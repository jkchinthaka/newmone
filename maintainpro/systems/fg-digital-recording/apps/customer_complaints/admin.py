"""Admin — soft retention for customer complaints."""

from __future__ import annotations

from typing import TYPE_CHECKING, Any

from django.contrib import admin

from apps.customer_complaints.models import (
    CustomerComplaintBatchTrace,
    CustomerComplaintCase,
    CustomerComplaintCategoryConfig,
    CustomerComplaintCommunication,
    CustomerComplaintEvidenceLink,
    CustomerComplaintInvestigationLink,
    CustomerComplaintPolicy,
    CustomerComplaintTimelineEntry,
)

if TYPE_CHECKING:
    _SoftRetentionBase = admin.ModelAdmin[Any]
else:
    _SoftRetentionBase = admin.ModelAdmin


class SoftRetentionAdmin(_SoftRetentionBase):
    def has_delete_permission(self, request: Any, obj: Any = None) -> bool:
        return False


@admin.register(CustomerComplaintCase)
class CustomerComplaintCaseAdmin(SoftRetentionAdmin):
    list_display = (
        "code",
        "status",
        "batch_known",
        "organization",
        "received_at",
        "updated_at",
    )
    list_filter = ("status", "batch_known", "organization")
    search_fields = ("code", "product_reference", "batch_reference", "category_reference")
    readonly_fields = ("id", "created_at", "updated_at", "closed_at", "batch_known")


@admin.register(CustomerComplaintCategoryConfig)
class CustomerComplaintCategoryConfigAdmin(SoftRetentionAdmin):
    list_display = ("kind", "code", "label", "is_active", "organization", "updated_at")
    list_filter = ("kind", "is_active", "organization")
    search_fields = ("code", "label")
    readonly_fields = ("id", "created_at", "updated_at")


@admin.register(CustomerComplaintCommunication)
class CustomerComplaintCommunicationAdmin(SoftRetentionAdmin):
    list_display = ("reference", "channel_reference", "complaint_case", "created_at")
    readonly_fields = ("id", "created_at")


@admin.register(CustomerComplaintInvestigationLink)
class CustomerComplaintInvestigationLinkAdmin(SoftRetentionAdmin):
    list_display = ("link_kind", "reference", "complaint_case", "created_at")
    readonly_fields = ("id", "created_at")


@admin.register(CustomerComplaintEvidenceLink)
class CustomerComplaintEvidenceLinkAdmin(SoftRetentionAdmin):
    list_display = ("evidence_attachment_id", "complaint_case", "created_at")
    readonly_fields = ("id", "created_at")


@admin.register(CustomerComplaintBatchTrace)
class CustomerComplaintBatchTraceAdmin(SoftRetentionAdmin):
    list_display = ("batch_reference", "complaint_case", "updated_at")
    readonly_fields = ("id", "created_at", "updated_at")


@admin.register(CustomerComplaintTimelineEntry)
class CustomerComplaintTimelineEntryAdmin(SoftRetentionAdmin):
    list_display = ("event_type", "complaint_case", "created_at")
    readonly_fields = ("id", "created_at", "event_type", "summary", "payload", "actor")


@admin.register(CustomerComplaintPolicy)
class CustomerComplaintPolicyAdmin(SoftRetentionAdmin):
    list_display = (
        "organization",
        "customer_response_auto_send_enabled",
        "updated_at",
    )
    readonly_fields = ("id", "created_at", "updated_at")
