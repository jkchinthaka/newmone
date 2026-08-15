"""Admin — soft retention for dispatch quality foundation."""

from __future__ import annotations

from django.contrib import admin
from django.http import HttpRequest

from apps.dispatch.models import (
    ColdChainTemperatureReading,
    DispatchHistoryEntry,
    DispatchQualityRecord,
    DispatchQuantityLine,
    DispatchReleasePolicy,
)


class SoftRetentionAdmin(admin.ModelAdmin):  # type: ignore[type-arg]
    def has_delete_permission(self, request: HttpRequest, obj: object | None = None) -> bool:
        return False

    def get_actions(self, request: HttpRequest):  # type: ignore[no-untyped-def]
        actions = super().get_actions(request)
        actions.pop("delete_selected", None)
        return actions


class TemperatureInline(admin.TabularInline):  # type: ignore[type-arg]
    model = ColdChainTemperatureReading
    extra = 0
    readonly_fields = ("id", "created_at", "recorded_by")
    autocomplete_fields = ("equipment", "recorded_by")


class QuantityInline(admin.TabularInline):  # type: ignore[type-arg]
    model = DispatchQuantityLine
    extra = 0
    readonly_fields = ("id", "remaining_quantity", "created_at", "updated_at")
    autocomplete_fields = ("created_by", "updated_by")


@admin.register(DispatchQualityRecord)
class DispatchQualityRecordAdmin(SoftRetentionAdmin):
    list_display = (
        "code",
        "organization",
        "status",
        "delivery_loading_reference",
        "vehicle_reference",
        "batch_reference",
        "created_at",
        "completed_at",
    )
    list_filter = ("status", "organization")
    search_fields = (
        "code",
        "delivery_loading_reference",
        "vehicle_reference",
        "driver_reference",
        "batch_reference",
        "seal_number",
    )
    readonly_fields = ("id", "created_at", "updated_at", "completed_at", "cancelled_at")
    autocomplete_fields = (
        "organization",
        "owner",
        "created_by",
        "completed_by",
        "cancelled_by",
        "vehicle_inspection_checklist_version",
        "vehicle_inspection_submission",
        "qa_review",
    )
    inlines = [TemperatureInline, QuantityInline]


@admin.register(DispatchReleasePolicy)
class DispatchReleasePolicyAdmin(SoftRetentionAdmin):
    list_display = (
        "organization",
        "require_qa_release_before_loading",
        "updated_by",
        "updated_at",
    )
    list_filter = ("require_qa_release_before_loading",)
    search_fields = ("organization__code", "notes")
    readonly_fields = ("id", "created_at", "updated_at")
    autocomplete_fields = ("organization", "updated_by")


@admin.register(ColdChainTemperatureReading)
class ColdChainTemperatureReadingAdmin(SoftRetentionAdmin):
    list_display = (
        "dispatch_record",
        "reading_at",
        "temperature_celsius",
        "device_reference",
        "equipment",
        "recorded_by",
    )
    list_filter = ("organization",)
    search_fields = ("device_reference", "reading_context")
    readonly_fields = ("id", "created_at")
    autocomplete_fields = ("organization", "dispatch_record", "equipment", "recorded_by")


@admin.register(DispatchQuantityLine)
class DispatchQuantityLineAdmin(SoftRetentionAdmin):
    list_display = (
        "dispatch_record",
        "line_reference",
        "batch_reference",
        "released_quantity",
        "loaded_quantity",
        "remaining_quantity",
        "unit_of_measure",
    )
    list_filter = ("organization",)
    search_fields = ("line_reference", "batch_reference", "product_reference")
    readonly_fields = ("id", "remaining_quantity", "created_at", "updated_at")
    autocomplete_fields = ("organization", "dispatch_record", "created_by", "updated_by")


@admin.register(DispatchHistoryEntry)
class DispatchHistoryEntryAdmin(SoftRetentionAdmin):
    list_display = (
        "dispatch_record",
        "event_type",
        "from_status",
        "to_status",
        "actor",
        "created_at",
    )
    list_filter = ("event_type", "organization")
    search_fields = ("note", "event_type")
    readonly_fields = (
        "id",
        "organization",
        "dispatch_record",
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
