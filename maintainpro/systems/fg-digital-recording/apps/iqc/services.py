"""IQC workflow services — Phase 33.

ERP Receipt → IQC Task → Recording → Review → Local disposition → ERP only if approved.
Uses checklist engine (no hardcoded questions), sampling engine, and LIMS links.
"""

from __future__ import annotations

import uuid
from decimal import Decimal
from typing import Any

from django.core.exceptions import PermissionDenied, ValidationError
from django.db import IntegrityError
from django.utils import timezone

from apps.core.persistence.transactions import atomic_fn
from apps.access_control.services import Scope, require_permission, user_has_permission
from apps.accounts.models import User
from apps.checklists.models import ChecklistTemplate, ChecklistVersion
from apps.iqc.models import (
    IncomingReceiptEvent,
    IncomingReceiptEventStatus,
    IqcHistoryEntry,
    IqcInspectionCase,
    IqcWorkflowPolicy,
    IqcWorkflowStatus,
)
from apps.iqc.policy import attempt_iqc_erp_outbound
from apps.iqc.snapshots import build_frozen_iqc_traceability
from apps.organizations.models import Organization
from apps.receiving.models import MaterialReference, ReceiptQualityRecord, ReceiptQualityState
from apps.receiving.services import (
    create_material_reference,
    create_receipt_quality_record,
    register_incoming_lab_sample,
)
from apps.receiving.snapshots import build_frozen_receipt_context
from apps.recording.models import ChecklistSubmission
from apps.reviews.models import SupervisorReview, SupervisorReviewDecision
from apps.sampling.engine import SamplingMatchContext, resolve_sampling_requirement
from apps.sampling.models import SamplingPlanVersion
from apps.scheduling.services import create_batch_checklist_task
from apps.security_audit.services import record_event
from apps.supplier_quality.models import SupplierQualityProfile
from apps.supplier_quality.services import create_supplier_quality_profile

MANAGE = "iqc.manage_iqc"
DISPOSITION = "iqc.disposition_iqc"
VIEW = "iqc.view_iqc"
MANAGE_POLICY = "iqc.manage_iqcpolicy"


def _require_actor(actor: User | None) -> User:
    if actor is None or not getattr(actor, "is_authenticated", False) or not actor.is_active:
        raise PermissionDenied("Authentication required.")
    return actor


def _org_scope(organization_id: uuid.UUID) -> Scope:
    return Scope(organization_id=organization_id)


def _history(
    *,
    organization_id: uuid.UUID,
    actor: User,
    event_type: str,
    inspection_case: IqcInspectionCase | None = None,
    note: str = "",
    metadata: dict[str, Any] | None = None,
) -> IqcHistoryEntry:
    return IqcHistoryEntry.objects.create(
        organization_id=organization_id,
        inspection_case=inspection_case,
        event_type=event_type,
        note=(note or "").strip()[:255],
        metadata=metadata or {},
        actor=actor,
    )


def _refresh_traceability(case: IqcInspectionCase) -> IqcInspectionCase:
    case.frozen_traceability_context = build_frozen_iqc_traceability(case)
    case.save(update_fields=["frozen_traceability_context", "updated_at", "workflow_status"])
    return case


def _policy_review_required(organization_id: uuid.UUID) -> bool:
    policy = IqcWorkflowPolicy.objects.filter(organization_id=organization_id).first()
    if policy is None:
        return True
    return bool(policy.review_required)


def _iqc_batch_reference(receipt: ReceiptQualityRecord) -> str:
    return (
        f"IQC:{receipt.erp_receipt_reference}|{receipt.supplier_lot}|"
        f"{receipt.material.erp_material_reference}"
    )


@atomic_fn
def upsert_iqc_workflow_policy(
    *,
    actor: User | None,
    organization: Organization,
    review_required: bool = True,
    erp_outbound_enabled: bool = False,
    procedure_reference: str = "",
    notes: str = "",
) -> IqcWorkflowPolicy:
    user = _require_actor(actor)
    require_permission(user, MANAGE_POLICY, scope=_org_scope(organization.id))
    policy, _ = IqcWorkflowPolicy.objects.update_or_create(
        organization=organization,
        defaults={
            "review_required": bool(review_required),
            "erp_outbound_enabled": bool(erp_outbound_enabled),
            "procedure_reference": (procedure_reference or "").strip()[:255],
            "notes": (notes or "").strip(),
            "updated_by": user,
        },
    )
    record_event(
        event_type="IQC_POLICY_UPDATED",
        actor=user,
        metadata={
            "organization_id": str(organization.id),
            "review_required": policy.review_required,
            "erp_outbound_enabled": policy.erp_outbound_enabled,
        },
    )
    return policy


@atomic_fn
def open_iqc_case_for_receipt(
    *,
    actor: User | None,
    receipt: ReceiptQualityRecord,
    notes: str = "",
) -> IqcInspectionCase:
    user = _require_actor(actor)
    require_permission(user, MANAGE, scope=_org_scope(receipt.organization_id))
    existing = IqcInspectionCase.objects.filter(receipt=receipt).first()
    if existing is not None:
        return existing
    case = IqcInspectionCase(
        organization_id=receipt.organization_id,
        receipt=receipt,
        workflow_status=IqcWorkflowStatus.OPEN,
        review_required=_policy_review_required(receipt.organization_id),
        notes=(notes or "").strip(),
        created_by=user,
    )
    case.full_clean()
    case.save()
    _refresh_traceability(case)
    _history(
        organization_id=receipt.organization_id,
        actor=user,
        event_type="IQC_CASE_OPENED",
        inspection_case=case,
    )
    record_event(
        event_type="IQC_CASE_OPENED",
        actor=user,
        metadata={
            "iqc_case_id": str(case.id),
            "receipt_quality_id": str(receipt.id),
            "supplier_lot": receipt.supplier_lot,
        },
    )
    return case


@atomic_fn
def generate_iqc_task(
    *,
    actor: User | None,
    case: IqcInspectionCase,
    checklist_template: ChecklistTemplate | None = None,
    checklist_version: ChecklistVersion | None = None,
) -> IqcInspectionCase:
    """Create ChecklistTask from receipt-pinned or provided PUBLISHED checklist version."""
    user = _require_actor(actor)
    require_permission(user, MANAGE, scope=_org_scope(case.organization_id))
    receipt = case.receipt
    template = checklist_template or receipt.inspection_checklist_template
    version = checklist_version or receipt.inspection_checklist_version
    if template is None or version is None:
        raise ValidationError(
            {
                "checklist": (
                    "IQC task requires a checklist template and PUBLISHED version "
                    "(no hardcoded inspection questions)."
                )
            }
        )
    if case.checklist_task_id:
        return case

    task = create_batch_checklist_task(
        actor=user,
        organization_id=case.organization_id,
        checklist_template_id=template.id,
        checklist_version_id=version.id,
        batch_reference=_iqc_batch_reference(receipt),
    )
    if receipt.inspection_checklist_template_id is None:
        receipt.inspection_checklist_template = template
        receipt.inspection_checklist_version = version
        receipt.save(
            update_fields=[
                "inspection_checklist_template",
                "inspection_checklist_version",
                "updated_at",
            ]
        )
    case.checklist_task = task
    case.workflow_status = IqcWorkflowStatus.TASK_CREATED
    case.save(update_fields=["checklist_task", "workflow_status", "updated_at"])
    _refresh_traceability(case)
    _history(
        organization_id=case.organization_id,
        actor=user,
        event_type="IQC_TASK_CREATED",
        inspection_case=case,
        metadata={"checklist_task_id": str(task.id)},
    )
    record_event(
        event_type="IQC_TASK_CREATED",
        actor=user,
        metadata={
            "iqc_case_id": str(case.id),
            "checklist_task_id": str(task.id),
            "batch_reference": task.batch_reference,
        },
    )
    return case


@atomic_fn
def resolve_iqc_sampling(
    *,
    actor: User | None,
    case: IqcInspectionCase,
    plan_version: SamplingPlanVersion | None = None,
    inspection_type: str = "INCOMING",
) -> dict[str, Any]:
    """Resolve sample count via Phase 24 engine — no invented AQL tables."""
    user = _require_actor(actor)
    require_permission(user, MANAGE, scope=_org_scope(case.organization_id))
    context = SamplingMatchContext(
        organization_id=case.organization_id,
        lot_size=case.receipt.quantity,
        inspection_type=(inspection_type or "").strip(),
    )
    resolution = resolve_sampling_requirement(context=context, plan_version=plan_version)
    case.sampling_plan_version = plan_version
    case.sampling_snapshot = resolution.as_dict()
    case.save(update_fields=["sampling_plan_version", "sampling_snapshot", "updated_at"])
    _refresh_traceability(case)
    _history(
        organization_id=case.organization_id,
        actor=user,
        event_type="IQC_SAMPLING_RESOLVED",
        inspection_case=case,
        metadata={"reason_code": resolution.reason_code},
    )
    record_event(
        event_type="IQC_SAMPLING_RESOLVED",
        actor=user,
        metadata={
            "iqc_case_id": str(case.id),
            "reason_code": resolution.reason_code,
            "matched": resolution.matched,
            "not_qa_disposition": True,
        },
    )
    return resolution.as_dict()


@atomic_fn
def link_iqc_lab_sample(
    *,
    actor: User | None,
    case: IqcInspectionCase,
    sample_code: str,
    notes: str = "",
) -> dict[str, Any]:
    """Register Phase 22 lab sample against the receipt and refresh traceability."""
    user = _require_actor(actor)
    require_permission(user, MANAGE, scope=_org_scope(case.organization_id))
    sample, link = register_incoming_lab_sample(
        actor=user,
        receipt=case.receipt,
        sample_code=sample_code,
        notes=notes,
    )
    if case.workflow_status in {
        IqcWorkflowStatus.OPEN,
        IqcWorkflowStatus.TASK_CREATED,
    }:
        case.workflow_status = IqcWorkflowStatus.INSPECTION_IN_PROGRESS
        case.save(update_fields=["workflow_status", "updated_at"])
    _refresh_traceability(case)
    record_event(
        event_type="IQC_LAB_SAMPLE_LINKED",
        actor=user,
        metadata={
            "iqc_case_id": str(case.id),
            "lab_sample_id": str(sample.id),
            "receipt_lab_link_id": str(link.id),
        },
    )
    return {
        "lab_sample_id": str(sample.id),
        "receipt_lab_link_id": str(link.id),
        "sample_code": sample.code,
    }


@atomic_fn
def attach_iqc_review(
    *,
    actor: User | None,
    case: IqcInspectionCase,
    checklist_submission: ChecklistSubmission,
    supervisor_review: SupervisorReview,
) -> IqcInspectionCase:
    """Attach inspection submission + supervisor review for disposition gating."""
    user = _require_actor(actor)
    require_permission(user, MANAGE, scope=_org_scope(case.organization_id))
    if checklist_submission.checklist_record.organization_id != case.organization_id:
        raise ValidationError({"checklist_submission": "Submission org mismatch."})
    if supervisor_review.checklist_submission_id != checklist_submission.id:
        raise ValidationError(
            {"supervisor_review": "Review must belong to the inspection submission."}
        )
    if case.checklist_task_id:
        task_id = checklist_submission.checklist_record.checklist_task_id
        if task_id != case.checklist_task_id:
            raise ValidationError(
                {"checklist_submission": "Submission must belong to the IQC checklist task."}
            )
    case.checklist_submission = checklist_submission
    case.supervisor_review = supervisor_review
    case.workflow_status = IqcWorkflowStatus.AWAITING_REVIEW
    if supervisor_review.decision == SupervisorReviewDecision.APPROVED:
        case.workflow_status = IqcWorkflowStatus.AWAITING_REVIEW
    case.save(
        update_fields=[
            "checklist_submission",
            "supervisor_review",
            "workflow_status",
            "updated_at",
        ]
    )
    _refresh_traceability(case)
    _history(
        organization_id=case.organization_id,
        actor=user,
        event_type="IQC_REVIEW_ATTACHED",
        inspection_case=case,
        metadata={
            "supervisor_review_id": str(supervisor_review.id),
            "decision": supervisor_review.decision,
        },
    )
    record_event(
        event_type="IQC_REVIEW_ATTACHED",
        actor=user,
        metadata={
            "iqc_case_id": str(case.id),
            "supervisor_review_id": str(supervisor_review.id),
            "decision": supervisor_review.decision,
        },
    )
    return case


@atomic_fn
def complete_iqc_disposition(
    *,
    actor: User | None,
    case: IqcInspectionCase,
    quality_state: str,
    disposition_notes: str = "",
) -> IqcInspectionCase:
    """
    Apply local receipt quality disposition.

    When review_required, SupervisorReview must be APPROVED.
    Does not update ERP stock.
    """
    user = _require_actor(actor)
    require_permission(user, DISPOSITION, scope=_org_scope(case.organization_id))
    if case.review_required:
        review = case.supervisor_review
        if review is None:
            raise ValidationError(
                {
                    "supervisor_review": (
                        "IQC disposition requires an attached Supervisor review "
                        "(review_required=True)."
                    )
                }
            )
        if review.decision != SupervisorReviewDecision.APPROVED:
            raise ValidationError(
                {"supervisor_review": ("IQC disposition requires Supervisor APPROVED decision.")}
            )
    target = (quality_state or "").strip().upper()
    if target not in {
        ReceiptQualityState.ACCEPTED,
        ReceiptQualityState.HOLD,
        ReceiptQualityState.REJECTED,
    }:
        raise ValidationError(
            {
                "quality_state": (
                    "Disposition must be ACCEPTED, HOLD, or REJECTED "
                    "(local quality only — not ERP stock)."
                )
            }
        )
    receipt = case.receipt
    receipt.quality_state = target
    receipt.disposition_notes = (disposition_notes or "").strip()
    receipt.dispositioned_by = user
    receipt.dispositioned_at = timezone.now()
    frozen = build_frozen_receipt_context(receipt)
    frozen["disposition_local_only"] = True
    frozen["via_iqc_case_id"] = str(case.id)
    receipt.frozen_receipt_context = frozen
    receipt.save()
    case.receipt.refresh_from_db()
    case.workflow_status = IqcWorkflowStatus.DISPOSITIONED
    case.closed_at = timezone.now()
    case.save(update_fields=["workflow_status", "closed_at", "updated_at"])
    _refresh_traceability(case)
    _history(
        organization_id=case.organization_id,
        actor=user,
        event_type="IQC_DISPOSITIONED",
        inspection_case=case,
        metadata={
            "quality_state": case.receipt.quality_state,
            "erp_inventory_not_updated": True,
        },
    )
    record_event(
        event_type="IQC_DISPOSITIONED",
        actor=user,
        metadata={
            "iqc_case_id": str(case.id),
            "quality_state": case.receipt.quality_state,
            "erp_inventory_not_updated": True,
        },
    )
    return case


@atomic_fn
def ingest_incoming_receipt_event(
    *,
    actor: User | None,
    organization: Organization,
    source_system: str,
    source_event_id: str,
    erp_receipt_reference: str,
    supplier_lot: str,
    erp_material_reference: str,
    erp_supplier_reference: str = "",
    quantity: Decimal | None = None,
    uom: str = "",
    checklist_template: ChecklistTemplate | None = None,
    checklist_version: ChecklistVersion | None = None,
    auto_generate_task: bool = True,
    payload: dict[str, Any] | None = None,
) -> tuple[IncomingReceiptEvent, IqcInspectionCase | None, bool]:
    """
    Idempotent ERP receipt/GRN ingest.

    Returns (event, case|None, is_duplicate).
    """
    user = _require_actor(actor)
    require_permission(user, MANAGE, scope=_org_scope(organization.id))
    src = (source_system or "").strip()
    eid = (source_event_id or "").strip()
    if not src or not eid:
        raise ValidationError(
            {"source_event_id": "source_system and source_event_id are required."}
        )

    existing = (
        IncomingReceiptEvent.objects.select_related("receipt", "inspection_case")
        .filter(source_system__iexact=src, source_event_id__iexact=eid)
        .first()
    )
    if existing is not None:
        if existing.status in {
            IncomingReceiptEventStatus.PROCESSED,
            IncomingReceiptEventStatus.DUPLICATE,
        }:
            existing.status = IncomingReceiptEventStatus.DUPLICATE
            existing.save(update_fields=["status"])
            record_event(
                event_type="IQC_RECEIPT_EVENT_DUPLICATE",
                actor=user,
                metadata={
                    "incoming_event_id": str(existing.id),
                    "source_system": src,
                    "source_event_id": eid,
                },
            )
            return existing, existing.inspection_case, True

    event = IncomingReceiptEvent(
        organization=organization,
        source_system=src,
        source_event_id=eid,
        status=IncomingReceiptEventStatus.RECEIVED,
        erp_receipt_reference=(erp_receipt_reference or "").strip()[:128],
        erp_supplier_reference=(erp_supplier_reference or "").strip()[:128],
        supplier_lot=(supplier_lot or "").strip()[:128],
        erp_material_reference=(erp_material_reference or "").strip()[:128],
        quantity=quantity,
        uom=(uom or "").strip()[:32],
        payload=payload or {},
        created_by=user,
    )
    try:
        event.full_clean()
        event.save()
    except IntegrityError:
        # Race: treat as duplicate
        existing = IncomingReceiptEvent.objects.filter(
            source_system__iexact=src, source_event_id__iexact=eid
        ).first()
        if existing is None:
            raise
        return existing, existing.inspection_case, True

    try:
        supplier_ref = event.erp_supplier_reference or f"SUP-{event.erp_receipt_reference}"
        supplier = SupplierQualityProfile.objects.filter(
            organization=organization,
            erp_supplier_reference__iexact=supplier_ref,
        ).first()
        if supplier is None:
            supplier = create_supplier_quality_profile(
                actor=user,
                organization=organization,
                erp_supplier_reference=supplier_ref,
            )
        material = MaterialReference.objects.filter(
            organization=organization,
            erp_material_reference__iexact=event.erp_material_reference,
        ).first()
        if material is None:
            material = create_material_reference(
                actor=user,
                organization=organization,
                erp_material_reference=event.erp_material_reference,
                uom_reference=event.uom,
            )
        try:
            receipt = create_receipt_quality_record(
                actor=user,
                organization=organization,
                erp_receipt_reference=event.erp_receipt_reference,
                supplier_profile=supplier,
                supplier_lot=event.supplier_lot,
                material=material,
                quantity=event.quantity,
                uom=event.uom,
                inspection_checklist_template=checklist_template,
                inspection_checklist_version=checklist_version,
            )
        except ValidationError as exc:
            # Duplicate receipt mapping — reuse existing receipt for case.
            existing_receipt = ReceiptQualityRecord.objects.filter(
                organization=organization,
                erp_receipt_reference__iexact=event.erp_receipt_reference,
                supplier_lot__iexact=event.supplier_lot,
                material=material,
            ).first()
            if existing_receipt is None:
                raise exc
            receipt = existing_receipt

        case = open_iqc_case_for_receipt(actor=user, receipt=receipt)
        if auto_generate_task and (
            checklist_template is not None or receipt.inspection_checklist_version_id
        ):
            case = generate_iqc_task(
                actor=user,
                case=case,
                checklist_template=checklist_template,
                checklist_version=checklist_version,
            )
        event.receipt = receipt
        event.inspection_case = case
        event.status = IncomingReceiptEventStatus.PROCESSED
        event.processed_at = timezone.now()
        event.save(
            update_fields=[
                "receipt",
                "inspection_case",
                "status",
                "processed_at",
            ]
        )
        record_event(
            event_type="IQC_RECEIPT_EVENT_PROCESSED",
            actor=user,
            metadata={
                "incoming_event_id": str(event.id),
                "iqc_case_id": str(case.id),
                "receipt_quality_id": str(receipt.id),
                "supplier_lot": receipt.supplier_lot,
            },
        )
        return event, case, False
    except Exception as exc:  # noqa: BLE001 — persist failure on event
        event.status = IncomingReceiptEventStatus.FAILED
        event.error_message = str(exc)[:512]
        event.save(update_fields=["status", "error_message"])
        raise


def attempt_case_erp_outbound(*, actor: User | None, case: IqcInspectionCase) -> None:
    user = _require_actor(actor)
    org_scope = _org_scope(case.organization_id)
    if not (
        user_has_permission(user, DISPOSITION, scope=org_scope)
        or user_has_permission(user, MANAGE, scope=org_scope)
    ):
        raise PermissionDenied("Permission denied.")
    attempt_iqc_erp_outbound(case=case)
