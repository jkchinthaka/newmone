"""Dispatch quality selectors."""

from __future__ import annotations

import uuid

from django.db.models import QuerySet

from apps.access_control.services import (
    Scope,
    organization_ids_with_permission,
    user_has_permission,
)
from apps.accounts.models import User
from apps.dispatch.models import (
    DispatchHistoryEntry,
    DispatchQualityRecord,
    DispatchReleasePolicy,
)
from apps.dispatch.services import MANAGE_DISPATCH, VIEW_DISPATCH
from apps.organizations.models import Organization


def actor_can_access_dispatch_module(actor: User | None) -> bool:
    if actor is None or not getattr(actor, "is_authenticated", False):
        return False
    return bool(organization_ids_with_permission(actor, VIEW_DISPATCH))


def organizations_for_dispatch_view(actor: User) -> QuerySet[Organization]:
    org_ids = organization_ids_with_permission(actor, VIEW_DISPATCH)
    if not org_ids:
        return Organization.objects.none()
    return Organization.objects.filter(pk__in=org_ids, is_active=True).order_by("code")


def list_dispatch_records_for_actor(*, actor: User) -> QuerySet[DispatchQualityRecord]:
    org_ids = organization_ids_with_permission(actor, VIEW_DISPATCH)
    if not org_ids:
        return DispatchQualityRecord.objects.none()
    return (
        DispatchQualityRecord.objects.filter(organization_id__in=org_ids)
        .select_related("owner", "created_by", "qa_review", "organization")
        .order_by("-created_at")
    )


def list_dispatch_history(*, record_id: uuid.UUID) -> QuerySet[DispatchHistoryEntry]:
    return DispatchHistoryEntry.objects.filter(dispatch_record_id=record_id).select_related("actor")


def list_dispatch_records_for_org(
    *, actor: User, organization_id: uuid.UUID
) -> QuerySet[DispatchQualityRecord]:
    scope = Scope(organization_id=organization_id)
    if not (
        user_has_permission(actor, VIEW_DISPATCH, scope=scope)
        or user_has_permission(actor, MANAGE_DISPATCH, scope=scope)
    ):
        return DispatchQualityRecord.objects.none()
    return (
        DispatchQualityRecord.objects.filter(organization_id=organization_id)
        .select_related("owner", "created_by", "qa_review", "organization")
        .order_by("-created_at")
    )


def get_release_policy(*, organization_id: uuid.UUID) -> DispatchReleasePolicy | None:
    return DispatchReleasePolicy.objects.filter(organization_id=organization_id).first()
