"""Admin — soft retention for packaging artwork."""

from __future__ import annotations

from django.contrib import admin
from django.http import HttpRequest

from apps.packaging.models import (
    ArtworkVerificationRecord,
    ArtworkVersion,
    ChecklistItemArtworkBinding,
    LineClearanceArtworkHook,
    PackagingArtwork,
    PackagingHistoryEntry,
)


class SoftRetentionAdmin(admin.ModelAdmin):  # type: ignore[type-arg]
    def has_delete_permission(self, request: HttpRequest, obj: object | None = None) -> bool:
        return False

    def get_actions(self, request: HttpRequest):  # type: ignore[no-untyped-def]
        actions = super().get_actions(request)
        actions.pop("delete_selected", None)
        return actions


@admin.register(PackagingArtwork)
class PackagingArtworkAdmin(SoftRetentionAdmin):
    list_display = (
        "code",
        "title",
        "product",
        "organization",
        "pack_configuration_label",
        "is_active",
    )
    list_filter = ("is_active", "organization")
    search_fields = ("code", "title", "pack_configuration_label")
    readonly_fields = ("id", "created_at", "updated_at")


@admin.register(ArtworkVersion)
class ArtworkVersionAdmin(SoftRetentionAdmin):
    list_display = (
        "artwork",
        "version_number",
        "status",
        "effective_from",
        "effective_to",
        "approval_reference",
        "approved_at",
    )
    list_filter = ("status",)
    readonly_fields = ("id", "approved_by", "approved_at", "created_at", "updated_at")


@admin.register(ChecklistItemArtworkBinding)
class ChecklistItemArtworkBindingAdmin(SoftRetentionAdmin):
    list_display = ("checklist_item", "artwork_version", "updated_at")
    readonly_fields = ("id", "frozen_artwork_context", "created_at", "updated_at")


@admin.register(LineClearanceArtworkHook)
class LineClearanceArtworkHookAdmin(SoftRetentionAdmin):
    list_display = ("code", "title", "artwork_version", "line_code", "is_active", "organization")
    list_filter = ("is_active", "organization")
    search_fields = ("code", "line_code")


@admin.register(ArtworkVerificationRecord)
class ArtworkVerificationRecordAdmin(SoftRetentionAdmin):
    list_display = (
        "artwork_version",
        "batch_reference",
        "mfg_date",
        "exp_date",
        "batch_code",
        "recorded_at",
    )
    readonly_fields = ("id", "frozen_artwork_context", "recorded_at", "recorded_by")


@admin.register(PackagingHistoryEntry)
class PackagingHistoryEntryAdmin(SoftRetentionAdmin):
    list_display = ("event_type", "organization", "artwork", "actor", "created_at")
    list_filter = ("event_type",)
    readonly_fields = ("id", "created_at", "metadata")
