"""Admin — soft retention for foreign-body challenge records."""

from __future__ import annotations

from django.contrib import admin
from django.http import HttpRequest

from apps.foreign_body.models import (
    ChallengeScheduleRule,
    ContainmentAssessment,
    ForeignBodyHistoryEntry,
    MetalDetectorChallengeTest,
    TestPiece,
)


class SoftRetentionAdmin(admin.ModelAdmin):  # type: ignore[type-arg]
    def has_delete_permission(self, request: HttpRequest, obj: object | None = None) -> bool:
        return False

    def get_actions(self, request: HttpRequest):  # type: ignore[no-untyped-def]
        actions = super().get_actions(request)
        actions.pop("delete_selected", None)
        return actions


@admin.register(TestPiece)
class TestPieceAdmin(SoftRetentionAdmin):
    list_display = (
        "code",
        "title",
        "category_label",
        "size_label",
        "expected_detected",
        "organization",
        "is_active",
    )
    list_filter = ("is_active", "organization")
    search_fields = ("code", "title", "category_label")
    readonly_fields = ("id", "created_at", "updated_at")


@admin.register(ChallengeScheduleRule)
class ChallengeScheduleRuleAdmin(SoftRetentionAdmin):
    list_display = ("code", "schedule_mode", "rule_code", "organization", "is_active")
    list_filter = ("schedule_mode", "is_active", "organization")
    readonly_fields = ("id", "created_at", "updated_at")


@admin.register(MetalDetectorChallengeTest)
class MetalDetectorChallengeTestAdmin(SoftRetentionAdmin):
    list_display = (
        "id",
        "equipment",
        "result",
        "status",
        "performed_at",
        "batch_reference",
        "organization",
    )
    list_filter = ("result", "status", "schedule_mode", "organization")
    search_fields = ("batch_reference", "production_line_code", "evidence_reference")
    readonly_fields = (
        "id",
        "created_at",
        "updated_at",
        "frozen_device_context",
        "frozen_test_piece_context",
        "verified_at",
    )


@admin.register(ContainmentAssessment)
class ContainmentAssessmentAdmin(SoftRetentionAdmin):
    list_display = (
        "failed_test",
        "interval_start",
        "interval_end",
        "hold_recommended",
        "hold_created",
        "organization",
    )
    readonly_fields = ("id", "created_at", "assessment_context")


@admin.register(ForeignBodyHistoryEntry)
class ForeignBodyHistoryEntryAdmin(SoftRetentionAdmin):
    list_display = ("event_type", "organization", "challenge_test", "actor", "created_at")
    readonly_fields = ("id", "created_at", "metadata")
