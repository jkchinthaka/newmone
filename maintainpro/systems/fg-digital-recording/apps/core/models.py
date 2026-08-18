"""Abstract foundation mixins + durable idempotency key model."""

from __future__ import annotations

import uuid

from django.db import models
from django.utils import timezone


class TimeStampedModel(models.Model):
    """Timezone-aware created/updated timestamps for future concrete models."""

    created_at = models.DateTimeField(default=timezone.now, editable=False)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        abstract = True


class ActiveFlagModel(models.Model):
    """Soft active/inactive flag for future concrete models."""

    is_active = models.BooleanField(default=True)

    class Meta:
        abstract = True


class IdempotencyKeyStatus(models.TextChoices):
    PENDING = "PENDING", "Pending"
    IN_PROGRESS = "IN_PROGRESS", "In progress"
    COMPLETED = "COMPLETED", "Completed"
    FAILED = "FAILED", "Failed"


class IdempotencyKey(models.Model):
    """Organization-scoped durable idempotency record for critical FG writes.

    Mongo collection (namespaced): fg_core_idempotencykey
    """

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    organization = models.ForeignKey(
        "organizations.Organization",
        on_delete=models.PROTECT,
        related_name="idempotency_keys",
    )
    scope = models.CharField(max_length=64)
    key = models.CharField(max_length=191)
    status = models.CharField(
        max_length=16,
        choices=IdempotencyKeyStatus.choices,
        default=IdempotencyKeyStatus.PENDING,
    )
    result_reference = models.CharField(max_length=64, blank=True, default="")
    result_payload = models.JSONField(default=dict, blank=True)
    error_code = models.CharField(max_length=64, blank=True, default="")
    created_at = models.DateTimeField(auto_now_add=True)
    completed_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        verbose_name = "Idempotency key"
        verbose_name_plural = "Idempotency keys"
        constraints = [
            models.UniqueConstraint(
                fields=["organization", "scope", "key"],
                name="core_idempotency_org_scope_key_uniq",
            ),
        ]
        indexes = [
            models.Index(
                fields=["organization", "scope", "status"],
                name="core_idem_org_scope_st_idx",
            ),
            models.Index(fields=["created_at"], name="core_idem_created_idx"),
        ]

    def __str__(self) -> str:
        return f"{self.scope}/{self.key} ({self.status})"
