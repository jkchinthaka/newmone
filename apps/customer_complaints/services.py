"""Customer quality complaint services — Phase 39 (ADR-050 / APR-064).

ERP customer master remains identity SoR. Category/severity are configurable
references only. Communication shells never auto-send. Customer-sensitive
labels require view_complaint_customer_sensitive.
"""

from __future__ import annotations

import uuid
from datetime import datetime
from typing import Any

from django.core.exceptions import PermissionDenied, ValidationError
from django.utils import timezone

from apps.access_control.services import Scope, require_permission, user_has_permission
from apps.accounts.models import User
from apps.capa.services import create_corrective_action
from apps.core.persistence import atomic_fn, lock_queryset
from apps.customer_complaints.models import (
    COMPLAINT_STATUS_TRANSITIONS,
    ComplaintCaseStatus,
    ComplaintInvestigationLinkKind,
    CustomerComplaintBatchTrace,
    CustomerComplaintCase,
    CustomerComplaintCategoryConfig,
    CustomerComplaintCommunication,
    CustomerComplaintEvidenceLink,
    CustomerComplaintInvestigationLink,
    CustomerComplaintPolicy,
    CustomerComplaintTimelineEntry,
)
from apps.customer_complaints.policy import evaluate_complaint_customer_response
from apps.customer_complaints.selectors import get_complaint_case, timeline_for_case
from apps.nonconformance.models import NonConformanceSource
from apps.nonconformance.services import create_nonconformance
from apps.organizations.models import Organization
from apps.security_audit.services import record_event

VIEW = "customer_complaints.view_customercomplaint"
CREATE = "customer_complaints.create_customercomplaint"
MANAGE = "customer_complaints.manage_customercomplaint"
CLOSE = "customer_complaints.close_customercomplaint"
VIEW_SENSITIVE = "customer_complaints.view_complaint_customer_sensitive"
RECORD_COMM = "customer_complaints.record_complaint_communication"
MANAGE_POLICY = "customer_complaints.manage_complaintpolicy"


def _require_actor(actor: User | None) -> User:
    if actor is None or not getattr(actor, "is_authenticated", False) or not actor.is_active:
        raise PermissionDenied("Authentication required.")
    return actor


def _org_scope(organization_id: uuid.UUID) -> Scope:
    return Scope(organization_id=organization_id)


def _append_timeline(
    *,
    case: CustomerComplaintCase,
    actor: User | None,
    event_type: str,
    summary: str,
    payload: dict[str, Any] | None = None,
) -> CustomerComplaintTimelineEntry:
    return CustomerComplaintTimelineEntry.objects.create(
        complaint_case=case,
        event_type=event_type,
        summary=(summary or "")[:512],
        payload=dict(payload or {}),
        actor=actor,
    )


def _transition(case: CustomerComplaintCase, new_status: str) -> None:
    allowed = COMPLAINT_STATUS_TRANSITIONS.get(case.status, frozenset())
    if new_status not in allowed:
        raise ValidationError({"status": f"Cannot transition from {case.status} to {new_status}."})
    case.status = new_status


def can_view_customer_sensitive(user: User | None, *, organization_id: uuid.UUID) -> bool:
    if user is None:
        return False
    return user_has_permission(user, VIEW_SENSITIVE, scope=_org_scope(organization_id))


@atomic_fn
def upsert_complaint_policy(
    *,
    actor: User | None,
    organization: Organization,
    customer_response_auto_send_enabled: bool = False,
    procedure_reference: str = "",
    notes: str = "",
) -> CustomerComplaintPolicy:
    user = _require_actor(actor)
    require_permission(user, MANAGE_POLICY, scope=_org_scope(organization.id))
    policy, _ = lock_queryset(CustomerComplaintPolicy.objects.all()).get_or_create(
        organization=organization,
        defaults={
            "updated_by": user,
            "customer_response_auto_send_enabled": False,
        },
    )
    policy.customer_response_auto_send_enabled = bool(customer_response_auto_send_enabled)
    policy.procedure_reference = (procedure_reference or "").strip()[:255]
    policy.notes = (notes or "").strip()
    policy.updated_by = user
    policy.save()
    record_event(
        event_type="COMPLAINT_POLICY_UPDATED",
        actor=user,
        metadata={
            "organization_id": str(organization.id),
            "customer_response_auto_send_enabled": policy.customer_response_auto_send_enabled,
        },
    )
    return policy


@atomic_fn
def upsert_category_config(
    *,
    actor: User | None,
    organization: Organization,
    kind: str,
    code: str,
    label: str,
    is_active: bool = True,
    notes: str = "",
) -> CustomerComplaintCategoryConfig:
    """Owner-configured category/severity shell — never a seeded Nelna taxonomy."""
    user = _require_actor(actor)
    require_permission(user, MANAGE_POLICY, scope=_org_scope(organization.id))
    kind_norm = (kind or "").strip().upper()
    if kind_norm not in {"CATEGORY", "SEVERITY"}:
        raise ValidationError({"kind": "kind must be CATEGORY or SEVERITY."})
    code_norm = (code or "").strip()
    label_norm = (label or "").strip()
    if not code_norm or not label_norm:
        raise ValidationError({"code": "code and label are required."})
    row, created = CustomerComplaintCategoryConfig.objects.get_or_create(
        organization=organization,
        kind=kind_norm,
        code=code_norm,
        defaults={
            "label": label_norm[:255],
            "is_active": is_active,
            "notes": (notes or "").strip(),
            "updated_by": user,
        },
    )
    if not created:
        row.label = label_norm[:255]
        row.is_active = is_active
        row.notes = (notes or "").strip()
        row.updated_by = user
        row.save()
    record_event(
        event_type="COMPLAINT_CATEGORY_CONFIG_UPSERTED",
        actor=user,
        metadata={
            "organization_id": str(organization.id),
            "kind": kind_norm,
            "code": code_norm,
            "created": created,
        },
    )
    return row


@atomic_fn
def create_complaint_case(
    *,
    actor: User | None,
    organization: Organization,
    code: str,
    description: str,
    received_at: datetime | None = None,
    channel_reference: str = "",
    erp_customer_reference: str = "",
    customer_display_label: str = "",
    product_reference: str = "",
    batch_reference: str = "",
    category_reference: str = "",
    severity_reference: str = "",
    owner: User | None = None,
    open_immediately: bool = True,
) -> CustomerComplaintCase:
    user = _require_actor(actor)
    require_permission(user, CREATE, scope=_org_scope(organization.id))
    case = CustomerComplaintCase(
        organization=organization,
        code=(code or "").strip(),
        received_at=received_at or timezone.now(),
        channel_reference=(channel_reference or "").strip()[:128],
        erp_customer_reference=(erp_customer_reference or "").strip()[:128],
        customer_display_label=(customer_display_label or "").strip()[:128],
        product_reference=(product_reference or "").strip()[:128],
        batch_reference=(batch_reference or "").strip()[:128],
        description=(description or "").strip(),
        category_reference=(category_reference or "").strip()[:128],
        severity_reference=(severity_reference or "").strip()[:128],
        owner=owner or user,
        created_by=user,
        status=(ComplaintCaseStatus.OPEN if open_immediately else ComplaintCaseStatus.DRAFT),
        metadata={
            "erp_customer_master_is_sor": True,
            "no_invented_category_taxonomy": True,
            "minimize_customer_pii": True,
        },
    )
    case.full_clean()
    case.save()
    _append_timeline(
        case=case,
        actor=user,
        event_type="COMPLAINT_CREATED",
        summary=f"Complaint {case.code} created ({case.status})",
        payload={
            "batch_known": case.batch_known,
            "batch_reference": case.batch_reference,
            "open_immediately": bool(open_immediately),
        },
    )
    record_event(
        event_type="COMPLAINT_CASE_CREATED",
        actor=user,
        metadata={
            "organization_id": str(organization.id),
            "complaint_case_id": str(case.id),
            "code": case.code,
            "batch_known": case.batch_known,
        },
    )
    return case


@atomic_fn
def open_complaint_case(
    *, actor: User | None, organization: Organization, case_id: uuid.UUID
) -> CustomerComplaintCase:
    user = _require_actor(actor)
    require_permission(user, MANAGE, scope=_org_scope(organization.id))
    case = get_complaint_case(organization_id=organization.id, case_id=case_id)
    if case is None:
        raise ValidationError({"case_id": "Complaint case not found."})
    _transition(case, ComplaintCaseStatus.OPEN)
    case.save(update_fields=["status", "updated_at"])
    _append_timeline(
        case=case,
        actor=user,
        event_type="COMPLAINT_OPENED",
        summary=f"Complaint {case.code} opened",
    )
    record_event(
        event_type="COMPLAINT_CASE_OPENED",
        actor=user,
        metadata={
            "organization_id": str(organization.id),
            "complaint_case_id": str(case.id),
        },
    )
    return case


@atomic_fn
def set_complaint_batch_reference(
    *,
    actor: User | None,
    organization: Organization,
    case_id: uuid.UUID,
    batch_reference: str,
) -> CustomerComplaintCase:
    """Confirm or clear batch — empty means batch unknown (not invented)."""
    user = _require_actor(actor)
    require_permission(user, MANAGE, scope=_org_scope(organization.id))
    case = get_complaint_case(organization_id=organization.id, case_id=case_id)
    if case is None:
        raise ValidationError({"case_id": "Complaint case not found."})
    if case.status in {ComplaintCaseStatus.CLOSED, ComplaintCaseStatus.CANCELLED}:
        raise ValidationError({"status": "Cannot update a closed/cancelled complaint."})
    batch = (batch_reference or "").strip()[:128]
    case.batch_reference = batch
    case.batch_known = bool(batch)
    case.full_clean()
    case.save(update_fields=["batch_reference", "batch_known", "updated_at"])
    _append_timeline(
        case=case,
        actor=user,
        event_type="COMPLAINT_BATCH_SET",
        summary=(f"Batch set to {batch}" if batch else "Batch cleared (unknown)"),
        payload={"batch_known": case.batch_known, "batch_reference": batch},
    )
    record_event(
        event_type="COMPLAINT_BATCH_UPDATED",
        actor=user,
        metadata={
            "organization_id": str(organization.id),
            "complaint_case_id": str(case.id),
            "batch_known": case.batch_known,
        },
    )
    return case


@atomic_fn
def upsert_batch_trace(
    *,
    actor: User | None,
    organization: Organization,
    case_id: uuid.UUID,
    batch_reference: str | None = None,
    dossier_batch_reference: str | None = None,
    genealogy_node_id: uuid.UUID | None = None,
    qa_disposition_reference: str | None = None,
    qa_review_id: uuid.UUID | None = None,
    lab_sample_id: uuid.UUID | None = None,
    lab_sample_reference: str | None = None,
    dispatch_record_id: uuid.UUID | None = None,
    dispatch_reference: str | None = None,
    notes: str | None = None,
) -> CustomerComplaintBatchTrace:
    """
    Link complaint to dossier / genealogy / QA disposition / lab / dispatch shells.

    Does not assemble dossier or invent genealogy — stores opaque references only.
    """
    user = _require_actor(actor)
    require_permission(user, MANAGE, scope=_org_scope(organization.id))
    case = get_complaint_case(organization_id=organization.id, case_id=case_id)
    if case is None:
        raise ValidationError({"case_id": "Complaint case not found."})
    if case.status in {ComplaintCaseStatus.CLOSED, ComplaintCaseStatus.CANCELLED}:
        raise ValidationError({"status": "Cannot update a closed/cancelled complaint."})

    # Do not invent batch identity for unknown complaints.
    if batch_reference is not None and not (batch_reference or "").strip():
        if not case.batch_known:
            raise ValidationError(
                {
                    "batch_reference": (
                        "Batch reference required to link dossier/genealogy/"
                        "QA/lab/dispatch when batch is unknown."
                    )
                }
            )

    trace, _ = CustomerComplaintBatchTrace.objects.get_or_create(
        complaint_case=case,
        defaults={"updated_by": user},
    )
    if batch_reference is not None:
        trace.batch_reference = batch_reference.strip()[:128]
        if trace.batch_reference and not case.batch_known:
            case.batch_reference = trace.batch_reference
            case.batch_known = True
            case.save(update_fields=["batch_reference", "batch_known", "updated_at"])
    elif case.batch_reference and not trace.batch_reference:
        trace.batch_reference = case.batch_reference
    if dossier_batch_reference is not None:
        trace.dossier_batch_reference = dossier_batch_reference.strip()[:128]
    elif trace.batch_reference and not trace.dossier_batch_reference:
        trace.dossier_batch_reference = trace.batch_reference
    if genealogy_node_id is not None:
        trace.genealogy_node_id = genealogy_node_id
    if qa_disposition_reference is not None:
        trace.qa_disposition_reference = qa_disposition_reference.strip()[:128]
    if qa_review_id is not None:
        trace.qa_review_id = qa_review_id
    if lab_sample_id is not None:
        trace.lab_sample_id = lab_sample_id
    if lab_sample_reference is not None:
        trace.lab_sample_reference = lab_sample_reference.strip()[:128]
    if dispatch_record_id is not None:
        trace.dispatch_record_id = dispatch_record_id
    if dispatch_reference is not None:
        trace.dispatch_reference = dispatch_reference.strip()[:128]
    if notes is not None:
        trace.notes = notes.strip()
    trace.updated_by = user
    trace.save()

    if case.status == ComplaintCaseStatus.OPEN:
        _transition(case, ComplaintCaseStatus.INVESTIGATING)
        case.save(update_fields=["status", "updated_at"])

    _append_timeline(
        case=case,
        actor=user,
        event_type="COMPLAINT_BATCH_TRACE_UPDATED",
        summary=f"Batch trace updated for {case.code}",
        payload={
            "batch_reference": trace.batch_reference,
            "genealogy_node_id": (
                str(trace.genealogy_node_id) if trace.genealogy_node_id else None
            ),
            "qa_review_id": str(trace.qa_review_id) if trace.qa_review_id else None,
            "lab_sample_id": str(trace.lab_sample_id) if trace.lab_sample_id else None,
            "dispatch_record_id": (
                str(trace.dispatch_record_id) if trace.dispatch_record_id else None
            ),
        },
    )
    record_event(
        event_type="COMPLAINT_BATCH_TRACE_UPDATED",
        actor=user,
        metadata={
            "organization_id": str(organization.id),
            "complaint_case_id": str(case.id),
            "batch_known": case.batch_known,
        },
    )
    return trace


@atomic_fn
def link_complaint_evidence(
    *,
    actor: User | None,
    organization: Organization,
    case_id: uuid.UUID,
    evidence_attachment_id: uuid.UUID,
    notes: str = "",
) -> CustomerComplaintEvidenceLink:
    user = _require_actor(actor)
    require_permission(user, MANAGE, scope=_org_scope(organization.id))
    case = get_complaint_case(organization_id=organization.id, case_id=case_id)
    if case is None:
        raise ValidationError({"case_id": "Complaint case not found."})
    link, created = CustomerComplaintEvidenceLink.objects.get_or_create(
        complaint_case=case,
        evidence_attachment_id=evidence_attachment_id,
        defaults={
            "notes": (notes or "").strip()[:512],
            "linked_by": user,
        },
    )
    if not created and notes:
        link.notes = notes.strip()[:512]
        link.save(update_fields=["notes"])
    _append_timeline(
        case=case,
        actor=user,
        event_type="COMPLAINT_EVIDENCE_LINKED",
        summary="Evidence attachment linked to complaint",
        payload={
            "evidence_attachment_id": str(evidence_attachment_id),
            "created": created,
        },
    )
    record_event(
        event_type="COMPLAINT_EVIDENCE_LINKED",
        actor=user,
        metadata={
            "organization_id": str(organization.id),
            "complaint_case_id": str(case.id),
            "evidence_attachment_id": str(evidence_attachment_id),
        },
    )
    return link


@atomic_fn
def record_investigation_link(
    *,
    actor: User | None,
    organization: Organization,
    case_id: uuid.UUID,
    link_kind: str,
    reference: str = "",
    notes: str = "",
    explicit_user_action: bool = False,
    create_quality_case: bool = False,
    ncr_code: str = "",
    ncr_title: str = "",
    capa_code: str = "",
    capa_title: str = "",
    nonconformance_id: uuid.UUID | None = None,
) -> CustomerComplaintInvestigationLink:
    """
    Record investigation / RCA / NCR / CAPA link.

    Opening NCR/CAPA requires explicit_user_action + create_quality_case and
    the corresponding quality permissions.
    """
    user = _require_actor(actor)
    require_permission(user, MANAGE, scope=_org_scope(organization.id))
    if not explicit_user_action:
        raise ValidationError(
            {"explicit_user_action": ("Investigation links require explicit_user_action=True.")}
        )
    case = get_complaint_case(organization_id=organization.id, case_id=case_id)
    if case is None:
        raise ValidationError({"case_id": "Complaint case not found."})

    kind = (link_kind or "").strip().upper()
    if kind not in {c.value for c in ComplaintInvestigationLinkKind}:
        raise ValidationError({"link_kind": "link_kind must be INVESTIGATION, RCA, NCR, or CAPA."})

    ncr_id = None
    capa_id = None
    ref = (reference or "").strip()[:128]

    if kind in {
        ComplaintInvestigationLinkKind.INVESTIGATION,
        ComplaintInvestigationLinkKind.RCA,
    }:
        if not ref:
            raise ValidationError({"reference": f"{kind} links require an opaque reference."})
    elif create_quality_case:
        if kind == ComplaintInvestigationLinkKind.NCR:
            ncr = create_nonconformance(
                actor=user,
                organization=organization,
                code=ncr_code or f"NCR-CC-{uuid.uuid4().hex[:8].upper()}",
                title=ncr_title or f"Complaint {case.code}",
                summary=notes or case.description[:500],
                source=NonConformanceSource.OTHER,
                batch_reference=case.batch_reference,
            )
            ncr_id = ncr.id
            ref = ref or ncr.code
        elif kind == ComplaintInvestigationLinkKind.CAPA:
            capa = create_corrective_action(
                actor=user,
                organization=organization,
                code=capa_code or f"CAPA-CC-{uuid.uuid4().hex[:8].upper()}",
                title=capa_title or f"Complaint {case.code}",
                summary=notes or case.description[:500],
                nonconformance_id=nonconformance_id,
            )
            capa_id = capa.id
            ref = ref or capa.code

    link = CustomerComplaintInvestigationLink(
        complaint_case=case,
        link_kind=kind,
        reference=ref,
        nonconformance_id=ncr_id,
        corrective_action_id=capa_id,
        notes=(notes or "").strip(),
        explicit_user_action=True,
        created_by=user,
    )
    link.full_clean()
    link.save()

    if case.status == ComplaintCaseStatus.OPEN:
        _transition(case, ComplaintCaseStatus.INVESTIGATING)
        case.save(update_fields=["status", "updated_at"])

    _append_timeline(
        case=case,
        actor=user,
        event_type="COMPLAINT_INVESTIGATION_LINKED",
        summary=f"{kind} linked to complaint {case.code}",
        payload={
            "link_id": str(link.id),
            "link_kind": kind,
            "nonconformance_id": str(ncr_id) if ncr_id else None,
            "corrective_action_id": str(capa_id) if capa_id else None,
            "explicit_user_action": True,
            "create_quality_case": bool(create_quality_case),
        },
    )
    record_event(
        event_type="COMPLAINT_INVESTIGATION_LINKED",
        actor=user,
        metadata={
            "organization_id": str(organization.id),
            "complaint_case_id": str(case.id),
            "link_kind": kind,
            "nonconformance_id": str(ncr_id) if ncr_id else None,
            "corrective_action_id": str(capa_id) if capa_id else None,
            "explicit_user_action": True,
        },
    )
    return link


@atomic_fn
def record_complaint_communication(
    *,
    actor: User | None,
    organization: Organization,
    case_id: uuid.UUID,
    reference: str,
    channel_reference: str = "",
    audience_reference: str = "",
    evidence_attachment_id: uuid.UUID | None = None,
    notes: str = "",
) -> CustomerComplaintCommunication:
    """Store communication reference only — never auto-sends."""
    user = _require_actor(actor)
    require_permission(user, RECORD_COMM, scope=_org_scope(organization.id))
    case = get_complaint_case(organization_id=organization.id, case_id=case_id)
    if case is None:
        raise ValidationError({"case_id": "Complaint case not found."})
    ref = (reference or "").strip()
    if not ref:
        raise ValidationError({"reference": "Communication reference is required."})
    row = CustomerComplaintCommunication.objects.create(
        complaint_case=case,
        reference=ref[:128],
        channel_reference=(channel_reference or "").strip()[:128],
        audience_reference=(audience_reference or "").strip()[:128],
        evidence_attachment_id=evidence_attachment_id,
        notes=(notes or "").strip(),
        recorded_by=user,
    )
    if case.status in {
        ComplaintCaseStatus.OPEN,
        ComplaintCaseStatus.INVESTIGATING,
    }:
        _transition(case, ComplaintCaseStatus.PENDING_RESPONSE)
        case.save(update_fields=["status", "updated_at"])
    _append_timeline(
        case=case,
        actor=user,
        event_type="COMPLAINT_COMMUNICATION_RECORDED",
        summary=f"Communication reference {ref} recorded (no auto-send)",
        payload={"reference": ref, "auto_send": False},
    )
    record_event(
        event_type="COMPLAINT_COMMUNICATION_RECORDED",
        actor=user,
        metadata={
            "organization_id": str(organization.id),
            "complaint_case_id": str(case.id),
            "communication_id": str(row.id),
            "auto_send": False,
        },
    )
    return row


def attempt_customer_response_send(
    *,
    actor: User | None,
    organization: Organization,
    case_id: uuid.UUID,
) -> dict[str, Any]:
    """Dual-gated OFF — prepare-only; never sends customer responses in Phase 39."""
    user = _require_actor(actor)
    require_permission(user, RECORD_COMM, scope=_org_scope(organization.id))
    case = get_complaint_case(organization_id=organization.id, case_id=case_id)
    if case is None:
        raise ValidationError({"case_id": "Complaint case not found."})
    decision = evaluate_complaint_customer_response(organization_id=organization.id)
    payload = {
        **decision.as_dict(),
        "message_not_sent": True,
        "complaint_case_id": str(case.id),
    }
    record_event(
        event_type=(
            "COMPLAINT_CUSTOMER_RESPONSE_PREPARED"
            if decision.allowed
            else "COMPLAINT_CUSTOMER_RESPONSE_BLOCKED"
        ),
        actor=user,
        metadata={
            "organization_id": str(organization.id),
            "complaint_case_id": str(case.id),
            **payload,
        },
    )
    _append_timeline(
        case=case,
        actor=user,
        event_type="CUSTOMER_RESPONSE_GATE",
        summary=(
            "Customer response prepared (no send)"
            if decision.allowed
            else f"Customer response blocked ({decision.reason_code})"
        ),
        payload=payload,
    )
    return payload


@atomic_fn
def close_complaint_case(
    *,
    actor: User | None,
    organization: Organization,
    case_id: uuid.UUID,
    closure_notes: str = "",
) -> CustomerComplaintCase:
    user = _require_actor(actor)
    require_permission(user, CLOSE, scope=_org_scope(organization.id))
    case = get_complaint_case(organization_id=organization.id, case_id=case_id)
    if case is None:
        raise ValidationError({"case_id": "Complaint case not found."})
    if case.status == ComplaintCaseStatus.CLOSED:
        return case
    if case.status == ComplaintCaseStatus.DRAFT:
        raise ValidationError({"status": "Open the complaint before closure."})
    if case.status == ComplaintCaseStatus.CANCELLED:
        raise ValidationError({"status": "Cancelled complaints cannot be closed."})
    _transition(case, ComplaintCaseStatus.CLOSED)
    case.closed_by = user
    case.closed_at = timezone.now()
    case.closure_notes = (closure_notes or "").strip()
    case.save(
        update_fields=[
            "status",
            "closed_by",
            "closed_at",
            "closure_notes",
            "updated_at",
        ]
    )
    _append_timeline(
        case=case,
        actor=user,
        event_type="COMPLAINT_CLOSED",
        summary=f"Complaint {case.code} closed",
    )
    record_event(
        event_type="COMPLAINT_CASE_CLOSED",
        actor=user,
        metadata={
            "organization_id": str(organization.id),
            "complaint_case_id": str(case.id),
            "code": case.code,
        },
    )
    return case


def serialize_complaint_case(
    case: CustomerComplaintCase,
    *,
    viewer: User | None = None,
) -> dict[str, Any]:
    """Serialize with privacy redaction for customer-sensitive fields."""
    reveal = False
    if viewer is not None:
        reveal = can_view_customer_sensitive(viewer, organization_id=case.organization_id)
    customer_label = case.customer_display_label if reveal else ""
    erp_ref = case.erp_customer_reference
    if not reveal and erp_ref:
        erp_ref_out = f"ERP-REF-REDACTED:{erp_ref[:4]}…" if len(erp_ref) > 4 else "ERP-REF-REDACTED"
    else:
        erp_ref_out = erp_ref

    trace = getattr(case, "batch_trace", None)
    return {
        "id": str(case.id),
        "code": case.code,
        "received_at": case.received_at.isoformat() if case.received_at else None,
        "channel_reference": case.channel_reference,
        "erp_customer_reference": erp_ref_out,
        "customer_display_label": customer_label,
        "customer_sensitive_redacted": not reveal,
        "product_reference": case.product_reference,
        "batch_reference": case.batch_reference,
        "batch_known": case.batch_known,
        "description": case.description,
        "category_reference": case.category_reference,
        "severity_reference": case.severity_reference,
        "status": case.status,
        "owner_id": str(case.owner_id) if case.owner_id else None,
        "closed_at": case.closed_at.isoformat() if case.closed_at else None,
        "closure_notes": case.closure_notes,
        "evidence_links": [
            {
                "id": str(e.id),
                "evidence_attachment_id": str(e.evidence_attachment_id),
                "notes": e.notes,
            }
            for e in case.evidence_links.all()
        ],
        "batch_trace": (
            {
                "batch_reference": trace.batch_reference,
                "dossier_batch_reference": trace.dossier_batch_reference,
                "genealogy_node_id": (
                    str(trace.genealogy_node_id) if trace.genealogy_node_id else None
                ),
                "qa_disposition_reference": trace.qa_disposition_reference,
                "qa_review_id": str(trace.qa_review_id) if trace.qa_review_id else None,
                "lab_sample_id": str(trace.lab_sample_id) if trace.lab_sample_id else None,
                "lab_sample_reference": trace.lab_sample_reference,
                "dispatch_record_id": (
                    str(trace.dispatch_record_id) if trace.dispatch_record_id else None
                ),
                "dispatch_reference": trace.dispatch_reference,
                "notes": trace.notes,
            }
            if trace is not None
            else None
        ),
        "investigation_links": [
            {
                "id": str(link.id),
                "link_kind": link.link_kind,
                "reference": link.reference,
                "nonconformance_id": (
                    str(link.nonconformance_id) if link.nonconformance_id else None
                ),
                "corrective_action_id": (
                    str(link.corrective_action_id) if link.corrective_action_id else None
                ),
                "explicit_user_action": link.explicit_user_action,
            }
            for link in case.investigation_links.all()
        ],
        "communications": [
            {
                "id": str(c.id),
                "reference": c.reference,
                "channel_reference": c.channel_reference,
                "auto_send": False,
            }
            for c in case.communications.all()
        ],
        "no_invented_category_taxonomy": True,
        "erp_customer_master_is_sor": True,
        "evidence_gate": "APR-064 / company complaint handling policy",
    }


def get_complaint_timeline(
    *,
    actor: User | None,
    organization: Organization,
    case_id: uuid.UUID,
) -> list[dict[str, Any]]:
    user = _require_actor(actor)
    require_permission(user, VIEW, scope=_org_scope(organization.id))
    case = get_complaint_case(organization_id=organization.id, case_id=case_id)
    if case is None:
        raise ValidationError({"case_id": "Complaint case not found."})
    return [
        {
            "id": str(e.id),
            "event_type": e.event_type,
            "summary": e.summary,
            "payload": e.payload,
            "actor_id": str(e.actor_id) if e.actor_id else None,
            "created_at": e.created_at.isoformat(),
            "immutable": True,
        }
        for e in timeline_for_case(case_id=case.id)
    ]
