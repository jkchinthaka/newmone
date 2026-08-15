"""Admin — soft retention for IPQC."""

from __future__ import annotations

from typing import TYPE_CHECKING, Any

from django.contrib import admin

from apps.ipqc.models import (
    IpqcHistoryEntry,
    IpqcInspectionCase,
    IpqcProcessCheckDefinition,
    IpqcWorkflowPolicy,
)

if TYPE_CHECKING:
    _SoftRetentionBase = admin.ModelAdmin[Any]
else:
    _SoftRetentionBase = admin.ModelAdmin


class SoftRetentionAdmin(_SoftRetentionBase):
    def has_delete_permission(self, request: Any, obj: Any = None) -> bool:
        return False


@admin.register(IpqcProcessCheckDefinition)
class IpqcProcessCheckDefinitionAdmin(SoftRetentionAdmin):
    list_display = (
        "code",
        "name",
        "trigger_kind",
        "is_active",
        "organization",
        "updated_at",
    )
    list_filter = ("trigger_kind", "is_active", "organization")
    search_fields = ("code", "name", "production_line_code", "process_step_code")
    readonly_fields = ("id", "created_at", "updated_at")


@admin.register(IpqcInspectionCase)
class IpqcInspectionCaseAdmin(SoftRetentionAdmin):
    list_display = (
        "definition",
        "trigger_kind",
        "workflow_status",
        "failure_detected",
        "stop_production_signal",
        "due_at",
        "organization",
    )
    list_filter = ("workflow_status", "trigger_kind", "failure_detected", "organization")
    search_fields = (
        "occurrence_key",
        "batch_reference",
        "production_order_reference",
        "production_line_code",
    )
    readonly_fields = (
        "id",
        "frozen_process_context",
        "measurement_snapshot",
        "equipment_trace_snapshot",
        "sampling_snapshot",
        "haccp_metadata_snapshot",
        "failure_decision",
        "created_at",
        "updated_at",
        "closed_at",
    )


@admin.register(IpqcWorkflowPolicy)
class IpqcWorkflowPolicyAdmin(SoftRetentionAdmin):
    list_display = (
        "organization",
        "stop_production_on_fail_enabled",
        "procedure_reference",
        "updated_at",
    )
    readonly_fields = ("id", "created_at", "updated_at")


@admin.register(IpqcHistoryEntry)
class IpqcHistoryEntryAdmin(SoftRetentionAdmin):
    list_display = ("event_type", "organization", "actor", "created_at")
    list_filter = ("event_type",)
    readonly_fields = ("id", "created_at", "metadata")
