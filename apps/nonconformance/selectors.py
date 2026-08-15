"""Nonconformance / Hold selectors."""

from __future__ import annotations

import uuid

from django.db.models import QuerySet

from apps.access_control.services import (
    Scope,
    organization_ids_with_permission,
    user_has_permission,
)
from apps.accounts.models import User
from apps.nonconformance.models import (
    HoldCase,
    NonConformanceRecord,
    QualityCaseHistoryEntry,
)
from apps.nonconformance.services import MANAGE_HOLD, MANAGE_NCR, VIEW_NONCONFORMANCE
from apps.organizations.models import Organization


def actor_can_access_ncr_module(actor: User | None) -> bool:
    if actor is None or not getattr(actor, "is_authenticated", False):
        return False
    return bool(organization_ids_with_permission(actor, VIEW_NONCONFORMANCE))


def organizations_for_ncr_view(actor: User) -> QuerySet[Organization]:
    org_ids = organization_ids_with_permission(actor, VIEW_NONCONFORMANCE)
    if not org_ids:
        return Organization.objects.none()
    return Organization.objects.filter(pk__in=org_ids, is_active=True).order_by("code")


def list_nonconformances_for_actor(*, actor: User) -> QuerySet[NonConformanceRecord]:
    org_ids = organization_ids_with_permission(actor, VIEW_NONCONFORMANCE)
    if not org_ids:
        return NonConformanceRecord.objects.none()
    return (
        NonConformanceRecord.objects.filter(organization_id__in=org_ids)
        .select_related("owner", "created_by", "organization")
        .order_by("-created_at")
    )


def list_nonconformances_for_org(
    *, actor: User, organization_id: uuid.UUID
) -> QuerySet[NonConformanceRecord]:
    scope = Scope(organization_id=organization_id)
    if not (
        user_has_permission(actor, VIEW_NONCONFORMANCE, scope=scope)
        or user_has_permission(actor, MANAGE_NCR, scope=scope)
    ):
        return NonConformanceRecord.objects.none()
    return (
        NonConformanceRecord.objects.filter(organization_id=organization_id)
        .select_related("owner", "created_by", "organization")
        .order_by("-created_at")
    )


def list_hold_cases_for_org(*, actor: User, organization_id: uuid.UUID) -> QuerySet[HoldCase]:
    scope = Scope(organization_id=organization_id)
    if not (
        user_has_permission(actor, MANAGE_HOLD, scope=scope)
        or user_has_permission(actor, "nonconformance.view_holdcase", scope=scope)
        or user_has_permission(actor, MANAGE_NCR, scope=scope)
    ):
        return HoldCase.objects.none()
    return (
        HoldCase.objects.filter(organization_id=organization_id)
        .select_related("owner", "opened_by", "nonconformance", "organization")
        .order_by("-opened_at")
    )


def list_case_history(
    *,
    organization_id: uuid.UUID,
    case_kind: str,
    case_id: uuid.UUID,
) -> QuerySet[QualityCaseHistoryEntry]:
    return QualityCaseHistoryEntry.objects.filter(
        organization_id=organization_id,
        case_kind=case_kind,
        case_id=case_id,
    ).select_related("actor")
