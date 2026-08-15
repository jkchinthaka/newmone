"""Admin — soft retention for governed report runs."""

from __future__ import annotations

from django.contrib import admin
from django.http import HttpRequest

from apps.reports.models import ReportRun


class SoftRetentionAdmin(admin.ModelAdmin):  # type: ignore[type-arg]
    def has_delete_permission(self, request: HttpRequest, obj: object | None = None) -> bool:
        return False

    def get_actions(self, request: HttpRequest):  # type: ignore[no-untyped-def]
        actions = super().get_actions(request)
        actions.pop("delete_selected", None)
        return actions


@admin.register(ReportRun)
class ReportRunAdmin(SoftRetentionAdmin):
    list_display = (
        "report_code",
        "organization",
        "status",
        "export_format",
        "row_count",
        "requested_by",
        "created_at",
        "completed_at",
    )
    list_filter = ("status", "report_code", "export_format", "organization")
    search_fields = ("error_summary",)
    readonly_fields = (
        "id",
        "created_at",
        "started_at",
        "completed_at",
        "result_csv",
        "row_count",
        "error_summary",
    )
    autocomplete_fields = ("organization", "requested_by")
