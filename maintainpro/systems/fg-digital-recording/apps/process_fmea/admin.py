from __future__ import annotations

from typing import TYPE_CHECKING, Any

from django.contrib import admin

from apps.process_fmea.models import (
    CurrentControl,
    FailureEffect,
    FailureMode,
    FailureModeAssessment,
    PotentialCause,
    ProcessFmea,
    ProcessFmeaEvent,
    ProcessFmeaLink,
    ProcessFmeaScoringPolicy,
    ProcessFmeaVersion,
    ProcessStep,
    RecommendedAction,
)

if TYPE_CHECKING:
    _SoftRetentionBase = admin.ModelAdmin[Any]
else:
    _SoftRetentionBase = admin.ModelAdmin


class SoftRetentionAdmin(_SoftRetentionBase):
    def has_delete_permission(self, request: Any, obj: Any = None) -> bool:
        return False


@admin.register(ProcessFmea)
class ProcessFmeaAdmin(SoftRetentionAdmin):
    list_display = ("fmea_code", "title", "organization", "process_reference")
    search_fields = ("fmea_code", "title")
    readonly_fields = ("created_at", "updated_at")


@admin.register(ProcessFmeaVersion)
class ProcessFmeaVersionAdmin(SoftRetentionAdmin):
    list_display = ("fmea", "version_number", "status", "scoring_enabled", "formula_kind")
    list_filter = ("status", "scoring_enabled")
    readonly_fields = ("created_at", "approved_at")


@admin.register(ProcessFmeaScoringPolicy)
class ProcessFmeaScoringPolicyAdmin(SoftRetentionAdmin):
    list_display = ("organization", "scoring_enabled", "formula_kind", "formula_citation")


@admin.register(ProcessStep)
class ProcessStepAdmin(SoftRetentionAdmin):
    list_display = ("step_code", "version", "sequence")


@admin.register(FailureMode)
class FailureModeAdmin(SoftRetentionAdmin):
    list_display = ("mode_code", "process_step")


@admin.register(FailureEffect)
class FailureEffectAdmin(SoftRetentionAdmin):
    list_display = ("failure_mode", "description")


@admin.register(PotentialCause)
class PotentialCauseAdmin(SoftRetentionAdmin):
    list_display = ("failure_mode", "description")


@admin.register(CurrentControl)
class CurrentControlAdmin(SoftRetentionAdmin):
    list_display = ("failure_mode", "control_reference")


@admin.register(FailureModeAssessment)
class FailureModeAssessmentAdmin(SoftRetentionAdmin):
    list_display = ("failure_mode", "snapshot_number", "computed_score_text", "assessed_at")
    readonly_fields = (
        "failure_mode",
        "snapshot_number",
        "severity_input",
        "occurrence_input",
        "detection_input",
        "computed_score_text",
        "method_citation",
        "notes",
        "assessed_by",
        "assessed_at",
    )

    def has_add_permission(self, request: Any) -> bool:
        return False

    def has_change_permission(self, request: Any, obj: Any = None) -> bool:
        return False


@admin.register(RecommendedAction)
class RecommendedActionAdmin(SoftRetentionAdmin):
    list_display = ("failure_mode", "action_kind", "summary")


@admin.register(ProcessFmeaLink)
class ProcessFmeaLinkAdmin(SoftRetentionAdmin):
    list_display = ("version", "link_kind", "citation")


@admin.register(ProcessFmeaEvent)
class ProcessFmeaEventAdmin(_SoftRetentionBase):
    list_display = ("fmea", "event_type", "actor", "created_at")
    readonly_fields = ("fmea", "version", "event_type", "summary", "payload", "actor", "created_at")

    def has_add_permission(self, request: Any) -> bool:
        return False

    def has_change_permission(self, request: Any, obj: Any = None) -> bool:
        return False

    def has_delete_permission(self, request: Any, obj: Any = None) -> bool:
        return False
