"""Django admin for training — no hard delete."""

from __future__ import annotations

from django.contrib import admin
from django.http import HttpRequest

from apps.training.models import TrainingEnforcementPolicy, TrainingRecord


class _NoHardDeleteAdmin(admin.ModelAdmin):  # type: ignore[type-arg]
    def has_delete_permission(self, request: HttpRequest, obj: object | None = None) -> bool:
        return False

    def get_actions(self, request: HttpRequest):  # type: ignore[no-untyped-def]
        actions = super().get_actions(request)
        actions.pop("delete_selected", None)
        return actions


@admin.register(TrainingRecord)
class TrainingRecordAdmin(_NoHardDeleteAdmin):
    list_display = (
        "course_code",
        "course_name",
        "subject_user",
        "organization",
        "competency_scope",
        "trained_on",
        "expires_on",
        "status",
        "recorded_by",
        "updated_at",
    )
    list_filter = ("status", "competency_scope", "organization")
    search_fields = (
        "course_code",
        "course_name",
        "subject_user__employee_code",
        "trainer_reference",
        "evidence_reference",
        "process_reference",
    )
    readonly_fields = ("id", "created_at", "updated_at")
    autocomplete_fields = (
        "organization",
        "subject_user",
        "checklist_template",
        "equipment",
        "business_role",
        "recorded_by",
    )
    ordering = ("-trained_on",)


@admin.register(TrainingEnforcementPolicy)
class TrainingEnforcementPolicyAdmin(_NoHardDeleteAdmin):
    list_display = ("organization", "gate_mode", "updated_by", "updated_at")
    list_filter = ("gate_mode",)
    search_fields = ("organization__code",)
    readonly_fields = ("id", "created_at", "updated_at")
    autocomplete_fields = ("organization", "updated_by")
