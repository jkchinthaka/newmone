"""Admin — soft retention (no hard delete) for NCR / Hold / history."""

from __future__ import annotations

from django.contrib import admin
from django.http import HttpRequest

from apps.nonconformance.models import HoldCase, NonConformanceRecord, QualityCaseHistoryEntry


class SoftRetentionAdmin(admin.ModelAdmin):  # type: ignore[type-arg]
    def has_delete_permission(self, request: HttpRequest, obj: object | None = None) -> bool:
        return False

    def get_actions(self, request: HttpRequest):  # type: ignore[no-untyped-def]
        actions = super().get_actions(request)
        actions.pop("delete_selected", None)
        return actions


@admin.register(NonConformanceRecord)
class NonConformanceRecordAdmin(SoftRetentionAdmin):
    """
    NCR status transitions are service-driven only.

    Workflow/status fields are read-only in admin for all staff (including
    superuser) to prevent silent state-machine bypass.
    """

    list_display = (
        "code",
        "title",
        "organization",
        "source",
        "status",
        "owner",
        "created_at",
        "closed_at",
    )
    list_filter = ("status", "source", "organization")
    search_fields = ("code", "title", "batch_reference", "description")
    readonly_fields = (
        "id",
        "status",
        "created_at",
        "updated_at",
        "closed_at",
        "closed_by",
    )
    autocomplete_fields = (
        "organization",
        "owner",
        "created_by",
        "closed_by",
        "checklist_task",
        "checklist_submission",
    )


@admin.register(HoldCase)
class HoldCaseAdmin(SoftRetentionAdmin):
    """Hold status transitions are service-driven only; status is admin read-only."""

    list_display = (
        "code",
        "organization",
        "status",
        "reason_reference",
        "owner",
        "opened_at",
        "closed_at",
    )
    list_filter = ("status", "organization")
    search_fields = ("code", "reason_reference", "batch_reference", "scope")
    readonly_fields = (
        "id",
        "status",
        "opened_at",
        "updated_at",
        "closed_at",
        "closed_by",
    )
    autocomplete_fields = (
        "organization",
        "owner",
        "opened_by",
        "closed_by",
        "nonconformance",
    )


@admin.register(QualityCaseHistoryEntry)
class QualityCaseHistoryEntryAdmin(SoftRetentionAdmin):
    list_display = (
        "case_kind",
        "case_id",
        "event_type",
        "from_status",
        "to_status",
        "actor",
        "created_at",
    )
    list_filter = ("case_kind", "event_type", "organization")
    search_fields = ("case_id", "event_type", "note")
    readonly_fields = (
        "id",
        "organization",
        "case_kind",
        "case_id",
        "event_type",
        "from_status",
        "to_status",
        "note",
        "metadata",
        "actor",
        "created_at",
    )

    def has_add_permission(self, request: HttpRequest) -> bool:
        return False

    def has_change_permission(self, request: HttpRequest, obj: object | None = None) -> bool:
        return False
