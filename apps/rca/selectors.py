"""RCA selectors — Phase 49."""

from __future__ import annotations

import uuid

from django.core.exceptions import PermissionDenied
from django.db.models import QuerySet

from apps.access_control.services import organization_ids_with_permission, user_has_permission
from apps.accounts.models import User
from apps.organizations.models import Organization
from apps.rca.models import RcaCause, RcaEvent, RootCauseAnalysis
from apps.rca.services import PERM_MANAGE, PERM_VIEW, _scope


def actor_can_access_rca_module(actor: User | None) -> bool:
    if actor is None or not getattr(actor, "is_authenticated", False):
        return False
    return bool(organization_ids_with_permission(actor, PERM_VIEW))


def organizations_for_rca_view(actor: User) -> QuerySet[Organization]:
    org_ids = organization_ids_with_permission(actor, PERM_VIEW)
    if not org_ids:
        return Organization.objects.none()
    return Organization.objects.filter(pk__in=org_ids, is_active=True).order_by("code")


def organizations_for_rca_manage(actor: User) -> QuerySet[Organization]:
    org_ids = organization_ids_with_permission(actor, PERM_MANAGE)
    if not org_ids:
        return Organization.objects.none()
    return Organization.objects.filter(pk__in=org_ids, is_active=True).order_by("code")


def list_rcas_for_actor(*, actor: User, status: str | None = None) -> QuerySet[RootCauseAnalysis]:
    org_ids = organization_ids_with_permission(actor, PERM_VIEW)
    if not org_ids:
        raise PermissionDenied("Permission denied.")
    qs = RootCauseAnalysis.objects.filter(organization_id__in=org_ids).select_related(
        "organization", "created_by", "facilitator"
    )
    if status:
        qs = qs.filter(status=status)
    return qs.order_by("-started_at")


def list_rcas(
    *, actor: User, organization_id: uuid.UUID, status: str | None = None
) -> QuerySet[RootCauseAnalysis]:
    if not user_has_permission(actor, PERM_VIEW, scope=_scope(organization_id)):
        raise PermissionDenied("Permission denied.")
    qs = RootCauseAnalysis.objects.filter(organization_id=organization_id)
    if status:
        qs = qs.filter(status=status)
    return qs.order_by("-started_at")


def get_rca_for_org(
    *, actor: User, organization_id: uuid.UUID, rca_id: uuid.UUID
) -> RootCauseAnalysis:
    if not user_has_permission(actor, PERM_VIEW, scope=_scope(organization_id)):
        raise PermissionDenied("Permission denied.")
    return RootCauseAnalysis.objects.get(pk=rca_id, organization_id=organization_id)


def list_rca_causes(*, rca: RootCauseAnalysis) -> QuerySet[RcaCause]:
    return rca.causes.all().order_by("created_at")


def list_rca_events(*, rca: RootCauseAnalysis) -> QuerySet[RcaEvent]:
    return rca.events.all()
