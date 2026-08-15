"""
Nonconformance and Hold case foundation — Phase 12.

Proposed technical lifecycle only. Severity, auto-HOLD from FAIL/CCP,
disposition matrices, and company resolution catalogues remain EVIDENCE REQUIRED.
ChecklistCorrection / resubmission is a separate recording concern — never the same
as formal NonConformanceRecord.
"""

from __future__ import annotations

import uuid

from django.conf import settings
from django.core.exceptions import ValidationError
from django.db import models
from django.db.models.functions import Lower

from apps.organizations.models import Organization


class NonConformanceStatus(models.TextChoices):
    """Architecture-proposed NCR lifecycle — not a seeded Nelna SOP."""

    OPEN = "OPEN", "Open"
    INVESTIGATING = "INVESTIGATING", "Investigating"
    ACTION_REQUIRED = "ACTION_REQUIRED", "Action required"
    VERIFICATION = "VERIFICATION", "Verification"
    CLOSED = "CLOSED", "Closed"


NCR_STATUS_TRANSITIONS: dict[str, frozenset[str]] = {
    NonConformanceStatus.OPEN: frozenset(
        {
            NonConformanceStatus.INVESTIGATING,
            NonConformanceStatus.ACTION_REQUIRED,
            NonConformanceStatus.CLOSED,
        }
    ),
    NonConformanceStatus.INVESTIGATING: frozenset(
        {
            NonConformanceStatus.OPEN,
            NonConformanceStatus.ACTION_REQUIRED,
            NonConformanceStatus.VERIFICATION,
            NonConformanceStatus.CLOSED,
        }
    ),
    NonConformanceStatus.ACTION_REQUIRED: frozenset(
        {
            NonConformanceStatus.INVESTIGATING,
            NonConformanceStatus.VERIFICATION,
            NonConformanceStatus.CLOSED,
        }
    ),
    NonConformanceStatus.VERIFICATION: frozenset(
        {
            NonConformanceStatus.ACTION_REQUIRED,
            NonConformanceStatus.INVESTIGATING,
            NonConformanceStatus.CLOSED,
        }
    ),
    NonConformanceStatus.CLOSED: frozenset(),
}


class NonConformanceSource(models.TextChoices):
    """
    How the case was opened.

    MANUAL is the only path implemented in Phase 12 services.
    CHECKLIST_* / QA_REVIEW are optional reference sources — never auto-created
    from FAIL/CCP metadata without an approved rule (none configured).
    """

    MANUAL = "MANUAL", "Manual"
    CHECKLIST_SUBMISSION = "CHECKLIST_SUBMISSION", "Checklist submission reference"
    QA_REVIEW = "QA_REVIEW", "QA review reference"
    OTHER = "OTHER", "Other (opaque reference)"


class HoldCaseStatus(models.TextChoices):
    """Technical hold lifecycle — resolutions are free text, not company facts."""

    OPEN = "OPEN", "Open"
    CLOSED = "CLOSED", "Closed"


class QualityCaseHistoryKind(models.TextChoices):
    NONCONFORMANCE = "NONCONFORMANCE", "Nonconformance"
    HOLD = "HOLD", "Hold case"
    CAPA = "CAPA", "CAPA"


class NonConformanceRecord(models.Model):
    """
    Organization-scoped formal quality nonconformance case.

    Distinct from recording.ChecklistCorrection (draft correction / resubmission).
    Soft retention: no hard delete via services/admin.
    """

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    organization = models.ForeignKey(
        Organization,
        on_delete=models.PROTECT,
        related_name="nonconformances",
    )
    code = models.CharField(max_length=64)
    title = models.CharField(max_length=255)
    source = models.CharField(
        max_length=32,
        choices=NonConformanceSource.choices,
        default=NonConformanceSource.MANUAL,
    )
    status = models.CharField(
        max_length=32,
        choices=NonConformanceStatus.choices,
        default=NonConformanceStatus.OPEN,
    )
    description = models.TextField(blank=True, default="")
    # Legacy alias retained for earlier Phase 32 callers — kept in sync with description.
    summary = models.TextField(blank=True, default="")
    batch_reference = models.CharField(max_length=128, blank=True, default="")
    checklist_task = models.ForeignKey(
        "scheduling.ChecklistTask",
        on_delete=models.PROTECT,
        null=True,
        blank=True,
        related_name="nonconformances",
    )
    checklist_submission = models.ForeignKey(
        "recording.ChecklistSubmission",
        on_delete=models.PROTECT,
        null=True,
        blank=True,
        related_name="nonconformances",
    )
    # Future quantity / sub-lot disposition architecture — opaque link only (none exists yet).
    quantity_reference = models.CharField(
        max_length=128,
        blank=True,
        default="",
        help_text="Opaque future quantity/sub-lot reference — no disposition rules invented.",
    )
    owner = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        null=True,
        blank=True,
        related_name="nonconformances_owned",
    )
    containment = models.TextField(blank=True, default="")
    investigation = models.TextField(blank=True, default="")
    closure_notes = models.TextField(blank=True, default="")
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        related_name="nonconformances_created",
    )
    closed_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        null=True,
        blank=True,
        related_name="nonconformances_closed",
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    closed_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ("organization__code", "code")
        verbose_name = "Nonconformance record"
        verbose_name_plural = "Nonconformance records"
        permissions = [
            ("create_nonconformance", "Can create nonconformance records"),
            ("manage_nonconformance", "Can manage nonconformance records"),
            ("close_nonconformance", "Can close nonconformance records"),
        ]
        constraints = [
            models.UniqueConstraint(
                Lower("code"),
                "organization",
                name="ncr_org_code_ci_uniq",
            ),
        ]
        indexes = [
            models.Index(
                fields=["organization", "status"],
                name="ncr_org_status_idx",
            ),
            models.Index(
                fields=["organization", "batch_reference"],
                name="ncr_org_batch_idx",
            ),
        ]

    def __str__(self) -> str:
        return f"{self.organization.code}/{self.code}"

    def clean(self) -> None:
        super().clean()
        if not (self.code or "").strip():
            raise ValidationError({"code": "Code cannot be blank."})
        if not (self.title or "").strip():
            raise ValidationError({"title": "Title cannot be blank."})
        if self.checklist_task_id and self.organization_id:
            task = self.checklist_task
            if task is not None and task.organization_id != self.organization_id:
                raise ValidationError(
                    {"checklist_task": "Task organization must match nonconformance organization."}
                )
        if self.checklist_submission_id and self.organization_id:
            submission = self.checklist_submission
            if submission is not None:
                record_org = submission.checklist_record.organization_id
                if record_org != self.organization_id:
                    raise ValidationError(
                        {
                            "checklist_submission": (
                                "Submission organization must match nonconformance organization."
                            )
                        }
                    )


class HoldCase(models.Model):
    """
    Generic quality HOLD case — independent of checklist QA disposition labels.

    Resolution text is free-form. Allowed company resolutions are NOT seeded.
    Soft retention: no hard delete via services/admin.
    """

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    organization = models.ForeignKey(
        Organization,
        on_delete=models.PROTECT,
        related_name="hold_cases",
    )
    code = models.CharField(max_length=64)
    reason_reference = models.CharField(
        max_length=255,
        help_text="Reason or external reference — not a company resolution catalogue code.",
    )
    scope = models.TextField(
        blank=True,
        default="",
        help_text="Free-text scope (batch/site/product/etc.) — no invented scope enums.",
    )
    status = models.CharField(
        max_length=16,
        choices=HoldCaseStatus.choices,
        default=HoldCaseStatus.OPEN,
    )
    resolution = models.TextField(
        blank=True,
        default="",
        help_text="Free-text resolution — not a Nelna-approved resolution enum.",
    )
    owner = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        null=True,
        blank=True,
        related_name="hold_cases_owned",
    )
    nonconformance = models.ForeignKey(
        NonConformanceRecord,
        on_delete=models.PROTECT,
        null=True,
        blank=True,
        related_name="hold_cases",
    )
    batch_reference = models.CharField(max_length=128, blank=True, default="")
    quantity_reference = models.CharField(
        max_length=128,
        blank=True,
        default="",
        help_text="Opaque future quantity/sub-lot reference — no disposition rules invented.",
    )
    opened_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        related_name="hold_cases_opened",
    )
    closed_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        null=True,
        blank=True,
        related_name="hold_cases_closed",
    )
    opened_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    closed_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ("organization__code", "code")
        verbose_name = "Hold case"
        verbose_name_plural = "Hold cases"
        permissions = [
            ("create_holdcase", "Can create hold cases"),
            ("manage_holdcase", "Can manage hold cases"),
            ("close_holdcase", "Can close hold cases"),
        ]
        constraints = [
            models.UniqueConstraint(
                Lower("code"),
                "organization",
                name="hold_org_code_ci_uniq",
            ),
        ]
        indexes = [
            models.Index(
                fields=["organization", "status"],
                name="hold_org_status_idx",
            ),
        ]

    def __str__(self) -> str:
        return f"HOLD {self.organization.code}/{self.code}"

    def clean(self) -> None:
        super().clean()
        if not (self.code or "").strip():
            raise ValidationError({"code": "Code cannot be blank."})
        if not (self.reason_reference or "").strip():
            raise ValidationError({"reason_reference": "Reason/reference cannot be blank."})
        if self.nonconformance_id and self.organization_id:
            ncr = self.nonconformance
            if ncr is not None and ncr.organization_id != self.organization_id:
                raise ValidationError(
                    {"nonconformance": "Hold organization must match linked NCR organization."}
                )


class QualityCaseHistoryEntry(models.Model):
    """Append-only case history for NCR and Hold — never edited in place."""

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    organization = models.ForeignKey(
        Organization,
        on_delete=models.PROTECT,
        related_name="quality_case_history",
    )
    case_kind = models.CharField(max_length=32, choices=QualityCaseHistoryKind.choices)
    case_id = models.UUIDField()
    event_type = models.CharField(max_length=64)
    from_status = models.CharField(max_length=32, blank=True, default="")
    to_status = models.CharField(max_length=32, blank=True, default="")
    note = models.TextField(blank=True, default="")
    metadata = models.JSONField(default=dict, blank=True)
    actor = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        related_name="quality_case_history_actions",
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ("-created_at",)
        verbose_name = "Quality case history entry"
        verbose_name_plural = "Quality case history entries"
        indexes = [
            models.Index(
                fields=["organization", "case_kind", "case_id", "created_at"],
                name="qch_org_case_created_idx",
            ),
        ]

    def __str__(self) -> str:
        return f"{self.case_kind}:{self.case_id} {self.event_type}"
