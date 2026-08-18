"""QA final review services — create immutable manual dispositions only."""

from __future__ import annotations

import uuid
from typing import Any

from django.core.exceptions import PermissionDenied, ValidationError

from apps.access_control.services import Scope, require_permission
from apps.accounts.models import User
from apps.core.idempotency import execute_idempotent
from apps.core.persistence import TransitionConflictError, atomic, create_immutable_unique
from apps.quality.models import QAReview, QAReviewDecision
from apps.recording.models import ChecklistRecordStatus, ChecklistSubmission
from apps.reviews.models import SupervisorReview, SupervisorReviewDecision
from apps.scheduling.models import ChecklistTaskStatus
from apps.security_audit.services import record_event

QA_REVIEW_CHECKLIST_SUBMISSION = "quality.qa_review_checklistsubmission"

REVIEW_NOTE_MAX_LENGTH = 4000


def _require_authenticated_actor(actor: User | None) -> User:
    if actor is None or not getattr(actor, "is_authenticated", False) or not actor.is_active:
        raise PermissionDenied("Authentication required.")
    return actor


def submission_authorization_scope(submission: ChecklistSubmission) -> Scope:
    return Scope(organization_id=submission.checklist_record.organization_id)


def normalize_qa_review_note(raw: str | None) -> str:
    """Trim only — optional in Phase 10A; disposition-note policy remains EVIDENCE REQUIRED."""
    if raw is None:
        return ""
    value = str(raw).strip()
    if len(value) > REVIEW_NOTE_MAX_LENGTH:
        raise ValidationError(
            {"review_note": f"Review note must be at most {REVIEW_NOTE_MAX_LENGTH} characters."}
        )
    return value


def get_latest_submission_for_record(record_id: uuid.UUID) -> ChecklistSubmission | None:
    return (
        ChecklistSubmission.objects.filter(checklist_record_id=record_id)
        .order_by("-submission_number")
        .first()
    )


def _qa_review_metadata(review: QAReview) -> dict[str, Any]:
    submission = review.checklist_submission
    record = submission.checklist_record
    task = record.checklist_task
    return {
        "qa_review_id": str(review.id),
        "checklist_submission_id": str(submission.id),
        "submission_number": submission.submission_number,
        "checklist_record_id": str(record.id),
        "checklist_task_id": str(task.id),
        "organization_id": str(review.organization_id),
        "checklist_template_id": str(task.checklist_template_id),
        "checklist_version_id": str(task.checklist_version_id),
        "batch_reference": task.batch_reference,
        "supervisor_review_id": str(review.supervisor_review_id),
        "decision": review.decision,
    }


def create_qa_review(
    *,
    actor: User | None,
    submission_id: uuid.UUID,
    decision: str,
    review_note: str | None = None,
    idempotency_key: str = "",
) -> QAReview:
    """
    Record an immutable QAReview for the latest Supervisor-APPROVED submission.

    Manual disposition only — does not evaluate responses, call ERP/warehouse,
    start correction, change ChecklistRecord/ChecklistTask status, or notify.
    SoD rules remain EVIDENCE REQUIRED and are not enforced in Phase 10A.
    Concurrency: unique(submission) + create_immutable_unique (no select_for_update).
    """
    user = _require_authenticated_actor(actor)

    if decision not in QAReviewDecision.values:
        raise ValidationError({"decision": "Invalid QA review decision."})

    note = normalize_qa_review_note(review_note)
    peek = (
        ChecklistSubmission.objects.select_related("checklist_record__organization")
        .filter(pk=submission_id)
        .first()
    )
    if peek is None:
        raise ValidationError({"submission": "Checklist submission not found."})
    key = (idempotency_key or "").strip() or f"qa:{submission_id}:{decision}"

    def _create() -> QAReview:
        return _create_qa_review_body(
            user=user,
            submission_id=submission_id,
            decision=decision,
            note=note,
        )

    return execute_idempotent(
        organization=peek.checklist_record.organization,
        scope="quality.qa_review",
        key=key,
        fn=_create,
        reload=lambda ref: QAReview.objects.filter(pk=ref).first(),
        pending_fallback=lambda: QAReview.objects.filter(
            checklist_submission_id=submission_id, decision=decision
        ).first(),
    )


def _create_qa_review_body(
    *,
    user: User,
    submission_id: uuid.UUID,
    decision: str,
    note: str,
) -> QAReview:
    with atomic():
        submission = (
            ChecklistSubmission.objects.select_related(
                "checklist_record",
                "checklist_record__organization",
                "checklist_record__checklist_task",
                "checklist_record__checklist_task__checklist_template",
                "checklist_record__checklist_task__checklist_version",
                "submitted_by",
            )
            .filter(pk=submission_id)
            .first()
        )
        if submission is None:
            raise ValidationError({"submission": "Checklist submission not found."})

        record = submission.checklist_record
        require_permission(
            user,
            QA_REVIEW_CHECKLIST_SUBMISSION,
            scope=submission_authorization_scope(submission),
        )

        if record.status != ChecklistRecordStatus.SUBMITTED:
            raise ValidationError(
                {"submission": ("Only SUBMITTED checklist records may receive QA review.")}
            )

        task = record.checklist_task
        if task.status == ChecklistTaskStatus.CANCELLED:
            raise ValidationError({"task": "Cancelled checklist tasks cannot receive QA review."})
        if task.status != ChecklistTaskStatus.PENDING:
            raise ValidationError({"task": "Only PENDING checklist tasks may receive QA review."})

        latest = get_latest_submission_for_record(record.id)
        if latest is None or latest.id != submission.id:
            raise ValidationError(
                {
                    "submission": (
                        "QA review may act only on the latest ChecklistSubmission "
                        "for the record."
                    )
                }
            )

        supervisor = SupervisorReview.objects.filter(
            checklist_submission_id=submission.id
        ).first()
        if supervisor is None:
            raise ValidationError(
                {
                    "submission": (
                        "QA review requires an immutable Supervisor review on the submission."
                    )
                }
            )
        if supervisor.decision != SupervisorReviewDecision.APPROVED:
            raise ValidationError(
                {
                    "submission": (
                        "QA review requires SupervisorReview decision APPROVED. "
                        "RETURNED_FOR_CORRECTION and other decisions are not eligible."
                    )
                }
            )

        existing = QAReview.objects.filter(checklist_submission_id=submission.id).first()
        if existing is not None:
            if existing.decision == decision:
                return existing
            raise ValidationError(
                {
                    "decision": (
                        "This submission already has an immutable QA review "
                        f"({existing.decision}). Different decisions cannot overwrite it."
                    )
                }
            )

        try:
            review, created = create_immutable_unique(
                model=QAReview,
                create_kwargs={
                    "organization_id": record.organization_id,
                    "checklist_submission": submission,
                    "supervisor_review": supervisor,
                    "decision": decision,
                    "review_note": note,
                    "reviewed_by": user,
                },
                unique_lookup={"checklist_submission_id": submission.id},
                decision_field="decision",
                decision_value=decision,
            )
        except TransitionConflictError as exc:
            raise ValidationError(
                {
                    "decision": (
                        "This submission already has an immutable QA review "
                        "with a different decision. Different decisions cannot overwrite it."
                    )
                }
            ) from exc

        if created:
            meta = _qa_review_metadata(review)
            meta["concurrency_pattern"] = "optimistic_unique_insert"
            record_event(event_type="QA_REVIEW_COMPLETED", actor=user, metadata=meta)

    return QAReview.objects.select_related(
        "organization",
        "checklist_submission",
        "checklist_submission__checklist_record",
        "checklist_submission__checklist_record__checklist_task",
        "checklist_submission__checklist_record__checklist_task__checklist_template",
        "checklist_submission__checklist_record__checklist_task__checklist_version",
        "checklist_submission__submitted_by",
        "supervisor_review",
        "supervisor_review__reviewed_by",
        "reviewed_by",
    ).get(pk=review.id)
