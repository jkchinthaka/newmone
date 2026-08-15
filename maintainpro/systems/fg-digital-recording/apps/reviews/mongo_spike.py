"""Supervisor review Mongo concurrency spike — uses optimistic unique insert.

Does not replace the production ``create_supervisor_review`` path yet.
Proves immutable decision races can be handled without relying solely on
``select_for_update`` (unique constraint + idempotent conflict handling).
"""

from __future__ import annotations

import uuid
from typing import Any

from django.core.exceptions import PermissionDenied, ValidationError

from apps.access_control.services import require_permission
from apps.accounts.models import User
from apps.core.persistence import TransitionConflictError, atomic, create_immutable_unique
from apps.recording.models import ChecklistRecordStatus, ChecklistSubmission
from apps.reviews.governance import assert_self_review_allowed
from apps.reviews.models import SupervisorReview, SupervisorReviewDecision
from apps.reviews.services import (
    REVIEW_CHECKLIST_SUBMISSION,
    _review_metadata,
    normalize_review_note,
    submission_authorization_scope,
)
from apps.security_audit.services import record_event


def create_supervisor_review_cas(
    *,
    actor: User | None,
    submission_id: uuid.UUID,
    decision: str,
    review_note: str | None = None,
) -> SupervisorReview:
    """CAS/unique-constraint spike for Supervisor immutable decisions."""
    if actor is None or not getattr(actor, "is_authenticated", False) or not actor.is_active:
        raise PermissionDenied("Authentication required.")
    user = actor

    if decision not in SupervisorReviewDecision.values:
        raise ValidationError({"decision": "Invalid supervisor review decision."})

    note = normalize_review_note(review_note)

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
            REVIEW_CHECKLIST_SUBMISSION,
            scope=submission_authorization_scope(submission),
        )
        self_review_eval = assert_self_review_allowed(actor=user, submission=submission)

        if record.status != ChecklistRecordStatus.SUBMITTED:
            raise ValidationError(
                {
                    "submission": (
                        "Only SUBMITTED checklist records may receive Supervisor review."
                    )
                }
            )

        latest = (
            ChecklistSubmission.objects.filter(checklist_record_id=record.id)
            .order_by("-submission_number", "-submitted_at")
            .values_list("id", flat=True)
            .first()
        )
        if latest is not None and latest != submission.id:
            raise ValidationError(
                {
                    "submission": (
                        "Only the latest checklist submission for this record may be "
                        "reviewed. Earlier submissions keep immutable review history."
                    )
                }
            )

        existing_before = SupervisorReview.objects.filter(
            checklist_submission_id=submission.id
        ).first()
        if existing_before is not None:
            if existing_before.decision == decision:
                return existing_before
            raise ValidationError(
                {
                    "decision": (
                        "This submission already has an immutable Supervisor review "
                        f"({existing_before.decision}). Different decisions cannot overwrite it."
                    )
                }
            )

        create_kwargs: dict[str, Any] = {
            "organization_id": record.organization_id,
            "checklist_submission": submission,
            "decision": decision,
            "review_note": note,
            "reviewed_by": user,
        }
        try:
            review, created = create_immutable_unique(
                model=SupervisorReview,
                create_kwargs=create_kwargs,
                unique_lookup={"checklist_submission_id": submission.id},
                decision_field="decision",
                decision_value=decision,
            )
        except TransitionConflictError as exc:
            raise ValidationError(
                {
                    "decision": (
                        "This submission already has an immutable Supervisor review "
                        "with a different decision. Different decisions cannot overwrite it."
                    )
                }
            ) from exc

        if created:
            meta = _review_metadata(review)
            meta["self_review_mode"] = self_review_eval.mode
            meta["self_review_is_self"] = self_review_eval.is_self_review
            meta["self_review_enforcement"] = self_review_eval.enforcement
            meta["governance_phase"] = "09C"
            meta["concurrency_pattern"] = "optimistic_unique_insert"
            record_event(
                event_type="SUPERVISOR_REVIEW_COMPLETED",
                actor=user,
                metadata=meta,
            )

    return SupervisorReview.objects.select_related(
        "organization",
        "checklist_submission",
        "checklist_submission__checklist_record",
        "reviewed_by",
    ).get(pk=review.id)
