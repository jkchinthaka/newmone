"""Recording start Mongo concurrency spike — unique task→record without select_for_update.

Does not replace production ``start_checklist_recording`` yet.
"""

from __future__ import annotations

import uuid

from django.core.exceptions import PermissionDenied, ValidationError

from apps.access_control.services import require_permission
from apps.accounts.models import User
from apps.core.persistence import TransitionConflictError, atomic, create_immutable_unique
from apps.recording.models import ChecklistRecord, ChecklistRecordStatus
from apps.recording.services import (
    RECORD_CHECKLIST_TASK,
    _assert_task_recordable,
    _record_metadata,
    task_authorization_scope,
)
from apps.scheduling.models import ChecklistTask
from apps.security_audit.services import record_event


def start_checklist_recording_cas(
    *,
    actor: User | None,
    task_id: uuid.UUID,
) -> ChecklistRecord:
    """Idempotent record start using unique(task) + conflict re-read."""
    if actor is None or not getattr(actor, "is_authenticated", False) or not actor.is_active:
        raise PermissionDenied("Authentication required.")
    user = actor

    task = (
        ChecklistTask.objects.select_related(
            "organization",
            "checklist_template",
            "checklist_version",
        )
        .filter(pk=task_id)
        .first()
    )
    if task is None:
        raise ValidationError({"task": "Checklist task not found."})

    require_permission(user, RECORD_CHECKLIST_TASK, scope=task_authorization_scope(task))
    _assert_task_recordable(task)

    existing = (
        ChecklistRecord.objects.select_related(
            "organization",
            "checklist_task",
            "started_by",
        )
        .filter(checklist_task_id=task.id)
        .first()
    )
    if existing is not None:
        return existing

    with atomic():
        # Re-check under atomic boundary (no row lock).
        raced = ChecklistRecord.objects.filter(checklist_task_id=task.id).first()
        if raced is not None:
            return raced

        try:
            record, created = create_immutable_unique(
                model=ChecklistRecord,
                create_kwargs={
                    "organization_id": task.organization_id,
                    "checklist_task": task,
                    "status": ChecklistRecordStatus.DRAFT,
                    "started_by": user,
                },
                unique_lookup={"checklist_task_id": task.id},
                decision_field="checklist_task_id",
                decision_value=task.id,
            )
        except TransitionConflictError as exc:
            fallback = ChecklistRecord.objects.filter(checklist_task_id=task.id).first()
            if fallback is not None:
                return fallback
            raise ValidationError({"task": "Unable to start checklist recording."}) from exc

        if created:
            meta = _record_metadata(record)
            meta["concurrency_pattern"] = "optimistic_unique_insert"
            record_event(
                event_type="CHECKLIST_RECORD_STARTED",
                actor=user,
                metadata=meta,
            )

    return ChecklistRecord.objects.select_related(
        "organization",
        "checklist_task",
        "checklist_task__checklist_template",
        "checklist_task__checklist_version",
        "started_by",
    ).get(pk=record.id)
