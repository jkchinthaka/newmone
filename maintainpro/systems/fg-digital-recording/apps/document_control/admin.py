from __future__ import annotations

from typing import TYPE_CHECKING, Any

from django.contrib import admin

from apps.document_control.models import (
    QualityDocument,
    QualityDocumentAcknowledgement,
    QualityDocumentEvent,
    QualityDocumentVersion,
    QualityRecordDocumentLink,
)

if TYPE_CHECKING:
    _SoftRetentionBase = admin.ModelAdmin[Any]
else:
    _SoftRetentionBase = admin.ModelAdmin


class SoftRetentionAdmin(_SoftRetentionBase):
    def has_delete_permission(self, request: Any, obj: Any = None) -> bool:
        return False


@admin.register(QualityDocument)
class QualityDocumentAdmin(SoftRetentionAdmin):
    list_display = ("code", "title", "document_kind", "organization", "owner")
    list_filter = ("document_kind", "organization")
    search_fields = ("code", "title")
    readonly_fields = ("created_at", "updated_at")


@admin.register(QualityDocumentVersion)
class QualityDocumentVersionAdmin(SoftRetentionAdmin):
    list_display = ("document", "revision", "status", "effective_from", "approved_at")
    list_filter = ("status",)
    search_fields = ("revision", "document__code", "approval_reference")
    readonly_fields = ("created_at", "updated_at", "approved_at", "published_at", "retired_at")


@admin.register(QualityDocumentEvent)
class QualityDocumentEventAdmin(_SoftRetentionBase):
    list_display = ("document", "version", "event_type", "actor", "created_at")
    list_filter = ("event_type",)
    readonly_fields = (
        "document",
        "version",
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


@admin.register(QualityDocumentAcknowledgement)
class QualityDocumentAcknowledgementAdmin(SoftRetentionAdmin):
    list_display = (
        "version",
        "acknowledged_by",
        "acknowledged_at",
        "is_not_competency_training",
    )
    readonly_fields = ("acknowledged_at", "is_not_competency_training")


@admin.register(QualityRecordDocumentLink)
class QualityRecordDocumentLinkAdmin(SoftRetentionAdmin):
    list_display = ("document_version", "linked_kind", "linked_object_id", "organization")
    list_filter = ("linked_kind",)
    readonly_fields = ("created_at",)
