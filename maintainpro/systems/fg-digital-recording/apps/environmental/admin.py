"""Admin — soft retention for environmental monitoring."""

from __future__ import annotations

from django.contrib import admin
from django.http import HttpRequest

from apps.environmental.models import (
    EnvironmentalExcursionPolicy,
    EnvironmentalHistoryEntry,
    MonitoringExcursion,
    MonitoringLimitRule,
    MonitoringParameter,
    MonitoringPoint,
    MonitoringReading,
    MonitoringScheduleLink,
    MonitoringSpec,
    MonitoringSpecVersion,
    MonitoringTrendIndex,
)


class SoftRetentionAdmin(admin.ModelAdmin):  # type: ignore[type-arg]
    def has_delete_permission(self, request: HttpRequest, obj: object | None = None) -> bool:
        return False

    def get_actions(self, request: HttpRequest):  # type: ignore[no-untyped-def]
        actions = super().get_actions(request)
        actions.pop("delete_selected", None)
        return actions


@admin.register(MonitoringPoint)
class MonitoringPointAdmin(SoftRetentionAdmin):
    list_display = ("code", "name", "organization", "site", "department", "is_active")
    list_filter = ("is_active", "organization")
    search_fields = ("code", "name", "room_code", "line_code", "work_area_code")
    readonly_fields = ("id", "created_at", "updated_at")


@admin.register(MonitoringParameter)
class MonitoringParameterAdmin(SoftRetentionAdmin):
    list_display = ("code", "name", "unit", "category", "organization", "is_active")
    list_filter = ("category", "is_active", "organization")
    search_fields = ("code", "name")


@admin.register(MonitoringSpec)
class MonitoringSpecAdmin(SoftRetentionAdmin):
    list_display = ("code", "title", "organization", "is_active")
    search_fields = ("code", "title")


@admin.register(MonitoringSpecVersion)
class MonitoringSpecVersionAdmin(SoftRetentionAdmin):
    list_display = ("spec", "version_number", "status", "approved_at")
    list_filter = ("status",)
    readonly_fields = ("id", "approved_by", "approved_at", "created_at", "updated_at")


@admin.register(MonitoringLimitRule)
class MonitoringLimitRuleAdmin(SoftRetentionAdmin):
    list_display = (
        "parameter",
        "monitoring_point",
        "spec_version",
        "bound_min",
        "bound_max",
    )


@admin.register(MonitoringReading)
class MonitoringReadingAdmin(SoftRetentionAdmin):
    list_display = (
        "parameter",
        "monitoring_point",
        "numeric_value",
        "source_type",
        "recorded_at",
    )
    list_filter = ("source_type",)
    readonly_fields = ("id", "device_trace_context", "created_at")


@admin.register(MonitoringExcursion)
class MonitoringExcursionAdmin(SoftRetentionAdmin):
    list_display = ("outcome", "reading", "hold_recommended", "auto_hold_created", "created_at")
    list_filter = ("outcome", "auto_hold_created")
    readonly_fields = ("id", "frozen_limit_context", "created_at")


@admin.register(MonitoringTrendIndex)
class MonitoringTrendIndexAdmin(SoftRetentionAdmin):
    list_display = (
        "parameter",
        "monitoring_point",
        "numeric_value",
        "recorded_at",
        "evaluation_outcome",
    )


@admin.register(MonitoringScheduleLink)
class MonitoringScheduleLinkAdmin(SoftRetentionAdmin):
    list_display = ("monitoring_point", "parameter", "checklist_schedule", "label")


@admin.register(EnvironmentalExcursionPolicy)
class EnvironmentalExcursionPolicyAdmin(SoftRetentionAdmin):
    list_display = ("organization", "auto_hold_enabled", "procedure_reference", "updated_at")


@admin.register(EnvironmentalHistoryEntry)
class EnvironmentalHistoryEntryAdmin(SoftRetentionAdmin):
    list_display = ("event_type", "organization", "actor", "created_at")
    readonly_fields = ("id", "created_at", "metadata")
