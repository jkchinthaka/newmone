"""Admin — soft retention for AI assistance audit rows."""

from __future__ import annotations

from django.contrib import admin
from django.http import HttpRequest

from apps.ai_assistance.models import AIAssistanceRequest


class SoftRetentionAdmin(admin.ModelAdmin):  # type: ignore[type-arg]
    def has_delete_permission(self, request: HttpRequest, obj: object | None = None) -> bool:
        return False

    def get_actions(self, request: HttpRequest):  # type: ignore[no-untyped-def]
        actions = super().get_actions(request)
        actions.pop("delete_selected", None)
        return actions


@admin.register(AIAssistanceRequest)
class AIAssistanceRequestAdmin(SoftRetentionAdmin):
    list_display = (
        "use_case",
        "organization",
        "status",
        "provider_name",
        "requested_by",
        "created_at",
    )
    list_filter = ("status", "use_case", "provider_name", "organization")
    search_fields = ("correlation_id", "reason_code")
    readonly_fields = (
        "id",
        "created_at",
        "source_ids",
        "reason_code",
        "correlation_id",
    )
    autocomplete_fields = ("organization", "requested_by")
