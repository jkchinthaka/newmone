"""Frozen changeover / line-clearance context for historical traceability."""

from __future__ import annotations

from typing import Any

from apps.changeover.models import ChangeoverRecord, LineClearanceRecord


def build_frozen_changeover_context(record: ChangeoverRecord) -> dict[str, Any]:
    return {
        "changeover_id": str(record.id),
        "organization_id": str(record.organization_id),
        "previous_product_id": str(record.previous_product_id),
        "previous_product_code": record.previous_product.code,
        "next_product_id": str(record.next_product_id),
        "next_product_code": record.next_product.code,
        "line_code": record.line_code or "",
        "started_at": record.started_at.isoformat() if record.started_at else None,
        "completed_at": (record.completed_at.isoformat() if record.completed_at else None),
        "status": record.status,
        "batch_reference": record.batch_reference or "",
        "cleaning_checklist_template_id": (
            str(record.cleaning_checklist_template_id)
            if record.cleaning_checklist_template_id
            else None
        ),
        "cleaning_checklist_version_id": (
            str(record.cleaning_checklist_version_id)
            if record.cleaning_checklist_version_id
            else None
        ),
        "packaging_artwork_hook_id": (
            str(record.packaging_artwork_hook_id) if record.packaging_artwork_hook_id else None
        ),
        "previous_declaration_id": (
            str(record.previous_declaration_id) if record.previous_declaration_id else None
        ),
        "next_declaration_id": (
            str(record.next_declaration_id) if record.next_declaration_id else None
        ),
        "evidence_object_key": record.evidence_object_key or "",
        "not_qa_disposition": True,
        "no_invented_allergen_matrix": True,
        "evidence_gate": "APR-056 / company allergen changeover policy",
        "batch_dossier_ready": True,
    }


def build_frozen_line_clearance_context(record: LineClearanceRecord) -> dict[str, Any]:
    return {
        "line_clearance_id": str(record.id),
        "organization_id": str(record.organization_id),
        "changeover_id": str(record.changeover_id) if record.changeover_id else None,
        "line_code": record.line_code or "",
        "status": record.status,
        "checklist_template_id": str(record.checklist_template_id),
        "checklist_template_code": record.checklist_template.code,
        "checklist_version_id": (
            str(record.checklist_version_id) if record.checklist_version_id else None
        ),
        "checklist_version_number": (
            record.checklist_version.version_number
            if record.checklist_version is not None
            else None
        ),
        "checklist_submission_id": (
            str(record.checklist_submission_id) if record.checklist_submission_id else None
        ),
        "packaging_artwork_hook_id": (
            str(record.packaging_artwork_hook_id) if record.packaging_artwork_hook_id else None
        ),
        "evidence_object_key": record.evidence_object_key or "",
        "completed_at": (record.completed_at.isoformat() if record.completed_at else None),
        "not_qa_disposition": True,
        "uses_checklist_engine": True,
        "evidence_gate": "APR-056 / company allergen changeover policy",
        "batch_dossier_ready": True,
    }
