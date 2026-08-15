"""Supervisor review models — immutable decisions bound to ChecklistSubmission."""

from __future__ import annotations

import uuid

from django.conf import settings
from django.core.exceptions import ValidationError
from django.db import models

from apps.organizations.models import Organization
from apps.recording.models import ChecklistRecordStatus, ChecklistSubmission


class SupervisorReviewDecision(models.TextChoices):
    """
    Provisional technical workflow labels — not formal QA policy.

    APPROVED: Supervisor review complete; may eventually enter future QA stage.
    Does NOT mean QA approved, RELEASED, or product acceptance.

    RETURNED_FOR_CORRECTION: Correction/resubmission will eventually be required.
    Phase 09A records the decision only — does not reopen or resubmit.
    """

    APPROVED = "APPROVED", "Approved (supervisor review complete)"
    RETURNED_FOR_CORRECTION = (
        "RETURNED_FOR_CORRECTION",
        "Returned for correction",
    )


class SupervisorReview(models.Model):
    """
    Immutable Supervisor decision for exactly one ChecklistSubmission.

    Future Submission #2 receives its own SupervisorReview. Do not bind reviews
    to ChecklistRecord mutable draft responses.
    """

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    organization = models.ForeignKey(
        Organization,
        on_delete=models.PROTECT,
        related_name="supervisor_reviews",
    )
    checklist_submission = models.OneToOneField(
        ChecklistSubmission,
        on_delete=models.PROTECT,
        related_name="supervisor_review",
    )
    decision = models.CharField(
        max_length=32,
        choices=SupervisorReviewDecision.choices,
    )
    review_note = models.TextField(blank=True, default="")
    reviewed_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        related_name="supervisor_reviews",
    )
    reviewed_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ("-reviewed_at",)
        verbose_name = "Supervisor review"
        verbose_name_plural = "Supervisor reviews"
        permissions = [
            (
                "review_checklistsubmission",
                "Can review checklist submissions (Supervisor review)",
            ),
        ]
        indexes = [
            models.Index(
                fields=["organization", "reviewed_at"],
                name="rev_sup_org_reviewed_idx",
            ),
            models.Index(
                fields=["organization", "decision"],
                name="rev_sup_org_decision_idx",
            ),
        ]

    def __str__(self) -> str:
        return f"SupervisorReview {self.decision} / submission {self.checklist_submission_id}"

    def clean(self) -> None:
        super().clean()
        if not self.checklist_submission_id:
            return
        submission = self.checklist_submission
        record = submission.checklist_record
        if self.organization_id and record.organization_id != self.organization_id:
            raise ValidationError(
                {
                    "organization": (
                        "Review organization must match the submission record organization."
                    )
                }
            )
        if record.status != ChecklistRecordStatus.SUBMITTED:
            raise ValidationError(
                {
                    "checklist_submission": (
                        "Supervisor review requires a SUBMITTED checklist record."
                    )
                }
            )


class SelfReviewPolicyMode(models.TextChoices):
    """
    Owner-controlled self-review posture for Supervisor review.

    PENDING (default): APR-010 / SoD unanswered — prohibition NOT enforced.
    PROHIBIT / ALLOW: only when owner-approved evidence_reference is recorded.
    """

    PENDING = "PENDING", "Pending owner decision (not enforced)"
    PROHIBIT = "PROHIBIT", "Self-review prohibited (owner-approved)"
    ALLOW = "ALLOW", "Self-review allowed (owner-approved)"


class SupervisorReviewGovernancePolicy(models.Model):
    """
    Per-organization Supervisor review governance configuration (Phase 09C).

    Does not invent Supervisor job titles. Authorization remains
    ``reviews.review_checklistsubmission`` via Phase 03C scoped assignments.
    ``review_sla_minutes`` is optional; null means no review-due / overdue derivation.
    """

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    organization = models.OneToOneField(
        Organization,
        on_delete=models.PROTECT,
        related_name="supervisor_review_governance_policy",
    )
    self_review_mode = models.CharField(
        max_length=16,
        choices=SelfReviewPolicyMode.choices,
        default=SelfReviewPolicyMode.PENDING,
        help_text="PENDING = SoD open (not enforced). PROHIBIT/ALLOW require evidence_reference.",
    )
    review_sla_minutes = models.PositiveIntegerField(
        null=True,
        blank=True,
        help_text=(
            "Optional configured minutes after submission before review is overdue. "
            "Null = no SLA (EVIDENCE REQUIRED — never invent timing)."
        ),
    )
    evidence_reference = models.CharField(
        max_length=255,
        blank=True,
        default="",
        help_text="Required when self_review_mode is PROHIBIT or ALLOW (APR evidence id/ref).",
    )
    notes = models.TextField(
        blank=True,
        default="",
        help_text="Governance notes only — not operational limits or invented titles.",
    )
    updated_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        null=True,
        blank=True,
        related_name="updated_supervisor_review_governance_policies",
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = "Supervisor review governance policy"
        verbose_name_plural = "Supervisor review governance policies"
        indexes = [
            models.Index(fields=["self_review_mode"], name="rev_gov_self_mode_idx"),
        ]

    def __str__(self) -> str:
        return (
            f"SupervisorReviewGovernancePolicy {self.organization.code} "
            f"self_review={self.self_review_mode}"
        )

    def clean(self) -> None:
        super().clean()
        errors: dict[str, str] = {}
        mode = self.self_review_mode or SelfReviewPolicyMode.PENDING
        if mode in {SelfReviewPolicyMode.PROHIBIT, SelfReviewPolicyMode.ALLOW}:
            if not (self.evidence_reference or "").strip():
                errors["evidence_reference"] = (
                    "evidence_reference is required when self_review_mode is "
                    "PROHIBIT or ALLOW (owner-approved policy)."
                )
        if self.review_sla_minutes is not None and int(self.review_sla_minutes) < 1:
            errors["review_sla_minutes"] = "review_sla_minutes must be >= 1 when configured."
        if errors:
            raise ValidationError(errors)
