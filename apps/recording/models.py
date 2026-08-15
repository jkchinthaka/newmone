"""Checklist recording models — draft working state + immutable submissions."""

from __future__ import annotations

import uuid

from django.conf import settings
from django.core.exceptions import ValidationError
from django.core.validators import MinValueValidator
from django.db import models
from django.db.models import Q

from apps.checklists.models import ChecklistItem, ChecklistItemOption
from apps.organizations.models import Organization
from apps.scheduling.models import ChecklistTask


class ChoiceResponseValue(models.TextChoices):
    """Typed YES/NO/NA choice storage — not a QA disposition."""

    YES = "YES", "Yes"
    NO = "NO", "No"
    NA = "NA", "N/A"


class ChecklistRecordStatus(models.TextChoices):
    """Phase 08B record lifecycle — draft working state vs submitted."""

    DRAFT = "DRAFT", "Draft"
    SUBMITTED = "SUBMITTED", "Submitted"


class ChecklistRecord(models.Model):
    """
    Operator recording session bound to exactly one ChecklistTask.

    DRAFT uses mutable ChecklistResponse rows. SUBMITTED freezes answers into
    ChecklistSubmission / ChecklistSubmissionResponse snapshots.
    """

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    organization = models.ForeignKey(
        Organization,
        on_delete=models.PROTECT,
        related_name="checklist_records",
    )
    checklist_task = models.OneToOneField(
        ChecklistTask,
        on_delete=models.PROTECT,
        related_name="checklist_record",
    )
    status = models.CharField(
        max_length=16,
        choices=ChecklistRecordStatus.choices,
        default=ChecklistRecordStatus.DRAFT,
    )
    started_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        related_name="started_checklist_records",
    )
    started_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    draft_version = models.PositiveIntegerField(
        default=1,
        help_text=(
            "Optimistic concurrency token for DRAFT saves. Clients must send the "
            "expected version; mismatched saves are rejected (no silent last-write-wins)."
        ),
    )

    class Meta:
        ordering = ("-updated_at",)
        verbose_name = "Checklist record"
        verbose_name_plural = "Checklist records"
        indexes = [
            models.Index(
                fields=["organization", "updated_at"],
                name="rec_record_org_updated_idx",
            ),
            models.Index(
                fields=["organization", "status"],
                name="rec_record_org_status_idx",
            ),
        ]

    def __str__(self) -> str:
        return f"Record {self.id} / task {self.checklist_task_id}"

    @property
    def is_draft(self) -> bool:
        return self.status == ChecklistRecordStatus.DRAFT

    @property
    def is_submitted(self) -> bool:
        return self.status == ChecklistRecordStatus.SUBMITTED

    def clean(self) -> None:
        super().clean()
        if self.checklist_task_id and self.organization_id:
            if self.checklist_task.organization_id != self.organization_id:
                raise ValidationError(
                    {
                        "organization": (
                            "Record organization must match the checklist task organization."
                        )
                    }
                )


class ChecklistResponse(models.Model):
    """
    Typed mutable draft answer for one ChecklistItem (+ sample_index) on a record.

    Not historical truth after submission — see ChecklistSubmissionResponse.
    Top-level SIMPLE items use sample_index=1. Repeating-group children use 1..N.
    """

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    checklist_record = models.ForeignKey(
        ChecklistRecord,
        on_delete=models.CASCADE,
        related_name="responses",
    )
    checklist_item = models.ForeignKey(
        ChecklistItem,
        on_delete=models.PROTECT,
        related_name="draft_responses",
    )
    sample_index = models.PositiveIntegerField(
        default=1,
        validators=[MinValueValidator(1)],
        help_text="1 for non-repeating answers; sample/row index for repeating children.",
    )
    choice_value = models.CharField(
        max_length=8,
        choices=ChoiceResponseValue.choices,
        blank=True,
        default="",
    )
    number_value = models.DecimalField(
        max_digits=26,
        decimal_places=12,
        null=True,
        blank=True,
        help_text="Decimal-safe NUMBER storage (up to 12 fractional places for Phase 06M).",
    )
    text_value = models.TextField(blank=True, default="")
    selected_option = models.ForeignKey(
        ChecklistItemOption,
        on_delete=models.PROTECT,
        null=True,
        blank=True,
        related_name="draft_responses",
    )
    calculation_context = models.JSONField(
        null=True,
        blank=True,
        default=None,
        help_text="Server-authored explanation for CALCULATED drafts (operator + inputs).",
    )
    condition_context = models.JSONField(
        null=True,
        blank=True,
        default=None,
        help_text="Server-authored conditional applicability snapshot (Phase 06J).",
    )
    evaluation_result = models.CharField(
        max_length=32,
        blank=True,
        default="",
        help_text=(
            "Server-authored item evaluation (PASS/FAIL/WARN/NOT_EVALUATED). "
            "Not a QA disposition — PASS≠RELEASE, FAIL≠HOLD/REJECT."
        ),
    )
    evaluation_context = models.JSONField(
        null=True,
        blank=True,
        default=None,
        help_text="Server-authored evaluation rule snapshot (Phase 06K).",
    )
    measurement_context = models.JSONField(
        null=True,
        blank=True,
        default=None,
        help_text="Server-authored NUMBER measurement semantics snapshot (Phase 06M).",
    )
    equipment = models.ForeignKey(
        "instruments.Equipment",
        on_delete=models.PROTECT,
        null=True,
        blank=True,
        related_name="checklist_draft_responses",
        help_text=(
            "Optional measuring device when the item requires equipment reference. "
            "Calibration enforcement follows INSTRUMENTS_CALIBRATION_ENFORCEMENT."
        ),
    )
    calibration_record = models.ForeignKey(
        "instruments.CalibrationRecord",
        on_delete=models.PROTECT,
        null=True,
        blank=True,
        related_name="checklist_draft_responses",
        help_text="Latest RECORDED calibration linked at measurement time (nullable).",
    )
    measurement_recorded_at = models.DateTimeField(
        null=True,
        blank=True,
        help_text="Server timestamp when the device reference was last applied.",
    )
    device_trace_context = models.JSONField(
        null=True,
        blank=True,
        default=None,
        help_text=(
            "Frozen device identity + calibration fitness at measurement time. "
            "Later equipment edits must not rewrite this snapshot."
        ),
    )
    evidence_hook = models.JSONField(
        null=True,
        blank=True,
        default=None,
        help_text=(
            "Future evidence/attachment hook metadata only (Phase 11). "
            "Never stores file bytes — object storage later."
        ),
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = (
            "checklist_item__section__position",
            "checklist_item__position",
            "sample_index",
        )
        verbose_name = "Checklist response"
        verbose_name_plural = "Checklist responses"
        constraints = [
            models.UniqueConstraint(
                fields=["checklist_record", "checklist_item", "sample_index"],
                name="rec_response_record_item_sample_uniq",
            ),
            models.CheckConstraint(
                condition=(
                    (
                        ~Q(choice_value="")
                        & Q(number_value__isnull=True)
                        & Q(text_value="")
                        & Q(selected_option__isnull=True)
                    )
                    | (
                        Q(choice_value="")
                        & Q(number_value__isnull=False)
                        & Q(text_value="")
                        & Q(selected_option__isnull=True)
                    )
                    | (
                        Q(choice_value="")
                        & Q(number_value__isnull=True)
                        & ~Q(text_value="")
                        & Q(selected_option__isnull=True)
                    )
                    | (
                        Q(choice_value="")
                        & Q(number_value__isnull=True)
                        & Q(text_value="")
                        & Q(selected_option__isnull=False)
                    )
                ),
                name="rec_response_exactly_one_value",
            ),
        ]
        indexes = [
            models.Index(
                fields=["checklist_record", "updated_at"],
                name="rec_response_record_upd_idx",
            ),
            models.Index(
                fields=["checklist_record", "checklist_item", "sample_index"],
                name="rec_response_item_sample_idx",
            ),
        ]

    def __str__(self) -> str:
        return f"Response {self.id} / item {self.checklist_item_id} / sample {self.sample_index}"

    def clean(self) -> None:
        super().clean()
        filled = [
            bool(self.choice_value),
            self.number_value is not None,
            bool(self.text_value),
            self.selected_option_id is not None,
        ]
        if sum(1 for flag in filled if flag) != 1:
            raise ValidationError("Exactly one typed response value must be set.")
        if self.sample_index < 1:
            raise ValidationError({"sample_index": "sample_index must be >= 1."})


class ChecklistSubmission(models.Model):
    """
    Immutable submission of a ChecklistRecord.

    Phase 08B creates submission_number=1 only. Future corrections may add 2+.
    Supervisor/QA must bind to a specific submission — not mutable draft rows.
    """

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    checklist_record = models.ForeignKey(
        ChecklistRecord,
        on_delete=models.PROTECT,
        related_name="submissions",
    )
    submission_number = models.PositiveIntegerField(validators=[MinValueValidator(1)])
    submitted_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        related_name="checklist_submissions",
    )
    submitted_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ("checklist_record_id", "submission_number")
        verbose_name = "Checklist submission"
        verbose_name_plural = "Checklist submissions"
        constraints = [
            models.UniqueConstraint(
                fields=["checklist_record", "submission_number"],
                name="rec_submission_record_number_uniq",
            ),
        ]
        indexes = [
            models.Index(
                fields=["checklist_record", "submitted_at"],
                name="rec_submission_record_at_idx",
            ),
        ]

    def __str__(self) -> str:
        return f"Submission #{self.submission_number} / record {self.checklist_record_id}"


class ChecklistSubmissionResponse(models.Model):
    """
    Immutable typed snapshot of one answered item (+ sample_index) at submission.

    Survives future mutation/correction of working ChecklistResponse rows.
    """

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    checklist_submission = models.ForeignKey(
        ChecklistSubmission,
        on_delete=models.PROTECT,
        related_name="responses",
    )
    checklist_item = models.ForeignKey(
        ChecklistItem,
        on_delete=models.PROTECT,
        related_name="submission_responses",
    )
    sample_index = models.PositiveIntegerField(
        default=1,
        validators=[MinValueValidator(1)],
        help_text="Preserved sample/row index for repeating children; 1 for SIMPLE.",
    )
    choice_value = models.CharField(
        max_length=8,
        choices=ChoiceResponseValue.choices,
        blank=True,
        default="",
    )
    number_value = models.DecimalField(
        max_digits=26,
        decimal_places=12,
        null=True,
        blank=True,
        help_text="Frozen Decimal-safe NUMBER storage (up to 12 fractional places for Phase 06M).",
    )
    text_value = models.TextField(blank=True, default="")
    selected_option = models.ForeignKey(
        ChecklistItemOption,
        on_delete=models.PROTECT,
        null=True,
        blank=True,
        related_name="submission_responses",
    )
    calculation_context = models.JSONField(
        null=True,
        blank=True,
        default=None,
        help_text=(
            "Frozen CALCULATED explanation at submit time. Historical truth — "
            "do not recompute with future definition rules."
        ),
    )
    condition_context = models.JSONField(
        null=True,
        blank=True,
        default=None,
        help_text=(
            "Frozen conditional applicability at submit time. Historical truth — "
            "do not re-evaluate with future definition rules."
        ),
    )
    evaluation_result = models.CharField(
        max_length=32,
        blank=True,
        default="",
        help_text=(
            "Frozen item evaluation at submit time. Not QA disposition "
            "(PASS≠RELEASE, FAIL≠HOLD/REJECT)."
        ),
    )
    evaluation_context = models.JSONField(
        null=True,
        blank=True,
        default=None,
        help_text=(
            "Frozen evaluation rule/result context at submit time. Historical truth — "
            "do not recompute with future definition rules."
        ),
    )
    control_point_context = models.JSONField(
        null=True,
        blank=True,
        default=None,
        help_text=(
            "Frozen control-point / criticality metadata at submit time. "
            "Not a QA disposition — does not HOLD/REJECT/RELEASE."
        ),
    )
    measurement_context = models.JSONField(
        null=True,
        blank=True,
        default=None,
        help_text=(
            "Frozen NUMBER measurement semantics at submit time. Historical truth — "
            "do not recompute with future definition rules."
        ),
    )
    equipment = models.ForeignKey(
        "instruments.Equipment",
        on_delete=models.PROTECT,
        null=True,
        blank=True,
        related_name="checklist_submission_responses",
        help_text="Frozen measuring device reference at submit time.",
    )
    calibration_record = models.ForeignKey(
        "instruments.CalibrationRecord",
        on_delete=models.PROTECT,
        null=True,
        blank=True,
        related_name="checklist_submission_responses",
        help_text="Frozen calibration record reference at submit time.",
    )
    measurement_recorded_at = models.DateTimeField(
        null=True,
        blank=True,
        help_text="Frozen measurement timestamp copied from draft response.",
    )
    device_trace_context = models.JSONField(
        null=True,
        blank=True,
        default=None,
        help_text=(
            "Frozen device + calibration snapshot at submit. Historical truth — "
            "do not recompute from later equipment master changes."
        ),
    )
    evidence_hook = models.JSONField(
        null=True,
        blank=True,
        default=None,
        help_text="Frozen evidence/attachment hook metadata (no file bytes).",
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = (
            "checklist_item__section__position",
            "checklist_item__position",
            "sample_index",
        )
        verbose_name = "Checklist submission response"
        verbose_name_plural = "Checklist submission responses"
        constraints = [
            models.UniqueConstraint(
                fields=["checklist_submission", "checklist_item", "sample_index"],
                name="rec_sub_resp_sub_item_sample_uniq",
            ),
            models.CheckConstraint(
                condition=(
                    (
                        ~Q(choice_value="")
                        & Q(number_value__isnull=True)
                        & Q(text_value="")
                        & Q(selected_option__isnull=True)
                    )
                    | (
                        Q(choice_value="")
                        & Q(number_value__isnull=False)
                        & Q(text_value="")
                        & Q(selected_option__isnull=True)
                    )
                    | (
                        Q(choice_value="")
                        & Q(number_value__isnull=True)
                        & ~Q(text_value="")
                        & Q(selected_option__isnull=True)
                    )
                    | (
                        Q(choice_value="")
                        & Q(number_value__isnull=True)
                        & Q(text_value="")
                        & Q(selected_option__isnull=False)
                    )
                ),
                name="rec_sub_resp_exactly_one_value",
            ),
        ]
        indexes = [
            models.Index(
                fields=["checklist_submission", "checklist_item", "sample_index"],
                name="rec_sub_resp_item_sample_idx",
            ),
        ]

    def __str__(self) -> str:
        return (
            f"Submission response {self.id} / item {self.checklist_item_id} "
            f"/ sample {self.sample_index}"
        )

    def clean(self) -> None:
        super().clean()
        filled = [
            bool(self.choice_value),
            self.number_value is not None,
            bool(self.text_value),
            self.selected_option_id is not None,
        ]
        if sum(1 for flag in filled if flag) != 1:
            raise ValidationError("Exactly one typed response value must be set.")
        if self.sample_index < 1:
            raise ValidationError({"sample_index": "sample_index must be >= 1."})


class ChecklistCorrectionStatus(models.TextChoices):
    """Explicit correction-cycle lifecycle — not QA disposition."""

    DRAFT = "DRAFT", "Correction draft"
    RESUBMITTED = "RESUBMITTED", "Resubmitted"


class ChecklistCorrection(models.Model):
    """
    Controlled correction cycle for a RETURNED_FOR_CORRECTION submission.

    ChecklistRecord remains SUBMITTED. Mutable ChecklistResponse rows are the
    working copy while status=DRAFT. Source ChecklistSubmission / snapshot /
    SupervisorReview stay immutable. Resubmission creates Submission N+1.
    """

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    organization = models.ForeignKey(
        Organization,
        on_delete=models.PROTECT,
        related_name="checklist_corrections",
    )
    checklist_record = models.ForeignKey(
        ChecklistRecord,
        on_delete=models.PROTECT,
        related_name="corrections",
    )
    source_submission = models.OneToOneField(
        ChecklistSubmission,
        on_delete=models.PROTECT,
        related_name="correction_cycle",
    )
    status = models.CharField(
        max_length=16,
        choices=ChecklistCorrectionStatus.choices,
        default=ChecklistCorrectionStatus.DRAFT,
    )
    started_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        related_name="started_checklist_corrections",
    )
    started_at = models.DateTimeField(auto_now_add=True)
    resulting_submission = models.OneToOneField(
        ChecklistSubmission,
        on_delete=models.PROTECT,
        null=True,
        blank=True,
        related_name="produced_by_correction",
    )
    completed_at = models.DateTimeField(null=True, blank=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ("-started_at",)
        verbose_name = "Checklist correction"
        verbose_name_plural = "Checklist corrections"
        indexes = [
            models.Index(
                fields=["organization", "status"],
                name="rec_corr_org_status_idx",
            ),
            models.Index(
                fields=["checklist_record", "status"],
                name="rec_corr_record_status_idx",
            ),
        ]

    def __str__(self) -> str:
        return f"Correction {self.status} / source submission {self.source_submission_id}"

    @property
    def is_draft(self) -> bool:
        return self.status == ChecklistCorrectionStatus.DRAFT

    @property
    def is_resubmitted(self) -> bool:
        return self.status == ChecklistCorrectionStatus.RESUBMITTED

    def clean(self) -> None:
        super().clean()
        if self.source_submission_id and self.checklist_record_id:
            if self.source_submission.checklist_record_id != self.checklist_record_id:
                raise ValidationError(
                    {
                        "source_submission": (
                            "Source submission must belong to the checklist record."
                        )
                    }
                )
        if self.checklist_record_id and self.organization_id:
            if self.checklist_record.organization_id != self.organization_id:
                raise ValidationError(
                    {
                        "organization": (
                            "Correction organization must match the record organization."
                        )
                    }
                )
        if self.resulting_submission_id and self.checklist_record_id:
            resulting = self.resulting_submission
            if resulting is not None and resulting.checklist_record_id != self.checklist_record_id:
                raise ValidationError(
                    {
                        "resulting_submission": (
                            "Resulting submission must belong to the checklist record."
                        )
                    }
                )
