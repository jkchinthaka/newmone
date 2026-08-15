"""Admin — soft retention for genealogy."""

from __future__ import annotations

from typing import TYPE_CHECKING, Any

from django.contrib import admin

from apps.batch_genealogy.models import GenealogyEdge, GenealogyNode, GenealogyPolicy

if TYPE_CHECKING:
    _SoftRetentionBase = admin.ModelAdmin[Any]
else:
    _SoftRetentionBase = admin.ModelAdmin


class SoftRetentionAdmin(_SoftRetentionBase):
    def has_delete_permission(self, request: Any, obj: Any = None) -> bool:
        return False


@admin.register(GenealogyNode)
class GenealogyNodeAdmin(SoftRetentionAdmin):
    list_display = ("kind", "external_key", "organization", "updated_at")
    list_filter = ("kind", "organization")
    search_fields = ("external_key", "display_label", "product_reference")
    readonly_fields = ("id", "created_at", "updated_at")


@admin.register(GenealogyEdge)
class GenealogyEdgeAdmin(SoftRetentionAdmin):
    list_display = (
        "relation",
        "from_node",
        "to_node",
        "is_rework",
        "source_system",
        "organization",
        "created_at",
    )
    list_filter = ("relation", "is_rework", "organization")
    search_fields = ("source_system", "source_event_id")
    readonly_fields = ("id", "created_at", "metadata")


@admin.register(GenealogyPolicy)
class GenealogyPolicyAdmin(SoftRetentionAdmin):
    list_display = (
        "organization",
        "mongo_projection_enabled",
        "max_trace_depth",
        "updated_at",
    )
    readonly_fields = ("id", "created_at", "updated_at")
