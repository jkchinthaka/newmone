from __future__ import annotations

from typing import TYPE_CHECKING, Any

from django.contrib import admin

from apps.quality_audits.models import (
    QualityAudit,
    QualityAuditChecklistBinding,
    QualityAuditEvent,
    QualityAuditFinding,
    QualityAuditFindingCodeConfig,
    QualityAuditParticipant,
)

if TYPE_CHECKING:
    _SoftRetentionBase = admin.ModelAdmin[Any]
else:
    _SoftRetentionBase = admin.ModelAdmin


class SoftRetentionAdmin(_SoftRetentionBase):
    def has_delete_permission(self, request: Any, obj: Any = None) -> bool:
        return False


@admin.register(QualityAudit)
class QualityAuditAdmin(SoftRetentionAdmin):
    list_display = ("audit_code", "title", "audit_type", "status", "organization", "lead_auditor")
    list_filter = ("status", "audit_type", "organization")
    search_fields = ("audit_code", "title")
    readonly_fields = ("created_at", "updated_at", "closed_at")


@admin.register(QualityAuditParticipant)
class QualityAuditParticipantAdmin(SoftRetentionAdmin):
    list_display = ("audit", "user", "role_reference")


@admin.register(QualityAuditChecklistBinding)
class QualityAuditChecklistBindingAdmin(SoftRetentionAdmin):
    list_display = ("organization", "checklist_template")


@admin.register(QualityAuditFindingCodeConfig)
class QualityAuditFindingCodeConfigAdmin(SoftRetentionAdmin):
    list_display = ("organization", "kind", "code", "label", "is_active")
    list_filter = ("kind", "is_active")


@admin.register(QualityAuditFinding)
class QualityAuditFindingAdmin(SoftRetentionAdmin):
    list_display = ("audit", "status", "severity_code", "classification_code", "due_date")
    list_filter = ("status",)
    readonly_fields = ("created_at", "updated_at", "closed_at", "verified_at")


@admin.register(QualityAuditEvent)
class QualityAuditEventAdmin(_SoftRetentionBase):
    list_display = ("audit", "finding", "event_type", "actor", "created_at")
    list_filter = ("event_type",)
    readonly_fields = (
        "audit",
        "finding",
        "event_type",
        "summary",
        "payload",
        "actor",
        "created_at",
    )

    def has_add_permission(self, request: Any) -> bool:
        return False

    def has_change_permission(self, request: Any, obj: Any = None) -> bool:
        return False

    def has_delete_permission(self, request: Any, obj: Any = None) -> bool:
        return False
