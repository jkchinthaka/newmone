"""Read-only Django admin for security audit events."""

from __future__ import annotations

from django.contrib import admin
from django.http import HttpRequest

from apps.security_audit.models import SecurityAuditEvent


@admin.register(SecurityAuditEvent)
class SecurityAuditEventAdmin(admin.ModelAdmin):  # type: ignore[type-arg]
    list_display = (
        "event_type",
        "actor",
        "subject_user",
        "ip_address",
        "request_id",
        "created_at",
    )
    list_filter = ("event_type",)
    search_fields = (
        "request_id",
        "actor__employee_code",
        "subject_user__employee_code",
        "ip_address",
    )
    readonly_fields = (
        "id",
        "event_type",
        "actor",
        "subject_user",
        "request_id",
        "ip_address",
        "user_agent_summary",
        "metadata",
        "created_at",
    )
    ordering = ("-created_at",)

    def has_add_permission(self, request: HttpRequest) -> bool:
        return False

    def has_change_permission(self, request: HttpRequest, obj: object | None = None) -> bool:
        return False

    def has_delete_permission(self, request: HttpRequest, obj: object | None = None) -> bool:
        return False
