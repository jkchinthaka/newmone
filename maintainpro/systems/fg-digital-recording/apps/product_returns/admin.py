"""Retention-safe admin for returned-product quality."""

from __future__ import annotations

from typing import TYPE_CHECKING, Any

from django.contrib import admin

from apps.product_returns.models import (
    ReturnQualityPolicy,
    ReturnQualityRecord,
    ReturnQualityTimelineEntry,
)

if TYPE_CHECKING:
    _SoftRetentionBase = admin.ModelAdmin[Any]
else:
    _SoftRetentionBase = admin.ModelAdmin


class SoftRetentionAdmin(_SoftRetentionBase):
    def has_delete_permission(self, request: Any, obj: Any = None) -> bool:
        return False


@admin.register(ReturnQualityRecord)
class ReturnQualityRecordAdmin(SoftRetentionAdmin):
    list_display = (
        "erp_return_reference",
        "erp_return_line_reference",
        "product_reference",
        "status",
        "quarantine_state",
        "not_saleable_via_app",
        "received_at",
    )
    list_filter = ("status", "quarantine_state", "disposition", "organization")
    search_fields = (
        "erp_return_reference",
        "erp_return_line_reference",
        "product_reference",
        "original_batch_reference",
    )
    readonly_fields = ("id", "not_saleable_via_app", "created_at", "updated_at", "dispositioned_at")


@admin.register(ReturnQualityPolicy)
class ReturnQualityPolicyAdmin(SoftRetentionAdmin):
    list_display = ("organization", "erp_stock_movement_enabled", "updated_at")
    readonly_fields = ("id", "created_at", "updated_at")


@admin.register(ReturnQualityTimelineEntry)
class ReturnQualityTimelineEntryAdmin(SoftRetentionAdmin):
    list_display = ("event_type", "return_quality_record", "actor", "created_at")
    list_filter = ("event_type", "organization")
    readonly_fields = (
        "id",
        "organization",
        "return_quality_record",
        "event_type",
        "metadata",
        "actor",
        "created_at",
    )
