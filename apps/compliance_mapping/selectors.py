"""Compliance mapping selectors — Phase 46."""

from __future__ import annotations

import uuid

from django.core.exceptions import PermissionDenied
from django.db.models import Count, QuerySet

from apps.access_control.services import user_has_permission
from apps.accounts.models import User
from apps.compliance_mapping.models import (
    ComplianceControlMapping,
    ComplianceGap,
    ComplianceMappingEvent,
    ComplianceSource,
    ComplianceSourceEdition,
)
from apps.compliance_mapping.services import PERM_VIEW, _scope


def list_compliance_sources(
    *, actor: User, organization_id: uuid.UUID
) -> QuerySet[ComplianceSource]:
    if not user_has_permission(actor, PERM_VIEW, scope=_scope(organization_id)):
        raise PermissionDenied("Permission denied.")
    return ComplianceSource.objects.filter(organization_id=organization_id).order_by("source_code")


def get_compliance_source_for_org(
    *, actor: User, organization_id: uuid.UUID, source_id: uuid.UUID
) -> ComplianceSource:
    if not user_has_permission(actor, PERM_VIEW, scope=_scope(organization_id)):
        raise PermissionDenied("Permission denied.")
    return ComplianceSource.objects.get(pk=source_id, organization_id=organization_id)


def get_source_for_org(
    *, actor: User, organization_id: uuid.UUID, source_id: uuid.UUID
) -> ComplianceSource:
    return get_compliance_source_for_org(
        actor=actor, organization_id=organization_id, source_id=source_id
    )


def list_source_editions(*, source: ComplianceSource) -> QuerySet[ComplianceSourceEdition]:
    return source.editions.all().order_by("-created_at")


def list_control_mappings(
    *,
    actor: User,
    organization_id: uuid.UUID,
    status: str | None = None,
) -> QuerySet[ComplianceControlMapping]:
    if not user_has_permission(actor, PERM_VIEW, scope=_scope(organization_id)):
        raise PermissionDenied("Permission denied.")
    qs = ComplianceControlMapping.objects.filter(organization_id=organization_id)
    if status:
        qs = qs.filter(status=status)
    return qs.select_related("edition", "edition__source").order_by("clause_reference")


def list_mapping_gaps(*, mapping: ComplianceControlMapping) -> QuerySet[ComplianceGap]:
    return mapping.gaps.all().order_by("-created_at")


def list_mapping_events(*, source: ComplianceSource) -> QuerySet[ComplianceMappingEvent]:
    return source.events.all()


def list_open_gaps(*, actor: User, organization_id: uuid.UUID) -> QuerySet[ComplianceGap]:
    if not user_has_permission(actor, PERM_VIEW, scope=_scope(organization_id)):
        raise PermissionDenied("Permission denied.")
    return (
        ComplianceGap.objects.filter(mapping__organization_id=organization_id)
        .exclude(status=ComplianceGap.Status.CLOSED)
        .select_related("mapping", "mapping__edition")
        .order_by("created_at")
    )


def report_mapping_status(*, actor: User, organization_id: uuid.UUID) -> list[dict[str, object]]:
    if not user_has_permission(actor, PERM_VIEW, scope=_scope(organization_id)):
        raise PermissionDenied("Permission denied.")
    rows = (
        ComplianceControlMapping.objects.filter(organization_id=organization_id)
        .values("status")
        .annotate(total=Count("id"))
        .order_by("status")
    )
    return [{"status": row["status"], "total": row["total"]} for row in rows]
