"""QMS quality audit selectors and reporting queries — Phase 45."""

from __future__ import annotations

import uuid
from datetime import date

from django.core.exceptions import PermissionDenied
from django.db.models import Count, QuerySet
from django.utils import timezone

from apps.access_control.services import user_has_permission
from apps.accounts.models import User
from apps.quality_audits.models import (
    QualityAudit,
    QualityAuditEvent,
    QualityAuditFinding,
    QualityAuditFindingStatus,
)
from apps.quality_audits.services import PERM_VIEW, _scope


def list_quality_audits(
    *,
    actor: User,
    organization_id: uuid.UUID,
    status: str | None = None,
) -> QuerySet[QualityAudit]:
    if not user_has_permission(actor, PERM_VIEW, scope=_scope(organization_id)):
        raise PermissionDenied("Permission denied.")
    qs = QualityAudit.objects.filter(organization_id=organization_id)
    if status:
        qs = qs.filter(status=status)
    return qs.order_by("-created_at")


def get_quality_audit_for_org(
    *, actor: User, organization_id: uuid.UUID, audit_id: uuid.UUID
) -> QualityAudit:
    if not user_has_permission(actor, PERM_VIEW, scope=_scope(organization_id)):
        raise PermissionDenied("Permission denied.")
    return QualityAudit.objects.get(pk=audit_id, organization_id=organization_id)


def list_findings_for_audit(*, audit: QualityAudit) -> QuerySet[QualityAuditFinding]:
    return audit.findings.select_related("owner", "nonconformance", "corrective_action")


def list_audit_events(*, audit: QualityAudit) -> QuerySet[QualityAuditEvent]:
    return audit.events.all()


def report_open_findings(
    *, actor: User, organization_id: uuid.UUID
) -> QuerySet[QualityAuditFinding]:
    if not user_has_permission(actor, PERM_VIEW, scope=_scope(organization_id)):
        raise PermissionDenied("Permission denied.")
    return (
        QualityAuditFinding.objects.filter(
            audit__organization_id=organization_id,
            status__in={
                QualityAuditFindingStatus.OPEN,
                QualityAuditFindingStatus.ACTION_COMPLETED,
                QualityAuditFindingStatus.VERIFIED,
            },
        )
        .select_related("audit", "owner")
        .order_by("due_date", "created_at")
    )


def report_overdue_findings(
    *,
    actor: User,
    organization_id: uuid.UUID,
    as_of: date | None = None,
) -> QuerySet[QualityAuditFinding]:
    if not user_has_permission(actor, PERM_VIEW, scope=_scope(organization_id)):
        raise PermissionDenied("Permission denied.")
    today = as_of or timezone.localdate()
    return (
        QualityAuditFinding.objects.filter(
            audit__organization_id=organization_id,
            due_date__lt=today,
        )
        .exclude(status=QualityAuditFindingStatus.CLOSED)
        .select_related("audit")
        .order_by("due_date")
    )


def report_audit_status(*, actor: User, organization_id: uuid.UUID) -> list[dict[str, object]]:
    if not user_has_permission(actor, PERM_VIEW, scope=_scope(organization_id)):
        raise PermissionDenied("Permission denied.")
    rows = (
        QualityAudit.objects.filter(organization_id=organization_id)
        .values("status")
        .annotate(total=Count("id"))
        .order_by("status")
    )
    return [{"status": row["status"], "total": row["total"]} for row in rows]


def report_capa_links(*, actor: User, organization_id: uuid.UUID) -> QuerySet[QualityAuditFinding]:
    if not user_has_permission(actor, PERM_VIEW, scope=_scope(organization_id)):
        raise PermissionDenied("Permission denied.")
    return QualityAuditFinding.objects.filter(
        audit__organization_id=organization_id,
        corrective_action__isnull=False,
    ).select_related("audit", "corrective_action", "nonconformance")


def report_site_process_trends(
    *, actor: User, organization_id: uuid.UUID
) -> list[dict[str, object]]:
    if not user_has_permission(actor, PERM_VIEW, scope=_scope(organization_id)):
        raise PermissionDenied("Permission denied.")
    rows = (
        QualityAudit.objects.filter(organization_id=organization_id)
        .values("site_reference", "process_reference", "status")
        .annotate(total=Count("id"))
        .order_by("site_reference", "process_reference", "status")
    )
    return [
        {
            "site_reference": row["site_reference"],
            "process_reference": row["process_reference"],
            "status": row["status"],
            "total": row["total"],
        }
        for row in rows
    ]
