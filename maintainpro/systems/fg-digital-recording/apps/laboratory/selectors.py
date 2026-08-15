"""Read selectors for laboratory foundation."""

from __future__ import annotations

import uuid

from django.db.models import QuerySet

from apps.access_control.services import organization_ids_with_permission
from apps.accounts.models import User
from apps.laboratory.models import LabResult, LabResultStatus, LabSample
from apps.laboratory.services import VIEW_LAB
from apps.organizations.models import Organization


def actor_can_access_lab_module(actor: User | None) -> bool:
    if actor is None or not getattr(actor, "is_authenticated", False):
        return False
    return bool(organization_ids_with_permission(actor, VIEW_LAB))


def organizations_for_lab_view(actor: User) -> QuerySet[Organization]:
    org_ids = organization_ids_with_permission(actor, VIEW_LAB)
    if not org_ids:
        return Organization.objects.none()
    return Organization.objects.filter(pk__in=org_ids, is_active=True).order_by("code")


def samples_for_actor(*, actor: User) -> QuerySet[LabSample]:
    org_ids = organization_ids_with_permission(actor, VIEW_LAB)
    if not org_ids:
        return LabSample.objects.none()
    return (
        LabSample.objects.filter(organization_id__in=org_ids)
        .select_related("product", "site", "registered_by", "organization")
        .order_by("-registered_at")
    )


def samples_for_organization(organization_id: uuid.UUID) -> QuerySet[LabSample]:
    return LabSample.objects.filter(organization_id=organization_id).select_related(
        "product", "site", "registered_by"
    )


def latest_results_for_sample(sample_id: uuid.UUID) -> list[LabResult]:
    rows = (
        LabResult.objects.filter(lab_test__sample_id=sample_id)
        .exclude(status__in=[LabResultStatus.CANCELLED, LabResultStatus.SUPERSEDED])
        .select_related("parameter", "lab_test")
        .order_by("parameter__code", "-revision_number")
    )
    latest: dict[uuid.UUID, LabResult] = {}
    for row in rows:
        if row.parameter_id not in latest:
            latest[row.parameter_id] = row
    return list(latest.values())
