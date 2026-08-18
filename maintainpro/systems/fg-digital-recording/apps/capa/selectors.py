"""CAPA selectors."""

from __future__ import annotations

import uuid

from django.db.models import QuerySet

from apps.access_control.services import (
    Scope,
    organization_ids_with_permission,
    user_has_permission,
)
from apps.accounts.models import User
from apps.capa.models import CapaHistoryEntry, CorrectiveAction
from apps.capa.services import MANAGE_CAPA, VIEW_CAPA
from apps.organizations.models import Organization


def actor_can_access_capa_module(actor: User | None) -> bool:
    if actor is None or not getattr(actor, "is_authenticated", False):
        return False
    return bool(organization_ids_with_permission(actor, VIEW_CAPA))


def organizations_for_capa_view(actor: User) -> QuerySet[Organization]:
    org_ids = organization_ids_with_permission(actor, VIEW_CAPA)
    if not org_ids:
        return Organization.objects.none()
    return Organization.objects.filter(pk__in=org_ids, is_active=True).order_by("code")


def list_corrective_actions_for_actor(*, actor: User) -> QuerySet[CorrectiveAction]:
    org_ids = organization_ids_with_permission(actor, VIEW_CAPA)
    if not org_ids:
        return CorrectiveAction.objects.none()
    return (
        CorrectiveAction.objects.filter(organization_id__in=org_ids)
        .select_related("owner", "created_by", "nonconformance", "organization")
        .order_by("-created_at")
    )


def list_corrective_actions_for_org(
    *, actor: User, organization_id: uuid.UUID
) -> QuerySet[CorrectiveAction]:
    scope = Scope(organization_id=organization_id)
    if not (
        user_has_permission(actor, VIEW_CAPA, scope=scope)
        or user_has_permission(actor, MANAGE_CAPA, scope=scope)
    ):
        return CorrectiveAction.objects.none()
    return (
        CorrectiveAction.objects.filter(organization_id=organization_id)
        .select_related("owner", "created_by", "nonconformance", "organization")
        .order_by("-created_at")
    )


def list_capa_history(*, capa_id: uuid.UUID) -> QuerySet[CapaHistoryEntry]:
    return CapaHistoryEntry.objects.filter(capa_id=capa_id).select_related("actor")
