"""Django admin for checklist task orchestration, applicability, and schedules."""

from __future__ import annotations

from django.contrib import admin
from django.http import HttpRequest

from apps.scheduling.models import (
    ChecklistApplicabilityRule,
    ChecklistSchedule,
    ChecklistTask,
    ChecklistTaskAssignmentEvent,
    ExternalBatchEvent,
    ExternalBatchMapping,
)


@admin.register(ChecklistTask)
class ChecklistTaskAdmin(admin.ModelAdmin):  # type: ignore[type-arg]
    list_display = (
        "occurrence_key",
        "trigger_type",
        "batch_reference",
        "checklist_template",
        "organization",
        "assignee_kind",
        "assigned_user",
        "status",
        "due_from",
        "due_at",
        "due_soon_minutes",
        "created_at",
    )
    list_filter = ("status", "trigger_type", "organization", "checklist_template")
    search_fields = (
        "occurrence_key",
        "batch_reference",
        "checklist_template__code",
        "checklist_template__name",
    )
    autocomplete_fields = (
        "organization",
        "checklist_template",
        "checklist_version",
        "schedule",
        "shift",
    )
    ordering = ("-created_at",)
    readonly_fields = (
        "id",
        "organization",
        "checklist_template",
        "checklist_version",
        "batch_reference",
        "schedule",
        "trigger_type",
        "occurrence_key",
        "shift",
        "window_start_at",
        "window_end_at",
        "due_from",
        "due_at",
        "due_soon_minutes",
        "assignee_kind",
        "assigned_user",
        "assigned_role",
        "assigned_department",
        "assigned_shift",
        "assigned_team_code",
        "assigned_by",
        "assigned_at",
        "assignment_reason",
        "created_at",
        "updated_at",
    )

    def get_readonly_fields(
        self, request: HttpRequest, obj: ChecklistTask | None = None
    ) -> tuple[str, ...]:
        if obj is None:
            return ("id", "created_at", "updated_at")
        return self.readonly_fields

    def has_delete_permission(self, request: HttpRequest, obj: ChecklistTask | None = None) -> bool:
        return False

    def get_actions(self, request: HttpRequest):  # type: ignore[no-untyped-def]
        actions = super().get_actions(request)
        actions.pop("delete_selected", None)
        return actions


@admin.register(ChecklistSchedule)
class ChecklistScheduleAdmin(admin.ModelAdmin):  # type: ignore[type-arg]
    list_display = (
        "code",
        "name",
        "trigger_type",
        "organization",
        "checklist_template",
        "shift",
        "interval_minutes",
        "missed_policy",
        "is_active",
        "updated_at",
    )
    list_filter = ("trigger_type", "is_active", "organization", "missed_policy")
    search_fields = ("code", "name", "checklist_template__code", "notes")
    autocomplete_fields = (
        "organization",
        "checklist_template",
        "checklist_version",
        "shift",
    )
    readonly_fields = ("id", "created_at", "updated_at")
    ordering = ("organization__code", "code")

    def has_delete_permission(
        self, request: HttpRequest, obj: ChecklistSchedule | None = None
    ) -> bool:
        return False

    def get_actions(self, request: HttpRequest):  # type: ignore[no-untyped-def]
        actions = super().get_actions(request)
        actions.pop("delete_selected", None)
        return actions


@admin.register(ChecklistApplicabilityRule)
class ChecklistApplicabilityRuleAdmin(admin.ModelAdmin):  # type: ignore[type-arg]
    list_display = (
        "code",
        "name",
        "checklist_template",
        "checklist_version",
        "organization",
        "product",
        "site",
        "department",
        "shift",
        "effective_from",
        "effective_to",
        "is_active",
        "updated_at",
    )
    list_filter = ("is_active", "organization")
    search_fields = (
        "code",
        "name",
        "process_reference",
        "checklist_template__code",
        "notes",
        "product__code",
        "site__code",
        "department__code",
        "shift__code",
    )
    autocomplete_fields = (
        "organization",
        "checklist_template",
        "checklist_version",
        "product",
        "site",
        "department",
        "shift",
    )
    readonly_fields = ("id", "created_at", "updated_at")
    ordering = ("organization__code", "code")

    def has_delete_permission(
        self, request: HttpRequest, obj: ChecklistApplicabilityRule | None = None
    ) -> bool:
        return False

    def get_actions(self, request: HttpRequest):  # type: ignore[no-untyped-def]
        actions = super().get_actions(request)
        actions.pop("delete_selected", None)
        return actions


@admin.register(ExternalBatchMapping)
class ExternalBatchMappingAdmin(admin.ModelAdmin):  # type: ignore[type-arg]
    list_display = (
        "source_system",
        "mapping_kind",
        "external_key",
        "organization",
        "product",
        "site",
        "shift",
        "is_active",
        "updated_at",
    )
    list_filter = ("source_system", "mapping_kind", "is_active", "organization")
    search_fields = ("source_system", "external_key")
    autocomplete_fields = ("organization", "product", "site", "shift")
    readonly_fields = ("id", "created_at", "updated_at")
    ordering = ("source_system", "mapping_kind", "external_key")


@admin.register(ExternalBatchEvent)
class ExternalBatchEventAdmin(admin.ModelAdmin):  # type: ignore[type-arg]
    list_display = (
        "source_system",
        "source_event_id",
        "external_batch_id",
        "status",
        "organization",
        "checklist_task",
        "attempt_count",
        "processed_at",
        "created_at",
    )
    list_filter = ("status", "source_system", "organization")
    search_fields = ("source_system", "source_event_id", "external_batch_id")
    autocomplete_fields = (
        "organization",
        "product",
        "site",
        "shift",
        "checklist_task",
    )
    readonly_fields = (
        "id",
        "source_system",
        "source_event_id",
        "external_batch_id",
        "external_organization_key",
        "external_product_key",
        "external_site_key",
        "external_shift_key",
        "external_line_key",
        "status",
        "failure_code",
        "failure_message",
        "organization",
        "product",
        "site",
        "shift",
        "checklist_task",
        "attempt_count",
        "processed_at",
        "created_at",
        "updated_at",
    )
    ordering = ("-created_at",)

    def has_add_permission(self, request: HttpRequest) -> bool:
        return False

    def has_delete_permission(
        self, request: HttpRequest, obj: ExternalBatchEvent | None = None
    ) -> bool:
        return False

    def get_actions(self, request: HttpRequest):  # type: ignore[no-untyped-def]
        actions = super().get_actions(request)
        actions.pop("delete_selected", None)
        return actions


@admin.register(ChecklistTaskAssignmentEvent)
class ChecklistTaskAssignmentEventAdmin(admin.ModelAdmin):  # type: ignore[type-arg]
    list_display = (
        "checklist_task",
        "action",
        "assignee_kind",
        "assigned_user",
        "assigned_by",
        "assigned_at",
        "created_at",
    )
    list_filter = ("action", "assignee_kind")
    search_fields = ("checklist_task__batch_reference", "reason", "assigned_team_code")
    readonly_fields = (
        "id",
        "checklist_task",
        "action",
        "assignee_kind",
        "assigned_user",
        "assigned_role",
        "assigned_department",
        "assigned_shift",
        "assigned_team_code",
        "previous_assignee_kind",
        "previous_assigned_user",
        "previous_assigned_role",
        "previous_assigned_department",
        "previous_assigned_shift",
        "previous_assigned_team_code",
        "assigned_by",
        "assigned_at",
        "reason",
        "created_at",
    )
    ordering = ("-created_at",)

    def has_add_permission(self, request: HttpRequest) -> bool:
        return False

    def has_change_permission(
        self, request: HttpRequest, obj: ChecklistTaskAssignmentEvent | None = None
    ) -> bool:
        return False

    def has_delete_permission(
        self, request: HttpRequest, obj: ChecklistTaskAssignmentEvent | None = None
    ) -> bool:
        return False
