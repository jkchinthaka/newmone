"""Phase 07G — checklist task assignment (ownership only; never grants RBAC).

Assignment answers “who owns this work item?” Authorization remains deny-by-default
scoped RBAC. Being assigned does not grant view/manage/record permission.
"""

from __future__ import annotations

import uuid
from typing import Any

from django.core.exceptions import PermissionDenied, ValidationError
from django.utils import timezone

from apps.access_control.models import Role
from apps.access_control.services import require_permission, user_has_permission
from apps.accounts.models import User
from apps.core.persistence import atomic_fn, lock_queryset
from apps.organizations.models import Department, Shift
from apps.scheduling.models import (
    ChecklistTask,
    ChecklistTaskAssigneeKind,
    ChecklistTaskAssignmentAction,
    ChecklistTaskAssignmentEvent,
)
from apps.scheduling.services import (
    ASSIGN_CHECKLIST_TASK,
    VIEW_CHECKLIST_TASK,
    _require_authenticated_actor,
    task_authorization_scope,
)
from apps.security_audit.services import record_event

REASON_MAX_LENGTH = 255
TEAM_CODE_MAX_LENGTH = 64


def _norm_reason(reason: str | None) -> str:
    text = (reason or "").strip()
    if len(text) > REASON_MAX_LENGTH:
        raise ValidationError({"reason": f"reason must be at most {REASON_MAX_LENGTH} characters."})
    return text


def _snapshot(task: ChecklistTask) -> dict[str, Any]:
    return {
        "assignee_kind": (task.assignee_kind or "").strip(),
        "assigned_user_id": task.assigned_user_id,
        "assigned_role_id": task.assigned_role_id,
        "assigned_department_id": task.assigned_department_id,
        "assigned_shift_id": task.assigned_shift_id,
        "assigned_team_code": (task.assigned_team_code or "").strip(),
    }


def task_is_assigned(task: ChecklistTask) -> bool:
    return bool((task.assignee_kind or "").strip())


def _assignment_audit_metadata(
    task: ChecklistTask,
    event: ChecklistTaskAssignmentEvent,
    **extra: Any,
) -> dict[str, Any]:
    return {
        "checklist_task_id": str(task.id),
        "organization_id": str(task.organization_id),
        "assignment_event_id": str(event.id),
        "action": event.action,
        "assignee_kind": event.assignee_kind or "",
        "assigned_user_id": str(event.assigned_user_id) if event.assigned_user_id else None,
        "assigned_role_id": str(event.assigned_role_id) if event.assigned_role_id else None,
        "assigned_department_id": (
            str(event.assigned_department_id) if event.assigned_department_id else None
        ),
        "assigned_shift_id": str(event.assigned_shift_id) if event.assigned_shift_id else None,
        "assigned_team_code": event.assigned_team_code or "",
        "previous_assignee_kind": event.previous_assignee_kind or "",
        "previous_assigned_user_id": (
            str(event.previous_assigned_user_id) if event.previous_assigned_user_id else None
        ),
        "assigned_by_id": str(event.assigned_by_id),
        "assigned_at": event.assigned_at.isoformat(),
        "reason": event.reason or "",
        "assignment_grants_permission": False,
        **extra,
    }


def _resolve_targets(
    *,
    organization_id: uuid.UUID,
    assignee_kind: str,
    assigned_user_id: uuid.UUID | None,
    assigned_role_id: uuid.UUID | None,
    assigned_department_id: uuid.UUID | None,
    assigned_shift_id: uuid.UUID | None,
    assigned_team_code: str,
) -> dict[str, Any]:
    kind = (assignee_kind or "").strip().upper()
    if kind not in ChecklistTaskAssigneeKind.values:
        raise ValidationError({"assignee_kind": "Unsupported assignee_kind."})

    user = None
    role = None
    department = None
    shift = None
    team_code = (assigned_team_code or "").strip()

    if kind == ChecklistTaskAssigneeKind.USER:
        if assigned_user_id is None:
            raise ValidationError({"assigned_user": "USER assignment requires assigned_user."})
        user = User.objects.filter(pk=assigned_user_id).first()
        if user is None or not user.is_active:
            raise ValidationError({"assigned_user": "Assigned user not found or inactive."})
        if assigned_role_id or assigned_department_id or assigned_shift_id or team_code:
            raise ValidationError(
                {"assignee_kind": "USER assignment must not set role/department/shift/team."}
            )
    elif kind == ChecklistTaskAssigneeKind.ROLE:
        if assigned_role_id is None:
            raise ValidationError({"assigned_role": "ROLE assignment requires assigned_role."})
        role = Role.objects.filter(pk=assigned_role_id).first()
        if role is None or not role.is_active:
            raise ValidationError({"assigned_role": "Assigned role not found or inactive."})
        if assigned_user_id or assigned_department_id or assigned_shift_id or team_code:
            raise ValidationError(
                {"assignee_kind": "ROLE assignment must not set user/department/shift/team."}
            )
    elif kind == ChecklistTaskAssigneeKind.DEPARTMENT:
        if assigned_department_id is None:
            raise ValidationError(
                {"assigned_department": "DEPARTMENT assignment requires assigned_department."}
            )
        department = Department.objects.filter(pk=assigned_department_id).first()
        if department is None or not department.is_active:
            raise ValidationError(
                {"assigned_department": "Assigned department not found or inactive."}
            )
        if department.organization_id != organization_id:
            raise ValidationError(
                {"assigned_department": "Department must belong to the task organization."}
            )
        if assigned_user_id or assigned_role_id or assigned_shift_id or team_code:
            raise ValidationError(
                {"assignee_kind": "DEPARTMENT assignment must not set user/role/shift/team."}
            )
    elif kind == ChecklistTaskAssigneeKind.SHIFT:
        if assigned_shift_id is None:
            raise ValidationError({"assigned_shift": "SHIFT assignment requires assigned_shift."})
        shift = Shift.objects.filter(pk=assigned_shift_id).first()
        if shift is None or not shift.is_active:
            raise ValidationError({"assigned_shift": "Assigned shift not found or inactive."})
        if shift.organization_id != organization_id:
            raise ValidationError({"assigned_shift": "Shift must belong to the task organization."})
        if assigned_user_id or assigned_role_id or assigned_department_id or team_code:
            raise ValidationError(
                {"assignee_kind": "SHIFT assignment must not set user/role/department/team."}
            )
    elif kind == ChecklistTaskAssigneeKind.TEAM:
        if not team_code:
            raise ValidationError(
                {
                    "assigned_team_code": (
                        "TEAM assignment requires opaque assigned_team_code. "
                        "Team master remains EVIDENCE REQUIRED."
                    )
                }
            )
        if len(team_code) > TEAM_CODE_MAX_LENGTH:
            raise ValidationError(
                {
                    "assigned_team_code": (
                        f"assigned_team_code must be at most {TEAM_CODE_MAX_LENGTH} characters."
                    )
                }
            )
        if assigned_user_id or assigned_role_id or assigned_department_id or assigned_shift_id:
            raise ValidationError(
                {"assignee_kind": "TEAM assignment must not set user/role/department/shift."}
            )
    else:
        raise ValidationError({"assignee_kind": "Unsupported assignee_kind."})

    return {
        "assignee_kind": kind,
        "assigned_user": user,
        "assigned_role": role,
        "assigned_department": department,
        "assigned_shift": shift,
        "assigned_team_code": team_code,
    }


def _clear_current_assignment(task: ChecklistTask) -> None:
    task.assignee_kind = ""
    task.assigned_user = None
    task.assigned_role = None
    task.assigned_department = None
    task.assigned_shift = None
    task.assigned_team_code = ""
    task.assigned_by = None
    task.assigned_at = None
    task.assignment_reason = ""


def _apply_targets(
    task: ChecklistTask, targets: dict[str, Any], *, actor: User, reason: str
) -> None:
    task.assignee_kind = targets["assignee_kind"]
    task.assigned_user = targets["assigned_user"]
    task.assigned_role = targets["assigned_role"]
    task.assigned_department = targets["assigned_department"]
    task.assigned_shift = targets["assigned_shift"]
    task.assigned_team_code = targets["assigned_team_code"]
    task.assigned_by = actor
    task.assigned_at = timezone.now()
    task.assignment_reason = reason


def _write_history(
    *,
    task: ChecklistTask,
    action: str,
    actor: User,
    reason: str,
    previous: dict[str, Any],
) -> ChecklistTaskAssignmentEvent:
    if task.assigned_at is None and action != ChecklistTaskAssignmentAction.UNASSIGN:
        raise ValidationError({"assigned_at": "Assignment timestamp is required."})
    assigned_at = task.assigned_at or timezone.now()
    event = ChecklistTaskAssignmentEvent(
        checklist_task=task,
        action=action,
        assignee_kind=task.assignee_kind or "",
        assigned_user_id=task.assigned_user_id,
        assigned_role_id=task.assigned_role_id,
        assigned_department_id=task.assigned_department_id,
        assigned_shift_id=task.assigned_shift_id,
        assigned_team_code=task.assigned_team_code or "",
        previous_assignee_kind=previous["assignee_kind"],
        previous_assigned_user_id=previous["assigned_user_id"],
        previous_assigned_role_id=previous["assigned_role_id"],
        previous_assigned_department_id=previous["assigned_department_id"],
        previous_assigned_shift_id=previous["assigned_shift_id"],
        previous_assigned_team_code=previous["assigned_team_code"],
        assigned_by=actor,
        assigned_at=assigned_at,
        reason=reason,
    )
    event.full_clean()
    event.save()  # type: ignore[no-untyped-call]
    return event


@atomic_fn
def assign_checklist_task(
    *,
    actor: User | None,
    task_id: uuid.UUID,
    assignee_kind: str,
    assigned_user_id: uuid.UUID | None = None,
    assigned_role_id: uuid.UUID | None = None,
    assigned_department_id: uuid.UUID | None = None,
    assigned_shift_id: uuid.UUID | None = None,
    assigned_team_code: str = "",
    reason: str = "",
) -> ChecklistTask:
    """
    Assign or reassign ownership. Does not grant RBAC to the assignee.

    Requires ``scheduling.assign_checklisttask`` in the task organization scope.
    """
    user = _require_authenticated_actor(actor)
    reason_n = _norm_reason(reason)

    task = lock_queryset(
        ChecklistTask.objects.select_related("organization").filter(pk=task_id)
    ).first()
    if task is None:
        raise ValidationError({"task": "Checklist task not found."})

    require_permission(user, ASSIGN_CHECKLIST_TASK, scope=task_authorization_scope(task))

    targets = _resolve_targets(
        organization_id=task.organization_id,
        assignee_kind=assignee_kind,
        assigned_user_id=assigned_user_id,
        assigned_role_id=assigned_role_id,
        assigned_department_id=assigned_department_id,
        assigned_shift_id=assigned_shift_id,
        assigned_team_code=assigned_team_code,
    )

    previous = _snapshot(task)
    was_assigned = bool(previous["assignee_kind"])
    action = (
        ChecklistTaskAssignmentAction.REASSIGN
        if was_assigned
        else ChecklistTaskAssignmentAction.ASSIGN
    )

    _apply_targets(task, targets, actor=user, reason=reason_n)
    task.save(
        update_fields=[
            "assignee_kind",
            "assigned_user",
            "assigned_role",
            "assigned_department",
            "assigned_shift",
            "assigned_team_code",
            "assigned_by",
            "assigned_at",
            "assignment_reason",
            "updated_at",
        ]
    )
    event = _write_history(task=task, action=action, actor=user, reason=reason_n, previous=previous)
    audit_type = (
        "CHECKLIST_TASK_REASSIGNED"
        if action == ChecklistTaskAssignmentAction.REASSIGN
        else "CHECKLIST_TASK_ASSIGNED"
    )
    record_event(
        event_type=audit_type,
        actor=user,
        metadata=_assignment_audit_metadata(task, event),
    )
    return ChecklistTask.objects.select_related(
        "organization",
        "assigned_user",
        "assigned_role",
        "assigned_department",
        "assigned_shift",
        "assigned_by",
    ).get(pk=task.id)


@atomic_fn
def unassign_checklist_task(
    *,
    actor: User | None,
    task_id: uuid.UUID,
    reason: str = "",
) -> ChecklistTask:
    """Clear current ownership. Appends UNASSIGN history; never deletes prior events."""
    user = _require_authenticated_actor(actor)
    reason_n = _norm_reason(reason)

    task = lock_queryset(
        ChecklistTask.objects.select_related("organization").filter(pk=task_id)
    ).first()
    if task is None:
        raise ValidationError({"task": "Checklist task not found."})

    require_permission(user, ASSIGN_CHECKLIST_TASK, scope=task_authorization_scope(task))

    previous = _snapshot(task)
    if not previous["assignee_kind"]:
        raise ValidationError({"task": "Checklist task is already unassigned."})

    _clear_current_assignment(task)
    # Preserve who performed the unassign and when on the current snapshot.
    task.assigned_by = user
    task.assigned_at = timezone.now()
    task.assignment_reason = reason_n
    task.save(
        update_fields=[
            "assignee_kind",
            "assigned_user",
            "assigned_role",
            "assigned_department",
            "assigned_shift",
            "assigned_team_code",
            "assigned_by",
            "assigned_at",
            "assignment_reason",
            "updated_at",
        ]
    )
    event = _write_history(
        task=task,
        action=ChecklistTaskAssignmentAction.UNASSIGN,
        actor=user,
        reason=reason_n,
        previous=previous,
    )
    record_event(
        event_type="CHECKLIST_TASK_UNASSIGNED",
        actor=user,
        metadata=_assignment_audit_metadata(task, event),
    )
    return ChecklistTask.objects.select_related(
        "organization",
        "assigned_user",
        "assigned_role",
        "assigned_department",
        "assigned_shift",
        "assigned_by",
    ).get(pk=task.id)


def assignment_does_not_grant_permission(
    *,
    assignee: User | None,
    permission: str,
    task: ChecklistTask,
) -> bool:
    """
    Explicit guard helper for tests/docs: assignment alone never authorizes.

    Returns True when the assignee lacks ``permission`` on the task scope.
    """
    if assignee is None:
        return True
    return not user_has_permission(assignee, permission, scope=task_authorization_scope(task))


def list_assignment_history(
    *,
    actor: User | None,
    task_id: uuid.UUID,
) -> list[ChecklistTaskAssignmentEvent]:
    """Return append-only history for a task visible under view scope."""
    user = _require_authenticated_actor(actor)
    task = ChecklistTask.objects.filter(pk=task_id).first()
    if task is None:
        raise ValidationError({"task": "Checklist task not found."})
    if not user_has_permission(user, VIEW_CHECKLIST_TASK, scope=task_authorization_scope(task)):
        raise PermissionDenied("Permission denied.")
    return list(
        ChecklistTaskAssignmentEvent.objects.filter(checklist_task_id=task.id)
        .select_related(
            "assigned_by",
            "assigned_user",
            "assigned_role",
            "assigned_department",
            "assigned_shift",
            "previous_assigned_user",
        )
        .order_by("assigned_at", "created_at", "id")
    )
