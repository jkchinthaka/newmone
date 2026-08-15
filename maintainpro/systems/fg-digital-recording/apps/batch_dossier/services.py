"""Electronic batch quality dossier services — Phase 35.

Assembles a read-only aggregated dossier of authorized references for one
opaque batch_reference. Does not copy mutable source rows; uses references and
immutable snapshot excerpts. Completing / viewing a dossier is not FG RELEASE.
"""

from __future__ import annotations

import hashlib
import time
import uuid
from datetime import datetime
from typing import Any

from django.core.exceptions import PermissionDenied, ValidationError
from django.db import transaction
from django.utils import timezone

from apps.access_control.services import Scope, require_permission, user_has_permission
from apps.accounts.models import User
from apps.batch_dossier.assembly import BatchQualityDossier, DossierSectionPage
from apps.batch_dossier.models import (
    BatchDossierExportRequest,
    BatchDossierExportStatus,
    BatchDossierPolicy,
)
from apps.batch_dossier.policy import evaluate_batch_dossier_pdf_export
from apps.batch_dossier.selectors import (
    EVIDENCE_KIND_CAPA,
    EVIDENCE_KIND_IPQC,
    EVIDENCE_KIND_LAB,
    EVIDENCE_KIND_NCR,
    EVIDENCE_KIND_QA,
    EVIDENCE_KIND_SUBMISSION,
    EVIDENCE_KIND_SUPERVISOR,
    audit_events_for_batch,
    capas_for_batch_ncrs,
    corrections_for_batch,
    dispatch_for_batch,
    evidence_for_linked_targets,
    external_batch_events_for_batch,
    holds_for_batch,
    ipqc_cases_for_batch,
    lab_samples_for_batch,
    ncrs_for_batch,
    normalize_batch_reference,
    page_values,
    qa_reviews_for_batch,
    submissions_for_batch,
    submissions_with_device_traces,
    supervisor_reviews_for_batch,
    tasks_for_batch,
)
from apps.core.persistence import lock_queryset
from apps.organizations.models import Organization
from apps.security_audit.services import record_event

VIEW = "batch_dossier.view_batchdossier"
EXPORT = "batch_dossier.export_batchdossier"
MANAGE_POLICY = "batch_dossier.manage_batchdossierpolicy"

PERM_TASK = "scheduling.view_checklisttask"
PERM_SUPERVISOR = "reviews.review_checklistsubmission"
PERM_SUPERVISOR_VIEW = "reviews.view_supervisorreview"
PERM_QA = "quality.qa_review_checklistsubmission"
PERM_IPQC = "ipqc.view_ipqc"
PERM_LAB = "laboratory.view_laboratory"
PERM_NCR = "nonconformance.manage_nonconformance"
PERM_HOLD = "nonconformance.manage_holdcase"
PERM_CAPA = "capa.manage_capa"
PERM_DISPATCH = "dispatch.manage_dispatchqualityrecord"
PERM_EVIDENCE = "evidence.view_evidenceattachment"
PERM_EQUIPMENT = "instruments.view_equipment"
PERM_INTEGRATION = "integrations.view_integrationboundary"

SECTION_LIMIT_DEFAULT = 50
AUDIT_LIMIT_DEFAULT = 25
EVIDENCE_LIMIT_DEFAULT = 25
TIMELINE_LIMIT_DEFAULT = 100


def _require_actor(actor: User | None) -> User:
    if actor is None or not getattr(actor, "is_authenticated", False) or not actor.is_active:
        raise PermissionDenied("Authentication required.")
    return actor


def _org_scope(organization_id: uuid.UUID) -> Scope:
    return Scope(organization_id=organization_id)


def _iso(value: datetime | None) -> str | None:
    return value.isoformat() if value is not None else None


def _denied(key: str, *, limit: int, offset: int, notes: str = "") -> DossierSectionPage:
    return DossierSectionPage(
        key=key,
        access="DENIED",
        items=(),
        total_count=0,
        limit=limit,
        offset=offset,
        has_more=False,
        notes=notes or "Object-level permission denied for this section.",
    )


def _allowed(
    key: str,
    *,
    items: tuple[dict[str, Any], ...],
    total: int,
    limit: int,
    offset: int,
    has_more: bool,
    notes: str = "",
) -> DossierSectionPage:
    access = "EMPTY" if total == 0 else "ALLOWED"
    return DossierSectionPage(
        key=key,
        access=access,
        items=items,
        total_count=total,
        limit=limit,
        offset=offset,
        has_more=has_more,
        notes=notes,
    )


def _can(user: User, permission: str, organization_id: uuid.UUID) -> bool:
    return user_has_permission(user, permission, scope=_org_scope(organization_id))


@transaction.atomic
def upsert_batch_dossier_policy(
    *,
    actor: User | None,
    organization: Organization,
    pdf_export_enabled: bool = False,
    procedure_reference: str = "",
    notes: str = "",
) -> BatchDossierPolicy:
    user = _require_actor(actor)
    require_permission(user, MANAGE_POLICY, scope=_org_scope(organization.id))
    policy, _created = lock_queryset(BatchDossierPolicy.objects.all()).get_or_create(
        organization=organization,
        defaults={
            "pdf_export_enabled": False,
            "procedure_reference": (procedure_reference or "").strip()[:255],
            "notes": (notes or "").strip(),
            "updated_by": user,
        },
    )
    policy.pdf_export_enabled = bool(pdf_export_enabled)
    policy.procedure_reference = (procedure_reference or "").strip()[:255]
    policy.notes = (notes or "").strip()
    policy.updated_by = user
    policy.save()
    record_event(
        event_type="BATCH_DOSSIER_POLICY_UPDATED",
        actor=user,
        metadata={
            "organization_id": str(organization.id),
            "batch_reference": "",
            "pdf_export_enabled": policy.pdf_export_enabled,
            "procedure_reference": policy.procedure_reference,
        },
    )
    return policy


def assemble_batch_quality_dossier(
    *,
    actor: User | None,
    organization: Organization,
    batch_reference: str,
    section_limit: int = SECTION_LIMIT_DEFAULT,
    audit_limit: int = AUDIT_LIMIT_DEFAULT,
    audit_offset: int = 0,
    evidence_limit: int = EVIDENCE_LIMIT_DEFAULT,
    evidence_offset: int = 0,
    timeline_limit: int = TIMELINE_LIMIT_DEFAULT,
) -> BatchQualityDossier:
    """
    Build one read-only batch quality dossier.

    Historical rows come from immutable / final source records (submissions,
    reviews, frozen snapshots). Mutable drafts are not treated as historical truth.
    """
    user = _require_actor(actor)
    require_permission(user, VIEW, scope=_org_scope(organization.id))
    ref = normalize_batch_reference(batch_reference)
    if not ref:
        raise ValidationError({"batch_reference": "Batch reference is required."})

    started = time.perf_counter()
    limit = max(1, min(int(section_limit), 200))
    timeline_cap = max(1, min(int(timeline_limit), 500))
    now = timezone.now()
    org_id = organization.id
    timeline: list[dict[str, Any]] = []
    fingerprint_parts: list[str] = []

    # --- FG checklist tasks / product identity ---
    tasks_qs = tasks_for_batch(organization_id=org_id, batch_reference=ref)
    product_codes: list[str] = []
    production_order_refs: list[str] = []

    if _can(user, PERM_TASK, org_id):
        task_items, task_total, task_more = page_values(
            tasks_qs,
            limit=limit,
            offset=0,
            serializer=lambda t: {
                "id": str(t.id),
                "template_code": t.checklist_template.code,
                "template_name": t.checklist_template.name,
                "version_id": str(t.checklist_version_id),
                "status": t.status,
                "trigger_type": t.trigger_type,
                "due_at": _iso(t.due_at),
                "created_at": _iso(t.created_at),
                "source": "scheduling.ChecklistTask",
                "immutable_row": False,
                "reference_only": True,
            },
        )
        fg_section = _allowed(
            "fg_checklist_tasks",
            items=task_items,
            total=task_total,
            limit=limit,
            offset=0,
            has_more=task_more,
            notes="FG checklist tasks for batch — references only.",
        )
        for t in tasks_qs[:limit]:
            timeline.append(
                {
                    "at": _iso(t.created_at),
                    "kind": "FG_CHECKLIST_TASK",
                    "ref_id": str(t.id),
                    "summary": f"Task {t.checklist_template.code} ({t.status})",
                }
            )
            fingerprint_parts.append(f"task:{t.id}")
    else:
        fg_section = _denied("fg_checklist_tasks", limit=limit, offset=0)

    # --- Submissions (immutable) ---
    if _can(user, PERM_TASK, org_id):
        sub_qs = submissions_for_batch(organization_id=org_id, batch_reference=ref)
        sub_items, sub_total, sub_more = page_values(
            sub_qs,
            limit=limit,
            offset=0,
            serializer=lambda s: {
                "id": str(s.id),
                "submission_number": s.submission_number,
                "record_id": str(s.checklist_record_id),
                "task_id": str(s.checklist_record.checklist_task_id),
                "submitted_by": s.submitted_by.employee_code,
                "submitted_at": _iso(s.submitted_at),
                "source": "recording.ChecklistSubmission",
                "immutable_row": True,
                "reference_only": True,
            },
        )
        submissions_section = _allowed(
            "submissions",
            items=sub_items,
            total=sub_total,
            limit=limit,
            offset=0,
            has_more=sub_more,
            notes="Immutable submissions only — drafts excluded.",
        )
        for s in sub_qs[:limit]:
            timeline.append(
                {
                    "at": _iso(s.submitted_at),
                    "kind": "SUBMISSION",
                    "ref_id": str(s.id),
                    "summary": f"Submission #{s.submission_number}",
                }
            )
            fingerprint_parts.append(f"sub:{s.id}")
        corr_qs = corrections_for_batch(organization_id=org_id, batch_reference=ref)
        corr_items, corr_total, corr_more = page_values(
            corr_qs,
            limit=limit,
            offset=0,
            serializer=lambda c: {
                "id": str(c.id),
                "status": c.status,
                "source_submission_id": str(c.source_submission_id),
                "resulting_submission_id": str(c.resulting_submission_id)
                if c.resulting_submission_id
                else None,
                "started_at": _iso(c.started_at),
                "completed_at": _iso(c.completed_at),
                "source": "recording.ChecklistCorrection",
                "immutable_source_submission": True,
                "reference_only": True,
            },
        )
        corrections_section = _allowed(
            "corrections",
            items=corr_items,
            total=corr_total,
            limit=limit,
            offset=0,
            has_more=corr_more,
            notes="Correction cycles; source submissions remain immutable.",
        )
        for c in corr_qs[:limit]:
            timeline.append(
                {
                    "at": _iso(c.started_at),
                    "kind": "CORRECTION",
                    "ref_id": str(c.id),
                    "summary": f"Correction {c.status}",
                }
            )
            fingerprint_parts.append(f"corr:{c.id}")
    else:
        submissions_section = _denied("submissions", limit=limit, offset=0)
        corrections_section = _denied("corrections", limit=limit, offset=0)

    # --- Supervisor reviews ---
    if _can(user, PERM_SUPERVISOR, org_id) or _can(user, PERM_SUPERVISOR_VIEW, org_id):
        rev_qs = supervisor_reviews_for_batch(organization_id=org_id, batch_reference=ref)
        rev_items, rev_total, rev_more = page_values(
            rev_qs,
            limit=limit,
            offset=0,
            serializer=lambda r: {
                "id": str(r.id),
                "decision": r.decision,
                "submission_id": str(r.checklist_submission_id),
                "reviewed_by": r.reviewed_by.employee_code,
                "reviewed_at": _iso(r.reviewed_at),
                "source": "reviews.SupervisorReview",
                "immutable_row": True,
                "reference_only": True,
            },
        )
        supervisor_section = _allowed(
            "supervisor_reviews",
            items=rev_items,
            total=rev_total,
            limit=limit,
            offset=0,
            has_more=rev_more,
        )
        for r in rev_qs[:limit]:
            timeline.append(
                {
                    "at": _iso(r.reviewed_at),
                    "kind": "SUPERVISOR_REVIEW",
                    "ref_id": str(r.id),
                    "summary": f"Supervisor {r.decision}",
                }
            )
            fingerprint_parts.append(f"srev:{r.id}")
    else:
        supervisor_section = _denied("supervisor_reviews", limit=limit, offset=0)

    # --- QA reviews ---
    if _can(user, PERM_QA, org_id):
        qa_qs = qa_reviews_for_batch(organization_id=org_id, batch_reference=ref)
        qa_items, qa_total, qa_more = page_values(
            qa_qs,
            limit=limit,
            offset=0,
            serializer=lambda r: {
                "id": str(r.id),
                "decision": r.decision,
                "submission_id": str(r.checklist_submission_id),
                "reviewed_by": r.reviewed_by.employee_code,
                "reviewed_at": _iso(r.reviewed_at),
                "source": "quality.QAReview",
                "immutable_row": True,
                "reference_only": True,
                "not_dossier_as_fg_release": True,
            },
        )
        qa_section = _allowed(
            "qa_reviews",
            items=qa_items,
            total=qa_total,
            limit=limit,
            offset=0,
            has_more=qa_more,
            notes="QA review references — dossier view is not a release action.",
        )
        for qa_review in qa_qs[:limit]:
            timeline.append(
                {
                    "at": _iso(qa_review.reviewed_at),
                    "kind": "QA_REVIEW",
                    "ref_id": str(qa_review.id),
                    "summary": f"QA {r.decision}",
                }
            )
            fingerprint_parts.append(f"qa:{qa_review.id}")
    else:
        qa_section = _denied("qa_reviews", limit=limit, offset=0)

    # --- IPQC ---
    if _can(user, PERM_IPQC, org_id):
        ipqc_qs = ipqc_cases_for_batch(organization_id=org_id, batch_reference=ref)
        ipqc_items, ipqc_total, ipqc_more = page_values(
            ipqc_qs,
            limit=limit,
            offset=0,
            serializer=lambda c: {
                "id": str(c.id),
                "definition_code": c.definition.code,
                "workflow_status": c.workflow_status,
                "failure_detected": c.failure_detected,
                "product_code": c.product.code if c.product_id else "",
                "production_line_code": c.production_line_code,
                "process_step_code": c.process_step_code,
                "production_order_reference": c.production_order_reference,
                "equipment_id": str(c.equipment_id) if c.equipment_id else None,
                "measurement_snapshot": c.measurement_snapshot or {},
                "equipment_trace_snapshot": c.equipment_trace_snapshot or {},
                "frozen_process_context": c.frozen_process_context or {},
                "created_at": _iso(c.created_at),
                "source": "ipqc.IpqcInspectionCase",
                "reference_only": True,
            },
        )
        ipqc_section = _allowed(
            "ipqc",
            items=ipqc_items,
            total=ipqc_total,
            limit=limit,
            offset=0,
            has_more=ipqc_more,
        )
        for ipqc_case in ipqc_qs[:limit]:
            product = ipqc_case.product
            if ipqc_case.product_id and product is not None and product.code not in product_codes:
                product_codes.append(product.code)
            if (
                ipqc_case.production_order_reference
                and ipqc_case.production_order_reference not in production_order_refs
            ):
                production_order_refs.append(ipqc_case.production_order_reference)
            timeline.append(
                {
                    "at": _iso(ipqc_case.created_at),
                    "kind": "IPQC",
                    "ref_id": str(ipqc_case.id),
                    "summary": f"IPQC {ipqc_case.definition.code} ({ipqc_case.workflow_status})",
                }
            )
            fingerprint_parts.append(f"ipqc:{ipqc_case.id}")
    else:
        ipqc_section = _denied("ipqc", limit=limit, offset=0)

    # --- Lab ---
    if _can(user, PERM_LAB, org_id):
        lab_qs = lab_samples_for_batch(organization_id=org_id, batch_reference=ref)
        lab_items, lab_total, lab_more = page_values(
            lab_qs,
            limit=limit,
            offset=0,
            serializer=lambda s: {
                "id": str(s.id),
                "code": s.code,
                "status": s.status,
                "product_id": str(s.product_id) if s.product_id else None,
                "registered_at": _iso(s.registered_at),
                "result_count": sum(len(t.results.all()) for t in s.tests.all()),
                "source": "laboratory.LabSample",
                "reference_only": True,
            },
        )
        lab_section = _allowed(
            "lab_results",
            items=lab_items,
            total=lab_total,
            limit=limit,
            offset=0,
            has_more=lab_more,
            notes="Lab sample / result references — no invented disposition.",
        )
        for lab_sample in lab_qs[:limit]:
            timeline.append(
                {
                    "at": _iso(lab_sample.registered_at),
                    "kind": "LAB_SAMPLE",
                    "ref_id": str(lab_sample.id),
                    "summary": f"Lab sample {lab_sample.code}",
                }
            )
            fingerprint_parts.append(f"lab:{lab_sample.id}")
    else:
        lab_section = _denied("lab_results", limit=limit, offset=0)

    # --- Equipment / calibration (from immutable submission device traces + IPQC) ---
    equipment_items: list[dict[str, Any]] = []
    if _can(user, PERM_EQUIPMENT, org_id) or _can(user, PERM_TASK, org_id):
        seen_eq: set[str] = set()
        for sub in submissions_with_device_traces(organization_id=org_id, batch_reference=ref)[
            :limit
        ]:
            for resp in sub.responses.all():
                if resp.equipment_id is None and not resp.device_trace_context:
                    continue
                key = str(resp.equipment_id or resp.id)
                if key in seen_eq:
                    continue
                seen_eq.add(key)
                equipment_items.append(
                    {
                        "equipment_id": str(resp.equipment_id) if resp.equipment_id else None,
                        "calibration_record_id": str(resp.calibration_record_id)
                        if resp.calibration_record_id
                        else None,
                        "submission_id": str(sub.id),
                        "device_trace_context": resp.device_trace_context or {},
                        "measurement_recorded_at": _iso(resp.measurement_recorded_at),
                        "source": "recording.ChecklistSubmissionResponse",
                        "immutable_snapshot": True,
                        "reference_only": True,
                    }
                )
                fingerprint_parts.append(f"eq:{key}")
        if _can(user, PERM_IPQC, org_id):
            for ipqc_equipment_case in ipqc_cases_for_batch(
                organization_id=org_id, batch_reference=ref
            )[:limit]:
                if (
                    not ipqc_equipment_case.equipment_id
                    and not ipqc_equipment_case.equipment_trace_snapshot
                ):
                    continue
                key = f"ipqc-eq:{ipqc_equipment_case.id}"
                if key in seen_eq:
                    continue
                seen_eq.add(key)
                equipment_items.append(
                    {
                        "equipment_id": str(ipqc_equipment_case.equipment_id)
                        if ipqc_equipment_case.equipment_id
                        else None,
                        "ipqc_case_id": str(ipqc_equipment_case.id),
                        "equipment_trace_snapshot": ipqc_equipment_case.equipment_trace_snapshot
                        or {},
                        "source": "ipqc.IpqcInspectionCase",
                        "immutable_snapshot": True,
                        "reference_only": True,
                    }
                )
        equipment_section = _allowed(
            "equipment_calibration",
            items=tuple(equipment_items[:limit]),
            total=len(equipment_items),
            limit=limit,
            offset=0,
            has_more=len(equipment_items) > limit,
            notes="Device/calibration references from immutable snapshots.",
        )
    else:
        equipment_section = _denied("equipment_calibration", limit=limit, offset=0)

    # --- NCR / HOLD ---
    ncr_ids: list[uuid.UUID] = []
    if _can(user, PERM_NCR, org_id):
        ncr_qs = ncrs_for_batch(organization_id=org_id, batch_reference=ref)
        ncr_items, ncr_total, ncr_more = page_values(
            ncr_qs,
            limit=limit,
            offset=0,
            serializer=lambda n: {
                "id": str(n.id),
                "code": n.code,
                "status": n.status,
                "title": n.title,
                "created_at": _iso(n.created_at),
                "source": "nonconformance.NonConformanceRecord",
                "reference_only": True,
            },
        )
        ncr_ids = list(ncr_qs.values_list("id", flat=True)[:500])
        for n in ncr_qs[:limit]:
            timeline.append(
                {
                    "at": _iso(n.created_at),
                    "kind": "NCR",
                    "ref_id": str(n.id),
                    "summary": f"NCR {n.code}",
                }
            )
            fingerprint_parts.append(f"ncr:{n.id}")
    else:
        ncr_items, ncr_total, ncr_more = (), 0, False

    if _can(user, PERM_HOLD, org_id):
        hold_qs = holds_for_batch(organization_id=org_id, batch_reference=ref)
        hold_items, hold_total, hold_more = page_values(
            hold_qs,
            limit=limit,
            offset=0,
            serializer=lambda h: {
                "id": str(h.id),
                "code": h.code,
                "status": h.status,
                "opened_at": _iso(h.opened_at),
                "source": "nonconformance.HoldCase",
                "reference_only": True,
            },
        )
        for h in hold_qs[:limit]:
            timeline.append(
                {
                    "at": _iso(h.opened_at),
                    "kind": "HOLD",
                    "ref_id": str(h.id),
                    "summary": f"HOLD {h.code}",
                }
            )
            fingerprint_parts.append(f"hold:{h.id}")
    else:
        hold_items, hold_total, hold_more = (), 0, False

    if _can(user, PERM_NCR, org_id):
        ncr_section = _allowed(
            "ncr",
            items=ncr_items,
            total=ncr_total,
            limit=limit,
            offset=0,
            has_more=ncr_more,
        )
    else:
        ncr_section = _denied("ncr", limit=limit, offset=0)

    if _can(user, PERM_HOLD, org_id):
        hold_section = _allowed(
            "hold",
            items=hold_items,
            total=hold_total,
            limit=limit,
            offset=0,
            has_more=hold_more,
        )
    else:
        hold_section = _denied("hold", limit=limit, offset=0)

    # Combined view used only for evidence target collection
    if ncr_section.access != "DENIED" or hold_section.access != "DENIED":
        ncr_hold_section = _allowed(
            "ncr_hold",
            items=tuple(list(ncr_section.items) + list(hold_section.items))[:limit],
            total=ncr_section.total_count + hold_section.total_count,
            limit=limit,
            offset=0,
            has_more=False,
        )
    else:
        ncr_hold_section = _denied("ncr_hold", limit=limit, offset=0)

    # --- CAPA ---
    if _can(user, PERM_CAPA, org_id):
        capa_qs = capas_for_batch_ncrs(organization_id=org_id, ncr_ids=ncr_ids)
        if not _can(user, PERM_NCR, org_id):
            # Without NCR access, do not infer CAPA via foreign NCR ids.
            capa_qs = capas_for_batch_ncrs(organization_id=org_id, ncr_ids=[])
        capa_items, capa_total, capa_more = page_values(
            capa_qs,
            limit=limit,
            offset=0,
            serializer=lambda c: {
                "id": str(c.id),
                "code": c.code,
                "status": c.status,
                "nonconformance_id": str(c.nonconformance_id) if c.nonconformance_id else None,
                "created_at": _iso(c.created_at),
                "source": "capa.CorrectiveAction",
                "reference_only": True,
            },
        )
        capa_section = _allowed(
            "capa",
            items=capa_items,
            total=capa_total,
            limit=limit,
            offset=0,
            has_more=capa_more,
        )
        for capa_action in capa_qs[:limit]:
            timeline.append(
                {
                    "at": _iso(capa_action.created_at),
                    "kind": "CAPA",
                    "ref_id": str(capa_action.id),
                    "summary": f"CAPA {capa_action.code}",
                }
            )
            fingerprint_parts.append(f"capa:{capa_action.id}")
    else:
        capa_section = _denied("capa", limit=limit, offset=0)

    # --- Loading / dispatch ---
    if _can(user, PERM_DISPATCH, org_id):
        disp_qs = dispatch_for_batch(organization_id=org_id, batch_reference=ref)
        disp_items, disp_total, disp_more = page_values(
            disp_qs,
            limit=limit,
            offset=0,
            serializer=lambda d: {
                "id": str(d.id),
                "code": d.code,
                "status": d.status,
                "created_at": _iso(d.created_at),
                "completed_at": _iso(d.completed_at),
                "source": "dispatch.DispatchQualityRecord",
                "reference_only": True,
            },
        )
        dispatch_section = _allowed(
            "loading_dispatch",
            items=disp_items,
            total=disp_total,
            limit=limit,
            offset=0,
            has_more=disp_more,
        )
        for d in disp_qs[:limit]:
            timeline.append(
                {
                    "at": _iso(d.created_at),
                    "kind": "DISPATCH",
                    "ref_id": str(d.id),
                    "summary": f"Dispatch {d.code}",
                }
            )
            fingerprint_parts.append(f"disp:{d.id}")
    else:
        dispatch_section = _denied("loading_dispatch", limit=limit, offset=0)

    # --- Integration / production reference ---
    if _can(user, PERM_INTEGRATION, org_id) or _can(user, PERM_TASK, org_id):
        evt_qs = external_batch_events_for_batch(organization_id=org_id, batch_reference=ref)
        evt_items, evt_total, evt_more = page_values(
            evt_qs,
            limit=limit,
            offset=0,
            serializer=lambda e: {
                "id": str(e.id),
                "external_batch_id": e.external_batch_id,
                "status": e.status,
                "created_at": _iso(e.created_at),
                "source": "scheduling.ExternalBatchEvent",
                "reference_only": True,
            },
        )
        integration_section = _allowed(
            "integration_status",
            items=evt_items,
            total=evt_total,
            limit=limit,
            offset=0,
            has_more=evt_more,
            notes="Inbound batch-event adapter status — no ERP write implied.",
        )
        for e in evt_qs[:limit]:
            timeline.append(
                {
                    "at": _iso(e.created_at),
                    "kind": "EXTERNAL_BATCH_EVENT",
                    "ref_id": str(e.id),
                    "summary": f"External batch event ({e.status})",
                }
            )
            fingerprint_parts.append(f"evt:{e.id}")
    else:
        integration_section = _denied("integration_status", limit=limit, offset=0)

    production_section = _allowed(
        "production_reference",
        items=tuple(
            {"kind": "PRODUCTION_ORDER", "reference": r, "reference_only": True}
            for r in production_order_refs[:limit]
        )
        + tuple(
            [
                {
                    "kind": "EXTERNAL_BATCH_ID",
                    "reference": ref,
                    "event_count": integration_section.total_count
                    if integration_section.access != "DENIED"
                    else 0,
                    "reference_only": True,
                }
            ],
        ),
        total=len(production_order_refs) + 1,
        limit=limit,
        offset=0,
        has_more=False,
        notes="Opaque production / batch references only — no invented batch master.",
    )

    # --- Evidence (paginated) ---
    if _can(user, PERM_EVIDENCE, org_id):
        targets: list[tuple[str, uuid.UUID]] = []
        if submissions_section.access == "ALLOWED":
            for item in submissions_section.items:
                targets.append((EVIDENCE_KIND_SUBMISSION, uuid.UUID(item["id"])))
        if supervisor_section.access == "ALLOWED":
            for item in supervisor_section.items:
                targets.append((EVIDENCE_KIND_SUPERVISOR, uuid.UUID(item["id"])))
        if qa_section.access == "ALLOWED":
            for item in qa_section.items:
                targets.append((EVIDENCE_KIND_QA, uuid.UUID(item["id"])))
        if ncr_hold_section.access == "ALLOWED":
            for item in ncr_hold_section.items:
                if item.get("source", "").endswith("NonConformanceRecord"):
                    targets.append((EVIDENCE_KIND_NCR, uuid.UUID(item["id"])))
        if capa_section.access == "ALLOWED":
            for item in capa_section.items:
                targets.append((EVIDENCE_KIND_CAPA, uuid.UUID(item["id"])))
        if lab_section.access == "ALLOWED":
            for item in lab_section.items:
                targets.append((EVIDENCE_KIND_LAB, uuid.UUID(item["id"])))
        if ipqc_section.access == "ALLOWED":
            for item in ipqc_section.items:
                targets.append((EVIDENCE_KIND_IPQC, uuid.UUID(item["id"])))
        ev_qs = evidence_for_linked_targets(organization_id=org_id, targets=targets)
        ev_limit = max(1, min(int(evidence_limit), 200))
        ev_offset = max(0, int(evidence_offset))
        ev_items, ev_total, ev_more = page_values(
            ev_qs,
            limit=ev_limit,
            offset=ev_offset,
            serializer=lambda a: {
                "id": str(a.id),
                "linked_kind": a.linked_kind,
                "linked_object_id": str(a.linked_object_id),
                "storage_key": a.storage_key,
                "original_filename": a.original_filename,
                "lifecycle_status": a.lifecycle_status,
                "created_at": _iso(a.uploaded_at),
                "source": "evidence.EvidenceAttachment",
                "binary_not_included": True,
                "reference_only": True,
            },
        )
        evidence_section = _allowed(
            "evidence",
            items=ev_items,
            total=ev_total,
            limit=ev_limit,
            offset=ev_offset,
            has_more=ev_more,
            notes="Paginated evidence metadata — binaries stay in object storage.",
        )
        for a in ev_qs[ev_offset : ev_offset + ev_limit]:
            timeline.append(
                {
                    "at": _iso(a.uploaded_at),
                    "kind": "EVIDENCE",
                    "ref_id": str(a.id),
                    "summary": f"Evidence {a.linked_kind}",
                }
            )
            fingerprint_parts.append(f"ev:{a.id}")
    else:
        evidence_section = _denied("evidence", limit=evidence_limit, offset=evidence_offset)

    # --- Audit references (paginated) ---
    audit_qs = audit_events_for_batch(batch_reference=ref, organization_id=org_id)
    a_limit = max(1, min(int(audit_limit), 200))
    a_offset = max(0, int(audit_offset))
    audit_items, audit_total, audit_more = page_values(
        audit_qs,
        limit=a_limit,
        offset=a_offset,
        serializer=lambda e: {
            "id": str(e.id),
            "event_type": e.event_type,
            "actor_id": str(e.actor_id) if e.actor_id else None,
            "created_at": _iso(e.created_at),
            "metadata_keys": sorted((e.metadata or {}).keys()),
            "source": "security_audit.SecurityAuditEvent",
            "reference_only": True,
        },
    )
    audit_section = _allowed(
        "audit_references",
        items=audit_items,
        total=audit_total,
        limit=a_limit,
        offset=a_offset,
        has_more=audit_more,
        notes="Paginated audit references keyed by metadata.batch_reference.",
    )

    timeline_sorted = sorted(
        [t for t in timeline if t.get("at")],
        key=lambda row: row["at"] or "",
    )[:timeline_cap]

    export_decision = evaluate_batch_dossier_pdf_export(organization_id=org_id)
    fingerprint = hashlib.sha256("|".join(sorted(fingerprint_parts)).encode("utf-8")).hexdigest()[
        :32
    ]

    identity = {
        "organization_id": str(org_id),
        "organization_code": organization.code,
        "batch_reference": ref,
        "product_codes": product_codes,
        "production_order_references": production_order_refs,
        "task_count": fg_section.total_count if fg_section.access != "DENIED" else None,
        "source_of_truth": "opaque_batch_reference_across_domain_tables",
        "no_production_batch_master": True,
    }

    sections = {
        "identity": {
            "key": "identity",
            "access": "ALLOWED",
            "items": [identity],
            "total_count": 1,
            "limit": 1,
            "offset": 0,
            "has_more": False,
            "notes": "Batch identity shell — references only.",
        },
        "production_reference": production_section.as_dict(),
        "ipqc": ipqc_section.as_dict(),
        "fg_checklist_tasks": fg_section.as_dict(),
        "submissions": submissions_section.as_dict(),
        "corrections": corrections_section.as_dict(),
        "supervisor_reviews": supervisor_section.as_dict(),
        "qa_reviews": qa_section.as_dict(),
        "lab_results": lab_section.as_dict(),
        "equipment_calibration": equipment_section.as_dict(),
        "ncr": ncr_section.as_dict(),
        "hold": hold_section.as_dict(),
        "capa": capa_section.as_dict(),
        "loading_dispatch": dispatch_section.as_dict(),
        "evidence": evidence_section.as_dict(),
        "integration_status": integration_section.as_dict(),
        "audit_references": audit_section.as_dict(),
    }

    elapsed_ms = int((time.perf_counter() - started) * 1000)
    dossier = BatchQualityDossier(
        organization_id=str(org_id),
        batch_reference=ref,
        assembled_at=now,
        identity=identity,
        sections=sections,
        timeline=tuple(timeline_sorted),
        export_hook={
            **export_decision.as_dict(),
            "dossier_fingerprint": fingerprint,
            "pdf_content": None,
            "prepare_via": "prepare_batch_dossier_pdf_export",
        },
        performance={
            "elapsed_ms": elapsed_ms,
            "section_limit": limit,
            "timeline_count": len(timeline_sorted),
            "timeline_capped": len(timeline) > timeline_cap,
            "n_plus_one_avoided": True,
            "unbounded_retrieval_avoided": True,
            "avoid_unbounded_retrieval": True,
        },
    )

    record_event(
        event_type="BATCH_DOSSIER_VIEWED",
        actor=user,
        metadata={
            "organization_id": str(org_id),
            "batch_reference": ref,
            "dossier_fingerprint": fingerprint,
            "elapsed_ms": elapsed_ms,
            "section_keys": sorted(sections.keys()),
        },
    )
    return dossier


build_batch_quality_dossier = assemble_batch_quality_dossier


@transaction.atomic
def prepare_batch_dossier_pdf_export(
    *,
    actor: User | None,
    organization: Organization,
    batch_reference: str,
    procedure_reference: str = "",
) -> BatchDossierExportRequest:
    """
    Controlled PDF evidence-pack export hook.

    Does not generate PDF bytes in Phase 35. Dual-gate default OFF (APR-060).
    """
    user = _require_actor(actor)
    require_permission(user, EXPORT, scope=_org_scope(organization.id))
    ref = normalize_batch_reference(batch_reference)
    if not ref:
        raise ValidationError({"batch_reference": "Batch reference is required."})

    # Assemble under view permission path (export implies view for fingerprint).
    if not _can(user, VIEW, organization.id):
        raise PermissionDenied("view_batchdossier required to prepare export.")

    dossier = assemble_batch_quality_dossier(
        actor=user,
        organization=organization,
        batch_reference=ref,
        section_limit=25,
        audit_limit=10,
        evidence_limit=10,
        timeline_limit=50,
    )
    decision = evaluate_batch_dossier_pdf_export(organization_id=organization.id)
    fingerprint = str(dossier.export_hook.get("dossier_fingerprint") or "")
    if decision.allowed:
        status = BatchDossierExportStatus.PREPARED
        event_type = "BATCH_DOSSIER_EXPORT_PREPARED"
        reason = decision.reason_code
    else:
        status = BatchDossierExportStatus.BLOCKED
        event_type = "BATCH_DOSSIER_EXPORT_BLOCKED"
        reason = decision.reason_code

    request_row = BatchDossierExportRequest.objects.create(
        organization=organization,
        batch_reference=ref,
        status=status,
        reason_code=reason,
        procedure_reference=(
            (procedure_reference or decision.procedure_reference or "").strip()[:255]
        ),
        dossier_fingerprint=fingerprint,
        metadata={
            "pdf_not_generated": True,
            "section_counts": {k: v.get("total_count") for k, v in dossier.sections.items()},
            "decision": decision.as_dict(),
        },
        requested_by=user,
    )
    record_event(
        event_type=event_type,
        actor=user,
        metadata={
            "organization_id": str(organization.id),
            "batch_reference": ref,
            "export_request_id": str(request_row.id),
            "status": status,
            "reason_code": reason,
            "dossier_fingerprint": fingerprint,
        },
    )
    return request_row
