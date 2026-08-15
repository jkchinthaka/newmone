"""Django admin for organization hierarchy and Shift foundation."""

from __future__ import annotations

from django.contrib import admin
from django.http import HttpRequest

from apps.organizations.models import Department, Organization, Shift, Site


class _NoHardDeleteAdmin(admin.ModelAdmin):  # type: ignore[type-arg]
    """Historical safety: soft-deactivate via services; never hard-delete."""

    def has_delete_permission(self, request: HttpRequest, obj: object | None = None) -> bool:
        return False

    def get_actions(self, request: HttpRequest):  # type: ignore[no-untyped-def]
        actions = super().get_actions(request)
        actions.pop("delete_selected", None)
        return actions


@admin.register(Organization)
class OrganizationAdmin(_NoHardDeleteAdmin):
    list_display = ("code", "name", "is_active", "created_at", "updated_at")
    list_filter = ("is_active",)
    search_fields = ("code", "name")
    readonly_fields = ("id", "created_at", "updated_at")
    ordering = ("code",)


@admin.register(Site)
class SiteAdmin(_NoHardDeleteAdmin):
    list_display = ("code", "name", "organization", "is_active", "created_at")
    list_filter = ("is_active", "organization")
    search_fields = ("code", "name", "organization__code")
    readonly_fields = ("id", "created_at", "updated_at")
    autocomplete_fields = ("organization",)
    ordering = ("organization__code", "code")


@admin.register(Department)
class DepartmentAdmin(_NoHardDeleteAdmin):
    list_display = ("code", "name", "organization", "site", "is_active", "created_at")
    list_filter = ("is_active", "organization")
    search_fields = ("code", "name", "organization__code", "site__code")
    readonly_fields = ("id", "created_at", "updated_at")
    autocomplete_fields = ("organization", "site")
    ordering = ("organization__code", "code")


@admin.register(Shift)
class ShiftAdmin(_NoHardDeleteAdmin):
    list_display = (
        "code",
        "name",
        "organization",
        "site",
        "department",
        "start_time",
        "end_time",
        "effective_from",
        "effective_to",
        "is_active",
        "created_at",
    )
    list_filter = ("is_active", "organization", "site", "department")
    search_fields = ("code", "name", "organization__code", "site__code", "department__code")
    readonly_fields = ("id", "created_at", "updated_at")
    autocomplete_fields = ("organization", "site", "department")
    ordering = ("organization__code", "code", "effective_from")
