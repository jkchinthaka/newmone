"""Permission-aware checklist recording selectors."""

from __future__ import annotations

import uuid
from typing import Any

from django.core.exceptions import PermissionDenied
from django.db.models import Prefetch, QuerySet

from apps.access_control.services import (
    organization_ids_with_permission,
    user_has_permission,
)
from apps.accounts.models import User
from apps.checklists.compat_queries import load_sections_with_items_and_options
from apps.checklists.models import ChecklistSection
from apps.core.persistence import prefetch_related_compat
from apps.recording.models import (
    ChecklistCorrection,
    ChecklistCorrectionStatus,
    ChecklistRecord,
    ChecklistRecordStatus,
    ChecklistResponse,
    ChecklistSubmission,
    ChecklistSubmissionResponse,
)
from apps.recording.repeating import (
    editor_sample_indexes,
    partition_definition_items,
    responses_by_key,
)
from apps.recording.services import collect_submission_completeness
from apps.recording.snapshot_display import render_snapshot_sections
from apps.reviews.models import SupervisorReview, SupervisorReviewDecision
from apps.scheduling.models import ChecklistTask, ChecklistTaskStatus
from apps.scheduling.selectors import actor_can_record_task, task_is_eligible_for_recording
from apps.scheduling.services import RECORD_CHECKLIST_TASK, task_authorization_scope


def actor_can_access_recording_module(actor: User | None) -> bool:
    return bool(organization_ids_with_permission(actor, RECORD_CHECKLIST_TASK))


def list_recordable_checklist_tasks(actor: User | None) -> QuerySet[ChecklistTask]:
    """
    PENDING tasks the actor may record, scoped by Organization permission once.

    Includes DRAFT and SUBMITTED records for Continue / View Submitted / Correction.
    """
    if actor is None or not getattr(actor, "is_authenticated", False) or not actor.is_active:
        return ChecklistTask.objects.none()

    org_ids = organization_ids_with_permission(actor, RECORD_CHECKLIST_TASK)
    if not org_ids:
        return ChecklistTask.objects.none()

    return prefetch_related_compat(
        ChecklistTask.objects.select_related(
            "organization",
            "checklist_template",
            "checklist_version",
            "checklist_record",
        ).filter(
            organization_id__in=org_ids,
            status=ChecklistTaskStatus.PENDING,
            checklist_version__status="PUBLISHED",
        ),
        Prefetch(
            "checklist_record__corrections",
            queryset=ChecklistCorrection.objects.filter(
                status=ChecklistCorrectionStatus.DRAFT
            ).select_related("source_submission"),
            to_attr="active_corrections",
        ),
    ).order_by("-created_at")


def get_recordable_task(actor: User | None, task_id: uuid.UUID) -> ChecklistTask | None:
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
        return None
    if not actor_can_record_task(actor, task):
        raise PermissionDenied("Permission denied.")
    if not task_is_eligible_for_recording(task):
        return None
    return task


def get_checklist_record(actor: User | None, record_id: uuid.UUID) -> ChecklistRecord | None:
    record = (
        ChecklistRecord.objects.select_related(
            "organization",
            "started_by",
            "checklist_task",
            "checklist_task__organization",
            "checklist_task__checklist_template",
            "checklist_task__checklist_version",
        )
        .filter(pk=record_id)
        .first()
    )
    if record is None:
        return None
    if not user_has_permission(
        actor, RECORD_CHECKLIST_TASK, scope=task_authorization_scope(record.checklist_task)
    ):
        raise PermissionDenied("Permission denied.")
    return record


def get_checklist_submission(
    actor: User | None, submission_id: uuid.UUID
) -> ChecklistSubmission | None:
    submission = (
        ChecklistSubmission.objects.select_related(
            "submitted_by",
            "checklist_record",
            "checklist_record__organization",
            "checklist_record__started_by",
            "checklist_record__checklist_task",
            "checklist_record__checklist_task__organization",
            "checklist_record__checklist_task__checklist_template",
            "checklist_record__checklist_task__checklist_version",
        )
        .filter(pk=submission_id)
        .first()
    )
    if submission is None:
        return None
    record = submission.checklist_record
    if not user_has_permission(
        actor, RECORD_CHECKLIST_TASK, scope=task_authorization_scope(record.checklist_task)
    ):
        raise PermissionDenied("Permission denied.")
    return submission


def get_latest_checklist_submission_for_record(
    actor: User | None, record_id: uuid.UUID
) -> ChecklistSubmission | None:
    record = get_checklist_record(actor, record_id)
    if record is None:
        return None
    return (
        ChecklistSubmission.objects.select_related("submitted_by", "checklist_record")
        .filter(checklist_record_id=record.id)
        .order_by("-submission_number")
        .first()
    )


def _load_sections(version_id: uuid.UUID) -> list[ChecklistSection]:
    return load_sections_with_items_and_options(version_id)


def load_record_editor_context(
    actor: User | None,
    record_id: uuid.UUID,
    *,
    requested_sample_counts: dict[uuid.UUID, int] | None = None,
) -> dict[str, Any] | None:
    """
    Efficient editor payload for DRAFT records.

    Uses select_related / prefetch_related — no per-item permission queries.
    """
    record = get_checklist_record(actor, record_id)
    if record is None:
        return None

    version = record.checklist_task.checklist_version
    sections = _load_sections(version.id)
    responses = responses_by_key(
        list(
            ChecklistResponse.objects.filter(checklist_record_id=record.id).select_related(
                "selected_option"
            )
        )
    )
    items = [item for section in sections for item in section.items.all()]
    _, groups, children_by_parent, _ = partition_definition_items(items)
    sample_indexes_by_group: dict[uuid.UUID, list[int]] = {}
    for group in groups:
        requested = None
        if requested_sample_counts and group.id in requested_sample_counts:
            requested = requested_sample_counts[group.id]
        sample_indexes_by_group[group.id] = editor_sample_indexes(
            group=group,
            children=children_by_parent.get(group.id, []),
            responses=responses,
            requested_count=requested,
        )
    completeness = collect_submission_completeness(record=record, items=items, responses=responses)
    return {
        "record": record,
        "task": record.checklist_task,
        "sections": sections,
        "responses": responses,
        "completeness": completeness,
        "sample_indexes_by_group": sample_indexes_by_group,
        "groups": groups,
        "children_by_parent": children_by_parent,
    }


def load_submitted_record_context(
    actor: User | None, record_id: uuid.UUID
) -> dict[str, Any] | None:
    """Read-only submitted view using immutable snapshot responses."""
    record = get_checklist_record(actor, record_id)
    if record is None:
        return None
    if record.status != ChecklistRecordStatus.SUBMITTED:
        return None

    submission = (
        ChecklistSubmission.objects.select_related("submitted_by")
        .filter(checklist_record_id=record.id)
        .order_by("-submission_number")
        .first()
    )
    if submission is None:
        return None

    version = record.checklist_task.checklist_version
    sections = _load_sections(version.id)
    snapshot_responses = responses_by_key(
        list(
            ChecklistSubmissionResponse.objects.filter(
                checklist_submission_id=submission.id
            ).select_related("selected_option")
        )
    )
    return {
        "record": record,
        "task": record.checklist_task,
        "submission": submission,
        "sections": sections,
        "snapshot_responses": snapshot_responses,
        "rendered_sections": render_snapshot_sections(sections, snapshot_responses),
    }


def get_checklist_correction(
    actor: User | None, correction_id: uuid.UUID
) -> ChecklistCorrection | None:
    correction = (
        ChecklistCorrection.objects.select_related(
            "organization",
            "started_by",
            "source_submission",
            "source_submission__submitted_by",
            "resulting_submission",
            "checklist_record",
            "checklist_record__organization",
            "checklist_record__checklist_task",
            "checklist_record__checklist_task__checklist_template",
            "checklist_record__checklist_task__checklist_version",
        )
        .filter(pk=correction_id)
        .first()
    )
    if correction is None:
        return None
    if not user_has_permission(
        actor,
        RECORD_CHECKLIST_TASK,
        scope=task_authorization_scope(correction.checklist_record.checklist_task),
    ):
        raise PermissionDenied("Permission denied.")
    return correction


def load_correction_editor_context(
    actor: User | None,
    correction_id: uuid.UUID,
    *,
    requested_sample_counts: dict[uuid.UUID, int] | None = None,
) -> dict[str, Any] | None:
    """Correction DRAFT editor using mutable working ChecklistResponse rows."""
    correction = get_checklist_correction(actor, correction_id)
    if correction is None:
        return None

    record = correction.checklist_record
    version = record.checklist_task.checklist_version
    sections = _load_sections(version.id)
    responses = responses_by_key(
        list(
            ChecklistResponse.objects.filter(checklist_record_id=record.id).select_related(
                "selected_option"
            )
        )
    )
    items = [item for section in sections for item in section.items.all()]
    _, groups, children_by_parent, _ = partition_definition_items(items)
    sample_indexes_by_group: dict[uuid.UUID, list[int]] = {}
    for group in groups:
        requested = None
        if requested_sample_counts and group.id in requested_sample_counts:
            requested = requested_sample_counts[group.id]
        sample_indexes_by_group[group.id] = editor_sample_indexes(
            group=group,
            children=children_by_parent.get(group.id, []),
            responses=responses,
            requested_count=requested,
        )
    completeness = collect_submission_completeness(record=record, items=items, responses=responses)

    source_review = (
        SupervisorReview.objects.select_related("reviewed_by")
        .filter(checklist_submission_id=correction.source_submission_id)
        .first()
    )
    next_number = correction.source_submission.submission_number + 1
    if correction.resulting_submission_id is not None:
        resulting = ChecklistSubmission.objects.filter(
            pk=correction.resulting_submission_id
        ).first()
        if resulting is not None:
            next_number = resulting.submission_number

    return {
        "correction": correction,
        "record": record,
        "task": record.checklist_task,
        "sections": sections,
        "responses": responses,
        "completeness": completeness,
        "sample_indexes_by_group": sample_indexes_by_group,
        "groups": groups,
        "children_by_parent": children_by_parent,
        "source_submission": correction.source_submission,
        "source_review": source_review,
        "next_submission_number": next_number,
        "SupervisorReviewDecision": SupervisorReviewDecision,
        "ChecklistCorrectionStatus": ChecklistCorrectionStatus,
    }


def load_record_history_context(actor: User | None, record_id: uuid.UUID) -> dict[str, Any] | None:
    """Submission / review / correction provenance for a record."""
    record = get_checklist_record(actor, record_id)
    if record is None:
        return None

    submissions = list(
        ChecklistSubmission.objects.select_related("submitted_by")
        .filter(checklist_record_id=record.id)
        .order_by("submission_number")
    )
    submission_ids = [s.id for s in submissions]
    reviews = {
        review.checklist_submission_id: review
        for review in SupervisorReview.objects.select_related("reviewed_by").filter(
            checklist_submission_id__in=submission_ids
        )
    }
    corrections = {
        c.source_submission_id: c
        for c in ChecklistCorrection.objects.select_related(
            "started_by", "resulting_submission"
        ).filter(checklist_record_id=record.id)
    }
    history_rows = []
    for submission in submissions:
        history_rows.append(
            {
                "submission": submission,
                "review": reviews.get(submission.id),
                "correction": corrections.get(submission.id),
            }
        )
    active_correction = (
        ChecklistCorrection.objects.select_related("source_submission")
        .filter(
            checklist_record_id=record.id,
            status=ChecklistCorrectionStatus.DRAFT,
        )
        .first()
    )
    return {
        "record": record,
        "task": record.checklist_task,
        "history_rows": history_rows,
        "active_correction": active_correction,
        "SupervisorReviewDecision": SupervisorReviewDecision,
        "ChecklistCorrectionStatus": ChecklistCorrectionStatus,
    }


def load_returned_submission_context(
    actor: User | None, submission_id: uuid.UUID
) -> dict[str, Any] | None:
    """Recorder-facing returned submission context with Start/Continue Correction."""
    submission = get_checklist_submission(actor, submission_id)
    if submission is None:
        return None
    record = submission.checklist_record
    if record.status != ChecklistRecordStatus.SUBMITTED:
        return None

    review = (
        SupervisorReview.objects.select_related("reviewed_by")
        .filter(checklist_submission_id=submission.id)
        .first()
    )
    correction = (
        ChecklistCorrection.objects.select_related("started_by", "resulting_submission")
        .filter(source_submission_id=submission.id)
        .first()
    )
    version = record.checklist_task.checklist_version
    sections = _load_sections(version.id)
    snapshot_responses = responses_by_key(
        list(
            ChecklistSubmissionResponse.objects.filter(
                checklist_submission_id=submission.id
            ).select_related("selected_option")
        )
    )
    latest = (
        ChecklistSubmission.objects.filter(checklist_record_id=record.id)
        .order_by("-submission_number")
        .first()
    )
    is_latest = latest is not None and latest.id == submission.id
    can_start = (
        is_latest
        and review is not None
        and review.decision == SupervisorReviewDecision.RETURNED_FOR_CORRECTION
        and (correction is None or correction.status == ChecklistCorrectionStatus.DRAFT)
    )
    return {
        "submission": submission,
        "record": record,
        "task": record.checklist_task,
        "review": review,
        "correction": correction,
        "sections": sections,
        "snapshot_responses": snapshot_responses,
        "rendered_sections": render_snapshot_sections(sections, snapshot_responses),
        "is_latest": is_latest,
        "can_start_or_continue": can_start,
        "SupervisorReviewDecision": SupervisorReviewDecision,
        "ChecklistCorrectionStatus": ChecklistCorrectionStatus,
    }
