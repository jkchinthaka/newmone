"""Historical sampling context snapshots for checklist / submission integrity."""

from __future__ import annotations

from typing import Any
from uuid import UUID

from apps.sampling.models import ChecklistItemSamplingBinding


def snapshot_for_checklist_item(checklist_item_id: UUID) -> dict[str, Any] | None:
    binding = (
        ChecklistItemSamplingBinding.objects.select_related("plan_version__plan")
        .filter(checklist_item_id=checklist_item_id)
        .first()
    )
    if binding is None:
        return None
    if binding.frozen_sampling_context:
        frozen = dict(binding.frozen_sampling_context)
        frozen.setdefault("not_qa_disposition", True)
        frozen.setdefault("sampling_fail_is_not_qa_reject", True)
        return frozen
    version = binding.plan_version
    return {
        "plan_id": str(version.plan_id),
        "plan_code": version.plan.code,
        "plan_version_id": str(version.id),
        "version_number": version.version_number,
        "plan_version_status": version.status,
        "not_qa_disposition": True,
        "sampling_fail_is_not_qa_reject": True,
        "evidence_gate": "APR-050 / company sampling configuration required",
    }


def snapshot_for_item_or_parent(item: Any) -> dict[str, Any] | None:
    """Resolve sampling snapshot for item or its REPEATING_GROUP parent."""
    item_id = getattr(item, "id", None)
    if isinstance(item_id, UUID):
        direct = snapshot_for_checklist_item(item_id)
        if direct is not None:
            return direct
    parent_id = getattr(item, "parent_item_id", None)
    if isinstance(parent_id, UUID):
        return snapshot_for_checklist_item(parent_id)
    return None
