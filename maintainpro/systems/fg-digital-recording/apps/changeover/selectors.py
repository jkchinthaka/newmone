"""Read selectors for allergen / changeover / line clearance — Phase 30."""

from __future__ import annotations

import uuid

from django.db.models import QuerySet

from apps.changeover.models import (
    ChangeoverRecord,
    LineClearanceRecord,
    ProductAllergenDeclaration,
)


def declarations_for_product(
    product_id: uuid.UUID,
) -> QuerySet[ProductAllergenDeclaration]:
    return ProductAllergenDeclaration.objects.filter(product_id=product_id)


def changeovers_for_organization(
    organization_id: uuid.UUID,
) -> QuerySet[ChangeoverRecord]:
    return ChangeoverRecord.objects.filter(organization_id=organization_id)


def changeovers_for_line(
    *,
    organization_id: uuid.UUID,
    line_code: str,
) -> QuerySet[ChangeoverRecord]:
    return ChangeoverRecord.objects.filter(
        organization_id=organization_id,
        line_code=(line_code or "").strip(),
    )


def changeovers_for_batch(
    *,
    organization_id: uuid.UUID,
    batch_reference: str,
) -> QuerySet[ChangeoverRecord]:
    return ChangeoverRecord.objects.filter(
        organization_id=organization_id,
        batch_reference=(batch_reference or "").strip(),
    )


def line_clearances_for_organization(
    organization_id: uuid.UUID,
) -> QuerySet[LineClearanceRecord]:
    return LineClearanceRecord.objects.filter(organization_id=organization_id)
