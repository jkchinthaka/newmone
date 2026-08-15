"""QA final review models — immutable manual dispositions on ChecklistSubmission."""

from __future__ import annotations

import uuid

from django.conf import settings
from django.core.exceptions import ValidationError
from django.db import models

from apps.organizations.models import Organization
from apps.recording.models import ChecklistRecordStatus, ChecklistSubmission
from apps.reviews.models import SupervisorReview, SupervisorReviewDecision


class QAReviewDecision(models.TextChoices):
    """
    Provisional owner-directed final disposition labels — not regulatory approval.

    RELEASE / HOLD / REJECT are manual QA decisions recorded in this application only.
    They do NOT automatically release inventory, change ERP, dispatch stock,
    create CorrectiveAction, cancel tasks, or dispose product.
    """

    RELEASE = "RELEASE", "Release (provisional QA disposition)"
    HOLD = "HOLD", "Hold (provisional QA disposition)"
    REJECT = "REJECT", "Reject (provisional QA disposition)"


class QAReview(models.Model):
    """
    Immutable QA disposition for exactly one ChecklistSubmission.

    Requires the exact SupervisorReview(APPROVED) that made the submission eligible.
    Does not bind to ChecklistRecord mutable working responses.
    """

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    organization = models.ForeignKey(
        Organization,
        on_delete=models.PROTECT,
        related_name="qa_reviews",
    )
    checklist_submission = models.OneToOneField(
        ChecklistSubmission,
        on_delete=models.PROTECT,
        related_name="qa_review",
    )
    supervisor_review = models.OneToOneField(
        SupervisorReview,
        on_delete=models.PROTECT,
        related_name="qa_review",
    )
    decision = models.CharField(
        max_length=16,
        choices=QAReviewDecision.choices,
    )
    review_note = models.TextField(blank=True, default="")
    reviewed_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        related_name="qa_reviews",
    )
    reviewed_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ("-reviewed_at",)
        verbose_name = "QA review"
        verbose_name_plural = "QA reviews"
        permissions = [
            (
                "qa_review_checklistsubmission",
                "Can record QA final review disposition for checklist submissions",
            ),
        ]
        indexes = [
            models.Index(
                fields=["organization", "reviewed_at"],
                name="qa_review_org_reviewed_idx",
            ),
            models.Index(
                fields=["organization", "decision"],
                name="qa_review_org_decision_idx",
            ),
        ]

    def __str__(self) -> str:
        return f"QAReview {self.decision} / submission {self.checklist_submission_id}"

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
                        "QA review organization must match the submission record organization."
                    )
                }
            )
        if record.status != ChecklistRecordStatus.SUBMITTED:
            raise ValidationError(
                {"checklist_submission": ("QA review requires a SUBMITTED checklist record.")}
            )
        if not self.supervisor_review_id:
            raise ValidationError(
                {"supervisor_review": "QA review requires an approved Supervisor review."}
            )
        supervisor = self.supervisor_review
        if supervisor.checklist_submission_id != submission.id:
            raise ValidationError(
                {
                    "supervisor_review": (
                        "Supervisor review must belong to the same ChecklistSubmission."
                    )
                }
            )
        if supervisor.decision != SupervisorReviewDecision.APPROVED:
            raise ValidationError(
                {"supervisor_review": ("QA review requires SupervisorReview decision APPROVED.")}
            )
        if (
            self.organization_id
            and supervisor.organization_id
            and supervisor.organization_id != self.organization_id
        ):
            raise ValidationError(
                {
                    "organization": (
                        "QA review organization must match the Supervisor review organization."
                    )
                }
            )
