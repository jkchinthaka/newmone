"""Admin — soft retention (no hard delete) for supplier quality."""

from __future__ import annotations

from django.contrib import admin
from django.http import HttpRequest

from apps.supplier_quality.models import (
    SupplierCertificate,
    SupplierQualityEvent,
    SupplierQualityProfile,
)


class _NoHardDeleteAdmin(admin.ModelAdmin):  # type: ignore[type-arg]
    def has_delete_permission(self, request: HttpRequest, obj: object | None = None) -> bool:
        return False

    def get_actions(self, request: HttpRequest):  # type: ignore[no-untyped-def]
        actions = super().get_actions(request)
        actions.pop("delete_selected", None)
        return actions


@admin.register(SupplierQualityProfile)
class SupplierQualityProfileAdmin(_NoHardDeleteAdmin):
    list_display = (
        "erp_supplier_reference",
        "display_name",
        "organization",
        "quality_status",
        "is_active",
        "updated_at",
    )
    list_filter = ("is_active", "organization")
    search_fields = ("erp_supplier_reference", "display_name")
    readonly_fields = ("id", "created_at", "updated_at")
    autocomplete_fields = ("organization",)


@admin.register(SupplierCertificate)
class SupplierCertificateAdmin(_NoHardDeleteAdmin):
    list_display = (
        "certificate_type",
        "profile",
        "issued_on",
        "expires_on",
        "verified_at",
        "verified_by",
    )
    search_fields = ("certificate_type", "profile__erp_supplier_reference")
    readonly_fields = ("id", "created_at", "updated_at", "verified_at")
    autocomplete_fields = ("profile", "verified_by")


@admin.register(SupplierQualityEvent)
class SupplierQualityEventAdmin(_NoHardDeleteAdmin):
    list_display = ("event_kind", "profile", "occurred_at", "recorded_by", "created_at")
    list_filter = ("event_kind",)
    search_fields = ("summary", "profile__erp_supplier_reference")
    readonly_fields = ("id", "created_at")
    autocomplete_fields = ("profile", "nonconformance", "corrective_action", "recorded_by")
