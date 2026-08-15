from __future__ import annotations

from typing import TYPE_CHECKING, Any

from django.contrib import admin

from apps.quality_quarantine.models import (
    QualityQuarantineEvent,
    QualityQuarantinePolicy,
    QualityQuarantineRecord,
)

if TYPE_CHECKING:
    _SoftRetentionBase = admin.ModelAdmin[Any]
else:
    _SoftRetentionBase = admin.ModelAdmin


class SoftRetentionAdmin(_SoftRetentionBase):
    def has_delete_permission(self, request: Any, obj: Any = None) -> bool:
        return False


@admin.register(QualityQuarantineRecord)
class QualityQuarantineRecordAdmin(SoftRetentionAdmin):
    list_display = (
        "code",
        "batch_reference",
        "source",
        "status",
        "erp_sync_status",
        "not_inventory_ledger",
        "opened_at",
    )
    list_filter = ("status", "source", "erp_sync_status", "organization")
    search_fields = ("code", "batch_reference", "sub_lot_reference", "source_reference")
    readonly_fields = (
        "id",
        "not_inventory_ledger",
        "opened_by",
        "opened_at",
        "resolved_by",
        "resolved_at",
        "created_at",
        "updated_at",
    )


@admin.register(QualityQuarantinePolicy)
class QualityQuarantinePolicyAdmin(SoftRetentionAdmin):
    list_display = ("organization", "quantity_recording_enabled", "erp_sync_enabled", "updated_at")
    readonly_fields = ("id", "created_at", "updated_at")


@admin.register(QualityQuarantineEvent)
class QualityQuarantineEventAdmin(SoftRetentionAdmin):
    list_display = ("event_type", "quarantine", "actor", "created_at")
    list_filter = ("event_type",)
    readonly_fields = (
        "id",
        "quarantine",
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
