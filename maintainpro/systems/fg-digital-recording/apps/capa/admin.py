"""Admin — soft retention (no hard delete) for CAPA records."""

from __future__ import annotations

from django.contrib import admin
from django.http import HttpRequest

from apps.capa.models import CapaActionItem, CapaHistoryEntry, CorrectiveAction


class SoftRetentionAdmin(admin.ModelAdmin):  # type: ignore[type-arg]
    def has_delete_permission(self, request: HttpRequest, obj: object | None = None) -> bool:
        return False

    def get_actions(self, request: HttpRequest):  # type: ignore[no-untyped-def]
        actions = super().get_actions(request)
        actions.pop("delete_selected", None)
        return actions


class CapaActionItemInline(admin.TabularInline):  # type: ignore[type-arg]
    model = CapaActionItem
    extra = 0
    readonly_fields = ("id", "created_at", "updated_at", "completed_at")
    autocomplete_fields = ("owner",)


@admin.register(CorrectiveAction)
class CorrectiveActionAdmin(SoftRetentionAdmin):
    """
    CAPA status transitions are service-driven only.

    Workflow/status and terminal audit fields are read-only in admin for all
    staff (including superuser) to prevent silent state-machine bypass.
    """

    list_display = (
        "code",
        "title",
        "organization",
        "status",
        "owner",
        "nonconformance",
        "created_at",
        "closed_at",
    )
    list_filter = ("status", "organization")
    search_fields = ("code", "title", "summary")
    readonly_fields = (
        "id",
        "status",
        "created_at",
        "updated_at",
        "closed_at",
        "closed_by",
        "verified_at",
        "verified_by",
        "effectiveness_reviewed_at",
        "effectiveness_reviewed_by",
    )
    autocomplete_fields = (
        "organization",
        "nonconformance",
        "owner",
        "created_by",
        "closed_by",
        "verified_by",
        "effectiveness_reviewed_by",
    )
    inlines = [CapaActionItemInline]


@admin.register(CapaHistoryEntry)
class CapaHistoryEntryAdmin(SoftRetentionAdmin):
    list_display = ("capa", "event_type", "from_status", "to_status", "actor", "created_at")
    list_filter = ("event_type", "organization")
    search_fields = ("event_type", "note")
    readonly_fields = (
        "id",
        "organization",
        "capa",
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
