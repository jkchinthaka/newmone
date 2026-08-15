"""
Workflow notification foundation — Phase 15.

In-app first. Optional email only when SMTP is configured and policy enables it.
SMS is not integrated (provider/budget EVIDENCE REQUIRED).
Event types are configurable and disabled by default — do not spam.
Safe messages must never carry checklist answers or sensitive review notes.
"""

from __future__ import annotations

import uuid

from django.conf import settings
from django.core.exceptions import ValidationError
from django.db import models
from django.db.models.functions import Lower

from apps.organizations.models import Organization


class NotificationEventType(models.TextChoices):
    """Candidate workflow events — not enabled unless org policy turns them on."""

    TASK_ASSIGNED = "TASK_ASSIGNED", "Task assignment"
    TASK_DUE = "TASK_DUE", "Task due"
    TASK_OVERDUE = "TASK_OVERDUE", "Task overdue"
    SUBMISSION_CREATED = "SUBMISSION_CREATED", "Submission created"
    SUPERVISOR_PENDING = "SUPERVISOR_PENDING", "Supervisor review pending"
    CORRECTION_RETURNED = "CORRECTION_RETURNED", "Returned for correction"
    QA_PENDING = "QA_PENDING", "QA review pending"
    QA_HOLD = "QA_HOLD", "QA HOLD disposition"
    QA_REJECT = "QA_REJECT", "QA REJECT disposition"
    CAPA_DUE = "CAPA_DUE", "CAPA action due"
    INTEGRATION_FAILURE = "INTEGRATION_FAILURE", "Integration failure"


class NotificationChannel(models.TextChoices):
    IN_APP = "IN_APP", "In-app"
    EMAIL = "EMAIL", "Email"
    # SMS reserved — not implemented until company/provider/budget approved.


class NotificationDeliveryStatus(models.TextChoices):
    PENDING = "PENDING", "Pending"
    DELIVERED = "DELIVERED", "Delivered"
    FAILED = "FAILED", "Failed"
    SKIPPED = "SKIPPED", "Skipped"


class OrganizationNotificationPolicy(models.Model):
    """
    Per-organization notification switches.

    All event types default OFF. Email channel defaults OFF even if SMTP exists.
    """

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    organization = models.OneToOneField(
        Organization,
        on_delete=models.PROTECT,
        related_name="notification_policy",
    )
    # Comma-separated enabled event type codes (empty = none). Prefer JSONField-like
    # storage without inventing company routing matrices.
    enabled_event_types = models.JSONField(
        default=list,
        blank=True,
        help_text="List of NotificationEventType values enabled for this org. Default empty.",
    )
    email_delivery_enabled = models.BooleanField(
        default=False,
        help_text="When True and SMTP configured, queue email copies of enabled events.",
    )
    updated_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        related_name="notification_policies_updated",
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = "Organization notification policy"
        verbose_name_plural = "Organization notification policies"
        permissions = [
            ("manage_notificationpolicy", "Can manage organization notification policy"),
        ]

    def __str__(self) -> str:
        return f"{self.organization.code} notification policy"

    def clean(self) -> None:
        super().clean()
        if not isinstance(self.enabled_event_types, list):
            raise ValidationError({"enabled_event_types": "Must be a list of event type codes."})
        allowed = set(NotificationEventType.values)
        for code in self.enabled_event_types:
            if code not in allowed:
                raise ValidationError(
                    {"enabled_event_types": f"Unknown or disallowed event type: {code}"}
                )


class Notification(models.Model):
    """
    In-app workflow notification for one recipient.

    title / safe_message are privacy-safe only — no checklist answers or sensitive notes.
    """

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    organization = models.ForeignKey(
        Organization,
        on_delete=models.PROTECT,
        related_name="notifications",
    )
    recipient = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        related_name="workflow_notifications",
    )
    event_type = models.CharField(max_length=32, choices=NotificationEventType.choices)
    title = models.CharField(max_length=120)
    safe_message = models.CharField(
        max_length=280,
        help_text="Privacy-safe summary only — never checklist answers or sensitive notes.",
    )
    reference_kind = models.CharField(max_length=64, blank=True, default="")
    reference_id = models.UUIDField(null=True, blank=True)
    dedupe_key = models.CharField(
        max_length=128,
        help_text="Idempotency key scoped per recipient (duplicate creates are no-ops).",
    )
    delivery_status = models.CharField(
        max_length=16,
        choices=NotificationDeliveryStatus.choices,
        default=NotificationDeliveryStatus.DELIVERED,
        help_text="In-app channel status (created rows are DELIVERED).",
    )
    created_at = models.DateTimeField(auto_now_add=True)
    read_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ("-created_at",)
        verbose_name = "Notification"
        verbose_name_plural = "Notifications"
        permissions = [
            ("view_own_notifications", "Can view own workflow notifications"),
            ("manage_notifications", "Can manage workflow notification dispatch"),
        ]
        constraints = [
            models.UniqueConstraint(
                Lower("dedupe_key"),
                "recipient",
                name="notif_recipient_dedupe_ci_uniq",
            ),
        ]
        indexes = [
            models.Index(
                fields=["recipient", "read_at", "created_at"],
                name="notif_recipient_read_idx",
            ),
            models.Index(
                fields=["organization", "event_type", "created_at"],
                name="notif_org_event_idx",
            ),
        ]

    def __str__(self) -> str:
        return f"{self.event_type} → {self.recipient_id}"


class NotificationDeliveryAttempt(models.Model):
    """
    Async channel delivery record (email). Idempotent via unique idempotency_key.

    SMS channel is intentionally absent until provider/budget approval.
    """

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    notification = models.ForeignKey(
        Notification,
        on_delete=models.PROTECT,
        related_name="delivery_attempts",
    )
    channel = models.CharField(max_length=16, choices=NotificationChannel.choices)
    status = models.CharField(
        max_length=16,
        choices=NotificationDeliveryStatus.choices,
        default=NotificationDeliveryStatus.PENDING,
    )
    idempotency_key = models.CharField(max_length=160, unique=True)
    attempt_count = models.PositiveIntegerField(default=0)
    last_attempted_at = models.DateTimeField(null=True, blank=True)
    last_error = models.CharField(max_length=255, blank=True, default="")
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ("created_at",)
        verbose_name = "Notification delivery attempt"
        verbose_name_plural = "Notification delivery attempts"
        indexes = [
            models.Index(
                fields=["status", "channel", "last_attempted_at"],
                name="notif_delivery_status_idx",
            ),
        ]

    def __str__(self) -> str:
        return f"{self.channel}/{self.status} {self.idempotency_key}"
