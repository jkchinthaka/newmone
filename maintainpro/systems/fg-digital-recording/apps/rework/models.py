"""Controlled rework cases — Phase 42 (ADR-053).

REJECT does not automatically create rework. Original QA review, HOLD, REJECT,
and NCR records are never rewritten to hide rework. Reworked product requires
a new inspection task; source RELEASE is never reused.
"""

from __future__ import annotations

import uuid

from django.conf import settings
from django.db import models

from apps.organizations.models import Organization


class ReworkCase(models.Model):
    class Status(models.TextChoices):
        DRAFT = "DRAFT", "Draft"
        AUTHORIZED = "AUTHORIZED", "Authorized"
        IN_PROGRESS = "IN_PROGRESS", "In progress"
        COMPLETED = "COMPLETED", "Completed"
        CANCELLED = "CANCELLED", "Cancelled"

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    organization = models.ForeignKey(
        Organization,
        on_delete=models.PROTECT,
        related_name="rework_cases",
    )
    source_batch_reference = models.CharField(
        max_length=128,
        help_text="Original finished-good batch reference (genealogy parent).",
    )
    source_sublot_reference = models.CharField(max_length=128, blank=True, default="")
    source_quantity_reference = models.CharField(max_length=64)
    source_uom_reference = models.CharField(max_length=32)
    remaining_source_quantity_reference = models.CharField(max_length=64, blank=True, default="")
    resulting_quantity_reference = models.CharField(max_length=64, blank=True, default="")
    reason_reference = models.CharField(max_length=255)
    instruction_reference = models.CharField(max_length=255, blank=True, default="")
    resulting_batch_reference = models.CharField(max_length=128, blank=True, default="")
    inspection_task = models.ForeignKey(
        "scheduling.ChecklistTask",
        on_delete=models.PROTECT,
        related_name="rework_cases",
        null=True,
        blank=True,
    )
    source_qa_review = models.ForeignKey(
        "quality.QAReview",
        on_delete=models.PROTECT,
        related_name="rework_cases_as_source",
        null=True,
        blank=True,
        help_text="Optional pointer to original QA review — never mutated by rework.",
    )
    source_hold_case = models.ForeignKey(
        "nonconformance.HoldCase",
        on_delete=models.PROTECT,
        related_name="rework_cases_as_source",
        null=True,
        blank=True,
        help_text="Optional pointer to original HOLD — never mutated by rework.",
    )
    source_ncr = models.ForeignKey(
        "nonconformance.NonConformanceRecord",
        on_delete=models.PROTECT,
        related_name="rework_cases_as_source",
        null=True,
        blank=True,
        help_text="Optional pointer to original NCR — never mutated by rework.",
    )
    status = models.CharField(max_length=16, choices=Status.choices, default=Status.DRAFT)
    execution_key = models.CharField(max_length=128)
    started_at = models.DateTimeField(null=True, blank=True)
    completed_at = models.DateTimeField(null=True, blank=True)
    authorized_at = models.DateTimeField(null=True, blank=True)
    authorized_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        related_name="authorized_rework_cases",
        null=True,
        blank=True,
    )
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        related_name="created_rework_cases",
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ("-created_at",)
        constraints = [
            models.UniqueConstraint(
                fields=("organization", "execution_key"),
                name="rework_case_org_execution_key_uniq",
            ),
        ]
        indexes = [
            models.Index(fields=("organization", "status"), name="rework_case_org_status_idx"),
            models.Index(
                fields=("organization", "source_batch_reference"),
                name="rework_case_org_src_batch_idx",
            ),
        ]
        permissions = [
            ("view_reworkcase", "Can view rework cases"),
            ("create_reworkcase", "Can create rework cases"),
            ("authorize_reworkcase", "Can authorize rework cases"),
            ("execute_reworkcase", "Can execute rework cases"),
            ("manage_reworkpolicystub", "Can manage rework policy stubs"),
        ]
        default_permissions = ()
        verbose_name = "Rework case"
        verbose_name_plural = "Rework cases"

    def __str__(self) -> str:
        return f"Rework {self.execution_key} ({self.status})"


class ReworkCaseEvent(models.Model):
    class EventType(models.TextChoices):
        CREATED = "CREATED", "Created"
        AUTHORIZED = "AUTHORIZED", "Authorized"
        STARTED = "STARTED", "Started"
        COMPLETED = "COMPLETED", "Completed"
        CANCELLED = "CANCELLED", "Cancelled"
        REINSPECTION_OPENED = "REINSPECTION_OPENED", "Reinspection opened"
        GENEALOGY_RECORDED = "GENEALOGY_RECORDED", "Genealogy recorded"
        ERP_SYNC_STUBBED = "ERP_SYNC_STUBBED", "ERP sync stubbed"

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    organization = models.ForeignKey(
        Organization,
        on_delete=models.PROTECT,
        related_name="rework_case_events",
    )
    case = models.ForeignKey(
        ReworkCase,
        on_delete=models.CASCADE,
        related_name="events",
    )
    event_type = models.CharField(max_length=32, choices=EventType.choices)
    detail_reference = models.CharField(max_length=255, blank=True, default="")
    actor = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        related_name="rework_case_events",
        null=True,
        blank=True,
    )
    occurred_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ("occurred_at",)
        default_permissions = ()
        verbose_name = "Rework case event"
        verbose_name_plural = "Rework case events"

    def __str__(self) -> str:
        return f"{self.event_type} {self.case_id}"


class ReworkPolicyStub(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    organization = models.ForeignKey(
        Organization,
        on_delete=models.PROTECT,
        related_name="rework_policy_stubs",
    )
    policy_key = models.CharField(max_length=64)
    policy_value_reference = models.CharField(max_length=255)
    erp_stock_movement_enabled = models.BooleanField(default=False)
    updated_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        related_name="updated_rework_policy_stubs",
    )
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=("organization", "policy_key"),
                name="rework_policy_org_key_uniq",
            ),
        ]
        default_permissions = ()
        verbose_name = "Rework policy stub"
        verbose_name_plural = "Rework policy stubs"

    def __str__(self) -> str:
        return f"{self.policy_key}@{self.organization_id}"
