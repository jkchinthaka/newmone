"""Admin — soft retention for batch dossier."""

from __future__ import annotations

from typing import TYPE_CHECKING, Any

from django.contrib import admin

from apps.batch_dossier.models import BatchDossierExportRequest, BatchDossierPolicy

if TYPE_CHECKING:
    _SoftRetentionBase = admin.ModelAdmin[Any]
else:
    _SoftRetentionBase = admin.ModelAdmin


class SoftRetentionAdmin(_SoftRetentionBase):
    def has_delete_permission(self, request: Any, obj: Any = None) -> bool:
        return False


@admin.register(BatchDossierPolicy)
class BatchDossierPolicyAdmin(SoftRetentionAdmin):
    list_display = ("organization", "pdf_export_enabled", "updated_at")
    readonly_fields = ("id", "created_at", "updated_at")


@admin.register(BatchDossierExportRequest)
class BatchDossierExportRequestAdmin(SoftRetentionAdmin):
    list_display = (
        "batch_reference",
        "status",
        "reason_code",
        "organization",
        "created_at",
    )
    list_filter = ("status", "organization")
    search_fields = ("batch_reference", "dossier_fingerprint")
    readonly_fields = (
        "id",
        "created_at",
        "metadata",
        "dossier_fingerprint",
        "reason_code",
        "status",
    )
