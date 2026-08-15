"""Django admin for Supervisor reviews — read-only operational support."""

from __future__ import annotations

from django.contrib import admin
from django.http import HttpRequest

from apps.reviews.models import SupervisorReview, SupervisorReviewGovernancePolicy


@admin.register(SupervisorReview)
class SupervisorReviewAdmin(admin.ModelAdmin):  # type: ignore[type-arg]
    list_display = (
        "id",
        "organization",
        "checklist_submission",
        "decision",
        "reviewed_by",
        "reviewed_at",
    )
    list_filter = ("organization", "decision")
    search_fields = (
        "id",
        "checklist_submission__id",
        "checklist_submission__checklist_record__checklist_task__batch_reference",
        "reviewed_by__employee_code",
    )
    ordering = ("-reviewed_at",)
    readonly_fields = (
        "id",
        "organization",
        "checklist_submission",
        "decision",
        "review_note",
        "reviewed_by",
        "reviewed_at",
    )

    def has_add_permission(self, request: HttpRequest) -> bool:
        return False

    def has_change_permission(
        self, request: HttpRequest, obj: SupervisorReview | None = None
    ) -> bool:
        return request.method in {"GET", "HEAD", "OPTIONS"}

    def has_delete_permission(
        self, request: HttpRequest, obj: SupervisorReview | None = None
    ) -> bool:
        return False

    def get_actions(self, request: HttpRequest):  # type: ignore[no-untyped-def]
        actions = super().get_actions(request)
        actions.pop("delete_selected", None)
        return actions


@admin.register(SupervisorReviewGovernancePolicy)
class SupervisorReviewGovernancePolicyAdmin(admin.ModelAdmin):  # type: ignore[type-arg]
    list_display = (
        "organization",
        "self_review_mode",
        "review_sla_minutes",
        "evidence_reference",
        "updated_at",
    )
    list_filter = ("self_review_mode",)
    search_fields = ("organization__code", "evidence_reference")
    readonly_fields = ("id", "created_at", "updated_at")
