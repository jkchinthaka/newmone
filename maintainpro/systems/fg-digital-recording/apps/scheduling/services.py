"""Checklist task orchestration services — create/cancel only; no recording."""

from __future__ import annotations

import uuid
from datetime import date, datetime
from typing import Any, cast

from django.core.exceptions import PermissionDenied, ValidationError
from django.db import IntegrityError
from django.utils import timezone

from apps.access_control.services import Scope, require_permission
from apps.accounts.models import User
from apps.checklists.models import (
    ChecklistTemplate,
    ChecklistVersion,
    ChecklistVersionStatus,
)
from apps.core.persistence import (
    TransitionConflictError,
    atomic,
    cas_status_transition,
    lock_queryset,
)
from apps.organizations.models import Organization
from apps.scheduling.generation import batch_occurrence_key
from apps.scheduling.models import (
    BATCH_REFERENCE_MAX_LENGTH,
    ChecklistTask,
    ChecklistTaskStatus,
    ChecklistTriggerType,
)
from apps.security_audit.services import record_event

VIEW_CHECKLIST_TASK = "scheduling.view_checklisttask"
MANAGE_CHECKLIST_TASK = "scheduling.manage_checklisttask"
RECORD_CHECKLIST_TASK = "scheduling.record_checklisttask"
ASSIGN_CHECKLIST_TASK = "scheduling.assign_checklisttask"


def _require_authenticated_actor(actor: User | None) -> User:
    if actor is None or not getattr(actor, "is_authenticated", False) or not actor.is_active:
        raise PermissionDenied("Authentication required.")
    return actor


def task_authorization_scope(task: ChecklistTask) -> Scope:
    return Scope(organization_id=task.organization_id)


def normalize_batch_reference(raw: str) -> str:
    """Trim only — do not invent case-insensitive batch semantics."""
    if raw is None:
        raise ValidationError({"batch_reference": "Batch reference cannot be blank."})
    value = str(raw).strip()
    if not value:
        raise ValidationError({"batch_reference": "Batch reference cannot be blank."})
    if len(value) > BATCH_REFERENCE_MAX_LENGTH:
        raise ValidationError(
            {
                "batch_reference": (
                    f"Batch reference must be at most {BATCH_REFERENCE_MAX_LENGTH} characters."
                )
            }
        )
    return value


def _task_metadata(task: ChecklistTask) -> dict[str, Any]:
    return {
        "checklist_task_id": str(task.id),
        "organization_id": str(task.organization_id),
        "checklist_template_id": str(task.checklist_template_id),
        "checklist_template_code": task.checklist_template.code,
        "checklist_version_id": str(task.checklist_version_id),
        "checklist_version_number": task.checklist_version.version_number,
        "batch_reference": task.batch_reference,
        "occurrence_key": getattr(task, "occurrence_key", ""),
        "trigger_type": getattr(task, "trigger_type", "BATCH"),
        "status": task.status,
    }


def create_batch_checklist_task(
    *,
    actor: User | None,
    organization_id: uuid.UUID,
    checklist_template_id: uuid.UUID,
    checklist_version_id: uuid.UUID,
    batch_reference: str,
    required_permission: str = MANAGE_CHECKLIST_TASK,
) -> ChecklistTask:
    """
    Create (or return idempotently) a PENDING checklist task for one batch reference.

    Requires an explicit PUBLISHED ChecklistVersion — never auto-selects latest.
    """
    user = _require_authenticated_actor(actor)
    batch_ref = normalize_batch_reference(batch_reference)

    organization = Organization.objects.filter(pk=organization_id).first()
    if organization is None:
        raise ValidationError({"organization": "Organization not found."})

    if required_permission not in {MANAGE_CHECKLIST_TASK, RECORD_CHECKLIST_TASK}:
        raise ValidationError({"permission": "Unsupported task-create permission."})
    require_permission(user, required_permission, scope=Scope(organization_id=organization.id))

    template = (
        ChecklistTemplate.objects.select_related("organization")
        .filter(pk=checklist_template_id)
        .first()
    )
    if template is None:
        raise ValidationError({"checklist_template": "Checklist template not found."})
    if template.organization_id != organization.id:
        raise ValidationError(
            {"checklist_template": ("Checklist template must belong to the selected organization.")}
        )
    if required_permission == RECORD_CHECKLIST_TASK:
        from apps.checklists.controlled_forms import is_controlled_form_code

        if not is_controlled_form_code(template.code):
            raise ValidationError(
                {
                    "checklist_template": (
                        "Recorders may open only registered controlled source forms."
                    )
                }
            )

    version = (
        ChecklistVersion.objects.select_related("template", "template__organization")
        .filter(pk=checklist_version_id)
        .first()
    )
    if version is None:
        raise ValidationError({"checklist_version": "Checklist version not found."})
    if version.template_id != template.id:
        raise ValidationError(
            {
                "checklist_version": (
                    "Checklist version must belong to the selected checklist template."
                )
            }
        )
    if version.status != ChecklistVersionStatus.PUBLISHED:
        raise ValidationError(
            {
                "checklist_version": (
                    "Checklist tasks may reference only PUBLISHED checklist versions. "
                    "DRAFT and RETIRED versions are not eligible."
                )
            }
        )

    occ_key = batch_occurrence_key(batch_ref)
    existing = (
        ChecklistTask.objects.select_related(
            "organization", "checklist_template", "checklist_version"
        )
        .filter(
            organization_id=organization.id,
            checklist_template_id=template.id,
            occurrence_key=occ_key,
        )
        .first()
    )
    if existing is None:
        existing = (
            ChecklistTask.objects.select_related(
                "organization", "checklist_template", "checklist_version"
            )
            .filter(
                organization_id=organization.id,
                checklist_template_id=template.id,
                batch_reference=batch_ref,
            )
            .first()
        )
    if existing is not None:
        if existing.checklist_version_id != version.id:
            raise ValidationError(
                {
                    "checklist_version": (
                        "A checklist task already exists for this organization, "
                        "template, and batch reference with a different published version. "
                        "Historical task definition cannot be changed."
                    )
                }
            )
        return existing

    for _attempt in range(8):
        try:
            with atomic():
                task = ChecklistTask(
                    organization=organization,
                    checklist_template=template,
                    checklist_version=version,
                    batch_reference=batch_ref,
                    trigger_type=ChecklistTriggerType.BATCH,
                    occurrence_key=occ_key,
                    status=ChecklistTaskStatus.PENDING,
                )
                task.full_clean()
                task.save()
                record_event(
                    event_type="CHECKLIST_TASK_CREATED",
                    actor=user,
                    metadata=_task_metadata(task),
                )
            return ChecklistTask.objects.select_related(
                "organization", "checklist_template", "checklist_version"
            ).get(pk=task.id)
        except (IntegrityError, ValidationError) as exc:
            # Mongo full_clean raises ValidationError for UniqueConstraint before save;
            # concurrent insert may also surface IntegrityError / E11000.
            text = str(exc).lower()
            err_dict = getattr(exc, "message_dict", None) or getattr(exc, "error_dict", None) or {}
            messages = " ".join(str(m) for m in getattr(exc, "messages", ()) or ()).lower()
            blob = f"{text} {messages} {err_dict}".lower()
            is_unique = isinstance(exc, IntegrityError) or any(
                m in blob
                for m in (
                    "already exists",
                    "unique",
                    "occurrence_key",
                    "batch_reference",
                    "sched_task_org_tmpl",
                    "duplicate",
                    "e11000",
                    "constraint",
                )
            )
            if not is_unique:
                raise
            raced = (
                ChecklistTask.objects.select_related(
                    "organization", "checklist_template", "checklist_version"
                )
                .filter(
                    organization_id=organization.id,
                    checklist_template_id=template.id,
                    occurrence_key=occ_key,
                )
                .first()
            )
            if raced is None:
                raced = (
                    ChecklistTask.objects.select_related(
                        "organization", "checklist_template", "checklist_version"
                    )
                    .filter(
                        organization_id=organization.id,
                        checklist_template_id=template.id,
                        batch_reference=batch_ref,
                    )
                    .first()
                )
            if raced is not None:
                if raced.checklist_version_id != version.id:
                    raise ValidationError(
                        {
                            "checklist_version": (
                                "A checklist task already exists for this organization, "
                                "template, and batch reference with a different published version. "
                                "Historical task definition cannot be changed."
                            )
                        }
                    ) from None
                return raced
            # Winner not visible yet — brief retry.
            continue

    raise ValidationError(
        {
            "batch_reference": (
                "Unable to create checklist task due to a concurrent duplicate. Retry shortly."
            )
        }
    )


def create_batch_checklist_task_using_effective_version(
    *,
    actor: User | None,
    organization_id: uuid.UUID,
    checklist_template_id: uuid.UUID,
    batch_reference: str,
    as_of: datetime | None = None,
) -> ChecklistTask:
    """
    Create a task using Phase 07D deterministic effective-version selection.

    ``as_of`` is caller-supplied (APR-015 unresolved — do not invent which
    business event supplies it). Raises ValidationError when outcome is not
    exactly ONE_ELIGIBLE_VERSION (NO_ELIGIBLE_VERSION / OVERLAPPING / BLOCKED).

    Explicit UUID path ``create_batch_checklist_task`` remains for 07A.
    """
    from datetime import datetime

    from apps.checklists.effective_version import assert_exactly_one_effective_version

    if as_of is not None and not isinstance(as_of, datetime):
        raise ValidationError({"as_of": "as_of must be a datetime or None."})

    version = assert_exactly_one_effective_version(
        template_id=checklist_template_id,
        as_of=as_of,
    )
    return create_batch_checklist_task(
        actor=actor,
        organization_id=organization_id,
        checklist_template_id=checklist_template_id,
        checklist_version_id=version.id,
        batch_reference=batch_reference,
    )


def cancel_checklist_task(*, actor: User | None, task_id: uuid.UUID) -> ChecklistTask:
    """Cancel a PENDING task. Soft cancel only — never hard-delete."""
    user = _require_authenticated_actor(actor)

    with atomic():
        task = lock_queryset(
            ChecklistTask.objects.select_related(
                "organization", "checklist_template", "checklist_version"
            ).filter(pk=task_id)
        ).first()
        if task is None:
            raise ValidationError({"task": "Checklist task not found."})

        require_permission(user, MANAGE_CHECKLIST_TASK, scope=task_authorization_scope(task))

        if task.status == ChecklistTaskStatus.CANCELLED:
            return cast(ChecklistTask, task)
        # OVERDUE/MISSED remain cancellable orchestration states (no NCR implied).
        if task.status not in {
            ChecklistTaskStatus.PENDING,
            ChecklistTaskStatus.OVERDUE,
            ChecklistTaskStatus.MISSED,
        }:
            raise ValidationError(
                {"status": f"Cannot cancel checklist task in status {task.status}."}
            )

        from_status = task.status
        now = timezone.now()
        try:
            cas_status_transition(
                ChecklistTask,
                pk=task.pk,
                from_status=from_status,
                to_status=ChecklistTaskStatus.CANCELLED,
                extra_updates={"updated_at": now},
            )
        except TransitionConflictError as exc:
            fresh = ChecklistTask.objects.filter(pk=task_id).first()
            if fresh is not None and fresh.status == ChecklistTaskStatus.CANCELLED:
                return fresh  # type: ignore[no-any-return]
            raise ValidationError({"status": "Checklist task was updated concurrently."}) from exc
        task.refresh_from_db()
        record_event(
            event_type="CHECKLIST_TASK_CANCELLED",
            actor=user,
            metadata=_task_metadata(task),
        )
        return cast(ChecklistTask, task)


# --- Phase 07C checklist applicability (re-export engine API) ---


def ensure_controlled_daily_task(
    *,
    actor: User | None,
    organization_id: uuid.UUID,
    form_code: str,
    record_date: date,
    room_key: str = "",
) -> ChecklistTask:
    """Idempotent daily task for a SOURCE RECEIVED controlled form.

    Recorders may open today's form without manage_checklisttask. Only registered
    controlled-form codes are eligible.
    """
    from apps.checklists.controlled_forms import is_controlled_form_code

    user = _require_authenticated_actor(actor)
    if not is_controlled_form_code(form_code):
        raise ValidationError({"form_code": "Not a registered controlled source form."})
    require_permission(user, RECORD_CHECKLIST_TASK, scope=Scope(organization_id=organization_id))
    if not isinstance(record_date, date):
        raise ValidationError({"record_date": "A calendar date is required."})
    template = ChecklistTemplate.objects.filter(
        organization_id=organization_id, code=form_code, is_active=True
    ).first()
    if template is None:
        raise ValidationError(
            {"form_code": "Controlled form template is not published in this organization."}
        )
    version = (
        ChecklistVersion.objects.filter(template=template, status=ChecklistVersionStatus.PUBLISHED)
        .order_by("-version_number")
        .first()
    )
    if version is None:
        raise ValidationError({"form_code": "No published version exists for this form."})
    slug = form_code.replace("/", "-")
    suffix = f"-{room_key}" if room_key else ""
    batch_ref = f"{slug}-{record_date.isoformat()}{suffix}"
    return create_batch_checklist_task(
        actor=user,
        organization_id=organization_id,
        checklist_template_id=template.id,
        checklist_version_id=version.id,
        batch_reference=batch_ref,
        required_permission=RECORD_CHECKLIST_TASK,
    )


# Phase 07G assignment API lives in apps.scheduling.assignment (not re-exported here)
# to avoid circular import with ASSIGN_CHECKLIST_TASK / task_authorization_scope.
