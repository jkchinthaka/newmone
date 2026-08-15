"""Read selectors for supplier quality — org-scoped."""

from __future__ import annotations

import uuid

from django.db.models import QuerySet

from apps.accounts.models import User
from apps.supplier_quality.models import SupplierCertificate, SupplierQualityProfile
from apps.supplier_quality.services import assert_can_view_supplier_quality


def list_supplier_quality_profiles(
    *, actor: User | None, organization_id: uuid.UUID
) -> QuerySet[SupplierQualityProfile]:
    from apps.supplier_quality.services import _require_authenticated_actor

    user = _require_authenticated_actor(actor)
    assert_can_view_supplier_quality(actor=user, organization_id=organization_id)
    return SupplierQualityProfile.objects.filter(organization_id=organization_id).order_by(
        "erp_supplier_reference"
    )


def get_supplier_quality_profile(
    *, actor: User | None, profile_id: uuid.UUID
) -> SupplierQualityProfile:
    from apps.supplier_quality.services import _require_authenticated_actor

    user = _require_authenticated_actor(actor)
    profile = SupplierQualityProfile.objects.filter(pk=profile_id).first()
    if profile is None:
        from django.core.exceptions import ValidationError

        raise ValidationError({"profile": "Supplier quality profile not found."})
    assert_can_view_supplier_quality(actor=user, organization_id=profile.organization_id)
    return profile


def list_supplier_certificates(
    *, actor: User | None, profile_id: uuid.UUID
) -> QuerySet[SupplierCertificate]:
    profile = get_supplier_quality_profile(actor=actor, profile_id=profile_id)
    return SupplierCertificate.objects.filter(profile_id=profile.id).order_by(
        "-expires_on", "certificate_type"
    )
