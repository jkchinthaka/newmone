"""Read selectors for returned-product quality records."""

from __future__ import annotations

import uuid

from django.db.models import QuerySet

from apps.product_returns.models import ReturnQualityRecord


def return_quality_records_for_organization(
    organization_id: uuid.UUID,
) -> QuerySet[ReturnQualityRecord]:
    return ReturnQualityRecord.objects.filter(organization_id=organization_id)


def return_quality_records_for_erp_return(
    *, organization_id: uuid.UUID, erp_return_reference: str
) -> QuerySet[ReturnQualityRecord]:
    return ReturnQualityRecord.objects.filter(
        organization_id=organization_id,
        erp_return_reference=(erp_return_reference or "").strip(),
    )


def return_quality_records_for_original_batch(
    *, organization_id: uuid.UUID, original_batch_reference: str
) -> QuerySet[ReturnQualityRecord]:
    return ReturnQualityRecord.objects.filter(
        organization_id=organization_id,
        original_batch_reference=(original_batch_reference or "").strip(),
    )
