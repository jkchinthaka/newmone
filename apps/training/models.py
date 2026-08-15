"""Training / competency foundation — unseeded; no invented company matrices."""

from __future__ import annotations

import uuid
from datetime import date

from django.conf import settings
from django.core.exceptions import ValidationError
from django.db import models
from django.utils import timezone


class CompetencyScopeKind(models.TextChoices):
    """
    Technical competency-scope taxonomy.

    Use only where required. Not a seeded training matrix.
    """

    GENERAL = "GENERAL", "General"
    CHECKLIST = "CHECKLIST", "Specific checklist"
    PROCESS = "PROCESS", "Process"
    EQUIPMENT = "EQUIPMENT", "Equipment"
    BUSINESS_ROLE = "BUSINESS_ROLE", "Business role"


class TrainingRecordStatus(models.TextChoices):
    """
    Training-record lifecycle.

    Expiry does not delete or void the row — historical evidence is retained.
    Prefer SUPERSEDED / VOID over hard delete.
    """

    ACTIVE = "ACTIVE", "Active"
    SUPERSEDED = "SUPERSEDED", "Superseded"
    VOID = "VOID", "Void"


class TrainingCurrency(models.TextChoices):
    """
    Derived currency labels for architecture / reporting.

    Phase 05E exposes labels only — does not enforce recording gates.
    """

    VALID = "VALID", "Valid"
    FUTURE = "FUTURE", "Future (not yet effective)"
    EXPIRED = "EXPIRED", "Expired"
    INACTIVE = "INACTIVE", "Inactive (superseded/void)"
    UNKNOWN = "UNKNOWN", "Unknown"


class TrainingGateMode(models.TextChoices):
    """
    Future recording-gate policy modes.

    Default OFF until company policy / APR evidence approves WARN or BLOCK.
    """

    OFF = "OFF", "Off (no gate)"
    WARN = "WARN", "Warn"
    BLOCK = "BLOCK", "Block"


class TrainingRecord(models.Model):
    """
    Organization-scoped operator training / competency evidence.

    No company training requirements are seeded. Optional associations support
    checklist / process / equipment / business-role scopes when evidenced.
    """

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    organization = models.ForeignKey(
        "organizations.Organization",
        on_delete=models.PROTECT,
        related_name="training_records",
    )
    subject_user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        related_name="training_records_as_subject",
    )
    course_code = models.CharField(
        max_length=64,
        help_text="Training/course reference code (not a seeded catalogue).",
    )
    course_name = models.CharField(max_length=255, blank=True, default="")
    competency_scope = models.CharField(
        max_length=32,
        choices=CompetencyScopeKind.choices,
        default=CompetencyScopeKind.GENERAL,
    )
    checklist_template = models.ForeignKey(
        "checklists.ChecklistTemplate",
        on_delete=models.PROTECT,
        null=True,
        blank=True,
        related_name="training_records",
        help_text="Optional when competency_scope=CHECKLIST.",
    )
    process_reference = models.CharField(
        max_length=255,
        blank=True,
        default="",
        help_text="Optional process reference label when scope=PROCESS. Not a process master.",
    )
    equipment = models.ForeignKey(
        "instruments.Equipment",
        on_delete=models.PROTECT,
        null=True,
        blank=True,
        related_name="training_records",
        help_text="Optional when competency_scope=EQUIPMENT.",
    )
    business_role = models.ForeignKey(
        "access_control.Role",
        on_delete=models.PROTECT,
        null=True,
        blank=True,
        related_name="training_records",
        help_text="Optional when competency_scope=BUSINESS_ROLE.",
    )
    trained_on = models.DateField()
    expires_on = models.DateField(
        null=True,
        blank=True,
        help_text="Optional expiry when evidenced. Expiry retains the historical row.",
    )
    trainer_reference = models.CharField(max_length=255, blank=True, default="")
    evidence_reference = models.CharField(
        max_length=255,
        blank=True,
        default="",
        help_text="Optional evidence reference. File attachments deferred to object storage.",
    )
    status = models.CharField(
        max_length=16,
        choices=TrainingRecordStatus.choices,
        default=TrainingRecordStatus.ACTIVE,
    )
    recorded_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        related_name="training_records_recorded",
    )
    notes = models.TextField(blank=True, default="")
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ("-trained_on", "-created_at")
        verbose_name = "Training record"
        verbose_name_plural = "Training records"
        permissions = [
            ("manage_trainingrecord", "Can manage training and competency records"),
        ]
        constraints = [
            models.CheckConstraint(
                condition=(
                    models.Q(expires_on__isnull=True)
                    | models.Q(expires_on__gte=models.F("trained_on"))
                ),
                name="trn_record_expires_gte_trained",
            ),
        ]
        indexes = [
            models.Index(
                fields=["organization", "subject_user", "status"],
                name="trn_rec_org_user_status_idx",
            ),
            models.Index(
                fields=["organization", "competency_scope"],
                name="trn_rec_org_scope_idx",
            ),
            models.Index(fields=["expires_on"], name="trn_rec_expires_idx"),
        ]

    def __str__(self) -> str:
        return f"{self.organization_id}/{self.course_code}@{self.trained_on}"

    def clean(self) -> None:
        super().clean()
        errors: dict[str, str] = {}
        if not (self.course_code or "").strip():
            errors["course_code"] = "Course / training reference is required."
        if self.competency_scope not in CompetencyScopeKind.values:
            errors["competency_scope"] = "Unknown competency scope."
        if (
            self.expires_on is not None
            and self.trained_on is not None
            and self.expires_on < self.trained_on
        ):
            errors["expires_on"] = "expires_on cannot be earlier than trained_on."

        if self.competency_scope == CompetencyScopeKind.CHECKLIST:
            if self.checklist_template_id is None:
                errors["checklist_template"] = (
                    "checklist_template is required when competency_scope=CHECKLIST."
                )
        elif self.checklist_template_id is not None:
            errors["checklist_template"] = (
                "checklist_template is only applicable for CHECKLIST scope."
            )

        if self.competency_scope == CompetencyScopeKind.PROCESS:
            if not (self.process_reference or "").strip():
                errors["process_reference"] = (
                    "process_reference is required when competency_scope=PROCESS."
                )
        elif (self.process_reference or "").strip():
            errors["process_reference"] = "process_reference is only applicable for PROCESS scope."

        if self.competency_scope == CompetencyScopeKind.EQUIPMENT:
            if self.equipment_id is None:
                errors["equipment"] = "equipment is required when competency_scope=EQUIPMENT."
        elif self.equipment_id is not None:
            errors["equipment"] = "equipment is only applicable for EQUIPMENT scope."

        if self.competency_scope == CompetencyScopeKind.BUSINESS_ROLE:
            if self.business_role_id is None:
                errors["business_role"] = (
                    "business_role is required when competency_scope=BUSINESS_ROLE."
                )
        elif self.business_role_id is not None:
            errors["business_role"] = "business_role is only applicable for BUSINESS_ROLE scope."

        checklist_template = self.checklist_template
        if checklist_template is not None and self.organization_id:
            if checklist_template.organization_id != self.organization_id:
                errors["checklist_template"] = (
                    "Checklist template must belong to the selected organization."
                )
        equipment = self.equipment
        if equipment is not None and self.organization_id:
            if equipment.organization_id != self.organization_id:
                errors["equipment"] = "Equipment must belong to the selected organization."

        if errors:
            raise ValidationError(errors)


class TrainingEnforcementPolicy(models.Model):
    """
    Organization-scoped future gate mode (OFF / WARN / BLOCK).

    Default when unset is OFF. Phase 05E never blocks recording from this policy.
    Enabling WARN/BLOCK for production requires APR evidence.
    """

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    organization = models.OneToOneField(
        "organizations.Organization",
        on_delete=models.PROTECT,
        related_name="training_enforcement_policy",
    )
    gate_mode = models.CharField(
        max_length=16,
        choices=TrainingGateMode.choices,
        default=TrainingGateMode.OFF,
        help_text="Future recording-gate mode. OFF until company policy approves WARN/BLOCK.",
    )
    notes = models.TextField(blank=True, default="")
    updated_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        related_name="training_enforcement_policies_updated",
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = "Training enforcement policy"
        verbose_name_plural = "Training enforcement policies"

    def __str__(self) -> str:
        return f"{self.organization_id}:{self.gate_mode}"


def evaluate_training_currency(
    record: TrainingRecord,
    *,
    as_of: date | None = None,
) -> str:
    """
    Derive VALID / FUTURE / EXPIRED / INACTIVE.

    Does **not** block recording. Gate mode is separate (default OFF).
    """
    moment = as_of or timezone.localdate()
    if record.status != TrainingRecordStatus.ACTIVE:
        return TrainingCurrency.INACTIVE
    if record.trained_on > moment:
        return TrainingCurrency.FUTURE
    if record.expires_on is not None and record.expires_on < moment:
        return TrainingCurrency.EXPIRED
    return TrainingCurrency.VALID


def resolve_training_gate_mode(
    organization_id: uuid.UUID | None = None,
    *,
    policy: TrainingEnforcementPolicy | None = None,
) -> str:
    """Return configured gate mode or OFF when unset. Never invents WARN/BLOCK."""
    if policy is not None:
        return policy.gate_mode
    if organization_id is None:
        return TrainingGateMode.OFF
    row = (
        TrainingEnforcementPolicy.objects.filter(organization_id=organization_id)
        .only("gate_mode")
        .first()
    )
    return row.gate_mode if row is not None else TrainingGateMode.OFF
