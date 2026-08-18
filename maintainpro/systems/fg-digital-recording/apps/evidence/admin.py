"""Admin for evidence metadata — no binary streaming via admin."""

from __future__ import annotations

from typing import TYPE_CHECKING, Any

from django.contrib import admin

if TYPE_CHECKING:
    _EvidenceAdminBase = admin.ModelAdmin[Any]
else:
    _EvidenceAdminBase = admin.ModelAdmin

from apps.evidence.models import EvidenceAttachment


@admin.register(EvidenceAttachment)
class EvidenceAttachmentAdmin(_EvidenceAdminBase):
    list_display = (
        "id",
        "organization",
        "linked_kind",
        "original_filename",
        "content_type",
        "size_bytes",
        "lifecycle_status",
        "malware_scan_status",
        "linkage_immutable",
        "uploaded_at",
    )
    list_filter = ("linked_kind", "lifecycle_status", "malware_scan_status", "organization")
    search_fields = ("original_filename", "storage_key", "content_sha256", "caption")
    readonly_fields = (
        "id",
        "organization",
        "linked_kind",
        "linked_object_id",
        "original_filename",
        "storage_key",
        "content_type",
        "size_bytes",
        "content_sha256",
        "uploaded_by",
        "uploaded_at",
        "lifecycle_status",
        "linkage_immutable",
        "retired_at",
        "retired_by",
        "retirement_reason",
        "malware_scan_status",
        "malware_scan_provider",
        "malware_scan_detail",
        "malware_scanned_at",
        "caption",
    )

    def has_add_permission(self, request: Any) -> bool:
        return False

    def has_delete_permission(self, request: Any, obj: Any = None) -> bool:
        return False

    def has_change_permission(self, request: Any, obj: Any = None) -> bool:
        return False
