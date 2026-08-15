"""Electronic Batch Quality Dossier — Phase 35.

Read-only aggregation of authorized references for one opaque batch_reference.
Does not copy mutable source records; uses references + immutable snapshots.
"""

from __future__ import annotations

import uuid

from django.conf import settings
from django.db import models

from apps.organizations.models import Organization


class BatchDossierExportStatus(models.TextChoices):
    PREPARED = "PREPARED", "Prepared (hook only)"
    BLOCKED = "BLOCKED", "Blocked by dual-gate"
    FAILED = "FAILED", "Failed"


class BatchDossierPolicy(models.Model):
    """
    Org dossier policy stubs.

    PDF evidence-pack export remains dual-gated OFF (APR-060).
    """

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    organization = models.OneToOneField(
        Organization,
        on_delete=models.PROTECT,
        related_name="batch_dossier_policy",
    )
    pdf_export_enabled = models.BooleanField(
        default=False,
        help_text="Org stub only — still requires BATCH_DOSSIER_PDF_EXPORT_APPROVED.",
    )
    procedure_reference = models.CharField(max_length=255, blank=True, default="")
    notes = models.TextField(blank=True, default="")
    updated_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        related_name="batch_dossier_policies_updated",
    )
    updated_at = models.DateTimeField(auto_now=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name = "Batch dossier policy"
        verbose_name_plural = "Batch dossier policies"
        permissions = [
            ("view_batchdossier", "Can view electronic batch quality dossier"),
            ("export_batchdossier", "Can prepare batch dossier PDF export hook"),
            ("manage_batchdossierpolicy", "Can update batch dossier policy stubs"),
        ]

    def __str__(self) -> str:
        return f"{self.organization.code} batch dossier policy"


class BatchDossierExportRequest(models.Model):
    """
    Controlled PDF evidence-pack export hook.

    Does not generate PDF content in Phase 35 — prepare/blocked audit only.
    """

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    organization = models.ForeignKey(
        Organization,
        on_delete=models.PROTECT,
        related_name="batch_dossier_export_requests",
    )
    batch_reference = models.CharField(max_length=128)
    status = models.CharField(
        max_length=16,
        choices=BatchDossierExportStatus.choices,
        default=BatchDossierExportStatus.BLOCKED,
    )
    reason_code = models.CharField(max_length=64, blank=True, default="")
    procedure_reference = models.CharField(max_length=255, blank=True, default="")
    dossier_fingerprint = models.CharField(
        max_length=64,
        blank=True,
        default="",
        help_text="Opaque hash of assembled reference ids at prepare time.",
    )
    metadata = models.JSONField(default=dict, blank=True)
    requested_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        related_name="batch_dossier_exports_requested",
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ("-created_at",)
        indexes = [
            models.Index(fields=["organization", "batch_reference"]),
            models.Index(fields=["organization", "status"]),
        ]

    def __str__(self) -> str:
        return f"EBR-EXPORT/{self.batch_reference}/{self.status}"
