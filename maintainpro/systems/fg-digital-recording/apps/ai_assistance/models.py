"""AI assistance usage audit models — high-level metadata only (Phase 18)."""

from __future__ import annotations

import uuid

from django.conf import settings
from django.db import models

from apps.ai_assistance.catalogue import AllowedUseCase
from apps.organizations.models import Organization


class AIAssistanceRequestStatus(models.TextChoices):
    SUCCEEDED = "SUCCEEDED", "Succeeded"
    FAILED = "FAILED", "Failed"
    BLOCKED = "BLOCKED", "Blocked"
    DISABLED = "DISABLED", "Disabled"
    FALLBACK = "FALLBACK", "Safe fallback"


class AIAssistanceRequest(models.Model):
    """
    High-level AI usage audit row.

    Does not store full prompts or model completions by default — only use-case,
    status, source ids, and short redacted reason codes.
    """

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    organization = models.ForeignKey(
        Organization,
        on_delete=models.PROTECT,
        related_name="ai_assistance_requests",
    )
    requested_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        related_name="ai_assistance_requests",
    )
    use_case = models.CharField(max_length=64, choices=[(c.value, c.value) for c in AllowedUseCase])
    status = models.CharField(
        max_length=16,
        choices=AIAssistanceRequestStatus.choices,
        default=AIAssistanceRequestStatus.SUCCEEDED,
    )
    provider_name = models.CharField(max_length=32, blank=True, default="")
    correlation_id = models.CharField(max_length=64, blank=True, default="")
    source_ids = models.JSONField(default=list, blank=True)
    reason_code = models.CharField(max_length=64, blank=True, default="")
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ("-created_at",)
        verbose_name = "AI assistance request"
        verbose_name_plural = "AI assistance requests"
        permissions = [
            ("use_aiassistance", "Can use optional quality AI assistance"),
            ("view_aiassistanceaudit", "Can view AI assistance usage audit"),
        ]
        indexes = [
            models.Index(
                fields=["organization", "use_case", "created_at"],
                name="ai_assist_org_uc_at_idx",
            ),
            models.Index(
                fields=["organization", "status"],
                name="ai_assist_org_status_idx",
            ),
        ]

    def __str__(self) -> str:
        return f"{self.use_case} / {self.status} / {self.id}"
