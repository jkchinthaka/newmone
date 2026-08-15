from __future__ import annotations

from typing import TYPE_CHECKING, Any

from django.contrib import admin

from apps.compliance_mapping.models import (
    ComplianceControlMapping,
    ComplianceEvidenceLink,
    ComplianceGap,
    ComplianceGapAction,
    ComplianceMappingEvent,
    ComplianceSource,
    ComplianceSourceEdition,
)

if TYPE_CHECKING:
    _SoftRetentionBase = admin.ModelAdmin[Any]
else:
    _SoftRetentionBase = admin.ModelAdmin


class SoftRetentionAdmin(_SoftRetentionBase):
    def has_delete_permission(self, request: Any, obj: Any = None) -> bool:
        return False


@admin.register(ComplianceSource)
class ComplianceSourceAdmin(SoftRetentionAdmin):
    list_display = ("source_code", "title", "kind", "organization")
    list_filter = ("kind", "organization")
    search_fields = ("source_code", "title")
    readonly_fields = ("created_at", "updated_at")


@admin.register(ComplianceSourceEdition)
class ComplianceSourceEditionAdmin(SoftRetentionAdmin):
    list_display = (
        "source",
        "version_edition",
        "applicability_status",
        "register_status",
        "last_reviewed_on",
    )
    list_filter = ("applicability_status", "register_status")
    readonly_fields = ("created_at", "updated_at")


@admin.register(ComplianceControlMapping)
class ComplianceControlMappingAdmin(SoftRetentionAdmin):
    list_display = (
        "clause_reference",
        "system_control_kind",
        "status",
        "organization",
        "edition",
    )
    list_filter = ("status", "system_control_kind", "organization")
    search_fields = ("clause_reference", "system_control_reference")
    readonly_fields = ("created_at", "updated_at")


@admin.register(ComplianceEvidenceLink)
class ComplianceEvidenceLinkAdmin(SoftRetentionAdmin):
    list_display = ("mapping", "evidence_kind", "citation", "created_at")
    list_filter = ("evidence_kind",)


@admin.register(ComplianceGap)
class ComplianceGapAdmin(SoftRetentionAdmin):
    list_display = ("mapping", "status", "created_at")
    list_filter = ("status",)
    readonly_fields = ("created_at", "updated_at", "closed_at")


@admin.register(ComplianceGapAction)
class ComplianceGapActionAdmin(SoftRetentionAdmin):
    list_display = ("gap", "action_kind", "action_summary", "created_at")
    list_filter = ("action_kind",)


@admin.register(ComplianceMappingEvent)
class ComplianceMappingEventAdmin(_SoftRetentionBase):
    list_display = ("source", "event_type", "actor", "created_at")
    list_filter = ("event_type",)
    readonly_fields = (
        "organization",
        "source",
        "edition",
        "mapping",
        "gap",
        "event_type",
        "summary",
        "payload",
        "actor",
        "created_at",
    )

    def has_add_permission(self, request: Any) -> bool:
        return False

    def has_change_permission(self, request: Any, obj: Any = None) -> bool:
        return False

    def has_delete_permission(self, request: Any, obj: Any = None) -> bool:
        return False
