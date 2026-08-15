"""Frozen IQC traceability: supplier lot → receipt → inspection → decision."""

from __future__ import annotations

from typing import Any

from apps.iqc.models import IqcInspectionCase


def build_frozen_iqc_traceability(case: IqcInspectionCase) -> dict[str, Any]:
    receipt = case.receipt
    return {
        "iqc_case_id": str(case.id),
        "organization_id": str(case.organization_id),
        "workflow_status": case.workflow_status,
        "review_required": case.review_required,
        "receipt_quality_id": str(receipt.id),
        "erp_receipt_reference": receipt.erp_receipt_reference,
        "supplier_lot": receipt.supplier_lot,
        "erp_supplier_reference": receipt.supplier_profile.erp_supplier_reference,
        "erp_material_reference": receipt.material.erp_material_reference,
        "quantity": str(receipt.quantity) if receipt.quantity is not None else None,
        "uom": receipt.uom or "",
        "receipt_quality_state": receipt.quality_state,
        "checklist_task_id": (str(case.checklist_task_id) if case.checklist_task_id else None),
        "checklist_template_id": (
            str(receipt.inspection_checklist_template_id)
            if receipt.inspection_checklist_template_id
            else None
        ),
        "checklist_version_id": (
            str(receipt.inspection_checklist_version_id)
            if receipt.inspection_checklist_version_id
            else None
        ),
        "checklist_submission_id": (
            str(case.checklist_submission_id) if case.checklist_submission_id else None
        ),
        "supervisor_review_id": (
            str(case.supervisor_review_id) if case.supervisor_review_id else None
        ),
        "sampling_plan_version_id": (
            str(case.sampling_plan_version_id) if case.sampling_plan_version_id else None
        ),
        "sampling_snapshot": dict(case.sampling_snapshot or {}),
        "erp_inventory_not_updated": True,
        "not_hardcoded_inspection_questions": True,
        "evidence_gate": "APR-058 / company IQC workflow policy",
    }
