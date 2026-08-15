"""Read selectors for organization-scoped quality quarantine state."""

from __future__ import annotations

import uuid

from django.db.models import QuerySet

from apps.access_control.services import organization_ids_with_permission
from apps.accounts.models import User
from apps.organizations.models import Organization
from apps.quality_quarantine.models import QualityQuarantineEvent, QualityQuarantineRecord
from apps.quality_quarantine.services import VIEW


def actor_can_access_quarantine_module(actor: User | None) -> bool:
    if actor is None or not getattr(actor, "is_authenticated", False):
        return False
    return bool(organization_ids_with_permission(actor, VIEW))


def organizations_for_quarantine_view(actor: User) -> QuerySet[Organization]:
    org_ids = organization_ids_with_permission(actor, VIEW)
    if not org_ids:
        return Organization.objects.none()
    return Organization.objects.filter(pk__in=org_ids, is_active=True).order_by("code")


def list_quarantines_for_actor(*, actor: User) -> QuerySet[QualityQuarantineRecord]:
    org_ids = organization_ids_with_permission(actor, VIEW)
    if not org_ids:
        return QualityQuarantineRecord.objects.none()
    return (
        QualityQuarantineRecord.objects.filter(organization_id__in=org_ids)
        .select_related("opened_by", "owner", "organization")
        .order_by("-opened_at")
    )


def get_quarantine_record(
    *, organization_id: uuid.UUID, quarantine_id: uuid.UUID
) -> QualityQuarantineRecord:
    return QualityQuarantineRecord.objects.get(
        organization_id=organization_id,
        pk=quarantine_id,
    )


def list_quarantines_by_batch(
    *, organization_id: uuid.UUID, batch_reference: str
) -> QuerySet[QualityQuarantineRecord]:
    return QualityQuarantineRecord.objects.filter(
        organization_id=organization_id,
        batch_reference=(batch_reference or "").strip(),
    )


def list_quarantines_by_source(
    *, organization_id: uuid.UUID, source: str, source_reference: str | None = None
) -> QuerySet[QualityQuarantineRecord]:
    queryset = QualityQuarantineRecord.objects.filter(
        organization_id=organization_id,
        source=source,
    )
    if source_reference is not None:
        queryset = queryset.filter(source_reference=source_reference.strip())
    return queryset


def events_for_quarantine(
    *, organization_id: uuid.UUID, quarantine_id: uuid.UUID
) -> QuerySet[QualityQuarantineEvent]:
    return QualityQuarantineEvent.objects.filter(
        quarantine__organization_id=organization_id,
        quarantine_id=quarantine_id,
    ).select_related("actor", "quarantine")
