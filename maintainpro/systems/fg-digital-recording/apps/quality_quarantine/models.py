from __future__ import annotations

import uuid
from typing import Any

from django.conf import settings
from django.core.exceptions import ValidationError
from django.db import models
from django.db.models.functions import Lower

from apps.organizations.models import Organization


class QuarantineSource(models.TextChoices):
    QA_HOLD = "QA_HOLD", "QA hold"
    RETURNED_PRODUCT = "RETURNED_PRODUCT", "Returned product"
    INCOMING_INSPECTION = "INCOMING_INSPECTION", "Incoming inspection"
    LAB_PENDING = "LAB_PENDING", "Laboratory pending"
    NCR = "NCR", "Nonconformance"
    MANUAL = "MANUAL", "Manual"


class QuarantineStatus(models.TextChoices):
    OPEN = "OPEN", "Open"
    RELEASED = "RELEASED", "Released"
    CANCELLED = "CANCELLED", "Cancelled"


class QuarantineErpSyncStatus(models.TextChoices):
    NOT_SENT = "NOT_SENT", "Not sent"
    PENDING = "PENDING", "Pending"
    CONFIRMED = "CONFIRMED", "Confirmed"
    FAILED = "FAILED", "Failed"


class QualityQuarantineRecord(models.Model):
    """Application quality state only; ERP remains the inventory ledger."""

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    organization = models.ForeignKey(
        Organization, on_delete=models.PROTECT, related_name="quality_quarantine_records"
    )
    code = models.CharField(max_length=128)
    batch_reference = models.CharField(max_length=128)
    sub_lot_reference = models.CharField(max_length=128, blank=True, default="")
    quantity_reference = models.CharField(max_length=128, blank=True, default="")
    uom_reference = models.CharField(max_length=64, blank=True, default="")
    source = models.CharField(max_length=32, choices=QuarantineSource.choices)
    source_reference = models.CharField(max_length=128)
    reason_reference = models.CharField(max_length=255)
    opened_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        related_name="quality_quarantines_opened",
    )
    opened_at = models.DateTimeField()
    owner = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        null=True,
        blank=True,
        related_name="quality_quarantines_owned",
    )
    status = models.CharField(
        max_length=16, choices=QuarantineStatus.choices, default=QuarantineStatus.OPEN
    )
    resolution_reference = models.CharField(max_length=255, blank=True, default="")
    resolved_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        null=True,
        blank=True,
        related_name="quality_quarantines_resolved",
    )
    resolved_at = models.DateTimeField(null=True, blank=True)
    erp_sync_status = models.CharField(
        max_length=16,
        choices=QuarantineErpSyncStatus.choices,
        default=QuarantineErpSyncStatus.NOT_SENT,
    )
    erp_sync_detail = models.TextField(blank=True, default="")
    not_inventory_ledger = models.BooleanField(
        default=True,
        editable=False,
        help_text="Invariant: this app records quality state and is never the inventory ledger.",
    )
    metadata = models.JSONField(default=dict, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ("-opened_at", "-created_at")
        permissions = [
            ("view_qualityquarantine", "Can view quality quarantine records"),
            ("manage_qualityquarantine", "Can manage quality quarantine records"),
            ("release_qualityquarantine", "Can release quality quarantine records"),
            ("manage_quarantinepolicystub", "Can manage quality quarantine policy stubs"),
        ]
        constraints = [
            models.UniqueConstraint(
                Lower("code"), "organization", name="quality_quarantine_code_org_ci_uniq"
            ),
            models.CheckConstraint(
                condition=models.Q(not_inventory_ledger=True),
                name="quality_quarantine_not_ledger",
            ),
        ]
        indexes = [
            models.Index(fields=["organization", "status"], name="quality_quar_org_status_idx"),
            models.Index(
                fields=["organization", "batch_reference"], name="quality_quar_org_batch_idx"
            ),
            models.Index(
                fields=["organization", "source", "source_reference"],
                name="quality_quar_org_source_idx",
            ),
        ]

    def __str__(self) -> str:
        return f"{self.code} ({self.status})"

    def save(self, *args: Any, **kwargs: Any) -> None:
        if self.pk:
            previous = type(self).objects.filter(pk=self.pk).first()
            if previous is not None and previous.status != QuarantineStatus.OPEN:
                immutable = (
                    "organization_id",
                    "code",
                    "batch_reference",
                    "sub_lot_reference",
                    "source",
                    "source_reference",
                    "reason_reference",
                    "opened_by_id",
                    "opened_at",
                )
                if any(getattr(previous, field) != getattr(self, field) for field in immutable):
                    raise ValidationError(
                        "Resolved quarantine records cannot overwrite opening data."
                    )
        self.not_inventory_ledger = True
        super().save(*args, **kwargs)

    def clean(self) -> None:
        super().clean()
        errors: dict[str, str] = {}
        for field_name, message in (
            ("code", "Local quarantine code is required."),
            ("batch_reference", "Batch reference is required."),
            ("source_reference", "Source reference is required."),
            ("reason_reference", "Reason reference is required."),
        ):
            if not (getattr(self, field_name) or "").strip():
                errors[field_name] = message
        if self.not_inventory_ledger is not True:
            errors["not_inventory_ledger"] = "Quality quarantine is not an inventory ledger."
        if self.pk:
            previous = type(self).objects.filter(pk=self.pk).first()
            if previous is not None and previous.status != QuarantineStatus.OPEN:
                immutable = (
                    "organization_id",
                    "code",
                    "batch_reference",
                    "sub_lot_reference",
                    "source",
                    "source_reference",
                    "reason_reference",
                    "opened_by_id",
                    "opened_at",
                )
                if any(getattr(previous, field) != getattr(self, field) for field in immutable):
                    errors["status"] = "Resolved quarantine records cannot overwrite opening data."
        if errors:
            raise ValidationError(errors)


class ImmutableEventQuerySet(models.QuerySet["QualityQuarantineEvent"]):
    def update(self, **kwargs: object) -> int:
        raise ValidationError("Quality quarantine events are append-only and cannot be updated.")

    def delete(self) -> tuple[int, dict[str, int]]:
        raise ValidationError("Quality quarantine events are append-only and cannot be deleted.")


class QualityQuarantineEvent(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    quarantine = models.ForeignKey(
        QualityQuarantineRecord,
        on_delete=models.PROTECT,
        related_name="events",
    )
    event_type = models.CharField(max_length=64)
    summary = models.CharField(max_length=255, blank=True, default="")
    payload = models.JSONField(default=dict, blank=True)
    actor = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="quality_quarantine_events",
    )
    created_at = models.DateTimeField(auto_now_add=True)

    objects = ImmutableEventQuerySet.as_manager()

    class Meta:
        ordering = ("created_at",)
        indexes = [models.Index(fields=["quarantine", "created_at"], name="quality_quar_event_idx")]

    def __str__(self) -> str:
        return f"{self.event_type} for {self.quarantine_id}"

    def save(self, *args: Any, **kwargs: Any) -> None:
        if not self._state.adding:
            raise ValidationError(
                "Quality quarantine events are append-only and cannot be updated."
            )
        super().save(*args, **kwargs)

    def delete(self, *args: object, **kwargs: object) -> tuple[int, dict[str, int]]:
        raise ValidationError("Quality quarantine events are append-only and cannot be deleted.")


class QualityQuarantinePolicy(models.Model):
    """Organization policy stub; APR-066 business evidence remains required."""

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    organization = models.OneToOneField(
        Organization, on_delete=models.PROTECT, related_name="quality_quarantine_policy"
    )
    quantity_recording_enabled = models.BooleanField(default=False)
    erp_sync_enabled = models.BooleanField(
        default=False,
        help_text=(
            "Organization gate only; settings approval and approved adapter evidence are required."
        ),
    )
    procedure_reference = models.CharField(max_length=255, blank=True, default="")
    notes = models.TextField(blank=True, default="")
    updated_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        related_name="quality_quarantine_policies_updated",
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = "quality quarantine policy stub"
        verbose_name_plural = "quality quarantine policy stubs"

    def __str__(self) -> str:
        return f"Quarantine policy for {self.organization_id}"
