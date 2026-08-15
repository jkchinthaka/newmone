"""Admin — soft retention for integration attempts."""

from __future__ import annotations

from django.contrib import admin
from django.http import HttpRequest

from apps.integrations.models import IntegrationAttempt


class SoftRetentionAdmin(admin.ModelAdmin):  # type: ignore[type-arg]
    def has_delete_permission(self, request: HttpRequest, obj: object | None = None) -> bool:
        return False

    def get_actions(self, request: HttpRequest):  # type: ignore[no-untyped-def]
        actions = super().get_actions(request)
        actions.pop("delete_selected", None)
        return actions


@admin.register(IntegrationAttempt)
class IntegrationAttemptAdmin(SoftRetentionAdmin):
    list_display = (
        "channel",
        "source_system",
        "status",
        "error_class",
        "organization",
        "attempt_count",
        "created_at",
    )
    list_filter = ("channel", "status", "error_class", "source_system")
    search_fields = ("idempotency_key", "correlation_id", "error_summary")
    readonly_fields = (
        "id",
        "created_at",
        "updated_at",
        "completed_at",
        "idempotency_key",
        "metadata",
    )
    autocomplete_fields = ("organization", "requested_by")
