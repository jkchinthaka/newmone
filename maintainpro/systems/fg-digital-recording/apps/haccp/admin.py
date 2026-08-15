"""Admin — soft retention for HACCP foundation."""

from __future__ import annotations

from django.contrib import admin
from django.http import HttpRequest

from apps.haccp.models import (
    ChecklistItemHaccpBinding,
    ControlMeasure,
    ControlPoint,
    CorrectiveActionReference,
    CriticalLimitReference,
    HaccpHistoryEntry,
    HaccpPlan,
    HaccpPlanVersion,
    Hazard,
    MonitoringRule,
    ProcessStep,
)


class SoftRetentionAdmin(admin.ModelAdmin):  # type: ignore[type-arg]
    def has_delete_permission(self, request: HttpRequest, obj: object | None = None) -> bool:
        return False

    def get_actions(self, request: HttpRequest):  # type: ignore[no-untyped-def]
        actions = super().get_actions(request)
        actions.pop("delete_selected", None)
        return actions


@admin.register(HaccpPlan)
class HaccpPlanAdmin(SoftRetentionAdmin):
    list_display = ("code", "title", "organization", "is_active", "created_at")
    list_filter = ("is_active", "organization")
    search_fields = ("code", "title")
    readonly_fields = ("id", "created_at", "updated_at")


@admin.register(HaccpPlanVersion)
class HaccpPlanVersionAdmin(SoftRetentionAdmin):
    list_display = (
        "plan",
        "version_number",
        "status",
        "effective_from",
        "effective_to",
        "approved_at",
    )
    list_filter = ("status",)
    readonly_fields = ("id", "created_at", "updated_at", "approved_at")


@admin.register(ProcessStep)
class ProcessStepAdmin(SoftRetentionAdmin):
    list_display = ("code", "title", "sequence", "plan_version")
    search_fields = ("code", "title")


@admin.register(Hazard)
class HazardAdmin(SoftRetentionAdmin):
    list_display = ("code", "title", "category", "process_step")
    list_filter = ("category",)


@admin.register(ControlMeasure)
class ControlMeasureAdmin(SoftRetentionAdmin):
    list_display = ("code", "title", "hazard")


@admin.register(ControlPoint)
class ControlPointAdmin(SoftRetentionAdmin):
    list_display = ("code", "title", "control_point_type", "plan_version", "process_step")
    list_filter = ("control_point_type",)


@admin.register(CriticalLimitReference)
class CriticalLimitReferenceAdmin(SoftRetentionAdmin):
    list_display = ("control_point", "rule_reference", "unit", "boundary_semantics")
    readonly_fields = ("id",)


@admin.register(MonitoringRule)
class MonitoringRuleAdmin(SoftRetentionAdmin):
    list_display = ("control_point", "method_reference", "frequency_reference")


@admin.register(CorrectiveActionReference)
class CorrectiveActionReferenceAdmin(SoftRetentionAdmin):
    list_display = (
        "procedure_reference",
        "control_point",
        "auto_raise_hold_enabled",
        "auto_raise_ncr_enabled",
    )


@admin.register(ChecklistItemHaccpBinding)
class ChecklistItemHaccpBindingAdmin(SoftRetentionAdmin):
    list_display = ("checklist_item", "plan_version", "control_point", "created_at")
    readonly_fields = ("id", "frozen_haccp_context", "created_at", "updated_at")


@admin.register(HaccpHistoryEntry)
class HaccpHistoryEntryAdmin(SoftRetentionAdmin):
    list_display = ("event_type", "organization", "plan", "plan_version", "actor", "created_at")
    list_filter = ("event_type", "organization")
    readonly_fields = ("id", "created_at", "metadata")
