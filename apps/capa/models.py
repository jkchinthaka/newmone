"""
CAPA foundation — Phase 12.

Human-only closure. No AI final CAPA decisions. Action matrices and effectiveness
criteria remain EVIDENCE REQUIRED / configurable blanks.
"""

from __future__ import annotations

import uuid

from django.conf import settings
from django.core.exceptions import ValidationError
from django.db import models
from django.db.models.functions import Lower

from apps.nonconformance.models import NonConformanceRecord
from apps.organizations.models import Organization


class CorrectiveActionStatus(models.TextChoices):
    """Proposed CAPA header lifecycle — not a seeded Nelna CAPA matrix."""

    OPEN = "OPEN", "Open"
    IN_PROGRESS = "IN_PROGRESS", "In progress"
    VERIFICATION = "VERIFICATION", "Verification"
    EFFECTIVENESS_REVIEW = "EFFECTIVENESS_REVIEW", "Effectiveness review"
    CLOSED = "CLOSED", "Closed"


CAPA_STATUS_TRANSITIONS: dict[str, frozenset[str]] = {
    CorrectiveActionStatus.OPEN: frozenset(
        {
            CorrectiveActionStatus.IN_PROGRESS,
            CorrectiveActionStatus.VERIFICATION,
            CorrectiveActionStatus.CLOSED,
        }
    ),
    CorrectiveActionStatus.IN_PROGRESS: frozenset(
        {
            CorrectiveActionStatus.OPEN,
            CorrectiveActionStatus.VERIFICATION,
            CorrectiveActionStatus.CLOSED,
        }
    ),
    CorrectiveActionStatus.VERIFICATION: frozenset(
        {
            CorrectiveActionStatus.IN_PROGRESS,
            CorrectiveActionStatus.EFFECTIVENESS_REVIEW,
            CorrectiveActionStatus.CLOSED,
        }
    ),
    CorrectiveActionStatus.EFFECTIVENESS_REVIEW: frozenset(
        {
            CorrectiveActionStatus.VERIFICATION,
            CorrectiveActionStatus.IN_PROGRESS,
            CorrectiveActionStatus.CLOSED,
        }
    ),
    CorrectiveActionStatus.CLOSED: frozenset(),
}


class CapaActionItemStatus(models.TextChoices):
    OPEN = "OPEN", "Open"
    DONE = "DONE", "Done"
    CANCELLED = "CANCELLED", "Cancelled"


class CorrectiveAction(models.Model):
    """Organization-scoped CAPA header. Soft retention; human-only closure."""

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    organization = models.ForeignKey(
        Organization,
        on_delete=models.PROTECT,
        related_name="corrective_actions",
    )
    code = models.CharField(max_length=64)
    title = models.CharField(max_length=255)
    status = models.CharField(
        max_length=32,
        choices=CorrectiveActionStatus.choices,
        default=CorrectiveActionStatus.OPEN,
    )
    summary = models.TextField(blank=True, default="")
    nonconformance = models.ForeignKey(
        NonConformanceRecord,
        on_delete=models.PROTECT,
        null=True,
        blank=True,
        related_name="corrective_actions",
    )
    owner = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        null=True,
        blank=True,
        related_name="capa_owned",
    )
    due_date = models.DateField(
        null=True,
        blank=True,
        help_text="Optional CAPA-level due date — not a Nelna SLA fact.",
    )
    verification_notes = models.TextField(blank=True, default="")
    verified_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        null=True,
        blank=True,
        related_name="capa_verifications",
    )
    verified_at = models.DateTimeField(null=True, blank=True)
    effectiveness_notes = models.TextField(blank=True, default="")
    effectiveness_reviewed_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        null=True,
        blank=True,
        related_name="capa_effectiveness_reviews",
    )
    effectiveness_reviewed_at = models.DateTimeField(null=True, blank=True)
    closure_notes = models.TextField(blank=True, default="")
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        related_name="corrective_actions_created",
    )
    closed_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        null=True,
        blank=True,
        related_name="corrective_actions_closed",
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    closed_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ("organization__code", "code")
        verbose_name = "Corrective action"
        verbose_name_plural = "Corrective actions"
        permissions = [
            ("create_capa", "Can create CAPA records"),
            ("manage_capa", "Can manage CAPA records"),
            ("close_capa", "Can close CAPA records"),
        ]
        constraints = [
            models.UniqueConstraint(
                Lower("code"),
                "organization",
                name="capa_org_code_ci_uniq",
            ),
        ]
        indexes = [
            models.Index(fields=["organization", "status"], name="capa_org_status_idx"),
            models.Index(fields=["organization", "due_date"], name="capa_org_due_idx"),
        ]

    def __str__(self) -> str:
        return f"{self.organization.code}/{self.code}"

    def clean(self) -> None:
        super().clean()
        if not (self.code or "").strip():
            raise ValidationError({"code": "Code cannot be blank."})
        if not (self.title or "").strip():
            raise ValidationError({"title": "Title cannot be blank."})
        if self.nonconformance_id and self.organization_id:
            ncr = self.nonconformance
            if ncr is not None and ncr.organization_id != self.organization_id:
                raise ValidationError(
                    {"nonconformance": "CAPA organization must match linked NCR organization."}
                )


class CapaActionItem(models.Model):
    """Configurable CAPA action line — owner + due date; no invented action catalogue."""

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    capa = models.ForeignKey(
        CorrectiveAction,
        on_delete=models.PROTECT,
        related_name="action_items",
    )
    description = models.TextField()
    owner = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        null=True,
        blank=True,
        related_name="capa_action_items_owned",
    )
    due_date = models.DateField(null=True, blank=True)
    status = models.CharField(
        max_length=16,
        choices=CapaActionItemStatus.choices,
        default=CapaActionItemStatus.OPEN,
    )
    completion_notes = models.TextField(blank=True, default="")
    completed_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ("due_date", "created_at")
        verbose_name = "CAPA action item"
        verbose_name_plural = "CAPA action items"
        indexes = [
            models.Index(fields=["capa", "status"], name="capa_action_status_idx"),
        ]

    def __str__(self) -> str:
        return f"Action on {self.capa_id}"

    def clean(self) -> None:
        super().clean()
        if not (self.description or "").strip():
            raise ValidationError({"description": "Action description cannot be blank."})


class CapaHistoryEntry(models.Model):
    """Append-only CAPA history — never edited in place."""

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    organization = models.ForeignKey(
        Organization,
        on_delete=models.PROTECT,
        related_name="capa_history",
    )
    capa = models.ForeignKey(
        CorrectiveAction,
        on_delete=models.PROTECT,
        related_name="history_entries",
    )
    event_type = models.CharField(max_length=64)
    from_status = models.CharField(max_length=32, blank=True, default="")
    to_status = models.CharField(max_length=32, blank=True, default="")
    note = models.TextField(blank=True, default="")
    metadata = models.JSONField(default=dict, blank=True)
    actor = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        related_name="capa_history_actions",
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ("-created_at",)
        verbose_name = "CAPA history entry"
        verbose_name_plural = "CAPA history entries"
        indexes = [
            models.Index(
                fields=["organization", "capa", "created_at"],
                name="capa_hist_org_capa_idx",
            ),
        ]

    def __str__(self) -> str:
        return f"CAPA {self.capa_id} {self.event_type}"
