"""Read selectors for packaging artwork — Phase 29."""

from __future__ import annotations

import uuid

from django.db.models import QuerySet

from apps.packaging.models import (
    ArtworkVerificationRecord,
    ArtworkVersion,
    PackagingArtwork,
)


def artworks_for_organization(organization_id: uuid.UUID) -> QuerySet[PackagingArtwork]:
    return PackagingArtwork.objects.filter(organization_id=organization_id, is_active=True)


def artworks_for_product(product_id: uuid.UUID) -> QuerySet[PackagingArtwork]:
    return PackagingArtwork.objects.filter(product_id=product_id, is_active=True)


def artwork_versions_for_artwork(artwork_id: uuid.UUID) -> QuerySet[ArtworkVersion]:
    return ArtworkVersion.objects.filter(artwork_id=artwork_id).order_by("-version_number")


def versions_for_artwork(artwork_id: uuid.UUID) -> QuerySet[ArtworkVersion]:
    return artwork_versions_for_artwork(artwork_id)


def verifications_for_organization(
    organization_id: uuid.UUID,
) -> QuerySet[ArtworkVerificationRecord]:
    return ArtworkVerificationRecord.objects.filter(organization_id=organization_id)
