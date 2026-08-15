"""Admin — soft retention for sanitation / SSOP."""

from __future__ import annotations

from django.contrib import admin
from django.http import HttpRequest

from apps.sanitation.models import (
    ChecklistTemplateSanitationBinding,
    ChemicalReference,
    SanitationFailPolicy,
    SanitationHistoryEntry,
    SanitationProgram,
    SanitationProgramVersion,
    SanitationScheduleLink,
    SanitationScope,
)


class SoftRetentionAdmin(admin.ModelAdmin):  # type: ignore[type-arg]
    def has_delete_permission(self, request: HttpRequest, obj: object | None = None) -> bool:
        return False

    def get_actions(self, request: HttpRequest):  # type: ignore[no-untyped-def]
        actions = super().get_actions(request)
        actions.pop("delete_selected", None)
        return actions


@admin.register(SanitationProgram)
class SanitationProgramAdmin(SoftRetentionAdmin):
    list_display = ("code", "title", "organization", "checklist_template", "is_active")
    list_filter = ("is_active", "organization")
    search_fields = ("code", "title")
    readonly_fields = ("id", "created_at", "updated_at")


@admin.register(SanitationProgramVersion)
class SanitationProgramVersionAdmin(SoftRetentionAdmin):
    list_display = ("program", "version_number", "status", "verification_mode", "approved_at")
    list_filter = ("status", "verification_mode")
    readonly_fields = ("id", "approved_by", "approved_at", "created_at", "updated_at")


@admin.register(SanitationScope)
class SanitationScopeAdmin(SoftRetentionAdmin):
    list_display = ("code", "program_version", "site", "department", "line_code", "work_area_code")
    search_fields = ("code", "line_code", "work_area_code")


@admin.register(SanitationScheduleLink)
class SanitationScheduleLinkAdmin(SoftRetentionAdmin):
    list_display = ("schedule_kind", "label", "program_version", "checklist_schedule")
    list_filter = ("schedule_kind",)


@admin.register(ChemicalReference)
class ChemicalReferenceAdmin(SoftRetentionAdmin):
    list_display = ("code", "name", "organization", "is_active", "concentration_label")
    list_filter = ("is_active", "organization")
    search_fields = ("code", "name")
    readonly_fields = ("id", "created_at", "updated_at")


@admin.register(SanitationFailPolicy)
class SanitationFailPolicyAdmin(SoftRetentionAdmin):
    list_display = ("organization", "policy_enabled", "procedure_reference", "updated_at")
    list_filter = ("policy_enabled",)


@admin.register(ChecklistTemplateSanitationBinding)
class ChecklistTemplateSanitationBindingAdmin(SoftRetentionAdmin):
    list_display = ("checklist_template", "program_version", "updated_at")
    readonly_fields = ("id", "frozen_sanitation_context", "created_at", "updated_at")


@admin.register(SanitationHistoryEntry)
class SanitationHistoryEntryAdmin(SoftRetentionAdmin):
    list_display = ("event_type", "organization", "program", "actor", "created_at")
    list_filter = ("event_type",)
    readonly_fields = ("id", "created_at", "metadata")
