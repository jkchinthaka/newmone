"""Recurring / trigger-based checklist occurrence generation (Phase 07E).

Deterministic occurrence keys make Celery retries and catch-up replay-safe.
Frequencies are not invented — schedules carry administrator-configured windows
/ intervals only. Missed windows never auto-create NCR.
"""

from __future__ import annotations

import datetime as dt
import uuid
from dataclasses import dataclass, field
from typing import Any
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

from django.core.exceptions import PermissionDenied, ValidationError
from django.db import IntegrityError
from django.utils import timezone

from apps.access_control.services import Scope, require_permission
from apps.accounts.models import User
from apps.checklists.effective_version import assert_exactly_one_effective_version
from apps.checklists.models import ChecklistTemplate, ChecklistVersion, ChecklistVersionStatus
from apps.core.persistence import atomic, atomic_fn, lock_queryset
from apps.organizations.models import Organization, Shift
from apps.scheduling.models import (
    ChecklistMissedPolicy,
    ChecklistSchedule,
    ChecklistTask,
    ChecklistTaskStatus,
    ChecklistTriggerType,
)
from apps.security_audit.services import record_event

MANAGE_CHECKLIST_SCHEDULE = "scheduling.manage_checklistschedule"
VIEW_CHECKLIST_SCHEDULE = "scheduling.view_checklistschedule"
MANAGE_CHECKLIST_TASK = "scheduling.manage_checklisttask"

# Infrastructure catch-up lookback — not a business checklist frequency.
DEFAULT_CATCHUP_LOOKBACK = dt.timedelta(hours=36)


@dataclass(slots=True)
class OccurrencePlan:
    occurrence_key: str
    trigger_type: str
    window_start_at: dt.datetime
    window_end_at: dt.datetime
    due_at: dt.datetime
    shift: Shift | None = None
    status: str = ChecklistTaskStatus.PENDING


@dataclass(slots=True)
class GenerationResult:
    created: list[ChecklistTask] = field(default_factory=list)
    existing: list[ChecklistTask] = field(default_factory=list)
    skipped: list[str] = field(default_factory=list)
    marked: list[ChecklistTask] = field(default_factory=list)

    def to_dict(self) -> dict[str, Any]:
        return {
            "created_ids": [str(t.id) for t in self.created],
            "existing_ids": [str(t.id) for t in self.existing],
            "marked_ids": [str(t.id) for t in self.marked],
            "skipped": list(self.skipped),
            "created_count": len(self.created),
            "existing_count": len(self.existing),
            "never_auto_ncr": True,
        }


def _require_authenticated_actor(actor: User | None) -> User:
    if actor is None or not getattr(actor, "is_authenticated", False) or not actor.is_active:
        raise PermissionDenied("Authentication required.")
    return actor


def _tz(name: str) -> ZoneInfo:
    try:
        return ZoneInfo(name)
    except ZoneInfoNotFoundError as exc:
        raise ValidationError({"timezone_name": f"Unknown timezone: {name}"}) from exc


def _aware(value: dt.datetime) -> dt.datetime:
    if timezone.is_naive(value):
        return timezone.make_aware(value, timezone.get_current_timezone())
    return value


def batch_occurrence_key(batch_reference: str) -> str:
    return f"batch:{batch_reference.strip()}"


def shift_occurrence_key(
    *,
    trigger_type: str,
    schedule_id: uuid.UUID,
    shift_id: uuid.UUID,
    operational_date: dt.date,
) -> str:
    return f"{trigger_type.lower()}:{schedule_id}:{shift_id}:{operational_date.isoformat()}"


def scheduled_occurrence_key(
    *,
    schedule_id: uuid.UUID,
    window_start_at: dt.datetime,
) -> str:
    start = _aware(window_start_at).astimezone(dt.UTC)
    return f"scheduled:{schedule_id}:{start.strftime('%Y%m%dT%H%M%SZ')}"


def manual_occurrence_key(*, schedule_id: uuid.UUID, token: str) -> str:
    safe = (token or "").strip()
    if not safe:
        raise ValidationError({"manual_token": "Manual occurrence token cannot be blank."})
    return f"manual:{schedule_id}:{safe}"


def shift_instance_window(
    shift: Shift,
    *,
    as_of: dt.datetime,
    tz: ZoneInfo,
) -> tuple[dt.datetime, dt.datetime, dt.date]:
    """
    Bound one shift instance containing as_of (or the instance that started on as_of's date).

    Overnight: end is next calendar day. Operational date = local date of shift start.
    Official night-shift operational-day policy remains APR-004 / ASM-006 EVIDENCE REQUIRED;
    this is a provisional technical bound only.
    """
    local = _aware(as_of).astimezone(tz)
    start_date = local.date()
    start_dt = dt.datetime.combine(start_date, shift.start_time, tzinfo=tz)
    if shift.is_overnight:
        end_dt = dt.datetime.combine(start_date + dt.timedelta(days=1), shift.end_time, tzinfo=tz)
    else:
        end_dt = dt.datetime.combine(start_date, shift.end_time, tzinfo=tz)

    # If as_of is before today's start but within previous overnight instance, use prior day.
    if local < start_dt and shift.is_overnight:
        start_date = start_date - dt.timedelta(days=1)
        start_dt = dt.datetime.combine(start_date, shift.start_time, tzinfo=tz)
        end_dt = dt.datetime.combine(start_date + dt.timedelta(days=1), shift.end_time, tzinfo=tz)
    elif local < start_dt and not shift.is_overnight:
        # Before start today → still use today's planned instance for generation at/after start.
        pass
    elif local >= end_dt and shift.is_overnight is False:
        # After end — still identify today's instance for catch-up / missed marking.
        pass

    return start_dt, end_dt, start_date


def _grace_delta(schedule: ChecklistSchedule) -> dt.timedelta:
    if schedule.due_grace_minutes is None:
        return dt.timedelta(0)
    return dt.timedelta(minutes=int(schedule.due_grace_minutes))


def plan_shift_occurrence(
    schedule: ChecklistSchedule,
    *,
    as_of: dt.datetime,
) -> OccurrencePlan | None:
    if schedule.shift_id is None:
        return None
    shift = schedule.shift
    if shift is None or not shift.is_active:
        return None
    tz = _tz(schedule.timezone_name)
    start_dt, end_dt, op_date = shift_instance_window(shift, as_of=as_of, tz=tz)
    if schedule.trigger_type == ChecklistTriggerType.SHIFT_START:
        due_at = start_dt
        key = shift_occurrence_key(
            trigger_type=ChecklistTriggerType.SHIFT_START,
            schedule_id=schedule.id,
            shift_id=shift.id,
            operational_date=op_date,
        )
    elif schedule.trigger_type == ChecklistTriggerType.SHIFT_END:
        due_at = end_dt
        key = shift_occurrence_key(
            trigger_type=ChecklistTriggerType.SHIFT_END,
            schedule_id=schedule.id,
            shift_id=shift.id,
            operational_date=op_date,
        )
    else:
        return None

    status = ChecklistTaskStatus.PENDING
    as_of_a = _aware(as_of)
    grace_end = due_at + _grace_delta(schedule)
    if as_of_a > grace_end:
        if schedule.missed_policy == ChecklistMissedPolicy.SKIP:
            return None
        if schedule.missed_policy == ChecklistMissedPolicy.MARK_MISSED:
            status = ChecklistTaskStatus.MISSED
        else:
            status = ChecklistTaskStatus.OVERDUE

    # Only generate once due has been reached (or for catch-up past due).
    if as_of_a < due_at:
        return None

    return OccurrencePlan(
        occurrence_key=key,
        trigger_type=schedule.trigger_type,
        window_start_at=start_dt,
        window_end_at=end_dt,
        due_at=due_at,
        shift=shift,
        status=status,
    )


def plan_scheduled_occurrences(
    schedule: ChecklistSchedule,
    *,
    as_of: dt.datetime,
    lookback: dt.timedelta,
) -> list[OccurrencePlan]:
    """Plan SCHEDULED occurrences in (as_of - lookback, as_of] using configured window/interval."""
    if schedule.trigger_type != ChecklistTriggerType.SCHEDULED:
        return []
    tz = _tz(schedule.timezone_name)
    as_of_a = _aware(as_of).astimezone(tz)
    start_scan = as_of_a - lookback
    plans: list[OccurrencePlan] = []

    # Walk local dates in scan range.
    day = start_scan.date()
    end_day = as_of_a.date()
    while day <= end_day:
        if schedule.window_start_time and schedule.window_end_time:
            w_start = dt.datetime.combine(day, schedule.window_start_time, tzinfo=tz)
            if schedule.window_end_time > schedule.window_start_time:
                w_end = dt.datetime.combine(day, schedule.window_end_time, tzinfo=tz)
            else:
                # Overnight window (provisional technical rule).
                w_end = dt.datetime.combine(
                    day + dt.timedelta(days=1), schedule.window_end_time, tzinfo=tz
                )
            interval = schedule.interval_minutes
            if interval:
                cursor = w_start
                while cursor < w_end:
                    slot_end = min(cursor + dt.timedelta(minutes=interval), w_end)
                    plans.extend(_scheduled_plan_for_slot(schedule, cursor, slot_end, as_of_a))
                    cursor = slot_end
            else:
                plans.extend(_scheduled_plan_for_slot(schedule, w_start, w_end, as_of_a))
        elif schedule.interval_minutes:
            # Interval from midnight local — configuration only; not a seeded Nelna cadence.
            cursor = dt.datetime.combine(day, dt.time(0, 0), tzinfo=tz)
            day_end = cursor + dt.timedelta(days=1)
            step = dt.timedelta(minutes=int(schedule.interval_minutes))
            while cursor < day_end:
                slot_end = cursor + step
                plans.extend(_scheduled_plan_for_slot(schedule, cursor, slot_end, as_of_a))
                cursor = slot_end
        day += dt.timedelta(days=1)

    # Deduplicate by occurrence_key preserving order.
    seen: set[str] = set()
    unique: list[OccurrencePlan] = []
    for plan in plans:
        if plan.occurrence_key in seen:
            continue
        seen.add(plan.occurrence_key)
        unique.append(plan)
    return unique


def _scheduled_plan_for_slot(
    schedule: ChecklistSchedule,
    w_start: dt.datetime,
    w_end: dt.datetime,
    as_of_a: dt.datetime,
) -> list[OccurrencePlan]:
    if as_of_a < w_start:
        return []
    due_at = w_end
    grace_end = due_at + _grace_delta(schedule)
    status = ChecklistTaskStatus.PENDING
    if as_of_a > grace_end:
        if schedule.missed_policy == ChecklistMissedPolicy.SKIP:
            return []
        if schedule.missed_policy == ChecklistMissedPolicy.MARK_MISSED:
            status = ChecklistTaskStatus.MISSED
        else:
            status = ChecklistTaskStatus.OVERDUE
    key = scheduled_occurrence_key(schedule_id=schedule.id, window_start_at=w_start)
    return [
        OccurrencePlan(
            occurrence_key=key,
            trigger_type=ChecklistTriggerType.SCHEDULED,
            window_start_at=w_start,
            window_end_at=w_end,
            due_at=due_at,
            status=status,
        )
    ]


def _resolve_version(schedule: ChecklistSchedule, *, as_of: dt.datetime) -> ChecklistVersion:
    if schedule.checklist_version_id:
        version = schedule.checklist_version
        if version is None:
            raise ValidationError({"checklist_version": "Pinned checklist version not found."})
        if version.status != ChecklistVersionStatus.PUBLISHED:
            raise ValidationError(
                {"checklist_version": "Pinned schedule version must remain PUBLISHED."}
            )
        return version
    return assert_exactly_one_effective_version(
        template_id=schedule.checklist_template_id,
        as_of=as_of,
    )


def _task_metadata(task: ChecklistTask) -> dict[str, Any]:
    return {
        "checklist_task_id": str(task.id),
        "organization_id": str(task.organization_id),
        "checklist_template_id": str(task.checklist_template_id),
        "checklist_template_code": task.checklist_template.code,
        "checklist_version_id": str(task.checklist_version_id),
        "checklist_version_number": task.checklist_version.version_number,
        "batch_reference": task.batch_reference,
        "occurrence_key": task.occurrence_key,
        "trigger_type": task.trigger_type,
        "schedule_id": str(task.schedule_id) if task.schedule_id else None,
        "shift_id": str(task.shift_id) if task.shift_id else None,
        "status": task.status,
        "due_at": task.due_at.isoformat() if task.due_at else None,
    }


@atomic_fn
def upsert_occurrence_task(
    *,
    actor: User | None,
    schedule: ChecklistSchedule,
    plan: OccurrencePlan,
    as_of: dt.datetime,
) -> tuple[ChecklistTask, bool]:
    """
    Create or return existing task for occurrence_key (idempotent).

    Returns (task, created).
    """
    user = actor
    if user is not None:
        user = _require_authenticated_actor(user)
        require_permission(
            user,
            MANAGE_CHECKLIST_TASK,
            scope=Scope(organization_id=schedule.organization_id),
        )

    existing = (
        ChecklistTask.objects.select_related(
            "organization", "checklist_template", "checklist_version", "schedule", "shift"
        )
        .filter(
            organization_id=schedule.organization_id,
            checklist_template_id=schedule.checklist_template_id,
            occurrence_key=plan.occurrence_key,
        )
        .first()
    )
    if existing is not None:
        return existing, False

    version = _resolve_version(schedule, as_of=as_of)
    task = ChecklistTask(
        organization=schedule.organization,
        checklist_template=schedule.checklist_template,
        checklist_version=version,
        batch_reference="",
        schedule=schedule,
        trigger_type=plan.trigger_type,
        occurrence_key=plan.occurrence_key,
        shift=plan.shift,
        window_start_at=plan.window_start_at,
        window_end_at=plan.window_end_at,
        due_from=plan.window_start_at,
        due_at=plan.due_at,
        status=plan.status,
    )
    try:
        with atomic():
            task.full_clean()
            task.save()
    except (IntegrityError, ValidationError):
        raced = ChecklistTask.objects.filter(
            organization_id=schedule.organization_id,
            checklist_template_id=schedule.checklist_template_id,
            occurrence_key=plan.occurrence_key,
        ).first()
        if raced is None:
            raise
        return raced, False

    if user is not None:
        record_event(
            event_type="CHECKLIST_TASK_CREATED",
            actor=user,
            metadata=_task_metadata(task),
        )
    else:
        record_event(
            event_type="CHECKLIST_TASK_GENERATED",
            actor=None,
            metadata={**_task_metadata(task), "generator": "schedule_engine"},
        )
    return task, True


def generate_for_schedule(
    *,
    schedule: ChecklistSchedule,
    as_of: dt.datetime | None = None,
    lookback: dt.timedelta | None = None,
    actor: User | None = None,
) -> GenerationResult:
    """Generate due occurrences for one active schedule (replay-safe)."""
    result = GenerationResult()
    fresh = (
        ChecklistSchedule.objects.select_related(
            "organization", "checklist_template", "checklist_version", "shift"
        )
        .filter(pk=schedule.pk)
        .first()
    )
    if fresh is not None:
        schedule = fresh
    if not schedule.is_active:
        result.skipped.append("schedule_inactive")
        return result
    as_of_a = _aware(as_of or timezone.now())
    lookback = lookback or DEFAULT_CATCHUP_LOOKBACK

    plans: list[OccurrencePlan] = []
    if schedule.trigger_type in {
        ChecklistTriggerType.SHIFT_START,
        ChecklistTriggerType.SHIFT_END,
    }:
        # Catch-up: evaluate recent local days, but only keep occurrences whose
        # due_at falls in (as_of - lookback, as_of] — replay-safe, no inventing.
        days_back = max(1, int(lookback.total_seconds() // 86400) + 2)
        seen: set[str] = set()
        for delta_days in range(0, days_back):
            probe = as_of_a - dt.timedelta(days=delta_days)
            plan = plan_shift_occurrence(schedule, as_of=probe)
            if plan is None:
                continue
            if plan.occurrence_key in seen:
                continue
            due = _aware(plan.due_at)
            if due > as_of_a:
                continue
            if due < as_of_a - lookback:
                continue
            seen.add(plan.occurrence_key)
            plans.append(plan)
    elif schedule.trigger_type == ChecklistTriggerType.SCHEDULED:
        plans = plan_scheduled_occurrences(schedule, as_of=as_of_a, lookback=lookback)
    elif schedule.trigger_type == ChecklistTriggerType.MANUAL:
        result.skipped.append("manual_trigger_requires_explicit_token")
        return result
    else:
        result.skipped.append(f"unsupported_trigger:{schedule.trigger_type}")
        return result

    for plan in plans:
        # Skip future due beyond as_of already handled in planners.
        try:
            task, created = upsert_occurrence_task(
                actor=actor, schedule=schedule, plan=plan, as_of=as_of_a
            )
        except ValidationError as exc:
            result.skipped.append(f"blocked:{plan.occurrence_key}:{exc}")
            continue
        if created:
            result.created.append(task)
            if task.status in {ChecklistTaskStatus.OVERDUE, ChecklistTaskStatus.MISSED}:
                result.marked.append(task)
        else:
            result.existing.append(task)
    return result


def run_active_schedule_generation(
    *,
    as_of: dt.datetime | None = None,
    lookback: dt.timedelta | None = None,
    organization_id: uuid.UUID | None = None,
    actor: User | None = None,
) -> dict[str, Any]:
    """Replay-safe generation across active non-BATCH/MANUAL schedules."""
    as_of_a = _aware(as_of or timezone.now())
    qs = (
        ChecklistSchedule.objects.filter(is_active=True)
        .exclude(trigger_type__in=[ChecklistTriggerType.BATCH, ChecklistTriggerType.MANUAL])
        .select_related(
            "organization",
            "checklist_template",
            "checklist_version",
            "shift",
        )
    )
    if organization_id is not None:
        qs = qs.filter(organization_id=organization_id)

    aggregate = GenerationResult()
    schedule_count = 0
    for schedule in qs.iterator():
        schedule_count += 1
        partial = generate_for_schedule(
            schedule=schedule, as_of=as_of_a, lookback=lookback, actor=actor
        )
        aggregate.created.extend(partial.created)
        aggregate.existing.extend(partial.existing)
        aggregate.skipped.extend(partial.skipped)
        aggregate.marked.extend(partial.marked)

    payload = aggregate.to_dict()
    payload.update(
        {
            "as_of": as_of_a.isoformat(),
            "schedule_count": schedule_count,
            "replay_safe": True,
        }
    )
    record_event(
        event_type="CHECKLIST_SCHEDULE_GENERATION_RUN",
        actor=actor,
        metadata={
            "as_of": as_of_a.isoformat(),
            "schedule_count": schedule_count,
            "created_count": payload["created_count"],
            "existing_count": payload["existing_count"],
            "organization_id": str(organization_id) if organization_id else None,
            "never_auto_ncr": True,
        },
    )
    return payload


@atomic_fn
def create_checklist_schedule(
    *,
    actor: User | None,
    organization_id: uuid.UUID,
    code: str,
    name: str,
    checklist_template_id: uuid.UUID,
    trigger_type: str,
    checklist_version_id: uuid.UUID | None = None,
    shift_id: uuid.UUID | None = None,
    timezone_name: str = "UTC",
    window_start_time: dt.time | None = None,
    window_end_time: dt.time | None = None,
    interval_minutes: int | None = None,
    due_grace_minutes: int | None = None,
    missed_policy: str = ChecklistMissedPolicy.MARK_MISSED,
    notes: str = "",
    is_active: bool = True,
) -> ChecklistSchedule:
    user = _require_authenticated_actor(actor)
    org = Organization.objects.filter(pk=organization_id).first()
    if org is None:
        raise ValidationError({"organization": "Organization not found."})
    require_permission(user, MANAGE_CHECKLIST_SCHEDULE, scope=Scope(organization_id=org.id))
    template = ChecklistTemplate.objects.filter(pk=checklist_template_id).first()
    if template is None:
        raise ValidationError({"checklist_template": "Checklist template not found."})
    version = None
    if checklist_version_id is not None:
        version = ChecklistVersion.objects.filter(pk=checklist_version_id).first()
        if version is None:
            raise ValidationError({"checklist_version": "Checklist version not found."})
    shift = None
    if shift_id is not None:
        shift = Shift.objects.filter(pk=shift_id).first()
        if shift is None:
            raise ValidationError({"shift": "Shift not found."})
    resolved_tz_name = (timezone_name or "UTC").strip() or "UTC"
    _tz(resolved_tz_name)

    schedule = ChecklistSchedule(
        organization=org,
        code=(code or "").strip(),
        name=(name or "").strip(),
        checklist_template=template,
        checklist_version=version,
        trigger_type=trigger_type,
        shift=shift,
        timezone_name=resolved_tz_name,
        window_start_time=window_start_time,
        window_end_time=window_end_time,
        interval_minutes=interval_minutes,
        due_grace_minutes=due_grace_minutes,
        missed_policy=missed_policy,
        notes=(notes or "").strip(),
        is_active=is_active,
    )
    schedule.full_clean()
    schedule.save()
    record_event(
        event_type="CHECKLIST_SCHEDULE_CREATED",
        actor=user,
        metadata={
            "schedule_id": str(schedule.id),
            "organization_id": str(org.id),
            "code": schedule.code,
            "trigger_type": schedule.trigger_type,
            "shift_id": str(schedule.shift_id) if schedule.shift_id else None,
            "interval_minutes": schedule.interval_minutes,
            "missed_policy": schedule.missed_policy,
        },
    )
    return schedule


@atomic_fn
def deactivate_checklist_schedule(
    *, actor: User | None, schedule_id: uuid.UUID
) -> ChecklistSchedule:
    user = _require_authenticated_actor(actor)
    schedule = lock_queryset(
        ChecklistSchedule.objects.select_related("organization").filter(pk=schedule_id)
    ).first()
    if schedule is None:
        raise ValidationError({"schedule": "Checklist schedule not found."})
    require_permission(
        user,
        MANAGE_CHECKLIST_SCHEDULE,
        scope=Scope(organization_id=schedule.organization_id),
    )
    if not schedule.is_active:
        return schedule
    schedule.is_active = False
    schedule.save(update_fields=["is_active", "updated_at"])
    record_event(
        event_type="CHECKLIST_SCHEDULE_DEACTIVATED",
        actor=user,
        metadata={
            "schedule_id": str(schedule.id),
            "organization_id": str(schedule.organization_id),
            "code": schedule.code,
        },
    )
    return schedule


@atomic_fn
def create_manual_schedule_occurrence(
    *,
    actor: User | None,
    schedule_id: uuid.UUID,
    manual_token: str,
    as_of: dt.datetime | None = None,
) -> ChecklistTask:
    """Explicit MANUAL generation — still idempotent on (template, occurrence_key)."""
    user = _require_authenticated_actor(actor)
    schedule = (
        ChecklistSchedule.objects.select_related(
            "organization", "checklist_template", "checklist_version", "shift"
        )
        .filter(pk=schedule_id)
        .first()
    )
    if schedule is None:
        raise ValidationError({"schedule": "Checklist schedule not found."})
    if schedule.trigger_type != ChecklistTriggerType.MANUAL:
        raise ValidationError({"trigger_type": "Schedule trigger_type must be MANUAL."})
    require_permission(
        user,
        MANAGE_CHECKLIST_TASK,
        scope=Scope(organization_id=schedule.organization_id),
    )
    as_of_a = _aware(as_of or timezone.now())
    key = manual_occurrence_key(schedule_id=schedule.id, token=manual_token)
    plan = OccurrencePlan(
        occurrence_key=key,
        trigger_type=ChecklistTriggerType.MANUAL,
        window_start_at=as_of_a,
        window_end_at=as_of_a,
        due_at=as_of_a,
        status=ChecklistTaskStatus.PENDING,
    )
    task, _created = upsert_occurrence_task(actor=user, schedule=schedule, plan=plan, as_of=as_of_a)
    return task
