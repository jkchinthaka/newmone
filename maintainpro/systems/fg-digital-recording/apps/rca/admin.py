from __future__ import annotations

from typing import TYPE_CHECKING, Any

from django.contrib import admin

from apps.rca.models import (
    RcaCapaLink,
    RcaCause,
    RcaEvent,
    RcaEvidenceLink,
    RcaFishboneEntry,
    RcaFiveWhyStep,
    RcaParticipant,
    RootCauseAnalysis,
)

if TYPE_CHECKING:
    _SoftRetentionBase = admin.ModelAdmin[Any]
else:
    _SoftRetentionBase = admin.ModelAdmin


class SoftRetentionAdmin(_SoftRetentionBase):
    def has_delete_permission(self, request: Any, obj: Any = None) -> bool:
        return False

    def get_actions(self, request: Any):  # type: ignore[no-untyped-def]
        actions = super().get_actions(request)
        actions.pop("delete_selected", None)
        return actions


@admin.register(RootCauseAnalysis)
class RootCauseAnalysisAdmin(SoftRetentionAdmin):
    """
    Workflow status transitions are service-driven only.

    Admin keeps descriptive fields editable for support, but status / terminal
    audit timestamps are read-only for all staff (including superuser) so Django
    admin cannot silently bypass the RCA state machine.
    """

    list_display = ("rca_code", "source_kind", "status", "organization", "started_at")
    list_filter = ("status", "source_kind", "organization")
    search_fields = ("rca_code", "problem_statement")
    readonly_fields = (
        "status",
        "created_at",
        "updated_at",
        "started_at",
        "verified_at",
        "verified_by",
        "closed_at",
        "closed_by",
        "confirmed_root_cause_text",
    )


@admin.register(RcaParticipant)
class RcaParticipantAdmin(SoftRetentionAdmin):
    list_display = ("rca", "participant", "name_reference")


@admin.register(RcaFiveWhyStep)
class RcaFiveWhyStepAdmin(SoftRetentionAdmin):
    list_display = ("rca", "sequence", "why_question")


@admin.register(RcaFishboneEntry)
class RcaFishboneEntryAdmin(SoftRetentionAdmin):
    list_display = ("rca", "category")


@admin.register(RcaCause)
class RcaCauseAdmin(SoftRetentionAdmin):
    """Cause state changes (support/confirm) are service-driven only."""

    list_display = ("rca", "state", "suggested_by_ai", "confirmed_at")
    readonly_fields = (
        "state",
        "confirmed_by",
        "confirmed_at",
        "created_at",
        "updated_at",
        "suggested_by_ai",
    )


@admin.register(RcaEvidenceLink)
class RcaEvidenceLinkAdmin(SoftRetentionAdmin):
    list_display = ("rca", "cause", "citation")


@admin.register(RcaCapaLink)
class RcaCapaLinkAdmin(SoftRetentionAdmin):
    list_display = ("cause", "corrective_action")


@admin.register(RcaEvent)
class RcaEventAdmin(_SoftRetentionBase):
    list_display = ("rca", "event_type", "actor", "created_at")
    readonly_fields = ("rca", "event_type", "summary", "payload", "actor", "created_at")

    def has_add_permission(self, request: Any) -> bool:
        return False

    def has_change_permission(self, request: Any, obj: Any = None) -> bool:
        return False

    def has_delete_permission(self, request: Any, obj: Any = None) -> bool:
        return False
