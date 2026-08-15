"""Admin — soft retention for allergen / changeover / line clearance."""

from __future__ import annotations

from typing import TYPE_CHECKING, Any

from django.contrib import admin

from apps.changeover.models import (
    AllergenReference,
    AllergenRiskPolicy,
    ChangeoverHistoryEntry,
    ChangeoverRecord,
    LineClearanceRecord,
    ProductAllergenDeclaration,
)

if TYPE_CHECKING:
    _SoftRetentionBase = admin.ModelAdmin[Any]
else:
    _SoftRetentionBase = admin.ModelAdmin


class SoftRetentionAdmin(_SoftRetentionBase):
    """Operational history is retained — no hard delete from admin."""

    def has_delete_permission(self, request: Any, obj: Any = None) -> bool:
        return False


@admin.register(AllergenReference)
class AllergenReferenceAdmin(SoftRetentionAdmin):
    list_display = ("code", "name", "organization", "is_active", "created_at")
    list_filter = ("is_active", "organization")
    search_fields = ("code", "name")
    readonly_fields = ("id", "created_at", "updated_at")


@admin.register(ProductAllergenDeclaration)
class ProductAllergenDeclarationAdmin(SoftRetentionAdmin):
    list_display = (
        "product",
        "status",
        "declaration_reference",
        "organization",
        "approved_at",
    )
    list_filter = ("status", "organization")
    search_fields = ("declaration_reference", "product__code")
    readonly_fields = ("id", "created_at", "updated_at", "approved_at")
    filter_horizontal = ("allergen_references",)


@admin.register(ChangeoverRecord)
class ChangeoverRecordAdmin(SoftRetentionAdmin):
    list_display = (
        "previous_product",
        "next_product",
        "line_code",
        "status",
        "batch_reference",
        "started_at",
    )
    list_filter = ("status", "organization", "line_code")
    search_fields = ("batch_reference", "line_code")
    readonly_fields = (
        "id",
        "frozen_changeover_context",
        "created_at",
        "updated_at",
        "verified_at",
    )


@admin.register(LineClearanceRecord)
class LineClearanceRecordAdmin(SoftRetentionAdmin):
    list_display = (
        "line_code",
        "checklist_template",
        "checklist_version",
        "status",
        "completed_at",
    )
    list_filter = ("status", "organization", "line_code")
    readonly_fields = (
        "id",
        "frozen_clearance_context",
        "created_at",
        "updated_at",
    )


@admin.register(AllergenRiskPolicy)
class AllergenRiskPolicyAdmin(SoftRetentionAdmin):
    list_display = ("organization", "policy_enabled", "procedure_reference", "updated_at")
    readonly_fields = ("id", "created_at", "updated_at")


@admin.register(ChangeoverHistoryEntry)
class ChangeoverHistoryEntryAdmin(SoftRetentionAdmin):
    list_display = ("event_type", "organization", "actor", "created_at")
    list_filter = ("event_type", "organization")
    readonly_fields = ("id", "created_at", "metadata")
