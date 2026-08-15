"""
Loading / dispatch quality foundation — Phase 13.

Configurable recording only. No invented temperature limits, release catalogues,
vehicle inspection question text, or ERP inventory ledger behaviour.
QA RELEASE gate is policy-driven and defaults to disabled.
"""

from __future__ import annotations

import uuid
from decimal import Decimal

from django.conf import settings
from django.core.exceptions import ValidationError
from django.db import models
from django.db.models.functions import Lower

from apps.organizations.models import Organization


class DispatchRecordStatus(models.TextChoices):
    """Technical lifecycle labels — not a seeded Nelna dispatch SOP."""

    OPEN = "OPEN", "Open"
    COMPLETED = "COMPLETED", "Completed"
    CANCELLED = "CANCELLED", "Cancelled"


class DispatchHistoryEventType(models.TextChoices):
    CREATED = "CREATED", "Created"
    UPDATED = "UPDATED", "Updated"
    VEHICLE_INSPECTION_LINKED = "VEHICLE_INSPECTION_LINKED", "Vehicle inspection linked"
    QA_REVIEW_LINKED = "QA_REVIEW_LINKED", "QA review linked"
    TEMPERATURE_RECORDED = "TEMPERATURE_RECORDED", "Temperature recorded"
    QUANTITY_LINE_SET = "QUANTITY_LINE_SET", "Quantity line set"
    COMPLETED = "COMPLETED", "Completed"
    CANCELLED = "CANCELLED", "Cancelled"
    RELEASE_GATE_EVALUATED = "RELEASE_GATE_EVALUATED", "Release gate evaluated"


class DispatchQualityRecord(models.Model):
    """
    Organization-scoped loading/dispatch quality record.

    Vehicle hygiene / pre-cooling checks are linked to dynamic checklist
    definitions (ChecklistVersion / ChecklistSubmission) — not hardcoded questions.
    Soft retention: no hard delete via services/admin.
    """

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    organization = models.ForeignKey(
        Organization,
        on_delete=models.PROTECT,
        related_name="dispatch_quality_records",
    )
    code = models.CharField(max_length=64)
    delivery_loading_reference = models.CharField(max_length=128, blank=True, default="")
    vehicle_reference = models.CharField(max_length=128, blank=True, default="")
    driver_reference = models.CharField(max_length=128, blank=True, default="")
    loading_bay = models.CharField(max_length=64, blank=True, default="")
    started_at = models.DateTimeField(null=True, blank=True)
    ended_at = models.DateTimeField(null=True, blank=True)
    seal_number = models.CharField(max_length=64, blank=True, default="")
    # Optional overall declared quantity — not an ERP stock balance.
    quantity = models.DecimalField(
        max_digits=18,
        decimal_places=6,
        null=True,
        blank=True,
        help_text="Optional declared quantity — not an ERP inventory balance.",
    )
    quantity_uom = models.CharField(
        max_length=32,
        blank=True,
        default="",
        help_text="Opaque UOM label — catalogue EVIDENCE REQUIRED.",
    )
    batch_reference = models.CharField(max_length=128, blank=True, default="")
    sub_lot_reference = models.CharField(
        max_length=128,
        blank=True,
        default="",
        help_text="Opaque sub-lot reference — disposition architecture not invented.",
    )
    status = models.CharField(
        max_length=16,
        choices=DispatchRecordStatus.choices,
        default=DispatchRecordStatus.OPEN,
    )
    # Dynamic vehicle inspection checklist definition + optional executed submission.
    vehicle_inspection_checklist_version = models.ForeignKey(
        "checklists.ChecklistVersion",
        on_delete=models.PROTECT,
        null=True,
        blank=True,
        related_name="dispatch_vehicle_inspections",
        help_text="Dynamic checklist definition for hygiene/pre-cooling — no hardcoded questions.",
    )
    vehicle_inspection_submission = models.ForeignKey(
        "recording.ChecklistSubmission",
        on_delete=models.PROTECT,
        null=True,
        blank=True,
        related_name="dispatch_vehicle_inspections",
    )
    # Optional link to provisional QA disposition (quality.QAReview).
    qa_review = models.ForeignKey(
        "quality.QAReview",
        on_delete=models.PROTECT,
        null=True,
        blank=True,
        related_name="dispatch_quality_records",
        help_text="Optional QA quality status reference — gate behaviour is policy-driven.",
    )
    owner = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        null=True,
        blank=True,
        related_name="dispatch_quality_records_owned",
    )
    notes = models.TextField(blank=True, default="")
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        related_name="dispatch_quality_records_created",
    )
    completed_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        null=True,
        blank=True,
        related_name="dispatch_quality_records_completed",
    )
    cancelled_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        null=True,
        blank=True,
        related_name="dispatch_quality_records_cancelled",
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    completed_at = models.DateTimeField(null=True, blank=True)
    cancelled_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ("organization__code", "code")
        verbose_name = "Dispatch quality record"
        verbose_name_plural = "Dispatch quality records"
        permissions = [
            ("create_dispatchqualityrecord", "Can create dispatch quality records"),
            ("manage_dispatchqualityrecord", "Can manage dispatch quality records"),
            ("complete_dispatchqualityrecord", "Can complete dispatch quality records"),
            ("manage_dispatchreleasepolicy", "Can manage dispatch QA release policy"),
        ]
        constraints = [
            models.UniqueConstraint(
                Lower("code"),
                "organization",
                name="dispatch_org_code_ci_uniq",
            ),
        ]
        indexes = [
            models.Index(
                fields=["organization", "status"],
                name="dispatch_org_status_idx",
            ),
            models.Index(
                fields=["organization", "batch_reference"],
                name="dispatch_org_batch_idx",
            ),
            models.Index(
                fields=["organization", "delivery_loading_reference"],
                name="dispatch_org_delivery_idx",
            ),
        ]

    def __str__(self) -> str:
        return f"{self.organization.code}/{self.code}"

    def clean(self) -> None:
        super().clean()
        if self.started_at and self.ended_at and self.ended_at < self.started_at:
            raise ValidationError({"ended_at": "ended_at must not be before started_at."})
        if self.quantity is not None and self.quantity < Decimal("0"):
            raise ValidationError({"quantity": "quantity must not be negative."})
        vehicle_inspection_checklist_version = self.vehicle_inspection_checklist_version
        if (
            self.vehicle_inspection_checklist_version_id
            and self.organization_id
            and vehicle_inspection_checklist_version is not None
            and vehicle_inspection_checklist_version.template.organization_id
            != self.organization_id
        ):
            raise ValidationError(
                {
                    "vehicle_inspection_checklist_version": (
                        "Checklist version must belong to the same organization."
                    )
                }
            )
        vehicle_inspection_submission = self.vehicle_inspection_submission
        if (
            self.vehicle_inspection_submission_id
            and self.organization_id
            and vehicle_inspection_submission is not None
            and vehicle_inspection_submission.checklist_record.organization_id
            != self.organization_id
        ):
            raise ValidationError(
                {
                    "vehicle_inspection_submission": (
                        "Checklist submission must belong to the same organization."
                    )
                }
            )
        qa_review = self.qa_review
        if (
            self.qa_review_id
            and self.organization_id
            and qa_review is not None
            and qa_review.organization_id != self.organization_id
        ):
            raise ValidationError({"qa_review": "QA review must belong to the same organization."})


class DispatchReleasePolicy(models.Model):
    """
    Per-organization configurable QA RELEASE loading gate.

    Default: require_qa_release_before_loading=False (gate disabled).
    Enabling requires owner evidence (APR-017 / Dispatch + QA) — not seeded as Nelna fact.
    AI suggestions never drive this gate.
    """

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    organization = models.OneToOneField(
        Organization,
        on_delete=models.PROTECT,
        related_name="dispatch_release_policy",
    )
    require_qa_release_before_loading = models.BooleanField(
        default=False,
        help_text=(
            "When True, completing a dispatch quality record requires a linked "
            "QAReview with decision RELEASE. Default False — company policy EVIDENCE REQUIRED."
        ),
    )
    notes = models.TextField(
        blank=True,
        default="",
        help_text="Policy rationale / evidence reference — not an approval claim.",
    )
    updated_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        related_name="dispatch_release_policies_updated",
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = "Dispatch release policy"
        verbose_name_plural = "Dispatch release policies"

    def __str__(self) -> str:
        state = "ENABLED" if self.require_qa_release_before_loading else "DISABLED"
        return f"{self.organization.code} release gate {state}"


class ColdChainTemperatureReading(models.Model):
    """
    Temperature observation for a dispatch quality record.

    Stores Decimal temperatures and optional device/equipment references.
    Does NOT encode allowable ranges, CCP limits, or pass/fail outcomes.
    """

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    organization = models.ForeignKey(
        Organization,
        on_delete=models.PROTECT,
        related_name="cold_chain_temperature_readings",
    )
    dispatch_record = models.ForeignKey(
        DispatchQualityRecord,
        on_delete=models.PROTECT,
        related_name="temperature_readings",
    )
    reading_at = models.DateTimeField()
    temperature_celsius = models.DecimalField(
        max_digits=8,
        decimal_places=3,
        help_text="Recorded temperature in °C — no allowable limits invented.",
    )
    device_reference = models.CharField(
        max_length=128,
        blank=True,
        default="",
        help_text="Opaque device identifier when equipment master not linked.",
    )
    equipment = models.ForeignKey(
        "instruments.Equipment",
        on_delete=models.PROTECT,
        null=True,
        blank=True,
        related_name="dispatch_temperature_readings",
    )
    reading_context = models.CharField(
        max_length=255,
        blank=True,
        default="",
        help_text="Free-text context (e.g. probe location) — not a company fact catalogue.",
    )
    recorded_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        related_name="cold_chain_temperatures_recorded",
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ("dispatch_record", "reading_at", "created_at")
        verbose_name = "Cold-chain temperature reading"
        verbose_name_plural = "Cold-chain temperature readings"
        indexes = [
            models.Index(
                fields=["organization", "reading_at"],
                name="dispatch_temp_org_at_idx",
            ),
        ]

    def __str__(self) -> str:
        return f"{self.dispatch_record_id} @ {self.reading_at}: {self.temperature_celsius}°C"

    def clean(self) -> None:
        super().clean()
        if (
            self.dispatch_record_id
            and self.organization_id
            and self.dispatch_record.organization_id != self.organization_id
        ):
            raise ValidationError(
                {"organization": "Organization must match the dispatch record organization."}
            )
        if self.equipment_id and self.organization_id:
            equipment = self.equipment
            if equipment is not None and equipment.organization_id != self.organization_id:
                raise ValidationError(
                    {"equipment": "Equipment must belong to the same organization."}
                )


class DispatchQuantityLine(models.Model):
    """
    Released / loaded / remaining quantity reconciliation line.

    Not an ERP inventory ledger. No stock movements or ERP writes.
    remaining_quantity is derived as released_quantity - loaded_quantity.
    """

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    organization = models.ForeignKey(
        Organization,
        on_delete=models.PROTECT,
        related_name="dispatch_quantity_lines",
    )
    dispatch_record = models.ForeignKey(
        DispatchQualityRecord,
        on_delete=models.PROTECT,
        related_name="quantity_lines",
    )
    line_reference = models.CharField(max_length=64, blank=True, default="")
    product_reference = models.CharField(max_length=128, blank=True, default="")
    batch_reference = models.CharField(max_length=128, blank=True, default="")
    sub_lot_reference = models.CharField(max_length=128, blank=True, default="")
    released_quantity = models.DecimalField(max_digits=18, decimal_places=6)
    loaded_quantity = models.DecimalField(
        max_digits=18,
        decimal_places=6,
        default=Decimal("0"),
    )
    remaining_quantity = models.DecimalField(
        max_digits=18,
        decimal_places=6,
        help_text="Derived: released_quantity - loaded_quantity.",
    )
    unit_of_measure = models.CharField(
        max_length=32,
        blank=True,
        default="",
        help_text="Opaque UOM — not a seeded company catalogue.",
    )
    source_reference = models.CharField(
        max_length=255,
        blank=True,
        default="",
        help_text="Opaque source of released quantity (EVIDENCE REQUIRED for production use).",
    )
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        related_name="dispatch_quantity_lines_created",
    )
    updated_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        related_name="dispatch_quantity_lines_updated",
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ("dispatch_record", "line_reference", "created_at")
        verbose_name = "Dispatch quantity line"
        verbose_name_plural = "Dispatch quantity lines"
        indexes = [
            models.Index(
                fields=["organization", "batch_reference"],
                name="dispatch_qty_org_batch_idx",
            ),
        ]

    def __str__(self) -> str:
        return (
            f"{self.dispatch_record_id} "
            f"released={self.released_quantity} loaded={self.loaded_quantity}"
        )

    def clean(self) -> None:
        super().clean()
        if self.released_quantity is not None and self.released_quantity < Decimal("0"):
            raise ValidationError({"released_quantity": "released_quantity must not be negative."})
        if self.loaded_quantity is not None and self.loaded_quantity < Decimal("0"):
            raise ValidationError({"loaded_quantity": "loaded_quantity must not be negative."})
        if (
            self.released_quantity is not None
            and self.loaded_quantity is not None
            and self.loaded_quantity > self.released_quantity
        ):
            raise ValidationError(
                {"loaded_quantity": "loaded_quantity must not exceed released_quantity."}
            )
        if (
            self.dispatch_record_id
            and self.organization_id
            and self.dispatch_record.organization_id != self.organization_id
        ):
            raise ValidationError(
                {"organization": "Organization must match the dispatch record organization."}
            )


class DispatchHistoryEntry(models.Model):
    """Append-only history for dispatch quality records."""

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    organization = models.ForeignKey(
        Organization,
        on_delete=models.PROTECT,
        related_name="dispatch_history_entries",
    )
    dispatch_record = models.ForeignKey(
        DispatchQualityRecord,
        on_delete=models.PROTECT,
        related_name="history_entries",
    )
    event_type = models.CharField(max_length=64, choices=DispatchHistoryEventType.choices)
    from_status = models.CharField(max_length=16, blank=True, default="")
    to_status = models.CharField(max_length=16, blank=True, default="")
    note = models.TextField(blank=True, default="")
    metadata = models.JSONField(default=dict, blank=True)
    actor = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        related_name="dispatch_history_entries",
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ("created_at",)
        verbose_name = "Dispatch history entry"
        verbose_name_plural = "Dispatch history entries"
        indexes = [
            models.Index(
                fields=["dispatch_record", "created_at"],
                name="dispatch_hist_rec_at_idx",
            ),
        ]

    def __str__(self) -> str:
        return f"{self.event_type} @ {self.created_at}"
