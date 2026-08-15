"""Customer complaint read selectors — Phase 39."""

from __future__ import annotations

import uuid

from django.db.models import QuerySet

from apps.access_control.services import organization_ids_with_permission
from apps.accounts.models import User
from apps.customer_complaints.models import (
    CustomerComplaintCase,
    CustomerComplaintTimelineEntry,
)
from apps.organizations.models import Organization

VIEW = "customer_complaints.view_customercomplaint"


def actor_can_access_complaints_module(actor: User | None) -> bool:
    if actor is None or not getattr(actor, "is_authenticated", False):
        return False
    return bool(organization_ids_with_permission(actor, VIEW))


def organizations_for_complaints_view(actor: User) -> QuerySet[Organization]:
    org_ids = organization_ids_with_permission(actor, VIEW)
    if not org_ids:
        return Organization.objects.none()
    return Organization.objects.filter(pk__in=org_ids, is_active=True).order_by("code")


def list_complaints_for_actor(*, actor: User) -> QuerySet[CustomerComplaintCase]:
    org_ids = organization_ids_with_permission(actor, VIEW)
    if not org_ids:
        return CustomerComplaintCase.objects.none()
    return (
        CustomerComplaintCase.objects.filter(organization_id__in=org_ids)
        .select_related("owner", "created_by", "organization")
        .order_by("-created_at")
    )


def get_complaint_case(
    *, organization_id: uuid.UUID, case_id: uuid.UUID
) -> CustomerComplaintCase | None:
    return (
        CustomerComplaintCase.objects.filter(pk=case_id, organization_id=organization_id)
        .select_related("owner", "closed_by", "created_by")
        .first()
    )


def get_complaint_by_code(*, organization_id: uuid.UUID, code: str) -> CustomerComplaintCase | None:
    key = (code or "").strip()
    if not key:
        return None
    return CustomerComplaintCase.objects.filter(
        organization_id=organization_id, code__iexact=key
    ).first()


def timeline_for_case(*, case_id: uuid.UUID) -> QuerySet[CustomerComplaintTimelineEntry]:
    return (
        CustomerComplaintTimelineEntry.objects.filter(complaint_case_id=case_id)
        .select_related("actor")
        .order_by("created_at")
    )
