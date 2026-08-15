"""Frozen receipt quality context for historical / dossier integrity."""

from __future__ import annotations

from typing import Any

from apps.receiving.models import ReceiptQualityRecord


def build_frozen_receipt_context(record: ReceiptQualityRecord) -> dict[str, Any]:
    return {
        "receipt_quality_id": str(record.id),
        "organization_id": str(record.organization_id),
        "erp_receipt_reference": record.erp_receipt_reference,
        "supplier_profile_id": str(record.supplier_profile_id),
        "erp_supplier_reference": record.supplier_profile.erp_supplier_reference,
        "supplier_lot": record.supplier_lot,
        "material_id": str(record.material_id),
        "erp_material_reference": record.material.erp_material_reference,
        "quantity": str(record.quantity) if record.quantity is not None else None,
        "uom": record.uom or "",
        "received_date": (record.received_date.isoformat() if record.received_date else None),
        "quality_state": record.quality_state,
        "inspection_checklist_template_id": (
            str(record.inspection_checklist_template_id)
            if record.inspection_checklist_template_id
            else None
        ),
        "inspection_checklist_version_id": (
            str(record.inspection_checklist_version_id)
            if record.inspection_checklist_version_id
            else None
        ),
        "material_specification_version_id": (
            str(record.material_specification_version_id)
            if record.material_specification_version_id
            else None
        ),
        "evidence_object_key": record.evidence_object_key or "",
        "erp_inventory_not_updated": True,
        "not_qa_disposition_to_erp": True,
        "evidence_gate": "APR-057 / company raw material receiving quality policy",
    }
