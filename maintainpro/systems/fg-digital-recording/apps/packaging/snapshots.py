"""Historical packaging artwork context for checklist / submission integrity."""

from __future__ import annotations

from datetime import date
from typing import Any
from uuid import UUID

from apps.packaging.models import ArtworkVersion, ArtworkVersionStatus, ChecklistItemArtworkBinding


def build_frozen_artwork_context(version: ArtworkVersion) -> dict[str, Any]:
    artwork = version.artwork
    return {
        "artwork_id": str(artwork.id),
        "artwork_code": artwork.code,
        "artwork_title": artwork.title,
        "product_id": str(artwork.product_id),
        "product_code": artwork.product.code,
        "pack_configuration_label": artwork.pack_configuration_label or "",
        "artwork_version_id": str(version.id),
        "version_number": version.version_number,
        "status": version.status,
        "effective_from": (version.effective_from.isoformat() if version.effective_from else None),
        "effective_to": version.effective_to.isoformat() if version.effective_to else None,
        "approval_reference": version.approval_reference or "",
        "date_code_format_reference": version.date_code_format_reference or "",
        "batch_code_format_reference": version.batch_code_format_reference or "",
        "evidence_object_key": version.evidence_object_key or "",
        "evidence_file_name": version.evidence_file_name or "",
        "not_qa_disposition": True,
        "no_shelf_life_calculation": True,
        "evidence_gate": "APR-055 / company packaging artwork & date-code policy",
    }


def snapshot_for_checklist_item(checklist_item_id: UUID) -> dict[str, Any] | None:
    binding = (
        ChecklistItemArtworkBinding.objects.select_related("artwork_version__artwork__product")
        .filter(checklist_item_id=checklist_item_id)
        .first()
    )
    if binding is None:
        return None
    if binding.frozen_artwork_context:
        frozen = dict(binding.frozen_artwork_context)
        frozen.setdefault("not_qa_disposition", True)
        frozen.setdefault("no_shelf_life_calculation", True)
        return frozen
    return build_frozen_artwork_context(binding.artwork_version)


def artwork_version_is_effective(
    version: ArtworkVersion,
    *,
    as_of: date | None = None,
) -> bool:
    """Effective-date window check — does not invent company calendar rules."""
    if version.status != ArtworkVersionStatus.APPROVED:
        return False
    day = as_of or date.today()
    if version.effective_from is not None and day < version.effective_from:
        return False
    if version.effective_to is not None and day > version.effective_to:
        return False
    return True
