from __future__ import annotations

from typing import TYPE_CHECKING, Any

from django.contrib import admin

from apps.quality_risks.models import (
    QualityRisk,
    QualityRiskAssessment,
    QualityRiskCategoryConfig,
    QualityRiskEvent,
    QualityRiskLink,
    QualityRiskMitigation,
    QualityRiskReview,
    QualityRiskScoringPolicy,
)

if TYPE_CHECKING:
    _SoftRetentionBase = admin.ModelAdmin[Any]
else:
    _SoftRetentionBase = admin.ModelAdmin


class SoftRetentionAdmin(_SoftRetentionBase):
    def has_delete_permission(self, request: Any, obj: Any = None) -> bool:
        return False


@admin.register(QualityRisk)
class QualityRiskAdmin(SoftRetentionAdmin):
    list_display = ("risk_code", "title", "status", "organization", "next_review_date")
    list_filter = ("status", "organization")
    search_fields = ("risk_code", "title")
    readonly_fields = ("created_at", "updated_at", "accepted_at", "closed_at")


@admin.register(QualityRiskCategoryConfig)
class QualityRiskCategoryConfigAdmin(SoftRetentionAdmin):
    list_display = ("organization", "code", "label", "is_active")


@admin.register(QualityRiskScoringPolicy)
class QualityRiskScoringPolicyAdmin(SoftRetentionAdmin):
    list_display = ("organization", "scoring_enabled", "formula_citation")


@admin.register(QualityRiskAssessment)
class QualityRiskAssessmentAdmin(SoftRetentionAdmin):
    list_display = ("risk", "version_number", "residual_risk_input", "assessed_at")
    readonly_fields = (
        "risk",
        "version_number",
        "likelihood_input",
        "severity_input",
        "detectability_input",
        "exposure_input",
        "residual_risk_input",
        "computed_score_text",
        "method_citation",
        "notes",
        "assessed_by",
        "assessed_at",
    )

    def has_add_permission(self, request: Any) -> bool:
        return False

    def has_change_permission(self, request: Any, obj: Any = None) -> bool:
        return False


@admin.register(QualityRiskLink)
class QualityRiskLinkAdmin(SoftRetentionAdmin):
    list_display = ("risk", "link_kind", "citation")


@admin.register(QualityRiskMitigation)
class QualityRiskMitigationAdmin(SoftRetentionAdmin):
    list_display = ("risk", "mitigation_kind", "summary")


@admin.register(QualityRiskReview)
class QualityRiskReviewAdmin(SoftRetentionAdmin):
    list_display = ("risk", "reviewed_by", "reviewed_at", "next_review_date")
    readonly_fields = ("risk", "notes", "next_review_date", "reviewed_by", "reviewed_at")

    def has_add_permission(self, request: Any) -> bool:
        return False

    def has_change_permission(self, request: Any, obj: Any = None) -> bool:
        return False


@admin.register(QualityRiskEvent)
class QualityRiskEventAdmin(_SoftRetentionBase):
    list_display = ("risk", "event_type", "actor", "created_at")
    readonly_fields = ("risk", "event_type", "summary", "payload", "actor", "created_at")

    def has_add_permission(self, request: Any) -> bool:
        return False

    def has_change_permission(self, request: Any, obj: Any = None) -> bool:
        return False

    def has_delete_permission(self, request: Any, obj: Any = None) -> bool:
        return False
