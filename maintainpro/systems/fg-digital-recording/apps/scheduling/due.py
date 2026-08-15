"""Phase 07H — checklist due / overdue foundation (derived display; no invented SLAs).

Configured windows on ChecklistTask:
  due_from           — optional start of due window
  due_at (due_to)    — due deadline
  due_soon_minutes   — optional configured threshold for DUE_SOON (never seeded)

Display states are derived at read time — not persisted as a redundant status:
  NOT_DUE | DUE | DUE_SOON | OVERDUE | None (inactive / no window)

Overdue is not Non-Conformance. No automatic NCR. No hardcoded SLA durations.
"""

from __future__ import annotations

import datetime as dt
import uuid
from dataclasses import dataclass
from typing import Any

from django.core.exceptions import ValidationError
from django.db import transaction
from django.db.models import TextChoices
from django.utils import timezone

from apps.access_control.services import Scope, require_permission
from apps.accounts.models import User
from apps.core.persistence import lock_queryset
from apps.scheduling.models import ChecklistTask, ChecklistTaskStatus
from apps.scheduling.services import MANAGE_CHECKLIST_TASK, _require_authenticated_actor
from apps.security_audit.services import record_event


class ChecklistTaskDueDisplayState(TextChoices):
    """Operator-facing due window state — derived, not persisted."""

    NOT_DUE = "NOT_DUE", "Not due"
    DUE = "DUE", "Due"
    DUE_SOON = "DUE_SOON", "Due soon"
    OVERDUE = "OVERDUE", "Overdue"


# Alias kept for callers that used the shorter name during 07H drafting.
ChecklistDueDisplayState = ChecklistTaskDueDisplayState

_INACTIVE_STATUSES = frozenset(
    {
        ChecklistTaskStatus.CANCELLED,
        ChecklistTaskStatus.MISSED,
    }
)


def _aware(value: dt.datetime) -> dt.datetime:
    if timezone.is_naive(value):
        return timezone.make_aware(value, timezone=dt.UTC)
    return value


def normalize_as_of(as_of: dt.datetime | None = None) -> dt.datetime:
    return _aware(as_of or timezone.now())


@dataclass(frozen=True, slots=True)
class DueWindow:
    """Configured due bounds for a task."""

    due_from: dt.datetime | None
    due_to: dt.datetime | None
    due_at: dt.datetime | None
    overdue_at: dt.datetime | None
    due_soon_minutes: int | None
    grace_minutes: int | None


def resolve_due_window(task: ChecklistTask) -> DueWindow:
    """
    Resolve due_from / due_to / due_at from configured task fields.

    Precedence:
    - due_from ← task.due_from, else window_start_at
    - due_to / due_at ← task.due_at, else window_end_at
    - due_soon_minutes ← task.due_soon_minutes (null = DUE_SOON unused)
    - grace ← schedule.due_grace_minutes when linked (null = no grace; not an invented SLA)
    """
    due_from = task.due_from or task.window_start_at
    due_at = task.due_at or task.window_end_at
    due_to = due_at

    grace_minutes: int | None = None
    schedule = getattr(task, "schedule", None)
    if schedule is not None and getattr(schedule, "due_grace_minutes", None) is not None:
        grace_minutes = int(schedule.due_grace_minutes)

    due_soon_minutes: int | None = None
    if task.due_soon_minutes is not None:
        due_soon_minutes = int(task.due_soon_minutes)

    overdue_at: dt.datetime | None = None
    if due_at is not None:
        overdue_at = _aware(due_at)
        if grace_minutes:
            overdue_at = overdue_at + dt.timedelta(minutes=grace_minutes)

    return DueWindow(
        due_from=_aware(due_from) if due_from is not None else None,
        due_to=_aware(due_to) if due_to is not None else None,
        due_at=_aware(due_at) if due_at is not None else None,
        overdue_at=overdue_at,
        due_soon_minutes=due_soon_minutes,
        grace_minutes=grace_minutes,
    )


def task_participates_in_due_queues(task: ChecklistTask) -> bool:
    """Cancelled / MISSED tasks are inactive for due/overdue queues."""
    return task.status not in _INACTIVE_STATUSES


def overdue_does_not_create_ncr() -> bool:
    """Explicit contract: overdue display/status never auto-creates NCR."""
    return True


def derive_due_display_state(
    task: ChecklistTask,
    *,
    as_of: dt.datetime | None = None,
    due_soon_minutes: int | None = None,
) -> str | None:
    """
    Derive NOT_DUE / DUE / DUE_SOON / OVERDUE at ``as_of``.

    Returns None when the task is inactive (CANCELLED/MISSED) or has no due_at/due_to.

    Boundaries (inclusive deadline at overdue_at):
      as_of < due_from                 → NOT_DUE
      due_from <= as_of < soon_start   → DUE
      soon_start <= as_of <= overdue_at → DUE_SOON (only when soon minutes configured)
      as_of > overdue_at               → OVERDUE

    When due_soon is not configured, the in-window state is DUE through overdue_at inclusive,
    then OVERDUE strictly after overdue_at.
    """
    if not task_participates_in_due_queues(task):
        return None

    moment = normalize_as_of(as_of)
    window = resolve_due_window(task)
    if window.overdue_at is None:
        return None

    soon = due_soon_minutes if due_soon_minutes is not None else window.due_soon_minutes

    if moment > window.overdue_at:
        return ChecklistTaskDueDisplayState.OVERDUE

    if window.due_from is not None and moment < window.due_from:
        return ChecklistTaskDueDisplayState.NOT_DUE

    if soon is not None and soon > 0:
        soon_start = window.overdue_at - dt.timedelta(minutes=int(soon))
        if window.due_from is not None and soon_start < window.due_from:
            soon_start = window.due_from
        if moment >= soon_start:
            return ChecklistTaskDueDisplayState.DUE_SOON

    return ChecklistTaskDueDisplayState.DUE


def due_badge_css_class(state: str | None) -> str:
    if state == ChecklistTaskDueDisplayState.OVERDUE:
        return "status-pill status-pill--danger"
    if state == ChecklistTaskDueDisplayState.DUE_SOON:
        return "status-pill status-pill--warning"
    if state == ChecklistTaskDueDisplayState.DUE:
        return "status-pill status-pill--info"
    if state == ChecklistTaskDueDisplayState.NOT_DUE:
        return "status-pill status-pill--muted"
    return "status-pill status-pill--neutral"


def due_display_badge_class(state: str | None) -> str:
    """Alias used by templates/tests."""
    return due_badge_css_class(state)


def due_display_label(state: str | None) -> str:
    if not state:
        return "No due window"
    try:
        return str(ChecklistTaskDueDisplayState(state).label)
    except ValueError:
        return state


def attach_due_display(
    tasks: list[ChecklistTask] | Any,
    *,
    as_of: dt.datetime | None = None,
) -> list[ChecklistTask]:
    """Attach derived due display attrs for templates (not persisted)."""
    moment = normalize_as_of(as_of)
    materialised = list(tasks)
    for task in materialised:
        state = derive_due_display_state(task, as_of=moment)
        task.due_display_state = state
        task.due_display_label = due_display_label(state)
        task.due_badge_class = due_badge_css_class(state)
        window = resolve_due_window(task)
        task.resolved_overdue_at = window.overdue_at
    return materialised


@transaction.atomic
def set_checklist_task_due_window(
    *,
    actor: User | None,
    task_id: uuid.UUID,
    due_from: dt.datetime | None = None,
    due_at: dt.datetime | None = None,
    due_soon_minutes: int | None = None,
    clear_due_from: bool = False,
    clear_due_at: bool = False,
    clear_due_soon_minutes: bool = False,
) -> ChecklistTask:
    """Configure due_from / due_at (due_to) / due_soon_minutes. Never invent SLAs."""
    user = _require_authenticated_actor(actor)
    task = lock_queryset(
        ChecklistTask.objects.select_related("organization", "schedule").filter(pk=task_id)
    ).first()
    if task is None:
        raise ValidationError({"task": "Checklist task not found."})
    require_permission(
        user, MANAGE_CHECKLIST_TASK, scope=Scope(organization_id=task.organization_id)
    )
    if clear_due_from:
        task.due_from = None
    elif due_from is not None:
        task.due_from = _aware(due_from)
    if clear_due_at:
        task.due_at = None
    elif due_at is not None:
        task.due_at = _aware(due_at)
    if clear_due_soon_minutes:
        task.due_soon_minutes = None
    elif due_soon_minutes is not None:
        if int(due_soon_minutes) < 1:
            raise ValidationError(
                {"due_soon_minutes": "due_soon_minutes must be >= 1 when configured."}
            )
        task.due_soon_minutes = int(due_soon_minutes)
    # Keep generation window columns aligned when configuring due bounds.
    if task.due_from is not None:
        task.window_start_at = task.due_from
    if task.due_at is not None:
        task.window_end_at = task.due_at
    if task.due_from is not None and task.due_at is not None and task.due_from > task.due_at:
        raise ValidationError({"due_from": "due_from cannot be later than due_at (due_to)."})
    task.full_clean()
    task.save(
        update_fields=[
            "due_from",
            "due_at",
            "due_soon_minutes",
            "window_start_at",
            "window_end_at",
            "updated_at",
        ]
    )
    record_event(
        event_type="CHECKLIST_TASK_DUE_WINDOW_UPDATED",
        actor=user,
        metadata={
            "checklist_task_id": str(task.id),
            "organization_id": str(task.organization_id),
            "due_from": task.due_from.isoformat() if task.due_from else None,
            "due_at": task.due_at.isoformat() if task.due_at else None,
            "due_soon_minutes": task.due_soon_minutes,
            "overdue_is_not_ncr": True,
            "no_invented_sla": True,
        },
    )
    return task


annotate_due_display = attach_due_display
