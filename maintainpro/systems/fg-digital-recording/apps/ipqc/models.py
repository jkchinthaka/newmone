"""In-Process Quality Control (IPQC) — Phase 34.

Process checks during production, separate from Finished Goods release.
Checklist questions are never hardcoded — PUBLISHED templates only.
Failed IPQC does not stop the line unless dual-gated policy says so.
"""

from __future__ import annotations

import uuid

from django.conf import settings
from django.core.exceptions import ValidationError
from django.db import models
from django.db.models.functions import Lower

from apps.organizations.models import Organization


class IpqcTriggerKind(models.TextChoices):
    TIME_INTERVAL = "TIME_INTERVAL", "Time interval"
    SHIFT = "SHIFT", "Shift"
    PRODUCTION_ORDER = "PRODUCTION_ORDER", "Production order"
    BATCH = "BATCH", "Batch"
    MANUAL = "MANUAL", "Manual"


class IpqcWorkflowStatus(models.TextChoices):
    OPEN = "OPEN", "Open"
    TASK_CREATED = "TASK_CREATED", "Checklist task created"
    IN_PROGRESS = "IN_PROGRESS", "In progress"
    MEASURED = "MEASURED", "Measurement recorded"
    FAILED = "FAILED", "Failed (local / advisory)"
    COMPLETED = "COMPLETED", "Completed"
    ESCALATED = "ESCALATED", "Escalated to NCR/HOLD"
    CLOSED = "CLOSED", "Closed"


class IpqcProcessCheckDefinition(models.Model):
    """
    Configurable process-check shell.

    Inspection questions live on checklist versions — never on this model.
    Company trigger frequencies remain EVIDENCE REQUIRED (APR-059).
    """

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    organization = models.ForeignKey(
        Organization,
        on_delete=models.PROTECT,
        related_name="ipqc_process_check_definitions",
    )
    code = models.CharField(max_length=64)
    name = models.CharField(max_length=255)
    checklist_template = models.ForeignKey(
        "checklists.ChecklistTemplate",
        on_delete=models.PROTECT,
        related_name="ipqc_definitions",
    )
    checklist_version = models.ForeignKey(
        "checklists.ChecklistVersion",
        on_delete=models.PROTECT,
        null=True,
        blank=True,
        related_name="ipqc_definitions",
        help_text="Optional pin; generation uses PUBLISHED versions only.",
    )
    trigger_kind = models.CharField(
        max_length=32,
        choices=IpqcTriggerKind.choices,
        default=IpqcTriggerKind.MANUAL,
    )
    interval_minutes = models.PositiveIntegerField(
        null=True,
        blank=True,
        help_text="Used when trigger_kind=TIME_INTERVAL. Not a company SLA invent.",
    )
    due_grace_minutes = models.PositiveIntegerField(null=True, blank=True)
    product = models.ForeignKey(
        "master_data.FGProduct",
        on_delete=models.PROTECT,
        null=True,
        blank=True,
        related_name="ipqc_definitions",
    )
    production_line_code = models.CharField(max_length=64, blank=True, default="")
    process_step_code = models.CharField(max_length=64, blank=True, default="")
    process_step = models.ForeignKey(
        "haccp.ProcessStep",
        on_delete=models.PROTECT,
        null=True,
        blank=True,
        related_name="ipqc_definitions",
    )
    shift = models.ForeignKey(
        "organizations.Shift",
        on_delete=models.PROTECT,
        null=True,
        blank=True,
        related_name="ipqc_definitions",
    )
    checklist_schedule = models.ForeignKey(
        "scheduling.ChecklistSchedule",
        on_delete=models.PROTECT,
        null=True,
        blank=True,
        related_name="ipqc_definitions",
        help_text="Optional Phase 07 schedule link for TIME_INTERVAL / SHIFT triggers.",
    )
    is_active = models.BooleanField(default=True)
    notes = models.TextField(blank=True, default="")
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        related_name="ipqc_definitions_created",
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ("organization__code", "code")
        permissions = [
            ("manage_ipqc", "Can manage IPQC definitions and generation"),
            ("record_ipqc", "Can record IPQC measurements / equipment links"),
            ("escalate_ipqc", "Can escalate IPQC failures to NCR/HOLD"),
            ("view_ipqc", "Can view IPQC cases and dashboard"),
            ("manage_ipqcpolicy", "Can update IPQC stop-line / policy stubs"),
        ]
        constraints = [
            models.UniqueConstraint(
                Lower("code"),
                "organization",
                name="ipqc_definition_org_code_ci_uniq",
            ),
        ]
        indexes = [
            models.Index(fields=["organization", "trigger_kind", "is_active"]),
        ]

    def __str__(self) -> str:
        return f"{self.organization.code}/{self.code}"

    def clean(self) -> None:
        super().clean()
        product = self.product
        if product is not None and self.organization_id:
            if product.organization_id != self.organization_id:
                raise ValidationError({"product": "Product must belong to the organization."})
        shift = self.shift
        if shift is not None and self.organization_id:
            if shift.organization_id != self.organization_id:
                raise ValidationError({"shift": "Shift must belong to the organization."})
        if (
            self.trigger_kind == IpqcTriggerKind.TIME_INTERVAL
            and not self.interval_minutes
            and self.checklist_schedule_id is None
        ):
            raise ValidationError(
                {
                    "interval_minutes": (
                        "TIME_INTERVAL definitions require interval_minutes "
                        "or a linked checklist schedule."
                    )
                }
            )


class IpqcInspectionCase(models.Model):
    """
    One in-process inspection occurrence.

    Distinct from Finished Goods release — completion here is not QA RELEASE.
    """

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    organization = models.ForeignKey(
        Organization,
        on_delete=models.PROTECT,
        related_name="ipqc_inspection_cases",
    )
    definition = models.ForeignKey(
        IpqcProcessCheckDefinition,
        on_delete=models.PROTECT,
        related_name="inspection_cases",
    )
    occurrence_key = models.CharField(
        max_length=255,
        help_text="Idempotency key for scheduled / batch / manual generation.",
    )
    trigger_kind = models.CharField(max_length=32, choices=IpqcTriggerKind.choices)
    workflow_status = models.CharField(
        max_length=32,
        choices=IpqcWorkflowStatus.choices,
        default=IpqcWorkflowStatus.OPEN,
    )
    product = models.ForeignKey(
        "master_data.FGProduct",
        on_delete=models.PROTECT,
        null=True,
        blank=True,
        related_name="ipqc_inspection_cases",
    )
    production_line_code = models.CharField(max_length=64, blank=True, default="")
    process_step_code = models.CharField(max_length=64, blank=True, default="")
    process_step = models.ForeignKey(
        "haccp.ProcessStep",
        on_delete=models.PROTECT,
        null=True,
        blank=True,
        related_name="ipqc_inspection_cases",
    )
    shift = models.ForeignKey(
        "organizations.Shift",
        on_delete=models.PROTECT,
        null=True,
        blank=True,
        related_name="ipqc_inspection_cases",
    )
    batch_reference = models.CharField(max_length=128, blank=True, default="")
    production_order_reference = models.CharField(max_length=128, blank=True, default="")
    checklist_task = models.ForeignKey(
        "scheduling.ChecklistTask",
        on_delete=models.PROTECT,
        null=True,
        blank=True,
        related_name="ipqc_inspection_cases",
    )
    checklist_submission = models.ForeignKey(
        "recording.ChecklistSubmission",
        on_delete=models.PROTECT,
        null=True,
        blank=True,
        related_name="ipqc_inspection_cases",
    )
    equipment = models.ForeignKey(
        "instruments.Equipment",
        on_delete=models.PROTECT,
        null=True,
        blank=True,
        related_name="ipqc_inspection_cases",
    )
    equipment_trace_snapshot = models.JSONField(default=dict, blank=True)
    measurement_snapshot = models.JSONField(default=dict, blank=True)
    sampling_plan_version = models.ForeignKey(
        "sampling.SamplingPlanVersion",
        on_delete=models.PROTECT,
        null=True,
        blank=True,
        related_name="ipqc_inspection_cases",
    )
    sampling_snapshot = models.JSONField(default=dict, blank=True)
    haccp_metadata_snapshot = models.JSONField(default=dict, blank=True)
    failure_detected = models.BooleanField(default=False)
    stop_production_signal = models.BooleanField(
        default=False,
        help_text="True only when dual-gated stop policy evaluates enabled.",
    )
    failure_decision = models.JSONField(default=dict, blank=True)
    nonconformance = models.ForeignKey(
        "nonconformance.NonConformanceRecord",
        on_delete=models.PROTECT,
        null=True,
        blank=True,
        related_name="ipqc_inspection_cases",
    )
    hold_case = models.ForeignKey(
        "nonconformance.HoldCase",
        on_delete=models.PROTECT,
        null=True,
        blank=True,
        related_name="ipqc_inspection_cases",
    )
    due_at = models.DateTimeField(null=True, blank=True)
    window_start_at = models.DateTimeField(null=True, blank=True)
    window_end_at = models.DateTimeField(null=True, blank=True)
    frozen_process_context = models.JSONField(default=dict, blank=True)
    notes = models.TextField(blank=True, default="")
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        related_name="ipqc_cases_created",
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    closed_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ("-created_at",)

        constraints = [
            models.UniqueConstraint(
                fields=["organization", "occurrence_key"],
                name="ipqc_case_org_occurrence_uniq",
            ),
        ]
        indexes = [
            models.Index(fields=["organization", "workflow_status"]),
            models.Index(fields=["organization", "due_at"]),
            models.Index(fields=["organization", "failure_detected"]),
            models.Index(fields=["organization", "production_line_code"]),
            models.Index(fields=["organization", "batch_reference"]),
        ]

    def __str__(self) -> str:
        return f"IPQC/{self.definition.code}/{self.workflow_status}"

    def clean(self) -> None:
        super().clean()
        definition = self.definition
        if definition is not None and self.organization_id:
            if definition.organization_id != self.organization_id:
                raise ValidationError({"definition": "Definition must belong to the organization."})


class IpqcWorkflowPolicy(models.Model):
    """
    Org IPQC policy stubs.

    Failed IPQC does not stop production unless dual-gated ON (APR-059).
    Escalation to NCR/HOLD is controlled and never automatic from FAIL alone.
    """

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    organization = models.OneToOneField(
        Organization,
        on_delete=models.PROTECT,
        related_name="ipqc_workflow_policy",
    )
    stop_production_on_fail_enabled = models.BooleanField(
        default=False,
        help_text="Org stub only — still requires IPQC_STOP_PRODUCTION_ON_FAIL_APPROVED.",
    )
    procedure_reference = models.CharField(max_length=255, blank=True, default="")
    notes = models.TextField(blank=True, default="")
    updated_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        related_name="ipqc_policies_updated",
    )
    updated_at = models.DateTimeField(auto_now=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name = "IPQC workflow policy"
        verbose_name_plural = "IPQC workflow policies"

    def __str__(self) -> str:
        return f"{self.organization.code} IPQC policy"


class IpqcHistoryEntry(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    organization = models.ForeignKey(
        Organization,
        on_delete=models.PROTECT,
        related_name="ipqc_history_entries",
    )
    inspection_case = models.ForeignKey(
        IpqcInspectionCase,
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
        related_name="ipqc_history_actions",
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ("-created_at",)

    def __str__(self) -> str:
        return f"{self.event_type}:{self.inspection_case_id}"
