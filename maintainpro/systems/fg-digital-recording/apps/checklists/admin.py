"""Django admin for checklist definitions — lifecycle-safe."""

from __future__ import annotations

from django.contrib import admin
from django.core.exceptions import ValidationError
from django.http import HttpRequest

from apps.checklists.models import (
    ChecklistItem,
    ChecklistItemOption,
    ChecklistSection,
    ChecklistTemplate,
    ChecklistVersion,
    ChecklistVersionStatus,
)
from apps.checklists.services import assert_version_transition_allowed


class ChecklistSectionInline(admin.TabularInline):  # type: ignore[type-arg]
    model = ChecklistSection
    extra = 0
    fields = ("title", "description", "position")
    show_change_link = True

    def has_add_permission(self, request: HttpRequest, obj: ChecklistVersion | None = None) -> bool:
        return bool(obj and obj.status == ChecklistVersionStatus.DRAFT)

    def has_change_permission(
        self, request: HttpRequest, obj: ChecklistVersion | None = None
    ) -> bool:
        return bool(obj and obj.status == ChecklistVersionStatus.DRAFT)

    def has_delete_permission(
        self, request: HttpRequest, obj: ChecklistVersion | None = None
    ) -> bool:
        return bool(obj and obj.status == ChecklistVersionStatus.DRAFT)


class ChecklistItemInline(admin.TabularInline):  # type: ignore[type-arg]
    model = ChecklistItem
    extra = 0
    fields = (
        "code",
        "label",
        "help_text",
        "position",
        "is_required",
        "response_type",
        "unit",
        "minimum_value",
        "maximum_value",
        "decimal_precision",
        "rounding_mode",
        "min_inclusive",
        "max_inclusive",
        "control_point_class",
        "criticality",
    )

    def has_add_permission(self, request: HttpRequest, obj: ChecklistSection | None = None) -> bool:
        return bool(obj and obj.version.status == ChecklistVersionStatus.DRAFT)

    def has_change_permission(
        self, request: HttpRequest, obj: ChecklistSection | None = None
    ) -> bool:
        return bool(obj and obj.version.status == ChecklistVersionStatus.DRAFT)

    def has_delete_permission(
        self, request: HttpRequest, obj: ChecklistSection | None = None
    ) -> bool:
        return bool(obj and obj.version.status == ChecklistVersionStatus.DRAFT)


class ChecklistItemOptionInline(admin.TabularInline):  # type: ignore[type-arg]
    model = ChecklistItemOption
    extra = 0
    fields = ("value", "label", "position")

    def has_add_permission(self, request: HttpRequest, obj: ChecklistItem | None = None) -> bool:
        return bool(obj and obj.section.version.status == ChecklistVersionStatus.DRAFT)

    def has_change_permission(self, request: HttpRequest, obj: ChecklistItem | None = None) -> bool:
        return bool(obj and obj.section.version.status == ChecklistVersionStatus.DRAFT)

    def has_delete_permission(self, request: HttpRequest, obj: ChecklistItem | None = None) -> bool:
        return bool(obj and obj.section.version.status == ChecklistVersionStatus.DRAFT)


@admin.register(ChecklistTemplate)
class ChecklistTemplateAdmin(admin.ModelAdmin):  # type: ignore[type-arg]
    list_display = ("code", "name", "organization", "product", "is_active", "updated_at")
    list_filter = ("is_active", "organization")
    search_fields = ("code", "name", "organization__code")
    readonly_fields = ("id", "created_at", "updated_at")
    autocomplete_fields = ("organization", "product")
    ordering = ("organization__code", "code")

    def has_delete_permission(
        self, request: HttpRequest, obj: ChecklistTemplate | None = None
    ) -> bool:
        return False

    def get_actions(self, request: HttpRequest):  # type: ignore[no-untyped-def]
        actions = super().get_actions(request)
        actions.pop("delete_selected", None)
        return actions


@admin.register(ChecklistVersion)
class ChecklistVersionAdmin(admin.ModelAdmin):  # type: ignore[type-arg]
    list_display = (
        "template",
        "version_number",
        "status",
        "effective_from",
        "effective_to",
        "published_at",
        "updated_at",
    )
    list_filter = ("status",)
    search_fields = ("template__code", "template__name")
    readonly_fields = (
        "id",
        "created_at",
        "updated_at",
        "published_at",
        "version_number",
        "template",
    )
    fields = (
        "id",
        "template",
        "version_number",
        "status",
        "effective_from",
        "effective_to",
        "published_at",
        "created_at",
        "updated_at",
    )
    inlines = [ChecklistSectionInline]

    def has_delete_permission(
        self, request: HttpRequest, obj: ChecklistVersion | None = None
    ) -> bool:
        return False

    def get_readonly_fields(
        self, request: HttpRequest, obj: ChecklistVersion | None = None
    ) -> tuple[str, ...] | list[str]:
        base = list(super().get_readonly_fields(request, obj))
        if obj is not None and obj.is_immutable:
            return [*base, "status"]
        return base

    def save_model(  # type: ignore[no-untyped-def]
        self,
        request: HttpRequest,
        obj: ChecklistVersion,
        form,  # noqa: ANN001
        change: bool,
    ) -> None:
        if change and "status" in form.changed_data:
            previous = (
                ChecklistVersion.objects.filter(pk=obj.pk).values_list("status", flat=True).first()
            )
            if previous is None:
                raise ValidationError({"status": "Checklist version not found."})
            assert_version_transition_allowed(current=previous, target=obj.status)
            if obj.status == ChecklistVersionStatus.PUBLISHED and obj.published_at is None:
                from django.utils import timezone

                obj.published_at = timezone.now()
        super().save_model(request, obj, form, change)

    def get_actions(self, request: HttpRequest):  # type: ignore[no-untyped-def]
        actions = super().get_actions(request)
        actions.pop("delete_selected", None)
        return actions


@admin.register(ChecklistSection)
class ChecklistSectionAdmin(admin.ModelAdmin):  # type: ignore[type-arg]
    list_display = ("title", "version", "position")
    search_fields = ("title", "version__template__code")
    inlines = [ChecklistItemInline]
    readonly_fields = ("id",)

    def has_add_permission(self, request: HttpRequest) -> bool:
        return False

    def has_change_permission(
        self, request: HttpRequest, obj: ChecklistSection | None = None
    ) -> bool:
        if obj is None:
            return super().has_change_permission(request, obj)
        return obj.version.is_draft

    def has_delete_permission(
        self, request: HttpRequest, obj: ChecklistSection | None = None
    ) -> bool:
        if obj is None:
            return False
        return obj.version.is_draft


@admin.register(ChecklistItem)
class ChecklistItemAdmin(admin.ModelAdmin):  # type: ignore[type-arg]
    list_display = (
        "code",
        "label",
        "response_type",
        "control_point_class",
        "criticality",
        "section",
        "position",
        "is_required",
    )
    list_filter = ("response_type", "control_point_class", "criticality")
    search_fields = ("code", "label", "section__title")
    readonly_fields = ("id",)
    inlines = [ChecklistItemOptionInline]

    def has_add_permission(self, request: HttpRequest) -> bool:
        return False

    def has_change_permission(self, request: HttpRequest, obj: ChecklistItem | None = None) -> bool:
        if obj is None:
            return super().has_change_permission(request, obj)
        return obj.section.version.is_draft

    def has_delete_permission(self, request: HttpRequest, obj: ChecklistItem | None = None) -> bool:
        if obj is None:
            return False
        return obj.section.version.is_draft


@admin.register(ChecklistItemOption)
class ChecklistItemOptionAdmin(admin.ModelAdmin):  # type: ignore[type-arg]
    list_display = ("value", "label", "item", "position")
    search_fields = ("value", "label", "item__code")
    readonly_fields = ("id",)

    def has_add_permission(self, request: HttpRequest) -> bool:
        return False

    def has_change_permission(
        self, request: HttpRequest, obj: ChecklistItemOption | None = None
    ) -> bool:
        if obj is None:
            return super().has_change_permission(request, obj)
        return obj.item.section.version.is_draft

    def has_delete_permission(
        self, request: HttpRequest, obj: ChecklistItemOption | None = None
    ) -> bool:
        if obj is None:
            return False
        return obj.item.section.version.is_draft
