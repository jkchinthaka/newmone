"""Returned-product quality domain models -- Phase 40 (ADR-051)."""

from __future__ import annotations

import uuid
from typing import Any

from django.conf import settings
from django.core.exceptions import ValidationError
from django.db import models
from django.db.models.functions import Lower

from apps.organizations.models import Organization


class ReturnQualityStatus(models.TextChoices):
    RECEIVED = "RECEIVED", "Received"
    INSPECTION_IN_PROGRESS = "INSPECTION_IN_PROGRESS", "Inspection in progress"
    READY_FOR_DISPOSITION = "READY_FOR_DISPOSITION", "Ready for disposition"
    DISPOSITIONED = "DISPOSITIONED", "Dispositioned locally"


class ReturnQuarantineState(models.TextChoices):
    QUARANTINED = "QUARANTINED", "Quarantined"
    HOLD = "HOLD", "Hold"
    REWORK = "REWORK", "Rework"
    REJECTED = "REJECTED", "Rejected"


class ReturnDisposition(models.TextChoices):
    RELEASE = "RELEASE", "Release (local quality only)"
    HOLD = "HOLD", "Hold"
    REWORK = "REWORK", "Rework"
    REJECT = "REJECT", "Reject"


class ReturnQualityRecord(models.Model):
    """Organization-scoped quality record for an opaque ERP/SFA return."""

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    organization = models.ForeignKey(
        Organization, on_delete=models.PROTECT, related_name="return_quality_records"
    )
    erp_return_reference = models.CharField(max_length=128)
    erp_return_line_reference = models.CharField(max_length=128, blank=True, default="")
    product_reference = models.CharField(max_length=128)
    original_batch_reference = models.CharField(max_length=128)
    quantity_reference = models.CharField(max_length=128, blank=True, default="")
    uom_reference = models.CharField(max_length=64, blank=True, default="")
    erp_customer_reference = models.CharField(max_length=128, blank=True, default="")
    reason_reference = models.CharField(max_length=255, blank=True, default="")
    condition_reference = models.CharField(max_length=255, blank=True, default="")
    temperature_reference = models.CharField(max_length=255, blank=True, default="")
    evidence_attachment_id = models.UUIDField(null=True, blank=True)
    received_at = models.DateTimeField()
    status = models.CharField(
        max_length=32, choices=ReturnQualityStatus.choices, default=ReturnQualityStatus.RECEIVED
    )
    quarantine_state = models.CharField(
        max_length=16,
        choices=ReturnQuarantineState.choices,
        default=ReturnQuarantineState.QUARANTINED,
    )
    not_saleable_via_app = models.BooleanField(
        default=True,
        editable=False,
        help_text="Invariant: this application never makes returned stock saleable.",
    )
    hold_case = models.ForeignKey(
        "nonconformance.HoldCase",
        on_delete=models.PROTECT,
        null=True,
        blank=True,
        related_name="return_quality_records",
    )
    checklist_template = models.ForeignKey(
        "checklists.ChecklistTemplate",
        on_delete=models.PROTECT,
        null=True,
        blank=True,
        related_name="return_quality_records_for_template",
    )
    checklist_version = models.ForeignKey(
        "checklists.ChecklistVersion",
        on_delete=models.PROTECT,
        null=True,
        blank=True,
        related_name="return_quality_records_for_version",
    )
    checklist_task = models.ForeignKey(
        "scheduling.ChecklistTask",
        on_delete=models.PROTECT,
        null=True,
        blank=True,
        related_name="return_quality_records_for_task",
    )
    disposition = models.CharField(
        max_length=16, choices=ReturnDisposition.choices, blank=True, default=""
    )
    disposition_note = models.TextField(blank=True, default="")
    dispositioned_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        null=True,
        blank=True,
        related_name="return_quality_dispositions",
    )
    dispositioned_at = models.DateTimeField(null=True, blank=True)
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        related_name="return_quality_records_created",
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ("-received_at", "-created_at")
        permissions = [
            ("view_returnquality", "Can view returned-product quality records"),
            ("manage_returnquality", "Can manage returned-product quality records"),
            ("inspect_returnquality", "Can inspect returned-product quality records"),
            ("disposition_returnquality", "Can disposition returned-product quality records"),
        ]
        constraints = [
            models.UniqueConstraint(
                Lower("erp_return_reference"),
                Lower("erp_return_line_reference"),
                "organization",
                name="return_quality_erp_line_ci_uniq",
            ),
            models.CheckConstraint(
                condition=models.Q(not_saleable_via_app=True), name="return_quality_never_saleable"
            ),
        ]
        indexes = [
            models.Index(fields=["organization", "status"], name="return_quality_org_status_idx"),
            models.Index(
                fields=["organization", "original_batch_reference"],
                name="return_quality_org_batch_idx",
            ),
        ]

    def __str__(self) -> str:
        line = f"/{self.erp_return_line_reference}" if self.erp_return_line_reference else ""
        return f"{self.erp_return_reference}{line} ({self.status})"

    def save(self, *args: Any, **kwargs: Any) -> None:
        self.not_saleable_via_app = True
        super().save(*args, **kwargs)

    def clean(self) -> None:
        super().clean()
        errors: dict[str, str] = {}
        for field_name, message in (
            ("erp_return_reference", "ERP return reference is required."),
            ("product_reference", "Product reference is required."),
            ("original_batch_reference", "Original batch reference is required."),
        ):
            if not (getattr(self, field_name) or "").strip():
                errors[field_name] = message
        if self.not_saleable_via_app is not True:
            errors["not_saleable_via_app"] = "Returned stock cannot be made saleable by this app."
        if self.hold_case_id and self.organization_id:
            hold_case = self.hold_case
            if hold_case is not None and hold_case.organization_id != self.organization_id:
                errors["hold_case"] = "Hold case must belong to the same organization."
        checklist_organization_ids = {
            "checklist_template": (
                self.checklist_template.organization_id
                if self.checklist_template is not None
                else None
            ),
            "checklist_version": (
                self.checklist_version.template.organization_id
                if self.checklist_version is not None
                else None
            ),
            "checklist_task": (
                self.checklist_task.organization_id if self.checklist_task is not None else None
            ),
        }
        for field_name, organization_id in checklist_organization_ids.items():
            if organization_id is not None and organization_id != self.organization_id:
                errors[field_name] = "Checklist object must belong to the same organization."
        if self.checklist_version_id and self.checklist_template_id:
            checklist_version = self.checklist_version
            if (
                checklist_version is not None
                and checklist_version.template_id != self.checklist_template_id
            ):
                errors["checklist_version"] = "Checklist version must belong to the template."
        if errors:
            raise ValidationError(errors)


class ReturnQualityTimelineEntry(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    organization = models.ForeignKey(
        Organization, on_delete=models.PROTECT, related_name="return_quality_timeline_entries"
    )
    return_quality_record = models.ForeignKey(
        ReturnQualityRecord, on_delete=models.PROTECT, related_name="timeline_entries"
    )
    event_type = models.CharField(max_length=64)
    metadata = models.JSONField(default=dict, blank=True)
    actor = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        related_name="return_quality_timeline_actions",
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ("-created_at",)

    def __str__(self) -> str:
        return f"{self.event_type} for {self.return_quality_record_id}"

    def clean(self) -> None:
        super().clean()
        if (
            self.return_quality_record_id
            and self.organization_id
            and self.return_quality_record.organization_id != self.organization_id
        ):
            raise ValidationError(
                {"return_quality_record": "Timeline record must belong to the organization."}
            )


class ReturnQualityPolicy(models.Model):
    """Organization policy stub; APR-065 evidence remains required."""

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    organization = models.OneToOneField(
        Organization, on_delete=models.PROTECT, related_name="return_quality_policy"
    )
    erp_stock_movement_enabled = models.BooleanField(
        default=False,
        help_text="Org gate only; settings approval and an approved adapter are also required.",
    )
    allowed_disposition_codes = models.JSONField(default=list, blank=True)
    procedure_reference = models.CharField(max_length=255, blank=True, default="")
    updated_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        related_name="return_quality_policies_updated",
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = "return quality policy stub"
        verbose_name_plural = "return quality policy stubs"
        permissions = [
            ("manage_returnpolicystub", "Can manage returned-product quality policy stubs")
        ]

    def __str__(self) -> str:
        return f"Return policy for {self.organization_id}"

    def clean(self) -> None:
        super().clean()
        values = self.allowed_disposition_codes
        if not isinstance(values, list):
            raise ValidationError({"allowed_disposition_codes": "Must be a list of codes."})
        normalized = [(str(value) if value is not None else "").strip().upper() for value in values]
        invalid = sorted(
            {value for value in normalized if value not in set(ReturnDisposition.values)}
        )
        if invalid:
            raise ValidationError(
                {
                    "allowed_disposition_codes": (
                        "Unsupported disposition code(s): " + ", ".join(invalid) + "."
                    )
                }
            )
        if len(normalized) != len(set(normalized)):
            raise ValidationError(
                {"allowed_disposition_codes": "Disposition codes must be unique."}
            )
        self.allowed_disposition_codes = normalized
