"""
Supplier quality records keyed by ERP supplier reference.

Not a financial/commercial supplier master. No invented certificate types or scores.
"""

from __future__ import annotations

import uuid

from django.conf import settings
from django.core.exceptions import ValidationError
from django.db import models
from django.db.models.functions import Lower

from apps.capa.models import CorrectiveAction
from apps.nonconformance.models import NonConformanceRecord
from apps.organizations.models import Organization


class SupplierQualityEventKind(models.TextChoices):
    """Generic event categories for recording — not scoring rubrics."""

    INCOMING_DEFECT = "INCOMING_DEFECT", "Incoming defect"
    AUDIT = "AUDIT", "Supplier audit"
    COMPLAINT = "COMPLAINT", "Complaint"
    OTHER = "OTHER", "Other"


class SupplierQualityProfile(models.Model):
    """
    Organization-scoped quality profile for an external ERP supplier reference.

    `erp_supplier_reference` is the anti-corruption mapping key. Display name is a
    local label only — official commercial supplier master remains in ERP.
    `quality_status` is free-form configurable text (no seeded APPROVED/REJECTED
    catalogue presented as Nelna policy).
    """

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    organization = models.ForeignKey(
        Organization,
        on_delete=models.PROTECT,
        related_name="supplier_quality_profiles",
    )
    erp_supplier_reference = models.CharField(
        max_length=128,
        help_text="External ERP/Bileeta supplier identifier — not a local financial master code.",
    )
    display_name = models.CharField(max_length=255, blank=True, default="")
    quality_status = models.CharField(
        max_length=64,
        blank=True,
        default="",
        help_text="Optional configurable status label. Official values remain EVIDENCE REQUIRED.",
    )
    is_active = models.BooleanField(default=True)
    notes = models.TextField(blank=True, default="")
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ("organization__code", "erp_supplier_reference")
        verbose_name = "Supplier quality profile"
        verbose_name_plural = "Supplier quality profiles"
        permissions = [
            (
                "manage_supplierquality_qa",
                "Can manage supplier quality profiles (QA)",
            ),
            (
                "view_supplierquality_procurement",
                "Can view supplier quality profiles (Procurement)",
            ),
        ]
        constraints = [
            models.UniqueConstraint(
                Lower("erp_supplier_reference"),
                "organization",
                name="sq_profile_org_erp_ref_ci_uniq",
            ),
        ]
        indexes = [
            models.Index(
                fields=["organization", "is_active"],
                name="sq_profile_org_act_idx",
            ),
        ]

    def __str__(self) -> str:
        return f"{self.organization.code}/{self.erp_supplier_reference}"

    def clean(self) -> None:
        super().clean()
        if not (self.erp_supplier_reference or "").strip():
            raise ValidationError(
                {"erp_supplier_reference": "ERP supplier reference cannot be blank."}
            )


class SupplierCertificate(models.Model):
    """
    Configurable certificate record. Certificate types are operator-supplied strings.

    No mandatory certificate catalogue is seeded. Evidence is an object-storage key
    placeholder until the evidence module owns uploads (no PostgreSQL BLOBs).
    Soft retention: no hard delete.
    """

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    profile = models.ForeignKey(
        SupplierQualityProfile,
        on_delete=models.PROTECT,
        related_name="certificates",
    )
    certificate_type = models.CharField(max_length=128)
    issued_on = models.DateField(null=True, blank=True)
    expires_on = models.DateField(null=True, blank=True)
    evidence_object_key = models.CharField(
        max_length=512,
        blank=True,
        default="",
        help_text="Object-storage key placeholder — not a file BLOB.",
    )
    verified_at = models.DateTimeField(null=True, blank=True)
    verified_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        null=True,
        blank=True,
        related_name="supplier_certificates_verified",
    )
    verification_note = models.TextField(blank=True, default="")
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ("profile", "-expires_on", "certificate_type")
        verbose_name = "Supplier certificate"
        verbose_name_plural = "Supplier certificates"
        indexes = [
            models.Index(fields=["expires_on"], name="sq_cert_expires_idx"),
            models.Index(fields=["profile", "certificate_type"], name="sq_cert_profile_type_idx"),
        ]

    def __str__(self) -> str:
        return f"{self.profile_id}/{self.certificate_type}"

    def clean(self) -> None:
        super().clean()
        if not (self.certificate_type or "").strip():
            raise ValidationError({"certificate_type": "Certificate type cannot be blank."})
        if self.issued_on and self.expires_on and self.expires_on < self.issued_on:
            raise ValidationError({"expires_on": "Expiry cannot be before issue date."})


class SupplierQualityEvent(models.Model):
    """Append-oriented quality event against a supplier profile. No hard delete."""

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    profile = models.ForeignKey(
        SupplierQualityProfile,
        on_delete=models.PROTECT,
        related_name="quality_events",
    )
    event_kind = models.CharField(max_length=32, choices=SupplierQualityEventKind.choices)
    occurred_at = models.DateTimeField()
    summary = models.TextField()
    nonconformance = models.ForeignKey(
        NonConformanceRecord,
        on_delete=models.PROTECT,
        null=True,
        blank=True,
        related_name="supplier_quality_events",
    )
    corrective_action = models.ForeignKey(
        CorrectiveAction,
        on_delete=models.PROTECT,
        null=True,
        blank=True,
        related_name="supplier_quality_events",
    )
    recorded_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        related_name="supplier_quality_events_recorded",
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ("-occurred_at",)
        verbose_name = "Supplier quality event"
        verbose_name_plural = "Supplier quality events"
        indexes = [
            models.Index(fields=["profile", "event_kind"], name="sq_event_profile_kind_idx"),
            models.Index(fields=["occurred_at"], name="sq_event_occurred_idx"),
        ]

    def __str__(self) -> str:
        return f"{self.event_kind} @ {self.occurred_at}"

    def clean(self) -> None:
        super().clean()
        if not (self.summary or "").strip():
            raise ValidationError({"summary": "Summary cannot be blank."})
        org_id = self.profile.organization_id if self.profile_id else None
        if self.nonconformance_id and org_id is not None:
            ncr = self.nonconformance
            if ncr is not None and ncr.organization_id != org_id:
                raise ValidationError(
                    {"nonconformance": "Linked NCR must belong to the same organization."}
                )
        if self.corrective_action_id and org_id is not None:
            capa = self.corrective_action
            if capa is not None and capa.organization_id != org_id:
                raise ValidationError(
                    {"corrective_action": "Linked CAPA must belong to the same organization."}
                )
