"""Admin — soft retention for recall / mock exercises."""

from __future__ import annotations

from typing import TYPE_CHECKING, Any

from django.contrib import admin

from apps.recall.models import (
    MockExerciseMetrics,
    MockImprovementAction,
    MockRecallFinding,
    RecallAffectedBatch,
    RecallAffectedProduct,
    RecallCase,
    RecallCommunicationRecord,
    RecallPolicy,
    RecallQuantityLine,
    RecallTimelineEntry,
)

if TYPE_CHECKING:
    _SoftRetentionBase = admin.ModelAdmin[Any]
else:
    _SoftRetentionBase = admin.ModelAdmin


class SoftRetentionAdmin(_SoftRetentionBase):
    def has_delete_permission(self, request: Any, obj: Any = None) -> bool:
        return False


@admin.register(RecallCase)
class RecallCaseAdmin(SoftRetentionAdmin):
    list_display = (
        "code",
        "is_mock",
        "mode",
        "status",
        "organization",
        "initiated_at",
        "updated_at",
    )
    list_filter = ("is_mock", "mode", "status", "organization")
    search_fields = ("code", "case_type_reference", "reason")
    readonly_fields = (
        "id",
        "created_at",
        "updated_at",
        "initiated_at",
        "closed_at",
        "visual_banner_display",
    )

    @admin.display(description="Visual banner")
    def visual_banner_display(self, obj: RecallCase) -> str:
        return obj.visual_banner or "—"


@admin.register(RecallAffectedProduct)
class RecallAffectedProductAdmin(SoftRetentionAdmin):
    list_display = ("product_reference", "recall_case", "created_at")
    search_fields = ("product_reference",)


@admin.register(RecallAffectedBatch)
class RecallAffectedBatchAdmin(SoftRetentionAdmin):
    list_display = ("batch_reference", "selected_via", "recall_case", "created_at")
    search_fields = ("batch_reference",)


@admin.register(RecallQuantityLine)
class RecallQuantityLineAdmin(SoftRetentionAdmin):
    list_display = ("affected_batch", "recall_case", "updated_at")
    readonly_fields = ("id", "created_at", "updated_at")


@admin.register(RecallCommunicationRecord)
class RecallCommunicationRecordAdmin(SoftRetentionAdmin):
    list_display = ("reference", "channel_reference", "recall_case", "created_at")
    readonly_fields = ("id", "created_at")


@admin.register(RecallTimelineEntry)
class RecallTimelineEntryAdmin(SoftRetentionAdmin):
    list_display = ("event_type", "recall_case", "created_at")
    readonly_fields = ("id", "created_at", "event_type", "summary", "payload", "actor")


@admin.register(RecallPolicy)
class RecallPolicyAdmin(SoftRetentionAdmin):
    list_display = (
        "organization",
        "external_notification_enabled",
        "erp_distribution_pull_enabled",
        "updated_at",
    )
    readonly_fields = ("id", "created_at", "updated_at")


@admin.register(MockExerciseMetrics)
class MockExerciseMetricsAdmin(SoftRetentionAdmin):
    list_display = (
        "recall_case",
        "started_at",
        "completed_at",
        "traceback_completeness",
        "traceforward_completeness",
        "updated_at",
    )
    readonly_fields = ("id", "created_at", "updated_at")


@admin.register(MockRecallFinding)
class MockRecallFindingAdmin(SoftRetentionAdmin):
    list_display = ("title", "link_kind", "recall_case", "created_at")
    list_filter = ("link_kind",)
    search_fields = ("title",)


@admin.register(MockImprovementAction)
class MockImprovementActionAdmin(SoftRetentionAdmin):
    list_display = ("code", "title", "recall_case", "created_at")
    search_fields = ("code", "title")
