"""Django admin for FG Product and product specifications."""

from __future__ import annotations

from django.contrib import admin
from django.http import HttpRequest

from apps.master_data.models import (
    FGProduct,
    ProductSpecification,
    SpecificationParameter,
    SpecificationVersion,
    SpecificationVersionStatus,
)


@admin.register(FGProduct)
class FGProductAdmin(admin.ModelAdmin):  # type: ignore[type-arg]
    list_display = (
        "code",
        "name",
        "organization",
        "erp_item_code",
        "category",
        "is_active",
        "effective_from",
        "effective_to",
        "updated_at",
    )
    list_filter = ("is_active", "organization", "category")
    search_fields = (
        "code",
        "name",
        "erp_item_code",
        "barcode",
        "category",
        "brand",
        "organization__code",
    )
    readonly_fields = ("id", "created_at", "updated_at")
    autocomplete_fields = ("organization",)
    ordering = ("organization__code", "code")

    def has_delete_permission(self, request: HttpRequest, obj: FGProduct | None = None) -> bool:
        return False

    def get_actions(self, request: HttpRequest):  # type: ignore[no-untyped-def]
        actions = super().get_actions(request)
        actions.pop("delete_selected", None)
        return actions


class SpecificationParameterInline(admin.TabularInline):  # type: ignore[type-arg]
    model = SpecificationParameter
    extra = 0
    fields = (
        "code",
        "name",
        "unit",
        "precision",
        "bound_min",
        "bound_max",
        "min_inclusive",
        "max_inclusive",
        "warn_min",
        "warn_max",
        "test_method_reference",
    )
    show_change_link = True

    def has_delete_permission(
        self, request: HttpRequest, obj: SpecificationVersion | None = None
    ) -> bool:
        if obj is not None and obj.status != SpecificationVersionStatus.DRAFT:
            return False
        return super().has_delete_permission(request, obj)

    def get_readonly_fields(
        self, request: HttpRequest, obj: SpecificationVersion | None = None
    ) -> tuple[str, ...] | list[str]:
        if obj is not None and obj.is_immutable:
            return [f.name for f in self.model._meta.fields if f.name != "id"]
        return []


@admin.register(ProductSpecification)
class ProductSpecificationAdmin(admin.ModelAdmin):  # type: ignore[type-arg]
    list_display = ("code", "name", "product", "organization", "is_active", "updated_at")
    list_filter = ("is_active", "organization")
    search_fields = ("code", "name", "product__code", "organization__code")
    readonly_fields = ("id", "created_at", "updated_at")
    autocomplete_fields = ("organization", "product")

    def has_delete_permission(
        self, request: HttpRequest, obj: ProductSpecification | None = None
    ) -> bool:
        return False

    def get_actions(self, request: HttpRequest):  # type: ignore[no-untyped-def]
        actions = super().get_actions(request)
        actions.pop("delete_selected", None)
        return actions


@admin.register(SpecificationVersion)
class SpecificationVersionAdmin(admin.ModelAdmin):  # type: ignore[type-arg]
    list_display = (
        "specification",
        "version_number",
        "status",
        "effective_from",
        "effective_to",
        "approval_reference",
        "approved_at",
    )
    list_filter = ("status",)
    search_fields = ("specification__code", "approval_reference")
    readonly_fields = (
        "id",
        "version_number",
        "approved_at",
        "approved_by",
        "created_at",
        "updated_at",
    )
    autocomplete_fields = ("specification",)
    inlines = (SpecificationParameterInline,)

    def has_delete_permission(
        self, request: HttpRequest, obj: SpecificationVersion | None = None
    ) -> bool:
        return False

    def get_readonly_fields(
        self, request: HttpRequest, obj: SpecificationVersion | None = None
    ) -> tuple[str, ...] | list[str]:
        base = list(super().get_readonly_fields(request, obj))
        if obj is not None and obj.is_immutable:
            return base + [
                "specification",
                "status",
                "effective_from",
                "effective_to",
                "approval_reference",
                "notes",
            ]
        return base

    def get_actions(self, request: HttpRequest):  # type: ignore[no-untyped-def]
        actions = super().get_actions(request)
        actions.pop("delete_selected", None)
        return actions


@admin.register(SpecificationParameter)
class SpecificationParameterAdmin(admin.ModelAdmin):  # type: ignore[type-arg]
    list_display = ("code", "name", "version", "unit", "bound_min", "bound_max")
    search_fields = ("code", "name", "version__specification__code")
    readonly_fields = ("id", "created_at", "updated_at")
    autocomplete_fields = ("version",)

    def has_delete_permission(
        self, request: HttpRequest, obj: SpecificationParameter | None = None
    ) -> bool:
        if obj is not None and obj.version.is_immutable:
            return False
        return False  # Prefer service remove on DRAFT; refuse admin hard-delete path

    def get_actions(self, request: HttpRequest):  # type: ignore[no-untyped-def]
        actions = super().get_actions(request)
        actions.pop("delete_selected", None)
        return actions
