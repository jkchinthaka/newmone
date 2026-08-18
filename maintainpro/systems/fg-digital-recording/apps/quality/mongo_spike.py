"""QA review Mongo concurrency spike — optimistic unique insert (no select_for_update).

Does not replace production ``create_qa_review`` yet. Proves RELEASE/HOLD/REJECT
races resolve to exactly one immutable disposition.
"""

from __future__ import annotations

import uuid
from typing import Any

from django.core.exceptions import PermissionDenied, ValidationError

from apps.access_control.services import require_permission
from apps.accounts.models import User
from apps.core.persistence import TransitionConflictError, atomic, create_immutable_unique
from apps.quality.models import QAReview, QAReviewDecision
from apps.quality.services import (
    QA_REVIEW_CHECKLIST_SUBMISSION,
    _qa_review_metadata,
    get_latest_submission_for_record,
    normalize_qa_review_note,
    submission_authorization_scope,
)
from apps.recording.models import ChecklistRecordStatus, ChecklistSubmission
from apps.reviews.models import SupervisorReview, SupervisorReviewDecision
from apps.scheduling.models import ChecklistTaskStatus
from apps.security_audit.services import record_event


def create_qa_review_cas(
    *,
    actor: User | None,
    submission_id: uuid.UUID,
    decision: str,
    review_note: str | None = None,
) -> QAReview:
    """CAS/unique-constraint spike for immutable QA dispositions."""
    if actor is None or not getattr(actor, "is_authenticated", False) or not actor.is_active:
        raise PermissionDenied("Authentication required.")
    user = actor

    if decision not in QAReviewDecision.values:
        raise ValidationError({"decision": "Invalid QA review decision."})

    note = normalize_qa_review_note(review_note)

    with atomic():
        submission = (
            ChecklistSubmission.objects.select_related(
                "checklist_record",
                "checklist_record__organization",
                "checklist_record__checklist_task",
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
                {"submission": "Only SUBMITTED checklist records may receive QA review."}
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
                        "QA review may act only on the latest ChecklistSubmission for the record."
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

        create_kwargs: dict[str, Any] = {
            "organization_id": record.organization_id,
            "checklist_submission": submission,
            "supervisor_review": supervisor,
            "decision": decision,
            "review_note": note,
            "reviewed_by": user,
        }
        try:
            review, created = create_immutable_unique(
                model=QAReview,
                create_kwargs=create_kwargs,
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
        "supervisor_review",
        "reviewed_by",
    ).get(pk=review.id)
