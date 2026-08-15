"""Admin — soft retention for sampling engine."""

from __future__ import annotations

from django.contrib import admin
from django.http import HttpRequest

from apps.sampling.models import (
    ChecklistItemSamplingBinding,
    SampleRequirement,
    SamplingHistoryEntry,
    SamplingPlan,
    SamplingPlanVersion,
    SamplingRule,
)


class SoftRetentionAdmin(admin.ModelAdmin):  # type: ignore[type-arg]
    def has_delete_permission(self, request: HttpRequest, obj: object | None = None) -> bool:
        return False

    def get_actions(self, request: HttpRequest):  # type: ignore[no-untyped-def]
        actions = super().get_actions(request)
        actions.pop("delete_selected", None)
        return actions


@admin.register(SamplingPlan)
class SamplingPlanAdmin(SoftRetentionAdmin):
    list_display = ("code", "title", "organization", "is_active", "created_at")
    list_filter = ("is_active", "organization")
    search_fields = ("code", "title", "external_standard_source")
    readonly_fields = ("id", "created_at", "updated_at")


@admin.register(SamplingPlanVersion)
class SamplingPlanVersionAdmin(SoftRetentionAdmin):
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


@admin.register(SamplingRule)
class SamplingRuleAdmin(SoftRetentionAdmin):
    list_display = ("code", "priority", "plan_version", "lot_size_min", "lot_size_max")
    search_fields = ("code", "title")


@admin.register(SampleRequirement)
class SampleRequirementAdmin(SoftRetentionAdmin):
    list_display = (
        "rule",
        "required_sample_count",
        "accept_threshold",
        "reject_threshold",
        "inspection_level",
    )


@admin.register(ChecklistItemSamplingBinding)
class ChecklistItemSamplingBindingAdmin(SoftRetentionAdmin):
    list_display = ("checklist_item", "plan_version", "created_at")
    readonly_fields = ("id", "frozen_sampling_context", "created_at", "updated_at")


@admin.register(SamplingHistoryEntry)
class SamplingHistoryEntryAdmin(SoftRetentionAdmin):
    list_display = ("event_type", "organization", "plan", "plan_version", "actor", "created_at")
    readonly_fields = ("id", "created_at", "metadata")
