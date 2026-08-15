"""Frozen IPQC process context — product/line/step/shift/batch → inspection → outcome."""

from __future__ import annotations

from typing import Any

from apps.ipqc.models import IpqcInspectionCase


def build_frozen_ipqc_process_context(case: IpqcInspectionCase) -> dict[str, Any]:
    return {
        "ipqc_case_id": str(case.id),
        "organization_id": str(case.organization_id),
        "definition_id": str(case.definition_id),
        "definition_code": case.definition.code,
        "occurrence_key": case.occurrence_key,
        "trigger_kind": case.trigger_kind,
        "workflow_status": case.workflow_status,
        "product_id": str(case.product_id) if case.product_id else None,
        "product_code": (case.product.code if case.product is not None else ""),
        "production_line_code": case.production_line_code or "",
        "process_step_id": str(case.process_step_id) if case.process_step_id else None,
        "process_step_code": case.process_step_code or "",
        "shift_id": str(case.shift_id) if case.shift_id else None,
        "batch_reference": case.batch_reference or "",
        "production_order_reference": case.production_order_reference or "",
        "checklist_task_id": (str(case.checklist_task_id) if case.checklist_task_id else None),
        "checklist_submission_id": (
            str(case.checklist_submission_id) if case.checklist_submission_id else None
        ),
        "equipment_id": str(case.equipment_id) if case.equipment_id else None,
        "equipment_trace_snapshot": dict(case.equipment_trace_snapshot or {}),
        "measurement_snapshot": dict(case.measurement_snapshot or {}),
        "sampling_snapshot": dict(case.sampling_snapshot or {}),
        "haccp_metadata_snapshot": dict(case.haccp_metadata_snapshot or {}),
        "failure_detected": case.failure_detected,
        "stop_production_signal": case.stop_production_signal,
        "failure_decision": dict(case.failure_decision or {}),
        "nonconformance_id": (str(case.nonconformance_id) if case.nonconformance_id else None),
        "hold_case_id": str(case.hold_case_id) if case.hold_case_id else None,
        "due_at": case.due_at.isoformat() if case.due_at else None,
        "not_fg_release": True,
        "not_hardcoded_inspection_questions": True,
        "evidence_gate": "APR-059 / company IPQC process-check policy",
    }
