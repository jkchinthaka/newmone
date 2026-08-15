"""Permission-aware checklist task selectors."""

from __future__ import annotations

import uuid
from datetime import datetime
from typing import Literal

from django.core.exceptions import PermissionDenied
from django.db.models import QuerySet
from django.utils import timezone

from apps.access_control.services import (
    organization_ids_with_permission,
    user_has_permission,
)
from apps.accounts.models import User
from apps.checklists.models import ChecklistTemplate, ChecklistVersion, ChecklistVersionStatus
from apps.organizations.models import Organization
from apps.scheduling.applicability import (
    MANAGE_APPLICABILITY,
    VIEW_APPLICABILITY,
    applicability_authorization_scope,
)
from apps.scheduling.due import (
    ChecklistDueDisplayState,
    derive_due_display_state,
    normalize_as_of,
)
from apps.scheduling.models import (
    ChecklistApplicabilityRule,
    ChecklistTask,
    ChecklistTaskStatus,
)
from apps.scheduling.services import (
    ASSIGN_CHECKLIST_TASK,
    MANAGE_CHECKLIST_TASK,
    RECORD_CHECKLIST_TASK,
    VIEW_CHECKLIST_TASK,
    task_authorization_scope,
)

StatusFilter = Literal["all", "PENDING", "CANCELLED"]
AssignmentQueue = Literal["my", "unassigned", "assigned", "all"]
DueStateFilter = Literal["all", "NOT_DUE", "DUE", "DUE_SOON", "OVERDUE"]


def actor_can_view_checklist_tasks(actor: User | None) -> bool:
    return bool(organization_ids_with_permission(actor, VIEW_CHECKLIST_TASK))


def actor_can_manage_checklist_tasks(actor: User | None) -> bool:
    return bool(organization_ids_with_permission(actor, MANAGE_CHECKLIST_TASK))


def actor_can_record_checklist_tasks(actor: User | None) -> bool:
    """True if actor has recording capability in any organization (Phase 08 prep)."""
    return bool(organization_ids_with_permission(actor, RECORD_CHECKLIST_TASK))


def actor_can_manage_task(actor: User | None, task: ChecklistTask) -> bool:
    if actor is None or not getattr(actor, "is_authenticated", False) or not actor.is_active:
        return False
    return user_has_permission(actor, MANAGE_CHECKLIST_TASK, scope=task_authorization_scope(task))


def actor_can_assign_task(actor: User | None, task: ChecklistTask) -> bool:
    if actor is None or not getattr(actor, "is_authenticated", False) or not actor.is_active:
        return False
    return user_has_permission(actor, ASSIGN_CHECKLIST_TASK, scope=task_authorization_scope(task))


def actor_can_record_task(actor: User | None, task: ChecklistTask) -> bool:
    """
    Capability check for future Phase 08 recording.

    Does not mutate task state and does not open recording UI in Phase 07B.
    """
    if actor is None or not getattr(actor, "is_authenticated", False) or not actor.is_active:
        return False
    return user_has_permission(actor, RECORD_CHECKLIST_TASK, scope=task_authorization_scope(task))


def task_is_eligible_for_recording(task: ChecklistTask) -> bool:
    """
    Future Phase 08 eligibility contract (documented + testable).

    Requires PENDING status and a historically bound PUBLISHED version.
    Does not grant permission by itself.
    """
    if task.status != ChecklistTaskStatus.PENDING:
        return False
    version = task.checklist_version
    return version.status == ChecklistVersionStatus.PUBLISHED


def manageable_organization_ids(actor: User | None) -> frozenset[uuid.UUID]:
    return frozenset(organization_ids_with_permission(actor, MANAGE_CHECKLIST_TASK))


def organizations_for_task_view(actor: User | None) -> QuerySet[Organization]:
    org_ids = organization_ids_with_permission(actor, VIEW_CHECKLIST_TASK)
    if not org_ids:
        return Organization.objects.none()
    return Organization.objects.filter(pk__in=org_ids).order_by("code")


def organizations_for_task_manage(actor: User | None) -> QuerySet[Organization]:
    org_ids = organization_ids_with_permission(actor, MANAGE_CHECKLIST_TASK)
    if not org_ids:
        return Organization.objects.none()
    return Organization.objects.filter(pk__in=org_ids).order_by("code")


def organizations_for_task_record(actor: User | None) -> QuerySet[Organization]:
    org_ids = organization_ids_with_permission(actor, RECORD_CHECKLIST_TASK)
    if not org_ids:
        return Organization.objects.none()
    return Organization.objects.filter(pk__in=org_ids).order_by("code")


def templates_for_task_manage(
    actor: User | None,
    *,
    organization: Organization | None = None,
) -> QuerySet[ChecklistTemplate]:
    org_ids = organization_ids_with_permission(actor, MANAGE_CHECKLIST_TASK)
    if not org_ids:
        return ChecklistTemplate.objects.none()
    qs = ChecklistTemplate.objects.filter(
        organization_id__in=org_ids, is_active=True
    ).select_related("organization")
    if organization is not None:
        if organization.id not in org_ids:
            return ChecklistTemplate.objects.none()
        qs = qs.filter(organization=organization)
    return qs.order_by("organization__code", "code")


def published_versions_for_template(
    actor: User | None,
    *,
    template: ChecklistTemplate,
) -> QuerySet[ChecklistVersion]:
    org_ids = organization_ids_with_permission(actor, MANAGE_CHECKLIST_TASK)
    if not org_ids or template.organization_id not in org_ids:
        return ChecklistVersion.objects.none()
    return (
        ChecklistVersion.objects.filter(
            template=template,
            status=ChecklistVersionStatus.PUBLISHED,
        )
        .select_related("template", "template__organization")
        .order_by("-version_number")
    )


def list_checklist_tasks(
    actor: User | None,
    *,
    organization: Organization | None = None,
    template: ChecklistTemplate | None = None,
    status: StatusFilter = "all",
    batch_reference: str | None = None,
    assignment_queue: AssignmentQueue = "all",
    due_state: DueStateFilter = "all",
    as_of: datetime | None = None,
) -> QuerySet[ChecklistTask]:
    if actor is None or not getattr(actor, "is_authenticated", False) or not actor.is_active:
        return ChecklistTask.objects.none()
    allowed = organization_ids_with_permission(actor, VIEW_CHECKLIST_TASK)
    if not allowed:
        return ChecklistTask.objects.none()

    qs = ChecklistTask.objects.select_related(
        "organization",
        "checklist_template",
        "checklist_version",
        "schedule",
        "assigned_user",
        "assigned_role",
        "assigned_department",
        "assigned_shift",
        "assigned_by",
        "checklist_record",
    ).filter(organization_id__in=allowed)

    if organization is not None:
        if organization.id not in allowed:
            return ChecklistTask.objects.none()
        qs = qs.filter(organization=organization)
    if template is not None:
        if template.organization_id not in allowed:
            return ChecklistTask.objects.none()
        qs = qs.filter(checklist_template=template)
    if status == ChecklistTaskStatus.PENDING:
        qs = qs.filter(status=ChecklistTaskStatus.PENDING)
    elif status == ChecklistTaskStatus.CANCELLED:
        qs = qs.filter(status=ChecklistTaskStatus.CANCELLED)
    if batch_reference:
        term = batch_reference.strip()
        if term:
            qs = qs.filter(batch_reference__icontains=term)

    # Queues are scoped by VIEW RBAC first — assignment never expands visibility.
    if assignment_queue == "my":
        # USER ownership only. Role/shift/dept/team membership resolution is DECISION REQUIRED.
        qs = qs.filter(assignee_kind="USER", assigned_user_id=actor.id)
    elif assignment_queue == "unassigned":
        qs = qs.filter(assignee_kind="")
    elif assignment_queue == "assigned":
        qs = qs.exclude(assignee_kind="")

    qs = _apply_due_state_filter(qs, due_state=due_state, as_of=as_of)
    return qs.order_by("-created_at")


def _apply_due_state_filter(
    qs: QuerySet[ChecklistTask],
    *,
    due_state: DueStateFilter,
    as_of: datetime | None,
) -> QuerySet[ChecklistTask]:
    """Filter by derived due display state (exact derivation; no invented SLAs)."""
    if due_state == "all":
        return qs
    from django.db.models import Q

    instant = normalize_as_of(as_of)
    base = qs.exclude(
        status__in=[ChecklistTaskStatus.CANCELLED, ChecklistTaskStatus.MISSED]
    ).select_related("schedule")
    # due_at or window_end_at can resolve a deadline — never invent one.
    base = base.filter(Q(due_at__isnull=False) | Q(window_end_at__isnull=False))
    if due_state == ChecklistDueDisplayState.OVERDUE:
        # Broad candidate prefilter; exact OVERDUE uses derive (exclusive overdue_at).
        base = base.filter(Q(due_at__lte=instant) | Q(window_end_at__lte=instant))
    candidates = list(base)
    ids = [
        task.id for task in candidates if derive_due_display_state(task, as_of=instant) == due_state
    ]
    return qs.filter(pk__in=ids)


def list_overdue_checklist_tasks(
    actor: User | None,
    *,
    organization: Organization | None = None,
    as_of: datetime | None = None,
) -> QuerySet[ChecklistTask]:
    """
    Overdue Tasks queue — derived from due_at < as_of.

    Excludes cancelled tasks and tasks without a due deadline.
    Overdue is not Non-Conformance.
    """
    return list_checklist_tasks(
        actor,
        organization=organization,
        due_state="OVERDUE",
        as_of=as_of or timezone.now(),
    )


def list_my_checklist_tasks(
    actor: User | None,
    *,
    organization: Organization | None = None,
) -> QuerySet[ChecklistTask]:
    """My Tasks queue — USER assignee match within VIEW scope."""
    return list_checklist_tasks(
        actor,
        organization=organization,
        assignment_queue="my",
    )


def list_unassigned_checklist_tasks(
    actor: User | None,
    *,
    organization: Organization | None = None,
) -> QuerySet[ChecklistTask]:
    """Unassigned Tasks queue within VIEW scope."""
    return list_checklist_tasks(
        actor,
        organization=organization,
        assignment_queue="unassigned",
    )


def list_assigned_checklist_tasks(
    actor: User | None,
    *,
    organization: Organization | None = None,
) -> QuerySet[ChecklistTask]:
    """Assigned Tasks queue (any assignee kind) within VIEW scope."""
    return list_checklist_tasks(
        actor,
        organization=organization,
        assignment_queue="assigned",
    )


def list_pending_checklist_tasks(
    actor: User | None,
    *,
    organization: Organization | None = None,
) -> QuerySet[ChecklistTask]:
    return list_checklist_tasks(
        actor,
        organization=organization,
        status="PENDING",
    )


def get_checklist_task(actor: User | None, task_id: uuid.UUID) -> ChecklistTask | None:
    task = (
        ChecklistTask.objects.select_related(
            "organization",
            "checklist_template",
            "checklist_version",
            "schedule",
        )
        .filter(pk=task_id)
        .first()
    )
    if task is None:
        return None
    if not user_has_permission(actor, VIEW_CHECKLIST_TASK, scope=task_authorization_scope(task)):
        raise PermissionDenied("Permission denied.")
    return task


def actor_can_view_applicability(actor: User | None) -> bool:
    return bool(organization_ids_with_permission(actor, VIEW_APPLICABILITY))


def actor_can_manage_applicability(actor: User | None) -> bool:
    return bool(organization_ids_with_permission(actor, MANAGE_APPLICABILITY))


def get_checklist_applicability_rule(
    actor: User | None, rule_id: uuid.UUID
) -> ChecklistApplicabilityRule | None:
    rule = (
        ChecklistApplicabilityRule.objects.select_related(
            "organization",
            "checklist_template",
            "checklist_version",
            "product",
            "site",
            "department",
            "shift",
        )
        .filter(pk=rule_id)
        .first()
    )
    if rule is None:
        return None
    if not user_has_permission(
        actor, VIEW_APPLICABILITY, scope=applicability_authorization_scope(rule)
    ):
        raise PermissionDenied("Permission denied.")
    return rule


def list_checklist_applicability_rules(
    actor: User | None,
    *,
    organization: Organization | None = None,
    active_only: bool = False,
) -> QuerySet[ChecklistApplicabilityRule]:
    if actor is None or not getattr(actor, "is_authenticated", False) or not actor.is_active:
        return ChecklistApplicabilityRule.objects.none()
    allowed = organization_ids_with_permission(actor, VIEW_APPLICABILITY)
    if not allowed:
        return ChecklistApplicabilityRule.objects.none()
    qs = ChecklistApplicabilityRule.objects.select_related(
        "organization",
        "checklist_template",
        "checklist_version",
        "product",
        "site",
        "department",
        "shift",
    ).filter(organization_id__in=allowed)
    if organization is not None:
        if organization.id not in allowed:
            return ChecklistApplicabilityRule.objects.none()
        qs = qs.filter(organization=organization)
    if active_only:
        qs = qs.filter(is_active=True)
    return qs.order_by("organization__code", "code")
