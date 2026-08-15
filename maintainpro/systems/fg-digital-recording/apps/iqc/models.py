"""Incoming Quality Control workflow — Phase 33.

Orchestrates ERP receipt → IQC task → recording → review → local disposition.
Does not hardcode inspection questions. Does not update ERP stock without approval.
"""

from __future__ import annotations

import uuid

from django.conf import settings
from django.core.exceptions import ValidationError
from django.db import models
from django.db.models.functions import Lower

from apps.organizations.models import Organization


class IncomingReceiptEventStatus(models.TextChoices):
    RECEIVED = "RECEIVED", "Received"
    PROCESSED = "PROCESSED", "Processed"
    DUPLICATE = "DUPLICATE", "Duplicate (idempotent)"
    FAILED = "FAILED", "Failed"


class IqcWorkflowStatus(models.TextChoices):
    OPEN = "OPEN", "Open"
    TASK_CREATED = "TASK_CREATED", "IQC task created"
    INSPECTION_IN_PROGRESS = "INSPECTION_IN_PROGRESS", "Inspection in progress"
    AWAITING_REVIEW = "AWAITING_REVIEW", "Awaiting review"
    DISPOSITIONED = "DISPOSITIONED", "Dispositioned (local)"
    CLOSED = "CLOSED", "Closed"


class IncomingReceiptEvent(models.Model):
    """
    Idempotent ERP receipt/GRN event shell.

    Duplicate (source_system, source_event_id) returns existing processing result.
    """

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    organization = models.ForeignKey(
        Organization,
        on_delete=models.PROTECT,
        related_name="incoming_receipt_events",
    )
    source_system = models.CharField(max_length=64)
    source_event_id = models.CharField(max_length=128)
    status = models.CharField(
        max_length=16,
        choices=IncomingReceiptEventStatus.choices,
        default=IncomingReceiptEventStatus.RECEIVED,
    )
    erp_receipt_reference = models.CharField(max_length=128)
    erp_supplier_reference = models.CharField(max_length=128, blank=True, default="")
    supplier_lot = models.CharField(max_length=128)
    erp_material_reference = models.CharField(max_length=128)
    quantity = models.DecimalField(max_digits=18, decimal_places=6, null=True, blank=True)
    uom = models.CharField(max_length=32, blank=True, default="")
    payload = models.JSONField(default=dict, blank=True)
    error_message = models.CharField(max_length=512, blank=True, default="")
    receipt = models.ForeignKey(
        "receiving.ReceiptQualityRecord",
        on_delete=models.PROTECT,
        null=True,
        blank=True,
        related_name="incoming_events",
    )
    inspection_case = models.ForeignKey(
        "iqc.IqcInspectionCase",
        on_delete=models.PROTECT,
        null=True,
        blank=True,
        related_name="source_events",
    )
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        related_name="incoming_receipt_events_created",
    )
    created_at = models.DateTimeField(auto_now_add=True)
    processed_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ("-created_at",)

        permissions = [
            ("manage_iqc", "Can manage IQC workflow / ingest receipt events"),
            ("disposition_iqc", "Can complete IQC local disposition"),
            ("view_iqc", "Can view IQC inspection cases"),
            ("manage_iqcpolicy", "Can update IQC workflow policy stubs"),
        ]
        constraints = [
            models.UniqueConstraint(
                Lower("source_system"),
                Lower("source_event_id"),
                name="iqc_incoming_event_source_ci_uniq",
            ),
        ]
        indexes = [
            models.Index(fields=["organization", "erp_receipt_reference"]),
        ]

    def __str__(self) -> str:
        return f"{self.source_system}/{self.source_event_id} ({self.status})"


class IqcInspectionCase(models.Model):
    """
    Traceable IQC case: supplier lot → receipt → task → review → local decision.

    Inspection questions live on checklist versions — never hardcoded here.
    """

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    organization = models.ForeignKey(
        Organization,
        on_delete=models.PROTECT,
        related_name="iqc_inspection_cases",
    )
    receipt = models.OneToOneField(
        "receiving.ReceiptQualityRecord",
        on_delete=models.PROTECT,
        related_name="iqc_case",
    )
    workflow_status = models.CharField(
        max_length=32,
        choices=IqcWorkflowStatus.choices,
        default=IqcWorkflowStatus.OPEN,
    )
    review_required = models.BooleanField(
        default=True,
        help_text="When True, disposition requires Supervisor APPROVED review.",
    )
    checklist_task = models.ForeignKey(
        "scheduling.ChecklistTask",
        on_delete=models.PROTECT,
        null=True,
        blank=True,
        related_name="iqc_inspection_cases",
    )
    checklist_submission = models.ForeignKey(
        "recording.ChecklistSubmission",
        on_delete=models.PROTECT,
        null=True,
        blank=True,
        related_name="iqc_inspection_cases",
    )
    supervisor_review = models.ForeignKey(
        "reviews.SupervisorReview",
        on_delete=models.PROTECT,
        null=True,
        blank=True,
        related_name="iqc_inspection_cases",
    )
    sampling_plan_version = models.ForeignKey(
        "sampling.SamplingPlanVersion",
        on_delete=models.PROTECT,
        null=True,
        blank=True,
        related_name="iqc_inspection_cases",
    )
    sampling_snapshot = models.JSONField(default=dict, blank=True)
    frozen_traceability_context = models.JSONField(default=dict, blank=True)
    notes = models.TextField(blank=True, default="")
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        related_name="iqc_cases_created",
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    closed_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ("-created_at",)
        indexes = [
            models.Index(fields=["organization", "workflow_status"]),
        ]

    def __str__(self) -> str:
        return f"IQC/{self.receipt.erp_receipt_reference}/{self.workflow_status}"

    def clean(self) -> None:
        super().clean()
        if self.receipt_id and self.organization_id:
            if self.receipt.organization_id != self.organization_id:
                raise ValidationError({"receipt": "Receipt must belong to the organization."})


class IqcWorkflowPolicy(models.Model):
    """
    Org IQC policy stubs.

    review_required default True. ERP outbound dual-gated OFF (APR-058).
    """

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    organization = models.OneToOneField(
        Organization,
        on_delete=models.PROTECT,
        related_name="iqc_workflow_policy",
    )
    review_required = models.BooleanField(default=True)
    erp_outbound_enabled = models.BooleanField(
        default=False,
        help_text="Org stub only — still requires IQC_ERP_OUTBOUND_APPROVED.",
    )
    procedure_reference = models.CharField(max_length=255, blank=True, default="")
    notes = models.TextField(blank=True, default="")
    updated_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        related_name="iqc_policies_updated",
    )
    updated_at = models.DateTimeField(auto_now=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name = "IQC workflow policy"
        verbose_name_plural = "IQC workflow policies"

    def __str__(self) -> str:
        return f"{self.organization.code} IQC policy"


class IqcHistoryEntry(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    organization = models.ForeignKey(
        Organization,
        on_delete=models.PROTECT,
        related_name="iqc_history_entries",
    )
    inspection_case = models.ForeignKey(
        IqcInspectionCase,
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
        related_name="iqc_history_actions",
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ("-created_at",)

    def __str__(self) -> str:
        return f"{self.event_type}:{self.inspection_case_id}"
