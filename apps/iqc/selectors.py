"""Read selectors for IQC — Phase 33."""

from __future__ import annotations

import uuid

from django.db.models import QuerySet

from apps.iqc.models import IncomingReceiptEvent, IqcInspectionCase


def cases_for_organization(organization_id: uuid.UUID) -> QuerySet[IqcInspectionCase]:
    return IqcInspectionCase.objects.filter(organization_id=organization_id)


def cases_for_supplier_lot(
    *,
    organization_id: uuid.UUID,
    supplier_lot: str,
) -> QuerySet[IqcInspectionCase]:
    return IqcInspectionCase.objects.filter(
        organization_id=organization_id,
        receipt__supplier_lot=(supplier_lot or "").strip(),
    )


def events_for_source(
    *,
    source_system: str,
    source_event_id: str,
) -> QuerySet[IncomingReceiptEvent]:
    return IncomingReceiptEvent.objects.filter(
        source_system__iexact=(source_system or "").strip(),
        source_event_id__iexact=(source_event_id or "").strip(),
    )
