"""Django admin for roles, role templates, and scoped assignments."""

from __future__ import annotations

from django.contrib import admin, messages
from django.core.exceptions import ValidationError
from django.db import IntegrityError
from django.http import HttpRequest

from apps.access_control.models import Role, RoleTemplate, ScopedRoleAssignment


@admin.register(Role)
class RoleAdmin(admin.ModelAdmin):  # type: ignore[type-arg]
    list_display = ("code", "name", "is_active", "created_at", "updated_at")
    list_filter = ("is_active",)
    search_fields = ("code", "name")
    filter_horizontal = ("permissions",)
    readonly_fields = ("id", "created_at", "updated_at")
    ordering = ("code",)


@admin.register(RoleTemplate)
class RoleTemplateAdmin(admin.ModelAdmin):  # type: ignore[type-arg]
    list_display = (
        "code",
        "name",
        "is_active",
        "business_category_hint",
        "created_at",
        "updated_at",
    )
    list_filter = ("is_active",)
    search_fields = ("code", "name", "business_category_hint")
    filter_horizontal = ("permissions",)
    readonly_fields = ("id", "created_at", "updated_at")
    ordering = ("code",)


@admin.register(ScopedRoleAssignment)
class ScopedRoleAssignmentAdmin(admin.ModelAdmin):  # type: ignore[type-arg]
    list_display = (
        "user",
        "role",
        "organization",
        "site",
        "department",
        "is_active",
        "valid_from",
        "valid_until",
        "created_at",
    )
    list_filter = ("is_active", "role", "organization")
    search_fields = (
        "user__employee_code",
        "user__username",
        "role__code",
        "organization__code",
    )
    autocomplete_fields = ("user", "role", "organization", "site", "department", "assigned_by")
    readonly_fields = ("id", "created_at", "updated_at")
    ordering = ("-created_at",)

    def save_model(
        self,
        request: HttpRequest,
        obj: ScopedRoleAssignment,
        form: object,
        change: bool,
    ) -> None:
        try:
            obj.full_clean()
            super().save_model(request, obj, form, change)
        except IntegrityError as exc:
            messages.error(
                request,
                "An active assignment with this scope already exists.",
            )
            raise ValidationError("An active assignment with this scope already exists.") from exc
