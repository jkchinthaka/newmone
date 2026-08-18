from __future__ import annotations

from typing import TYPE_CHECKING, Any

from django.contrib import admin

from apps.change_control.models import (
    QualityChangeAffectedLink,
    QualityChangeEvent,
    QualityChangeImpactAssessment,
    QualityChangeImplementationLink,
    QualityChangeRequest,
)

if TYPE_CHECKING:
    _SoftRetentionBase = admin.ModelAdmin[Any]
else:
    _SoftRetentionBase = admin.ModelAdmin


class SoftRetentionAdmin(_SoftRetentionBase):
    def has_delete_permission(self, request: Any, obj: Any = None) -> bool:
        return False


@admin.register(QualityChangeRequest)
class QualityChangeRequestAdmin(SoftRetentionAdmin):
    list_display = ("change_code", "title", "status", "organization", "requester")
    list_filter = ("status", "organization")
    search_fields = ("change_code", "title")
    readonly_fields = ("created_at", "updated_at", "requested_at", "approved_at", "closed_at")


@admin.register(QualityChangeImpactAssessment)
class QualityChangeImpactAssessmentAdmin(SoftRetentionAdmin):
    list_display = ("change_request", "assessed_by", "assessed_at")
    readonly_fields = ("assessed_at", "updated_at")


@admin.register(QualityChangeAffectedLink)
class QualityChangeAffectedLinkAdmin(SoftRetentionAdmin):
    list_display = ("change_request", "linked_kind", "linked_reference", "linked_object_id")
    list_filter = ("linked_kind",)


@admin.register(QualityChangeImplementationLink)
class QualityChangeImplementationLinkAdmin(SoftRetentionAdmin):
    list_display = (
        "change_request",
        "implemented_kind",
        "implemented_reference",
        "does_not_constitute_approval",
    )
    readonly_fields = ("recorded_at", "does_not_constitute_approval")


@admin.register(QualityChangeEvent)
class QualityChangeEventAdmin(_SoftRetentionBase):
    list_display = ("change_request", "event_type", "actor", "created_at")
    list_filter = ("event_type",)
    readonly_fields = (
        "change_request",
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
