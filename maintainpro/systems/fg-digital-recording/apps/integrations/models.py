"""Integration run / dead-letter models — Phase 17 foundation (no live ERP)."""

from __future__ import annotations

import uuid

from django.conf import settings
from django.db import models

from apps.organizations.models import Organization


class IntegrationChannel(models.TextChoices):
    INBOUND_BATCH = "INBOUND_BATCH", "Inbound batch event"
    OUTBOUND_DISPOSITION = "OUTBOUND_DISPOSITION", "Outbound disposition (not approved)"


class IntegrationAttemptStatus(models.TextChoices):
    PENDING = "PENDING", "Pending"
    SUCCEEDED = "SUCCEEDED", "Succeeded"
    FAILED = "FAILED", "Failed"
    DEAD_LETTER = "DEAD_LETTER", "Dead letter"
    BLOCKED = "BLOCKED", "Blocked by evidence/policy"


class IntegrationAttempt(models.Model):
    """
    One adapter attempt (mock or future live). Soft retention — no hard delete.

    Never stores tokens, passwords, or full Authorization headers.
    """

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    organization = models.ForeignKey(
        Organization,
        on_delete=models.PROTECT,
        null=True,
        blank=True,
        related_name="integration_attempts",
    )
    channel = models.CharField(max_length=32, choices=IntegrationChannel.choices)
    source_system = models.CharField(max_length=64, blank=True, default="")
    idempotency_key = models.CharField(max_length=191)
    correlation_id = models.CharField(max_length=64, blank=True, default="")
    status = models.CharField(
        max_length=16,
        choices=IntegrationAttemptStatus.choices,
        default=IntegrationAttemptStatus.PENDING,
    )
    error_class = models.CharField(max_length=32, blank=True, default="")
    error_summary = models.CharField(max_length=255, blank=True, default="")
    attempt_count = models.PositiveIntegerField(default=0)
    external_batch_event_id = models.UUIDField(null=True, blank=True)
    # Safe metadata only (redacted)
    metadata = models.JSONField(default=dict, blank=True)
    requested_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        null=True,
        blank=True,
        related_name="integration_attempts_requested",
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    completed_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ("-created_at",)
        verbose_name = "Integration attempt"
        verbose_name_plural = "Integration attempts"
        permissions = [
            ("manage_integrationboundary", "Can manage ERP integration boundary"),
            ("view_integrationboundary", "Can view ERP integration boundary"),
        ]
        constraints = [
            models.UniqueConstraint(
                fields=["source_system", "idempotency_key", "channel"],
                name="integ_src_idem_channel_uniq",
            ),
        ]
        indexes = [
            models.Index(
                fields=["status", "created_at"],
                name="integ_attempt_status_at_idx",
            ),
            models.Index(
                fields=["organization", "status"],
                name="integ_attempt_org_status_idx",
            ),
        ]

    def __str__(self) -> str:
        return f"{self.channel} / {self.status} / {self.idempotency_key}"
