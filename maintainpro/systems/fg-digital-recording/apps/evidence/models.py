"""Evidence attachment models — metadata only; binaries stay in private storage."""

from __future__ import annotations

import uuid

from django.conf import settings
from django.core.exceptions import ValidationError
from django.db import models

from apps.organizations.models import Organization


class EvidenceLinkedKind(models.TextChoices):
    """Architecture-approved attachment targets (Phase 11 + future NCR/CAPA)."""

    CHECKLIST_RESPONSE = "CHECKLIST_RESPONSE", "Checklist response (draft)"
    CHECKLIST_SUBMISSION = "CHECKLIST_SUBMISSION", "Checklist submission"
    SUPERVISOR_REVIEW = "SUPERVISOR_REVIEW", "Supervisor review"
    QA_REVIEW = "QA_REVIEW", "QA review"
    NONCONFORMANCE = "NONCONFORMANCE", "Nonconformance (future)"
    CAPA = "CAPA", "CAPA (future)"
    LAB_SAMPLE = "LAB_SAMPLE", "Laboratory sample"
    LAB_EXTERNAL_CERTIFICATE = "LAB_EXTERNAL_CERTIFICATE", "Laboratory external certificate"
    CALIBRATION_CERTIFICATE = (
        "CALIBRATION_CERTIFICATE",
        "Calibration certificate (equipment record)",
    )
    SANITATION_PROGRAM = (
        "SANITATION_PROGRAM",
        "Sanitation / SSOP program",
    )
    MONITORING_READING = (
        "MONITORING_READING",
        "Environmental monitoring reading",
    )
    PACKAGING_ARTWORK_VERSION = (
        "PACKAGING_ARTWORK_VERSION",
        "Packaging artwork version evidence",
    )
    CHANGEOVER_RECORD = (
        "CHANGEOVER_RECORD",
        "Changeover / allergen changeover record",
    )
    LINE_CLEARANCE_RECORD = (
        "LINE_CLEARANCE_RECORD",
        "Line clearance record",
    )
    RECEIPT_QUALITY_RECORD = (
        "RECEIPT_QUALITY_RECORD",
        "Raw material receipt quality record",
    )
    IQC_INSPECTION_CASE = (
        "IQC_INSPECTION_CASE",
        "Incoming quality control inspection case",
    )
    IPQC_INSPECTION_CASE = (
        "IPQC_INSPECTION_CASE",
        "In-process quality control inspection case",
    )
    RECALL_CASE = (
        "RECALL_CASE",
        "Product recall / withdrawal case",
    )
    CUSTOMER_COMPLAINT_CASE = (
        "CUSTOMER_COMPLAINT_CASE",
        "Customer quality complaint case",
    )
    RETURN_QUALITY_RECORD = (
        "RETURN_QUALITY_RECORD",
        "Returned product quality record",
    )
    QUALITY_DOCUMENT_VERSION = (
        "QUALITY_DOCUMENT_VERSION",
        "Quality document version file",
    )
    QUALITY_AUDIT_FINDING = (
        "QUALITY_AUDIT_FINDING",
        "QMS quality audit finding evidence",
    )
    COMPLIANCE_CONTROL_MAPPING = (
        "COMPLIANCE_CONTROL_MAPPING",
        "Compliance control-mapping evidence",
    )


class EvidenceLifecycleStatus(models.TextChoices):
    ACTIVE = "ACTIVE", "Active"
    RETIRED = "RETIRED", "Retired (soft-removed)"


class EvidenceMalwareScanStatus(models.TextChoices):
    NOT_CONFIGURED = "NOT_CONFIGURED", "Scanner not configured"
    PENDING = "PENDING", "Scan pending"
    CLEAN = "CLEAN", "Clean"
    INFECTED = "INFECTED", "Infected"
    ERROR = "ERROR", "Scan error"


class EvidenceAttachment(models.Model):
    """
    Generic evidence metadata for quality workflows.

    Binaries are referenced by storage_key in private object/filesystem storage —
    never stored as PostgreSQL BLOBs. Soft retention only; no casual hard-delete.
    """

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    organization = models.ForeignKey(
        Organization,
        on_delete=models.PROTECT,
        related_name="evidence_attachments",
    )
    linked_kind = models.CharField(
        max_length=32,
        choices=EvidenceLinkedKind.choices,
    )
    linked_object_id = models.UUIDField(
        help_text="Primary key of the allowlisted linked domain object.",
    )
    original_filename = models.CharField(max_length=180)
    storage_key = models.CharField(
        max_length=512,
        unique=True,
        help_text="Opaque private storage key (randomized; not a public URL).",
    )
    content_type = models.CharField(max_length=128)
    size_bytes = models.PositiveBigIntegerField()
    content_sha256 = models.CharField(
        max_length=64,
        help_text="Lowercase hex SHA-256 of stored file bytes.",
    )
    caption = models.CharField(max_length=255, blank=True, default="")
    uploaded_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        related_name="evidence_uploads",
    )
    uploaded_at = models.DateTimeField(auto_now_add=True)
    lifecycle_status = models.CharField(
        max_length=16,
        choices=EvidenceLifecycleStatus.choices,
        default=EvidenceLifecycleStatus.ACTIVE,
    )
    linkage_immutable = models.BooleanField(
        default=False,
        help_text=(
            "True when linked to a finalized immutable record or when draft "
            "parent is no longer mutable. Controlled soft-retire only."
        ),
    )
    retired_at = models.DateTimeField(null=True, blank=True)
    retired_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        null=True,
        blank=True,
        related_name="evidence_retirements",
    )
    retirement_reason = models.CharField(max_length=255, blank=True, default="")
    malware_scan_status = models.CharField(
        max_length=32,
        choices=EvidenceMalwareScanStatus.choices,
        default=EvidenceMalwareScanStatus.NOT_CONFIGURED,
    )
    malware_scan_provider = models.CharField(max_length=64, blank=True, default="")
    malware_scan_detail = models.TextField(blank=True, default="")
    malware_scanned_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ("-uploaded_at",)
        verbose_name = "Evidence attachment"
        verbose_name_plural = "Evidence attachments"
        permissions = [
            (
                "upload_evidenceattachment",
                "Can upload evidence attachments",
            ),
            (
                "retire_evidenceattachment",
                "Can soft-retire evidence attachments",
            ),
        ]
        # view_evidenceattachment is Django's default view permission (not duplicated here).
        indexes = [
            models.Index(
                fields=["organization", "linked_kind", "linked_object_id"],
                name="ev_org_link_idx",
            ),
            models.Index(
                fields=["organization", "lifecycle_status", "uploaded_at"],
                name="ev_org_life_up_idx",
            ),
            models.Index(
                fields=["content_sha256"],
                name="ev_sha256_idx",
            ),
        ]

    def __str__(self) -> str:
        return f"Evidence {self.original_filename} ({self.linked_kind})"

    def clean(self) -> None:
        super().clean()
        if self.content_sha256 and len(self.content_sha256) != 64:
            raise ValidationError({"content_sha256": "SHA-256 digest must be 64 hex characters."})
        if self.lifecycle_status == EvidenceLifecycleStatus.RETIRED:
            if not self.retired_at or not self.retired_by_id:
                raise ValidationError(
                    {"lifecycle_status": "Retired evidence requires retired_at and retired_by."}
                )
