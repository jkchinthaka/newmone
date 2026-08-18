"""Historical sanitation context for checklist / submission integrity."""

from __future__ import annotations

from typing import Any
from uuid import UUID

from apps.sanitation.models import ChecklistTemplateSanitationBinding


def snapshot_for_checklist_template(checklist_template_id: UUID) -> dict[str, Any] | None:
    binding = (
        ChecklistTemplateSanitationBinding.objects.select_related("program_version__program")
        .filter(checklist_template_id=checklist_template_id)
        .first()
    )
    if binding is None:
        return None
    if binding.frozen_sanitation_context:
        frozen = dict(binding.frozen_sanitation_context)
        frozen.setdefault("not_qa_disposition", True)
        frozen.setdefault("fail_does_not_stop_production_by_default", True)
        return frozen
    version = binding.program_version
    return {
        "program_id": str(version.program_id),
        "program_code": version.program.code,
        "program_version_id": str(version.id),
        "version_number": version.version_number,
        "verification_mode": version.verification_mode,
        "program_version_status": version.status,
        "not_qa_disposition": True,
        "fail_does_not_stop_production_by_default": True,
        "evidence_gate": "APR-053 / company sanitation SOP configuration required",
    }


def build_frozen_sanitation_context(version: Any) -> dict[str, Any]:
    """Capture program version identity + scopes + schedule kinds for history."""
    scopes = [
        {
            "code": s.code,
            "title": s.title,
            "site_id": str(s.site_id) if s.site_id else None,
            "department_id": str(s.department_id) if s.department_id else None,
            "line_code": s.line_code or "",
            "work_area_code": s.work_area_code or "",
            "equipment_id": str(s.equipment_id) if s.equipment_id else None,
        }
        for s in version.scopes.all()
    ]
    schedule_kinds = [link.schedule_kind for link in version.schedule_links.all()]
    chemicals = [
        {
            "chemical_id": str(link.chemical_id),
            "chemical_code": link.chemical.code,
            "chemical_name": link.chemical.name,
            # Never snapshot invented concentrations — only stored opaque labels.
            "concentration_label": link.chemical.concentration_label or "",
        }
        for link in version.chemical_links.select_related("chemical").all()
    ]
    return {
        "program_id": str(version.program_id),
        "program_code": version.program.code,
        "program_title": version.program.title,
        "program_version_id": str(version.id),
        "version_number": version.version_number,
        "verification_mode": version.verification_mode,
        "checklist_template_id": str(version.program.checklist_template_id),
        "scopes": scopes,
        "schedule_kinds": schedule_kinds,
        "chemical_references": chemicals,
        "not_qa_disposition": True,
        "fail_does_not_stop_production_by_default": True,
        "evidence_gate": "APR-053 / company sanitation SOP configuration required",
        "reuses_checklist_engine": True,
    }
