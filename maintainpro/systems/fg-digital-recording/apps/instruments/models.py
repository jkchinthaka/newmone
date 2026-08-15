"""Equipment and calibration foundation — unseeded; no invented intervals."""

from __future__ import annotations

import uuid
from datetime import date

from django.conf import settings
from django.core.exceptions import ValidationError
from django.db import models
from django.db.models import Q
from django.db.models.functions import Lower
from django.utils import timezone


class EquipmentType(models.TextChoices):
    """
    Technical equipment-type taxonomy labels only.

    Not a seeded asset catalogue. Production type vocabulary remains owner-confirmed.
    """

    SCALE = "SCALE", "Scale"
    THERMOMETER = "THERMOMETER", "Thermometer"
    PROBE = "PROBE", "Probe"
    METAL_DETECTOR = "METAL_DETECTOR", "Metal detector"
    LAB_INSTRUMENT = "LAB_INSTRUMENT", "Lab instrument"
    OTHER = "OTHER", "Other"


class EquipmentOperationalStatus(models.TextChoices):
    """Operational service state — independent of calibration fitness."""

    IN_SERVICE = "IN_SERVICE", "In service"
    OUT_OF_SERVICE = "OUT_OF_SERVICE", "Out of service"


class CalibrationFitness(models.TextChoices):
    """
    Derived fitness labels for architecture / reporting.

    Whether OVERDUE blocks recording is company policy (EVIDENCE REQUIRED).
    Phase 05D exposes labels only — does not enforce block/warn.
    """

    VALID = "VALID", "Valid"
    DUE = "DUE", "Due"
    OVERDUE = "OVERDUE", "Overdue"
    OUT_OF_SERVICE = "OUT_OF_SERVICE", "Out of service"
    UNKNOWN = "UNKNOWN", "Unknown"


class CalibrationRecordStatus(models.TextChoices):
    """
    Explicit calibration-record lifecycle labels.

    Frequency/interval rules are not encoded. VOID retains the row (no hard delete).
    """

    RECORDED = "RECORDED", "Recorded"
    VOID = "VOID", "Void"


class Equipment(models.Model):
    """
    Organization-scoped measurement equipment master.

    No business equipment rows are seeded. Historical checklist/recording links
    (future) must use PROTECT and survive equipment inactivation.
    """

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    organization = models.ForeignKey(
        "organizations.Organization",
        on_delete=models.PROTECT,
        related_name="equipment_assets",
    )
    site = models.ForeignKey(
        "organizations.Site",
        on_delete=models.PROTECT,
        null=True,
        blank=True,
        related_name="equipment_assets",
    )
    code = models.CharField(max_length=64)
    name = models.CharField(max_length=255)
    equipment_type = models.CharField(
        max_length=32,
        choices=EquipmentType.choices,
        default=EquipmentType.OTHER,
    )
    serial_number = models.CharField(max_length=128, blank=True, default="")
    location_label = models.CharField(
        max_length=255,
        blank=True,
        default="",
        help_text="Optional free-text location label within site/org.",
    )
    manufacturer = models.CharField(max_length=128, blank=True, default="")
    model_name = models.CharField(max_length=128, blank=True, default="")
    operational_status = models.CharField(
        max_length=32,
        choices=EquipmentOperationalStatus.choices,
        default=EquipmentOperationalStatus.IN_SERVICE,
    )
    is_active = models.BooleanField(
        default=True,
        help_text="Inactive equipment remains historically referenceable; prefer over delete.",
    )
    notes = models.TextField(blank=True, default="")
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ("organization__code", "code")
        verbose_name = "Equipment"
        verbose_name_plural = "Equipment"
        permissions = [
            ("manage_equipment", "Can manage equipment and calibration records"),
            (
                "override_calibration_gate",
                "Can override calibration WARN/BLOCK when company policy approves",
            ),
        ]
        constraints = [
            models.UniqueConstraint(
                Lower("code"),
                "organization",
                name="inst_equipment_org_code_ci_uniq",
            ),
        ]
        indexes = [
            models.Index(
                fields=["organization", "is_active"],
                name="inst_equip_org_act_idx",
            ),
            models.Index(
                fields=["organization", "equipment_type"],
                name="inst_equip_org_type_idx",
            ),
            models.Index(Lower("code"), name="inst_equip_code_lower_idx"),
        ]

    def __str__(self) -> str:
        return f"{self.organization.code}/{self.code}"

    def clean(self) -> None:
        super().clean()
        errors: dict[str, str] = {}
        if not (self.code or "").strip():
            errors["code"] = "Equipment code is required."
        if not (self.name or "").strip():
            errors["name"] = "Equipment name is required."
        site = self.site
        if site is not None and self.organization_id:
            if site.organization_id != self.organization_id:
                errors["site"] = "Site must belong to the selected organization."
        if errors:
            raise ValidationError(errors)


class CalibrationRecord(models.Model):
    """
    Explicit calibration event for an equipment asset.

    next_due_on is entered when known — never derived from an invented interval.
    Certificate / provider fields are references only (attachments deferred).
    """

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    equipment = models.ForeignKey(
        Equipment,
        on_delete=models.PROTECT,
        related_name="calibration_records",
    )
    calibrated_on = models.DateField()
    next_due_on = models.DateField(
        null=True,
        blank=True,
        help_text="Optional next-due date when evidenced. Not auto-calculated from a frequency.",
    )
    certificate_reference = models.CharField(max_length=255, blank=True, default="")
    provider_reference = models.CharField(
        max_length=255,
        blank=True,
        default="",
        help_text="Calibration provider / lab reference (not invented).",
    )
    status = models.CharField(
        max_length=16,
        choices=CalibrationRecordStatus.choices,
        default=CalibrationRecordStatus.RECORDED,
        help_text="Record lifecycle. Prefer VOID over hard delete. Expansion EVIDENCE REQUIRED.",
    )
    recorded_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        related_name="calibration_records_recorded",
    )
    notes = models.TextField(blank=True, default="")
    # Evidence attachment deferred (object storage) — metadata-only in Phase 05D.
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ("-calibrated_on", "-created_at")
        verbose_name = "Calibration record"
        verbose_name_plural = "Calibration records"
        constraints = [
            models.CheckConstraint(
                condition=(
                    Q(next_due_on__isnull=True) | Q(next_due_on__gte=models.F("calibrated_on"))
                ),
                name="inst_calib_next_due_gte_calibrated",
            ),
        ]
        indexes = [
            models.Index(
                fields=["equipment", "calibrated_on"],
                name="inst_calib_equip_on_idx",
            ),
            models.Index(fields=["next_due_on"], name="inst_calib_next_due_idx"),
        ]

    def __str__(self) -> str:
        return f"{self.equipment_id}@{self.calibrated_on}"

    def clean(self) -> None:
        super().clean()
        if (
            self.next_due_on is not None
            and self.calibrated_on is not None
            and self.next_due_on < self.calibrated_on
        ):
            raise ValidationError(
                {"next_due_on": "next_due_on cannot be earlier than calibrated_on."}
            )


def evaluate_calibration_fitness(
    equipment: Equipment,
    *,
    as_of: date | None = None,
    latest_record: CalibrationRecord | None = None,
) -> str:
    """
    Derive VALID / DUE / OVERDUE / OUT_OF_SERVICE / UNKNOWN.

    Does **not** block recording. Policy for block vs warn is EVIDENCE REQUIRED.
    DUE means next_due_on equals as_of (no invented lead-time window).
    """
    moment = as_of or timezone.localdate()
    if (
        not equipment.is_active
        or equipment.operational_status == EquipmentOperationalStatus.OUT_OF_SERVICE
    ):
        return CalibrationFitness.OUT_OF_SERVICE

    record = latest_record
    if record is None:
        record = (
            CalibrationRecord.objects.filter(
                equipment=equipment,
                status=CalibrationRecordStatus.RECORDED,
            )
            .order_by("-calibrated_on", "-created_at")
            .first()
        )
    if record is None or record.next_due_on is None:
        return CalibrationFitness.UNKNOWN
    if record.next_due_on < moment:
        return CalibrationFitness.OVERDUE
    if record.next_due_on == moment:
        return CalibrationFitness.DUE
    return CalibrationFitness.VALID
