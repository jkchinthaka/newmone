from __future__ import annotations

from typing import TYPE_CHECKING, Any

from django.contrib import admin

from apps.rework.models import ReworkCase, ReworkCaseEvent, ReworkPolicyStub

if TYPE_CHECKING:
    _SoftRetentionBase = admin.ModelAdmin[Any]
else:
    _SoftRetentionBase = admin.ModelAdmin


class SoftRetentionAdmin(_SoftRetentionBase):
    def has_delete_permission(self, request: Any, obj: Any = None) -> bool:
        return False


@admin.register(ReworkCase)
class ReworkCaseAdmin(SoftRetentionAdmin):
    list_display = (
        "execution_key",
        "organization",
        "source_batch_reference",
        "status",
        "resulting_batch_reference",
        "created_at",
    )
    list_filter = ("status",)
    search_fields = ("execution_key", "source_batch_reference", "resulting_batch_reference")
    raw_id_fields = (
        "organization",
        "inspection_task",
        "source_qa_review",
        "source_hold_case",
        "source_ncr",
        "created_by",
        "authorized_by",
    )


@admin.register(ReworkCaseEvent)
class ReworkCaseEventAdmin(SoftRetentionAdmin):
    list_display = ("event_type", "case", "organization", "occurred_at")
    list_filter = ("event_type",)
    raw_id_fields = ("organization", "case", "actor")


@admin.register(ReworkPolicyStub)
class ReworkPolicyStubAdmin(SoftRetentionAdmin):
    list_display = ("policy_key", "organization", "erp_stock_movement_enabled", "updated_at")
    raw_id_fields = ("organization", "updated_by")
