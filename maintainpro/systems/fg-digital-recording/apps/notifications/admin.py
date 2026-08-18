"""Admin — soft retention for workflow notifications."""

from __future__ import annotations

from django.contrib import admin
from django.http import HttpRequest

from apps.notifications.models import (
    Notification,
    NotificationDeliveryAttempt,
    OrganizationNotificationPolicy,
)


class SoftRetentionAdmin(admin.ModelAdmin):  # type: ignore[type-arg]
    def has_delete_permission(self, request: HttpRequest, obj: object | None = None) -> bool:
        return False

    def get_actions(self, request: HttpRequest):  # type: ignore[no-untyped-def]
        actions = super().get_actions(request)
        actions.pop("delete_selected", None)
        return actions


@admin.register(OrganizationNotificationPolicy)
class OrganizationNotificationPolicyAdmin(SoftRetentionAdmin):
    list_display = (
        "organization",
        "email_delivery_enabled",
        "updated_by",
        "updated_at",
    )
    readonly_fields = ("id", "created_at", "updated_at")
    autocomplete_fields = ("organization", "updated_by")


@admin.register(Notification)
class NotificationAdmin(SoftRetentionAdmin):
    list_display = (
        "event_type",
        "recipient",
        "organization",
        "title",
        "delivery_status",
        "created_at",
        "read_at",
    )
    list_filter = ("event_type", "delivery_status", "organization")
    search_fields = ("title", "safe_message", "dedupe_key")
    readonly_fields = ("id", "created_at", "read_at", "dedupe_key")
    autocomplete_fields = ("organization", "recipient")


@admin.register(NotificationDeliveryAttempt)
class NotificationDeliveryAttemptAdmin(SoftRetentionAdmin):
    list_display = (
        "channel",
        "status",
        "attempt_count",
        "last_attempted_at",
        "idempotency_key",
    )
    list_filter = ("channel", "status")
    search_fields = ("idempotency_key", "last_error")
    readonly_fields = (
        "id",
        "created_at",
        "updated_at",
        "idempotency_key",
        "attempt_count",
        "last_attempted_at",
        "last_error",
    )
