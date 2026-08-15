"""Raw / material receiving quality foundation — Phase 31.

ERP owns inventory. This module records quality inspection against ERP
receipt/GRN and material references. Does not invent material catalogues,
specification limits, or update ERP stock state.
"""

from __future__ import annotations

import uuid
from decimal import Decimal

from django.conf import settings
from django.core.exceptions import ValidationError
from django.core.validators import MinValueValidator
from django.db import models
from django.db.models.functions import Lower
from django.utils import timezone

from apps.organizations.models import Organization


class MaterialSpecStatus(models.TextChoices):
    DRAFT = "DRAFT", "Draft"
    APPROVED = "APPROVED", "Approved"
    RETIRED = "RETIRED", "Retired"


class ReceiptQualityState(models.TextChoices):
    """Local quality states only — ERP stock effect remains separately governed."""

    PENDING_INSPECTION = "PENDING_INSPECTION", "Pending inspection"
    ACCEPTED = "ACCEPTED", "Accepted"
    HOLD = "HOLD", "Hold"
    REJECTED = "REJECTED", "Rejected"


class MaterialReference(models.Model):
    """
    Thin material mapping shell preferring ERP ownership.

    Not an inventory master. Official material catalogues remain in ERP.
    """

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    organization = models.ForeignKey(
        Organization,
        on_delete=models.PROTECT,
        related_name="material_references",
    )
    erp_material_reference = models.CharField(
        max_length=128,
        help_text="External ERP/Bileeta material / item identifier — preferred key.",
    )
    display_name = models.CharField(
        max_length=255,
        blank=True,
        default="",
        help_text="Local label only — official description remains ERP-owned.",
    )
    uom_reference = models.CharField(
        max_length=32,
        blank=True,
        default="",
        help_text="Opaque UOM reference — catalogue EVIDENCE REQUIRED.",
    )
    notes = models.TextField(blank=True, default="")
    is_active = models.BooleanField(default=True)
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        related_name="material_references_created",
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ("organization__code", "erp_material_reference")
        verbose_name = "Material reference"
        verbose_name_plural = "Material references"
        permissions = [
            (
                "manage_materialreference",
                "Can manage ERP-mapped material reference shells",
            ),
            (
                "manage_receiptquality",
                "Can create/edit raw material receipt quality records",
            ),
            (
                "disposition_receiptquality",
                "Can set receipt quality disposition (ACCEPTED/HOLD/REJECTED)",
            ),
            (
                "view_receiptquality",
                "Can view receipt quality / material receiving records",
            ),
            (
                "manage_materialspecification",
                "Can draft material specification versions",
            ),
            (
                "approve_materialspecification",
                "Can approve/retire material specification versions",
            ),
        ]
        constraints = [
            models.UniqueConstraint(
                Lower("erp_material_reference"),
                "organization",
                name="receiving_material_erp_ref_org_ci_uniq",
            ),
        ]

    def __str__(self) -> str:
        return f"{self.organization.code}/{self.erp_material_reference}"

    def clean(self) -> None:
        super().clean()
        if not (self.erp_material_reference or "").strip():
            raise ValidationError(
                {"erp_material_reference": "ERP material reference cannot be blank."}
            )


class MaterialSpecification(models.Model):
    """Versioned material specification container — no seeded limits."""

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    organization = models.ForeignKey(
        Organization,
        on_delete=models.PROTECT,
        related_name="material_specifications",
    )
    material = models.ForeignKey(
        MaterialReference,
        on_delete=models.PROTECT,
        related_name="specifications",
    )
    code = models.CharField(max_length=64)
    title = models.CharField(max_length=255)
    description = models.TextField(blank=True, default="")
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        related_name="material_specifications_created",
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ("material__erp_material_reference", "code")
        constraints = [
            models.UniqueConstraint(
                Lower("code"),
                "organization",
                name="receiving_material_spec_org_code_ci_uniq",
            ),
        ]

    def __str__(self) -> str:
        return f"{self.code} ({self.material.erp_material_reference})"

    def clean(self) -> None:
        super().clean()
        material = self.material
        if material is not None and self.organization_id:
            if material.organization_id != self.organization_id:
                raise ValidationError({"material": "Material must belong to the organization."})


class MaterialSpecificationVersion(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    specification = models.ForeignKey(
        MaterialSpecification,
        on_delete=models.PROTECT,
        related_name="versions",
    )
    version_number = models.PositiveIntegerField(validators=[MinValueValidator(1)])
    status = models.CharField(
        max_length=16,
        choices=MaterialSpecStatus.choices,
        default=MaterialSpecStatus.DRAFT,
    )
    change_summary = models.TextField(blank=True, default="")
    approval_reference = models.CharField(
        max_length=255,
        blank=True,
        default="",
        help_text="Opaque company approval reference — not invented.",
    )
    effective_from = models.DateField(null=True, blank=True)
    effective_to = models.DateField(null=True, blank=True)
    approved_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        null=True,
        blank=True,
        related_name="material_spec_versions_approved",
    )
    approved_at = models.DateTimeField(null=True, blank=True)
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        related_name="material_spec_versions_created",
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ("specification__code", "-version_number")
        constraints = [
            models.UniqueConstraint(
                fields=["specification", "version_number"],
                name="receiving_material_spec_version_uniq",
            ),
        ]

    def __str__(self) -> str:
        return f"{self.specification.code} v{self.version_number} ({self.status})"

    @property
    def is_immutable(self) -> bool:
        return self.status in {
            MaterialSpecStatus.APPROVED,
            MaterialSpecStatus.RETIRED,
        }

    def clean(self) -> None:
        super().clean()
        if (
            self.effective_from is not None
            and self.effective_to is not None
            and self.effective_from > self.effective_to
        ):
            raise ValidationError({"effective_to": "effective_to cannot be before effective_from."})


class MaterialSpecificationParameter(models.Model):
    """Parameter shell — bounds optional and never seeded as Nelna facts."""

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    version = models.ForeignKey(
        MaterialSpecificationVersion,
        on_delete=models.CASCADE,
        related_name="parameters",
    )
    code = models.CharField(max_length=64)
    name = models.CharField(max_length=255)
    unit = models.CharField(max_length=32, blank=True, default="")
    bound_min = models.DecimalField(max_digits=18, decimal_places=6, null=True, blank=True)
    bound_max = models.DecimalField(max_digits=18, decimal_places=6, null=True, blank=True)
    notes = models.TextField(
        blank=True,
        default="",
        help_text="Bounds remain EVIDENCE REQUIRED until company specs approved.",
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ("code",)
        constraints = [
            models.UniqueConstraint(
                fields=["version", "code"],
                name="receiving_material_spec_param_uniq",
            ),
        ]

    def __str__(self) -> str:
        return f"{self.code}"


class ReceiptQualityRecord(models.Model):
    """
    Incoming material quality record keyed to ERP receipt/GRN.

    Local quality_state does not update ERP inventory.
    """

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    organization = models.ForeignKey(
        Organization,
        on_delete=models.PROTECT,
        related_name="receipt_quality_records",
    )
    erp_receipt_reference = models.CharField(
        max_length=128,
        help_text="ERP GRN / goods-receipt reference — inventory ownership remains ERP.",
    )
    supplier_profile = models.ForeignKey(
        "supplier_quality.SupplierQualityProfile",
        on_delete=models.PROTECT,
        related_name="receipt_quality_records",
    )
    supplier_lot = models.CharField(
        max_length=128,
        help_text="Supplier lot / batch identity as received.",
    )
    material = models.ForeignKey(
        MaterialReference,
        on_delete=models.PROTECT,
        related_name="receipt_quality_records",
    )
    quantity = models.DecimalField(
        max_digits=18,
        decimal_places=6,
        null=True,
        blank=True,
        validators=[MinValueValidator(Decimal("0"))],
    )
    uom = models.CharField(max_length=32, blank=True, default="")
    received_date = models.DateField(default=timezone.localdate)
    quality_state = models.CharField(
        max_length=32,
        choices=ReceiptQualityState.choices,
        default=ReceiptQualityState.PENDING_INSPECTION,
    )
    inspection_checklist_template = models.ForeignKey(
        "checklists.ChecklistTemplate",
        on_delete=models.PROTECT,
        null=True,
        blank=True,
        related_name="receipt_quality_records",
    )
    inspection_checklist_version = models.ForeignKey(
        "checklists.ChecklistVersion",
        on_delete=models.PROTECT,
        null=True,
        blank=True,
        related_name="receipt_quality_records",
    )
    material_specification_version = models.ForeignKey(
        MaterialSpecificationVersion,
        on_delete=models.PROTECT,
        null=True,
        blank=True,
        related_name="receipt_quality_records",
        help_text="Optional approved material spec version — no invented limits.",
    )
    disposition_notes = models.TextField(blank=True, default="")
    evidence_object_key = models.CharField(max_length=512, blank=True, default="")
    evidence_file_name = models.CharField(max_length=255, blank=True, default="")
    frozen_receipt_context = models.JSONField(default=dict, blank=True)
    dispositioned_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        null=True,
        blank=True,
        related_name="receipt_quality_dispositioned",
    )
    dispositioned_at = models.DateTimeField(null=True, blank=True)
    recorded_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        related_name="receipt_quality_recorded",
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ("-received_date", "-created_at")
        verbose_name = "Receipt quality record"
        verbose_name_plural = "Receipt quality records"
        indexes = [
            models.Index(fields=["organization", "erp_receipt_reference"]),
            models.Index(fields=["organization", "supplier_lot"]),
            models.Index(fields=["organization", "quality_state"]),
        ]
        constraints = [
            models.UniqueConstraint(
                Lower("erp_receipt_reference"),
                "organization",
                "supplier_lot",
                "material",
                name="receiving_receipt_org_grn_lot_material_ci_uniq",
            ),
        ]

    def __str__(self) -> str:
        return (
            f"{self.organization.code}/{self.erp_receipt_reference}/"
            f"{self.supplier_lot} ({self.quality_state})"
        )

    def clean(self) -> None:
        super().clean()
        supplier_profile = self.supplier_profile
        if supplier_profile is not None and self.organization_id:
            if supplier_profile.organization_id != self.organization_id:
                raise ValidationError(
                    {"supplier_profile": "Supplier must belong to the organization."}
                )
        material = self.material
        if material is not None and self.organization_id:
            if material.organization_id != self.organization_id:
                raise ValidationError({"material": "Material must belong to the organization."})
        if not (self.erp_receipt_reference or "").strip():
            raise ValidationError(
                {"erp_receipt_reference": "ERP receipt/GRN reference is required."}
            )
        if not (self.supplier_lot or "").strip():
            raise ValidationError({"supplier_lot": "Supplier lot is required."})
        inspection_checklist_version = self.inspection_checklist_version
        if (
            self.inspection_checklist_version_id
            and self.inspection_checklist_template_id
            and inspection_checklist_version is not None
            and inspection_checklist_version.template_id != self.inspection_checklist_template_id
        ):
            raise ValidationError(
                {
                    "inspection_checklist_version": (
                        "Checklist version must belong to the selected template."
                    )
                }
            )


class ReceiptLabSampleLink(models.Model):
    """Bridge incoming receipt quality to Phase 22 LabSample."""

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    receipt = models.ForeignKey(
        ReceiptQualityRecord,
        on_delete=models.PROTECT,
        related_name="lab_sample_links",
    )
    lab_sample = models.ForeignKey(
        "laboratory.LabSample",
        on_delete=models.PROTECT,
        related_name="receipt_quality_links",
    )
    notes = models.CharField(max_length=255, blank=True, default="")
    linked_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        related_name="receipt_lab_sample_links",
    )
    linked_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=["receipt", "lab_sample"],
                name="receiving_receipt_lab_sample_uniq",
            ),
        ]

    def __str__(self) -> str:
        return f"{self.receipt_id}->{self.lab_sample_id}"

    def clean(self) -> None:
        super().clean()
        receipt = self.receipt
        if receipt is not None and self.lab_sample_id:
            if receipt.organization_id != self.lab_sample.organization_id:
                raise ValidationError(
                    {"lab_sample": "Lab sample must belong to the same organization."}
                )


class ReceivingHistoryEntry(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    organization = models.ForeignKey(
        Organization,
        on_delete=models.PROTECT,
        related_name="receiving_history_entries",
    )
    receipt = models.ForeignKey(
        ReceiptQualityRecord,
        on_delete=models.PROTECT,
        null=True,
        blank=True,
        related_name="history_entries",
    )
    event_type = models.CharField(max_length=64)
    note = models.CharField(max_length=255, blank=True, default="")
    metadata = models.JSONField(default=dict, blank=True)
    actor = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        related_name="receiving_history_actions",
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ("-created_at",)

    def __str__(self) -> str:
        return f"{self.event_type}:{self.receipt_id}"
