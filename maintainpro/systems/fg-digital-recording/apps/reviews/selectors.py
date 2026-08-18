"""Permission-aware Supervisor review selectors (Phase 09A + 09C queues)."""

from __future__ import annotations

import datetime as dt
import uuid
from typing import Any, Literal

from django.core.exceptions import PermissionDenied
from django.db.models import QuerySet
from django.utils import timezone

from apps.access_control.services import (
    organization_ids_with_permission,
    user_has_permission,
)
from apps.accounts.models import User
from apps.checklists.compat_queries import load_sections_with_items_and_options
from apps.checklists.models import ChecklistSection
from apps.core.persistence import latest_ids_by_parent
from apps.recording.models import (
    ChecklistRecordStatus,
    ChecklistSubmission,
    ChecklistSubmissionResponse,
)
from apps.recording.repeating import responses_by_key
from apps.recording.snapshot_display import render_snapshot_sections
from apps.reviews.governance import (
    QUEUE_PENDING,
    QUEUE_RESUBMISSION,
    get_governance_policy,
    governance_context_for_submission,
    resolve_review_due,
)
from apps.reviews.models import SupervisorReview, SupervisorReviewGovernancePolicy
from apps.reviews.services import (
    REVIEW_CHECKLIST_SUBMISSION,
    submission_authorization_scope,
)

QueueKind = Literal["pending", "overdue", "resubmission"]


def actor_can_access_review_module(actor: User | None) -> bool:
    return bool(organization_ids_with_permission(actor, REVIEW_CHECKLIST_SUBMISSION))


def _base_pending_queryset(org_ids: set[uuid.UUID]) -> QuerySet[ChecklistSubmission]:
    """Unreviewed SUBMITTED latest-per-record submissions (no OuterRef/Subquery)."""
    candidates = ChecklistSubmission.objects.filter(
        checklist_record__organization_id__in=org_ids,
        checklist_record__status=ChecklistRecordStatus.SUBMITTED,
        supervisor_review__isnull=True,
    )
    record_ids = list(candidates.values_list("checklist_record_id", flat=True).distinct())
    latest_ids = latest_ids_by_parent(
        model=ChecklistSubmission,
        parent_field="checklist_record_id",
        number_field="submission_number",
        parent_ids=record_ids,
    )
    return (
        ChecklistSubmission.objects.select_related(
            "submitted_by",
            "checklist_record",
            "checklist_record__organization",
            "checklist_record__checklist_task",
            "checklist_record__checklist_task__checklist_template",
            "checklist_record__checklist_task__checklist_version",
        )
        .filter(
            pk__in=latest_ids,
            supervisor_review__isnull=True,
            checklist_record__status=ChecklistRecordStatus.SUBMITTED,
        )
        .order_by("-submitted_at")
    )


def list_supervisor_reviewable_submissions(
    actor: User | None,
) -> QuerySet[ChecklistSubmission]:
    """
    SUBMITTED submissions without a SupervisorReview, Organization-scoped once.

    Phase 09C: only the latest submission per record is reviewable in queues.
    """
    if actor is None or not getattr(actor, "is_authenticated", False) or not actor.is_active:
        return ChecklistSubmission.objects.none()

    org_ids = organization_ids_with_permission(actor, REVIEW_CHECKLIST_SUBMISSION)
    if not org_ids:
        return ChecklistSubmission.objects.none()

    return _base_pending_queryset(set(org_ids))


def list_supervisor_review_queue(
    actor: User | None,
    *,
    queue: QueueKind | str = QUEUE_PENDING,
    as_of: dt.datetime | None = None,
) -> list[ChecklistSubmission]:
    """
    Pending / overdue / resubmission queues.

    Overdue requires configured review_sla_minutes (never invented).
    Resubmission = pending latest submissions with submission_number > 1.
    """
    pending = list(list_supervisor_reviewable_submissions(actor))
    kind = (queue or QUEUE_PENDING).strip().lower()
    if kind == QUEUE_PENDING:
        return pending
    if kind == QUEUE_RESUBMISSION:
        return [row for row in pending if int(row.submission_number) > 1]

    instant = as_of or timezone.now()
    overdue_rows: list[ChecklistSubmission] = []
    policy_cache: dict[uuid.UUID, SupervisorReviewGovernancePolicy | None] = {}
    for row in pending:
        org_id = row.checklist_record.organization_id
        if org_id not in policy_cache:
            policy_cache[org_id] = get_governance_policy(org_id)
        due = resolve_review_due(submission=row, as_of=instant, policy=policy_cache[org_id])
        if due.is_overdue and due.due_at is not None:
            row.review_due_at = due.due_at  # type: ignore[attr-defined]
            row.review_sla_minutes = due.sla_minutes  # type: ignore[attr-defined]
            overdue_rows.append(row)
    return overdue_rows


def submission_is_latest_for_record(submission: ChecklistSubmission) -> bool:
    latest = (
        ChecklistSubmission.objects.filter(checklist_record_id=submission.checklist_record_id)
        .order_by("-submission_number", "-submitted_at")
        .values_list("id", flat=True)
        .first()
    )
    return latest == submission.id


def annotate_queue_row_due(
    submissions: list[ChecklistSubmission],
    *,
    as_of: dt.datetime | None = None,
) -> list[dict[str, Any]]:
    """Attach due evaluation for queue display without inventing SLA."""
    instant = as_of or timezone.now()
    policy_cache: dict[uuid.UUID, SupervisorReviewGovernancePolicy | None] = {}
    rows: list[dict[str, Any]] = []
    for submission in submissions:
        org_id = submission.checklist_record.organization_id
        if org_id not in policy_cache:
            policy_cache[org_id] = get_governance_policy(org_id)
        due = resolve_review_due(
            submission=submission,
            as_of=instant,
            policy=policy_cache[org_id],
        )
        rows.append(
            {
                "submission": submission,
                "review_due_at": due.due_at,
                "review_sla_minutes": due.sla_minutes,
                "is_overdue": due.is_overdue if due.due_at is not None else False,
                "is_resubmission": int(submission.submission_number) > 1,
            }
        )
    return rows


def get_checklist_submission_for_review(
    actor: User | None, submission_id: uuid.UUID
) -> ChecklistSubmission | None:
    submission = (
        ChecklistSubmission.objects.select_related(
            "submitted_by",
            "checklist_record",
            "checklist_record__organization",
            "checklist_record__checklist_task",
            "checklist_record__checklist_task__organization",
            "checklist_record__checklist_task__checklist_template",
            "checklist_record__checklist_task__checklist_version",
            "supervisor_review",
            "supervisor_review__reviewed_by",
        )
        .filter(pk=submission_id)
        .first()
    )
    if submission is None:
        return None
    if not user_has_permission(
        actor,
        REVIEW_CHECKLIST_SUBMISSION,
        scope=submission_authorization_scope(submission),
    ):
        raise PermissionDenied("Permission denied.")
    return submission


def get_supervisor_review(actor: User | None, review_id: uuid.UUID) -> SupervisorReview | None:
    review = (
        SupervisorReview.objects.select_related(
            "organization",
            "reviewed_by",
            "checklist_submission",
            "checklist_submission__submitted_by",
            "checklist_submission__checklist_record",
            "checklist_submission__checklist_record__organization",
            "checklist_submission__checklist_record__checklist_task",
            "checklist_submission__checklist_record__checklist_task__checklist_template",
            "checklist_submission__checklist_record__checklist_task__checklist_version",
        )
        .filter(pk=review_id)
        .first()
    )
    if review is None:
        return None
    if not user_has_permission(
        actor,
        REVIEW_CHECKLIST_SUBMISSION,
        scope=submission_authorization_scope(review.checklist_submission),
    ):
        raise PermissionDenied("Permission denied.")
    return review


def _load_sections(version_id: uuid.UUID) -> list[ChecklistSection]:
    return load_sections_with_items_and_options(version_id)


def load_submission_review_context(
    actor: User | None, submission_id: uuid.UUID
) -> dict[str, Any] | None:
    """Review detail payload using immutable submission snapshots."""
    submission = get_checklist_submission_for_review(actor, submission_id)
    if submission is None:
        return None

    record = submission.checklist_record
    if record.status != ChecklistRecordStatus.SUBMITTED:
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

    existing_review = (
        SupervisorReview.objects.select_related("reviewed_by")
        .filter(checklist_submission_id=submission.id)
        .first()
    )

    governance = None
    if actor is not None and getattr(actor, "is_authenticated", False):
        governance = governance_context_for_submission(actor=actor, submission=submission)

    return {
        "submission": submission,
        "record": record,
        "task": record.checklist_task,
        "sections": sections,
        "snapshot_responses": snapshot_responses,
        "rendered_sections": render_snapshot_sections(sections, snapshot_responses),
        "review": existing_review,
        "governance": governance,
        "is_latest_submission": submission_is_latest_for_record(submission),
    }
