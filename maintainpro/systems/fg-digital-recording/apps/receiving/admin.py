"""Admin — soft retention for receiving quality."""

from __future__ import annotations

from typing import TYPE_CHECKING, Any

from django.contrib import admin

from apps.receiving.models import (
    MaterialReference,
    MaterialSpecification,
    MaterialSpecificationParameter,
    MaterialSpecificationVersion,
    ReceiptLabSampleLink,
    ReceiptQualityRecord,
    ReceivingHistoryEntry,
)

if TYPE_CHECKING:
    _SoftRetentionBase = admin.ModelAdmin[Any]
else:
    _SoftRetentionBase = admin.ModelAdmin


class SoftRetentionAdmin(_SoftRetentionBase):
    def has_delete_permission(self, request: Any, obj: Any = None) -> bool:
        return False


@admin.register(MaterialReference)
class MaterialReferenceAdmin(SoftRetentionAdmin):
    list_display = (
        "erp_material_reference",
        "display_name",
        "organization",
        "is_active",
    )
    search_fields = ("erp_material_reference", "display_name")
    list_filter = ("is_active", "organization")
    readonly_fields = ("id", "created_at", "updated_at")


@admin.register(MaterialSpecification)
class MaterialSpecificationAdmin(SoftRetentionAdmin):
    list_display = ("code", "title", "material", "organization")
    search_fields = ("code", "title")
    readonly_fields = ("id", "created_at", "updated_at")


@admin.register(MaterialSpecificationVersion)
class MaterialSpecificationVersionAdmin(SoftRetentionAdmin):
    list_display = ("specification", "version_number", "status", "approved_at")
    list_filter = ("status",)
    readonly_fields = ("id", "created_at", "updated_at", "approved_at")


@admin.register(MaterialSpecificationParameter)
class MaterialSpecificationParameterAdmin(SoftRetentionAdmin):
    list_display = ("code", "name", "version", "unit")
    readonly_fields = ("id", "created_at")


@admin.register(ReceiptQualityRecord)
class ReceiptQualityRecordAdmin(SoftRetentionAdmin):
    list_display = (
        "erp_receipt_reference",
        "supplier_lot",
        "material",
        "quality_state",
        "received_date",
    )
    list_filter = ("quality_state", "organization")
    search_fields = ("erp_receipt_reference", "supplier_lot")
    readonly_fields = (
        "id",
        "frozen_receipt_context",
        "created_at",
        "updated_at",
        "dispositioned_at",
    )


@admin.register(ReceiptLabSampleLink)
class ReceiptLabSampleLinkAdmin(SoftRetentionAdmin):
    list_display = ("receipt", "lab_sample", "linked_at")
    readonly_fields = ("id", "linked_at")


@admin.register(ReceivingHistoryEntry)
class ReceivingHistoryEntryAdmin(SoftRetentionAdmin):
    list_display = ("event_type", "organization", "actor", "created_at")
    list_filter = ("event_type",)
    readonly_fields = ("id", "created_at", "metadata")
