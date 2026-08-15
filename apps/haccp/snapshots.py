"""Historical HACCP context snapshots for checklist / submission integrity."""

from __future__ import annotations

from typing import Any
from uuid import UUID

from apps.haccp.models import ChecklistItemHaccpBinding, ControlPoint, HaccpPlanVersion


def build_haccp_context_snapshot(
    *,
    plan_version: HaccpPlanVersion,
    control_point: ControlPoint,
) -> dict[str, Any]:
    """Freeze exact plan version + control point identity for historical records."""
    return {
        "haccp_plan_id": str(plan_version.plan_id),
        "haccp_plan_code": plan_version.plan.code,
        "haccp_plan_version_id": str(plan_version.id),
        "haccp_plan_version_number": plan_version.version_number,
        "haccp_plan_version_status": plan_version.status,
        "control_point_id": str(control_point.id),
        "control_point_code": control_point.code,
        "control_point_type": control_point.control_point_type,
        "not_qa_disposition": True,
        "evidence_gate": "ASM-002 / APR-027 / company HACCP approval required for production use",
    }


def snapshot_for_checklist_item(checklist_item_id: UUID) -> dict[str, Any] | None:
    binding = (
        ChecklistItemHaccpBinding.objects.select_related(
            "plan_version__plan", "control_point", "control_point__process_step"
        )
        .filter(checklist_item_id=checklist_item_id)
        .first()
    )
    if binding is None:
        return None
    # Prefer frozen bind-time context so later plan edits cannot rewrite history.
    if binding.frozen_haccp_context:
        frozen = dict(binding.frozen_haccp_context)
        frozen.setdefault("not_qa_disposition", True)
        frozen.setdefault(
            "evidence_gate",
            "ASM-002 / APR-027 / company HACCP approval required for production use",
        )
        return frozen
    return build_haccp_context_snapshot(
        plan_version=binding.plan_version,
        control_point=binding.control_point,
    )
