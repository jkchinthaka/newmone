"""Read selectors for receiving quality — Phase 31."""

from __future__ import annotations

import uuid

from django.db.models import QuerySet

from apps.receiving.models import MaterialReference, ReceiptQualityRecord


def materials_for_organization(
    organization_id: uuid.UUID,
) -> QuerySet[MaterialReference]:
    return MaterialReference.objects.filter(organization_id=organization_id, is_active=True)


def receipts_for_organization(
    organization_id: uuid.UUID,
) -> QuerySet[ReceiptQualityRecord]:
    return ReceiptQualityRecord.objects.filter(organization_id=organization_id)


def receipts_for_supplier_lot(
    *,
    organization_id: uuid.UUID,
    supplier_lot: str,
) -> QuerySet[ReceiptQualityRecord]:
    return ReceiptQualityRecord.objects.filter(
        organization_id=organization_id,
        supplier_lot=(supplier_lot or "").strip(),
    )


def receipts_for_erp_grn(
    *,
    organization_id: uuid.UUID,
    erp_receipt_reference: str,
) -> QuerySet[ReceiptQualityRecord]:
    return ReceiptQualityRecord.objects.filter(
        organization_id=organization_id,
        erp_receipt_reference=(erp_receipt_reference or "").strip(),
    )
