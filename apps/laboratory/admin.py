"""Admin — soft retention for laboratory foundation."""

from __future__ import annotations

from django.contrib import admin
from django.http import HttpRequest

from apps.laboratory.models import (
    LabExternalCertificate,
    LabHistoryEntry,
    LabPositiveReleasePolicy,
    LabResult,
    LabSample,
    LabTest,
    LabTestParameter,
    TestMethodReference,
)


class SoftRetentionAdmin(admin.ModelAdmin):  # type: ignore[type-arg]
    def has_delete_permission(self, request: HttpRequest, obj: object | None = None) -> bool:
        return False

    def get_actions(self, request: HttpRequest):  # type: ignore[no-untyped-def]
        actions = super().get_actions(request)
        actions.pop("delete_selected", None)
        return actions


@admin.register(TestMethodReference)
class TestMethodReferenceAdmin(SoftRetentionAdmin):
    list_display = ("code", "title", "organization", "is_active", "created_at")
    list_filter = ("is_active", "organization")
    search_fields = ("code", "title")
    readonly_fields = ("id", "created_at", "updated_at")


@admin.register(LabTestParameter)
class LabTestParameterAdmin(SoftRetentionAdmin):
    list_display = ("code", "name", "result_type", "unit", "organization", "is_active")
    list_filter = ("result_type", "is_active", "organization")
    search_fields = ("code", "name")
    readonly_fields = ("id", "created_at", "updated_at")


@admin.register(LabSample)
class LabSampleAdmin(SoftRetentionAdmin):
    list_display = (
        "code",
        "status",
        "organization",
        "batch_reference",
        "product",
        "registered_at",
    )
    list_filter = ("status", "organization")
    search_fields = ("code", "batch_reference", "sub_lot_reference")
    readonly_fields = ("id", "registered_at", "updated_at", "cancelled_at")


@admin.register(LabTest)
class LabTestAdmin(SoftRetentionAdmin):
    list_display = ("code", "sample", "organization", "external_lab_code", "created_at")
    search_fields = ("code", "title", "external_lab_code")
    readonly_fields = ("id", "created_at", "updated_at")


@admin.register(LabResult)
class LabResultAdmin(SoftRetentionAdmin):
    list_display = (
        "parameter",
        "lab_test",
        "status",
        "revision_number",
        "organization",
        "entered_at",
    )
    list_filter = ("status", "result_type", "organization")
    readonly_fields = (
        "id",
        "entered_at",
        "verified_at",
        "finalized_at",
        "previous_result",
        "revision_number",
    )


@admin.register(LabExternalCertificate)
class LabExternalCertificateAdmin(SoftRetentionAdmin):
    list_display = (
        "external_lab_reference",
        "sample",
        "verification_status",
        "result_received_at",
        "organization",
    )
    list_filter = ("verification_status", "organization")
    readonly_fields = ("id", "created_at", "updated_at", "verified_at")


@admin.register(LabPositiveReleasePolicy)
class LabPositiveReleasePolicyAdmin(SoftRetentionAdmin):
    list_display = ("organization", "policy_enabled", "require_finalized_results", "updated_at")
    readonly_fields = ("id", "created_at", "updated_at")


@admin.register(LabHistoryEntry)
class LabHistoryEntryAdmin(SoftRetentionAdmin):
    list_display = ("event_type", "organization", "sample", "lab_result", "actor", "created_at")
    list_filter = ("event_type", "organization")
    readonly_fields = ("id", "created_at", "metadata")
