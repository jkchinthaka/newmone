"""Supervisor review services — create immutable decisions only."""

from __future__ import annotations

import uuid
from typing import Any

from django.core.exceptions import PermissionDenied, ValidationError

from apps.access_control.services import Scope, require_permission
from apps.accounts.models import User
from apps.core.persistence import TransitionConflictError, atomic, create_immutable_unique
from apps.core.idempotency import execute_idempotent
from apps.recording.models import ChecklistRecordStatus, ChecklistSubmission
from apps.reviews.governance import assert_self_review_allowed
from apps.reviews.models import SupervisorReview, SupervisorReviewDecision
from apps.security_audit.services import record_event

REVIEW_CHECKLIST_SUBMISSION = "reviews.review_checklistsubmission"

REVIEW_NOTE_MAX_LENGTH = 4000


def _require_authenticated_actor(actor: User | None) -> User:
    if actor is None or not getattr(actor, "is_authenticated", False) or not actor.is_active:
        raise PermissionDenied("Authentication required.")
    return actor


def submission_authorization_scope(submission: ChecklistSubmission) -> Scope:
    return Scope(organization_id=submission.checklist_record.organization_id)


def normalize_review_note(raw: str | None) -> str:
    """Trim only — optional in Phase 09A; do not invent mandatory-reason policy."""
    if raw is None:
        return ""
    value = str(raw).strip()
    if len(value) > REVIEW_NOTE_MAX_LENGTH:
        raise ValidationError(
            {"review_note": f"Review note must be at most {REVIEW_NOTE_MAX_LENGTH} characters."}
        )
    return value


def _review_metadata(review: SupervisorReview) -> dict[str, Any]:
    submission = review.checklist_submission
    record = submission.checklist_record
    task = record.checklist_task
    return {
        "supervisor_review_id": str(review.id),
        "checklist_submission_id": str(submission.id),
        "submission_number": submission.submission_number,
        "checklist_record_id": str(record.id),
        "checklist_task_id": str(task.id),
        "organization_id": str(review.organization_id),
        "checklist_template_id": str(task.checklist_template_id),
        "checklist_version_id": str(task.checklist_version_id),
        "batch_reference": task.batch_reference,
        "decision": review.decision,
    }


def create_supervisor_review(
    *,
    actor: User | None,
    submission_id: uuid.UUID,
    decision: str,
    review_note: str | None = None,
    idempotency_key: str = "",
) -> SupervisorReview:
    """
    Record an immutable SupervisorReview for a SUBMITTED ChecklistSubmission.

    Idempotent when the same decision already exists.
    Conflict when an existing review has a different decision.
    Concurrency: unique(submission) + create_immutable_unique (no select_for_update).
    """
    user = _require_authenticated_actor(actor)

    if decision not in SupervisorReviewDecision.values:
        raise ValidationError({"decision": "Invalid supervisor review decision."})

    note = normalize_review_note(review_note)
    peek = (
        ChecklistSubmission.objects.select_related("checklist_record__organization")
        .filter(pk=submission_id)
        .first()
    )
    if peek is None:
        raise ValidationError({"submission": "Checklist submission not found."})
    key = (idempotency_key or "").strip() or f"supervisor:{submission_id}:{decision}"

    def _create() -> SupervisorReview:
        return _create_supervisor_review_body(
            user=user,
            submission_id=submission_id,
            decision=decision,
            note=note,
        )

    return execute_idempotent(
        organization=peek.checklist_record.organization,
        scope="reviews.supervisor",
        key=key,
        fn=_create,
        reload=lambda ref: SupervisorReview.objects.filter(pk=ref).first(),
        pending_fallback=lambda: SupervisorReview.objects.filter(
            checklist_submission_id=submission_id, decision=decision
        ).first(),
    )


def _create_supervisor_review_body(
    *,
    user: User,
    submission_id: uuid.UUID,
    decision: str,
    note: str,
) -> SupervisorReview:
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

        existing = SupervisorReview.objects.filter(
            checklist_submission_id=submission.id
        ).first()
        if existing is not None:
            if existing.decision == decision:
                return existing
            raise ValidationError(
                {
                    "decision": (
                        "This submission already has an immutable Supervisor review "
                        f"({existing.decision}). Different decisions cannot overwrite it."
                    )
                }
            )

        try:
            review, created = create_immutable_unique(
                model=SupervisorReview,
                create_kwargs={
                    "organization_id": record.organization_id,
                    "checklist_submission": submission,
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
        "checklist_submission__checklist_record__checklist_task",
        "checklist_submission__checklist_record__checklist_task__checklist_template",
        "checklist_submission__checklist_record__checklist_task__checklist_version",
        "checklist_submission__submitted_by",
        "reviewed_by",
    ).get(pk=review.id)
