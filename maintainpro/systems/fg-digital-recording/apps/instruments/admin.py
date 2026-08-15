"""Django admin for equipment and calibration — no hard delete."""

from __future__ import annotations

from django.contrib import admin
from django.http import HttpRequest

from apps.instruments.models import CalibrationRecord, Equipment


class _NoHardDeleteAdmin(admin.ModelAdmin):  # type: ignore[type-arg]
    def has_delete_permission(self, request: HttpRequest, obj: object | None = None) -> bool:
        return False

    def get_actions(self, request: HttpRequest):  # type: ignore[no-untyped-def]
        actions = super().get_actions(request)
        actions.pop("delete_selected", None)
        return actions


@admin.register(Equipment)
class EquipmentAdmin(_NoHardDeleteAdmin):
    list_display = (
        "code",
        "name",
        "equipment_type",
        "organization",
        "site",
        "operational_status",
        "is_active",
        "updated_at",
    )
    list_filter = ("is_active", "equipment_type", "operational_status", "organization")
    search_fields = ("code", "name", "serial_number", "organization__code")
    readonly_fields = ("id", "created_at", "updated_at")
    autocomplete_fields = ("organization", "site")
    ordering = ("organization__code", "code")


@admin.register(CalibrationRecord)
class CalibrationRecordAdmin(_NoHardDeleteAdmin):
    list_display = (
        "equipment",
        "calibrated_on",
        "next_due_on",
        "status",
        "certificate_reference",
        "provider_reference",
        "recorded_by",
        "created_at",
    )
    list_filter = ("calibrated_on", "status")
    search_fields = (
        "equipment__code",
        "certificate_reference",
        "provider_reference",
    )
    readonly_fields = ("id", "created_at", "updated_at")
    autocomplete_fields = ("equipment", "recorded_by")
    ordering = ("-calibrated_on",)
