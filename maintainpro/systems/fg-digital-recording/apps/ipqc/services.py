"""IPQC workflow services — Phase 34.

Process checks during production (configurable checklists), separate from FG release.
Failed IPQC does not stop the line unless dual-gated policy says so.
NCR/HOLD escalation is controlled and never automatic from FAIL alone.
"""

from __future__ import annotations

import uuid
from datetime import datetime, timedelta
from decimal import Decimal
from typing import Any

from django.core.exceptions import PermissionDenied, ValidationError
from django.db import IntegrityError
from django.utils import timezone

from apps.core.persistence.transactions import atomic_fn
from apps.access_control.services import Scope, require_permission, user_has_permission
from apps.accounts.models import User
from apps.checklists.models import (
    ChecklistEvaluationResult,
    ChecklistTemplate,
    ChecklistVersion,
    ChecklistVersionStatus,
)
from apps.haccp.models import ProcessStep
from apps.instruments.device_traceability import (
    apply_calibration_policy,
    assess_device_eligibility,
    build_device_trace_snapshot,
)
from apps.instruments.models import Equipment
from apps.ipqc.models import (
    IpqcHistoryEntry,
    IpqcInspectionCase,
    IpqcProcessCheckDefinition,
    IpqcTriggerKind,
    IpqcWorkflowPolicy,
    IpqcWorkflowStatus,
)
from apps.ipqc.policy import evaluate_ipqc_fail_stop_policy
from apps.ipqc.snapshots import build_frozen_ipqc_process_context
from apps.master_data.models import FGProduct, SpecificationParameter
from apps.master_data.specification_evaluation import evaluate_specification_parameter
from apps.nonconformance.models import NonConformanceSource
from apps.nonconformance.services import create_hold_case, create_nonconformance
from apps.organizations.models import Organization, Shift
from apps.recording.models import ChecklistSubmission
from apps.sampling.engine import SamplingMatchContext, resolve_sampling_requirement
from apps.sampling.models import SamplingPlanVersion
from apps.scheduling.models import ChecklistSchedule, ChecklistTriggerType
from apps.scheduling.services import create_batch_checklist_task
from apps.security_audit.services import record_event

MANAGE = "ipqc.manage_ipqc"
RECORD = "ipqc.record_ipqc"
ESCALATE = "ipqc.escalate_ipqc"
VIEW = "ipqc.view_ipqc"
MANAGE_POLICY = "ipqc.manage_ipqcpolicy"

_TERMINAL = {
    IpqcWorkflowStatus.COMPLETED,
    IpqcWorkflowStatus.CLOSED,
}


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
    inspection_case: IpqcInspectionCase | None = None,
    note: str = "",
    metadata: dict[str, Any] | None = None,
) -> IpqcHistoryEntry:
    return IpqcHistoryEntry.objects.create(
        organization_id=organization_id,
        inspection_case=inspection_case,
        event_type=event_type,
        note=(note or "").strip()[:255],
        metadata=metadata or {},
        actor=actor,
    )


def _refresh_context(case: IpqcInspectionCase) -> IpqcInspectionCase:
    case.frozen_process_context = build_frozen_ipqc_process_context(case)
    case.save(update_fields=["frozen_process_context", "updated_at", "workflow_status"])
    return case


def _assert_not_terminal(case: IpqcInspectionCase) -> None:
    if case.workflow_status in _TERMINAL:
        raise ValidationError({"workflow_status": "IPQC case is already closed/completed."})


def _resolve_published_version(
    *,
    template: ChecklistTemplate,
    version: ChecklistVersion | None,
) -> ChecklistVersion:
    if version is not None:
        if version.template_id != template.id:
            raise ValidationError({"checklist_version": "Version does not belong to template."})
        if version.status != ChecklistVersionStatus.PUBLISHED:
            raise ValidationError(
                {"checklist_version": "IPQC requires a PUBLISHED checklist version."}
            )
        return version
    published = (
        ChecklistVersion.objects.filter(
            template=template,
            status=ChecklistVersionStatus.PUBLISHED,
        )
        .order_by("-version_number")
        .first()
    )
    if published is None:
        raise ValidationError(
            {
                "checklist": (
                    "IPQC requires a PUBLISHED checklist version "
                    "(no hardcoded inspection questions)."
                )
            }
        )
    return published


def _ipqc_batch_reference(case: IpqcInspectionCase) -> str:
    parts = [
        "IPQC",
        case.definition.code,
        case.occurrence_key[:80],
    ]
    if case.batch_reference:
        parts.append(case.batch_reference)
    return "|".join(parts)[:128]


@atomic_fn
def upsert_ipqc_workflow_policy(
    *,
    actor: User | None,
    organization: Organization,
    stop_production_on_fail_enabled: bool = False,
    procedure_reference: str = "",
    notes: str = "",
) -> IpqcWorkflowPolicy:
    user = _require_actor(actor)
    require_permission(user, MANAGE_POLICY, scope=_org_scope(organization.id))
    policy, _ = IpqcWorkflowPolicy.objects.update_or_create(
        organization=organization,
        defaults={
            "stop_production_on_fail_enabled": bool(stop_production_on_fail_enabled),
            "procedure_reference": (procedure_reference or "").strip()[:255],
            "notes": (notes or "").strip(),
            "updated_by": user,
        },
    )
    record_event(
        event_type="IPQC_POLICY_UPDATED",
        actor=user,
        metadata={
            "organization_id": str(organization.id),
            "stop_production_on_fail_enabled": policy.stop_production_on_fail_enabled,
        },
    )
    return policy


@atomic_fn
def create_ipqc_process_check_definition(
    *,
    actor: User | None,
    organization: Organization,
    code: str,
    name: str,
    checklist_template: ChecklistTemplate,
    checklist_version: ChecklistVersion | None = None,
    trigger_kind: str = IpqcTriggerKind.MANUAL,
    interval_minutes: int | None = None,
    due_grace_minutes: int | None = None,
    product: FGProduct | None = None,
    production_line_code: str = "",
    process_step_code: str = "",
    process_step: ProcessStep | None = None,
    shift: Shift | None = None,
    checklist_schedule: ChecklistSchedule | None = None,
    notes: str = "",
) -> IpqcProcessCheckDefinition:
    user = _require_actor(actor)
    require_permission(user, MANAGE, scope=_org_scope(organization.id))
    if checklist_template.organization_id != organization.id:
        raise ValidationError({"checklist_template": "Template must belong to organization."})
    if trigger_kind not in IpqcTriggerKind.values:
        raise ValidationError({"trigger_kind": "Unknown IPQC trigger kind."})
    if product is not None and product.organization_id != organization.id:
        raise ValidationError({"product": "Product must belong to organization."})
    if shift is not None and shift.organization_id != organization.id:
        raise ValidationError({"shift": "Shift must belong to organization."})
    if checklist_version is not None:
        _resolve_published_version(template=checklist_template, version=checklist_version)

    definition = IpqcProcessCheckDefinition(
        organization=organization,
        code=(code or "").strip(),
        name=(name or "").strip(),
        checklist_template=checklist_template,
        checklist_version=checklist_version,
        trigger_kind=trigger_kind,
        interval_minutes=interval_minutes,
        due_grace_minutes=due_grace_minutes,
        product=product,
        production_line_code=(production_line_code or "").strip()[:64],
        process_step_code=(process_step_code or "").strip()[:64],
        process_step=process_step,
        shift=shift,
        checklist_schedule=checklist_schedule,
        notes=(notes or "").strip(),
        created_by=user,
    )
    try:
        definition.full_clean()
        definition.save()
    except IntegrityError as exc:
        raise ValidationError({"code": "IPQC definition code already exists."}) from exc

    record_event(
        event_type="IPQC_DEFINITION_CREATED",
        actor=user,
        metadata={
            "definition_id": str(definition.id),
            "organization_id": str(organization.id),
            "code": definition.code,
            "trigger_kind": definition.trigger_kind,
        },
    )
    return definition


def _build_occurrence_key(
    *,
    definition: IpqcProcessCheckDefinition,
    trigger_kind: str,
    as_of: datetime,
    batch_reference: str = "",
    production_order_reference: str = "",
    manual_token: str = "",
) -> str:
    base = f"IPQC:{definition.id}:{trigger_kind}"
    if trigger_kind == IpqcTriggerKind.BATCH:
        return f"{base}:BATCH:{(batch_reference or '').strip().upper()}"
    if trigger_kind == IpqcTriggerKind.PRODUCTION_ORDER:
        return f"{base}:PO:{(production_order_reference or '').strip().upper()}"
    if trigger_kind == IpqcTriggerKind.MANUAL:
        token = (manual_token or "").strip() or as_of.strftime("%Y%m%d%H%M%S")
        return f"{base}:MANUAL:{token}"
    if trigger_kind == IpqcTriggerKind.SHIFT:
        shift_part = str(definition.shift_id or "NOSHIFT")
        day = as_of.date().isoformat()
        return f"{base}:SHIFT:{shift_part}:{day}"
    # TIME_INTERVAL — bucket by interval window
    interval = definition.interval_minutes or 60
    epoch = int(as_of.timestamp())
    window = epoch // (interval * 60)
    return f"{base}:INTERVAL:{interval}:{window}"


@atomic_fn
def generate_ipqc_case(
    *,
    actor: User | None,
    definition: IpqcProcessCheckDefinition,
    trigger_kind: str | None = None,
    as_of: datetime | None = None,
    batch_reference: str = "",
    production_order_reference: str = "",
    manual_token: str = "",
    product: FGProduct | None = None,
    production_line_code: str = "",
    process_step_code: str = "",
    process_step: ProcessStep | None = None,
    shift: Shift | None = None,
    due_at: datetime | None = None,
    auto_generate_task: bool = True,
    notes: str = "",
) -> tuple[IpqcInspectionCase, bool]:
    """
    Create (or return existing) IPQC case for a trigger occurrence.

    Returns (case, created). Idempotent on (organization, occurrence_key).
    """
    user = _require_actor(actor)
    require_permission(user, MANAGE, scope=_org_scope(definition.organization_id))
    if not definition.is_active:
        raise ValidationError({"definition": "IPQC definition is inactive."})

    instant = as_of or timezone.now()
    kind = trigger_kind or definition.trigger_kind
    if kind not in IpqcTriggerKind.values:
        raise ValidationError({"trigger_kind": "Unknown IPQC trigger kind."})

    occurrence_key = _build_occurrence_key(
        definition=definition,
        trigger_kind=kind,
        as_of=instant,
        batch_reference=batch_reference,
        production_order_reference=production_order_reference,
        manual_token=manual_token,
    )
    existing = IpqcInspectionCase.objects.filter(
        organization_id=definition.organization_id,
        occurrence_key=occurrence_key,
    ).first()
    if existing is not None:
        record_event(
            event_type="IPQC_CASE_DUPLICATE",
            actor=user,
            metadata={
                "ipqc_case_id": str(existing.id),
                "occurrence_key": occurrence_key,
            },
        )
        return existing, False

    resolved_product = product or definition.product
    resolved_shift = shift or definition.shift
    resolved_step = process_step or definition.process_step
    line = (production_line_code or definition.production_line_code or "").strip()[:64]
    step_code = (
        process_step_code
        or definition.process_step_code
        or (resolved_step.code if resolved_step else "")
    ).strip()[:64]

    resolved_due = due_at
    if resolved_due is None and definition.interval_minutes:
        grace = definition.due_grace_minutes or 0
        resolved_due = instant + timedelta(minutes=definition.interval_minutes + grace)
    elif resolved_due is None and kind == IpqcTriggerKind.SHIFT and resolved_shift is not None:
        # Due end-of-day shell — company shift due rules remain EVIDENCE REQUIRED.
        resolved_due = instant + timedelta(hours=8)

    case = IpqcInspectionCase(
        organization_id=definition.organization_id,
        definition=definition,
        occurrence_key=occurrence_key[:255],
        trigger_kind=kind,
        workflow_status=IpqcWorkflowStatus.OPEN,
        product=resolved_product,
        production_line_code=line,
        process_step_code=step_code,
        process_step=resolved_step,
        shift=resolved_shift,
        batch_reference=(batch_reference or "").strip()[:128],
        production_order_reference=(production_order_reference or "").strip()[:128],
        window_start_at=instant,
        due_at=resolved_due,
        notes=(notes or "").strip(),
        created_by=user,
    )
    try:
        case.full_clean()
        case.save()
    except IntegrityError:
        existing = IpqcInspectionCase.objects.get(
            organization_id=definition.organization_id,
            occurrence_key=occurrence_key[:255],
        )
        return existing, False

    _refresh_context(case)
    _history(
        organization_id=definition.organization_id,
        actor=user,
        event_type="IPQC_CASE_OPENED",
        inspection_case=case,
        metadata={"trigger_kind": kind, "occurrence_key": occurrence_key},
    )
    record_event(
        event_type="IPQC_CASE_OPENED",
        actor=user,
        metadata={
            "ipqc_case_id": str(case.id),
            "definition_id": str(definition.id),
            "trigger_kind": kind,
            "occurrence_key": occurrence_key,
        },
    )

    if auto_generate_task:
        case = generate_ipqc_task(actor=user, case=case)

    return case, True


@atomic_fn
def generate_scheduled_ipqc_cases(
    *,
    actor: User | None,
    organization: Organization,
    as_of: datetime | None = None,
) -> list[IpqcInspectionCase]:
    """
    Generate IPQC cases for active TIME_INTERVAL / SHIFT definitions.

    Company frequencies remain EVIDENCE REQUIRED — this only materializes shells.
    """
    user = _require_actor(actor)
    require_permission(user, MANAGE, scope=_org_scope(organization.id))
    instant = as_of or timezone.now()
    created: list[IpqcInspectionCase] = []
    defs = IpqcProcessCheckDefinition.objects.filter(
        organization=organization,
        is_active=True,
        trigger_kind__in=[IpqcTriggerKind.TIME_INTERVAL, IpqcTriggerKind.SHIFT],
    )
    for definition in defs:
        case, was_created = generate_ipqc_case(
            actor=user,
            definition=definition,
            as_of=instant,
            auto_generate_task=True,
        )
        if was_created:
            created.append(case)
    record_event(
        event_type="IPQC_SCHEDULED_GENERATION_RUN",
        actor=user,
        metadata={
            "organization_id": str(organization.id),
            "created_count": len(created),
            "as_of": instant.isoformat(),
        },
    )
    return created


@atomic_fn
def generate_ipqc_task(
    *,
    actor: User | None,
    case: IpqcInspectionCase,
    checklist_template: ChecklistTemplate | None = None,
    checklist_version: ChecklistVersion | None = None,
) -> IpqcInspectionCase:
    user = _require_actor(actor)
    require_permission(user, MANAGE, scope=_org_scope(case.organization_id))
    _assert_not_terminal(case)
    if case.checklist_task_id is not None:
        return case

    definition = case.definition
    template = checklist_template or definition.checklist_template
    version = checklist_version or definition.checklist_version
    version = _resolve_published_version(template=template, version=version)

    task = create_batch_checklist_task(
        actor=user,
        organization_id=case.organization_id,
        checklist_template_id=template.id,
        checklist_version_id=version.id,
        batch_reference=_ipqc_batch_reference(case),
    )
    case.checklist_task = task
    case.workflow_status = IpqcWorkflowStatus.TASK_CREATED
    case.save(update_fields=["checklist_task", "workflow_status", "updated_at"])
    _refresh_context(case)
    _history(
        organization_id=case.organization_id,
        actor=user,
        event_type="IPQC_TASK_CREATED",
        inspection_case=case,
        metadata={"checklist_task_id": str(task.id)},
    )
    record_event(
        event_type="IPQC_TASK_CREATED",
        actor=user,
        metadata={
            "ipqc_case_id": str(case.id),
            "checklist_task_id": str(task.id),
            "trigger_type": ChecklistTriggerType.BATCH,
        },
    )
    return case


@atomic_fn
def attach_ipqc_equipment_trace(
    *,
    actor: User | None,
    case: IpqcInspectionCase,
    equipment: Equipment,
) -> IpqcInspectionCase:
    user = _require_actor(actor)
    if not (
        user_has_permission(user, RECORD, scope=_org_scope(case.organization_id))
        or user_has_permission(user, MANAGE, scope=_org_scope(case.organization_id))
    ):
        raise PermissionDenied("Permission denied.")
    _assert_not_terminal(case)
    if equipment.organization_id != case.organization_id:
        raise ValidationError({"equipment": "Equipment must belong to the organization."})

    eligibility = assess_device_eligibility(
        equipment=equipment,
        organization_id=case.organization_id,
    )
    policy = apply_calibration_policy(eligibility=eligibility)
    snapshot = build_device_trace_snapshot(
        equipment=equipment,
        calibration_record=eligibility.calibration_record,
        fitness=eligibility.fitness,
        policy=policy,
    )
    case.equipment = equipment
    case.equipment_trace_snapshot = {
        **snapshot,
        "eligibility": eligibility.as_dict(),
        "not_qa_disposition": True,
    }
    if case.workflow_status in {IpqcWorkflowStatus.OPEN, IpqcWorkflowStatus.TASK_CREATED}:
        case.workflow_status = IpqcWorkflowStatus.IN_PROGRESS
    case.save(
        update_fields=[
            "equipment",
            "equipment_trace_snapshot",
            "workflow_status",
            "updated_at",
        ]
    )
    _refresh_context(case)
    record_event(
        event_type="IPQC_EQUIPMENT_LINKED",
        actor=user,
        metadata={
            "ipqc_case_id": str(case.id),
            "equipment_id": str(equipment.id),
            "eligible": eligibility.eligible,
        },
    )
    return case


@atomic_fn
def record_ipqc_measurement(
    *,
    actor: User | None,
    case: IpqcInspectionCase,
    parameter: SpecificationParameter,
    value: Decimal | None,
) -> dict[str, Any]:
    """
    Deterministic ProductSpecification evaluation.

    OUT_OF_SPEC ≠ HOLD/REJECT; IN_SPEC ≠ FG RELEASE.
    """
    user = _require_actor(actor)
    if not (
        user_has_permission(user, RECORD, scope=_org_scope(case.organization_id))
        or user_has_permission(user, MANAGE, scope=_org_scope(case.organization_id))
    ):
        raise PermissionDenied("Permission denied.")
    _assert_not_terminal(case)
    if parameter.version.specification.organization_id != case.organization_id:
        raise ValidationError(
            {"parameter": "Specification parameter must belong to the organization."}
        )
    if case.product_id and parameter.version.specification.product_id != case.product_id:
        raise ValidationError({"parameter": "Parameter product does not match IPQC case product."})

    result, label, extra = evaluate_specification_parameter(value=value, parameter=parameter)
    measurement = {
        "checklist_result": result,
        "spec_label": label,
        "value": str(value) if value is not None else None,
        **extra,
        "not_fg_release": True,
        "recorded_at": timezone.now().isoformat(),
    }
    case.measurement_snapshot = measurement
    case.workflow_status = IpqcWorkflowStatus.MEASURED
    if result == ChecklistEvaluationResult.FAIL or label == "OUT_OF_SPEC":
        # Record failure flag but do not escalate or stop — use mark_ipqc_failure.
        case.failure_detected = True
    case.save(
        update_fields=[
            "measurement_snapshot",
            "workflow_status",
            "failure_detected",
            "updated_at",
        ]
    )
    _refresh_context(case)
    record_event(
        event_type="IPQC_MEASUREMENT_RECORDED",
        actor=user,
        metadata={
            "ipqc_case_id": str(case.id),
            "checklist_result": result,
            "spec_label": label,
            "not_fg_release": True,
        },
    )
    return measurement


@atomic_fn
def resolve_ipqc_sampling(
    *,
    actor: User | None,
    case: IpqcInspectionCase,
    plan_version: SamplingPlanVersion | None = None,
    lot_size: Decimal | int | None = None,
) -> dict[str, Any]:
    user = _require_actor(actor)
    require_permission(user, MANAGE, scope=_org_scope(case.organization_id))
    _assert_not_terminal(case)
    parsed_lot: Decimal | None = None
    if lot_size is not None:
        parsed_lot = Decimal(str(lot_size))
    context = SamplingMatchContext(
        organization_id=case.organization_id,
        lot_size=parsed_lot,
        product_id=case.product_id,
        inspection_type="IN_PROCESS",
        process_code=case.process_step_code or "",
        site_id=None,
    )
    resolution = resolve_sampling_requirement(context=context, plan_version=plan_version)
    snapshot = {
        **resolution.as_dict(),
        "advisory_only": True,
        "inspection_type": "IN_PROCESS",
    }
    case.sampling_snapshot = snapshot
    if resolution.plan_version_id:
        case.sampling_plan_version_id = uuid.UUID(resolution.plan_version_id)
    case.save(update_fields=["sampling_snapshot", "sampling_plan_version", "updated_at"])
    _refresh_context(case)
    record_event(
        event_type="IPQC_SAMPLING_RESOLVED",
        actor=user,
        metadata={"ipqc_case_id": str(case.id), **snapshot},
    )
    return snapshot


@atomic_fn
def attach_ipqc_haccp_metadata(
    *,
    actor: User | None,
    case: IpqcInspectionCase,
    control_point_class: str = "",
    metadata: dict[str, Any] | None = None,
) -> IpqcInspectionCase:
    """Freeze HACCP metadata references — does not invent CCP classifications."""
    user = _require_actor(actor)
    require_permission(user, MANAGE, scope=_org_scope(case.organization_id))
    _assert_not_terminal(case)
    payload = {
        "process_step_id": str(case.process_step_id) if case.process_step_id else None,
        "process_step_code": case.process_step_code or "",
        "control_point_class": (control_point_class or "").strip()[:64],
        "company_ccp_classification": "EVIDENCE_REQUIRED",
        "extra": metadata or {},
    }
    case.haccp_metadata_snapshot = payload
    case.save(update_fields=["haccp_metadata_snapshot", "updated_at"])
    _refresh_context(case)
    record_event(
        event_type="IPQC_HACCP_METADATA_ATTACHED",
        actor=user,
        metadata={"ipqc_case_id": str(case.id), **payload},
    )
    return case


@atomic_fn
def mark_ipqc_failure(
    *,
    actor: User | None,
    case: IpqcInspectionCase,
    note: str = "",
) -> IpqcInspectionCase:
    """
    Record IPQC failure and evaluate stop-line policy (default OFF).

    Never auto-creates NCR/HOLD and never implies FG release decisions.
    """
    user = _require_actor(actor)
    if not (
        user_has_permission(user, RECORD, scope=_org_scope(case.organization_id))
        or user_has_permission(user, MANAGE, scope=_org_scope(case.organization_id))
    ):
        raise PermissionDenied("Permission denied.")
    _assert_not_terminal(case)

    case.failure_detected = True
    decision = evaluate_ipqc_fail_stop_policy(
        organization_id=case.organization_id,
        failure_detected=True,
    )
    case.failure_decision = decision.as_dict()
    case.stop_production_signal = bool(decision.stop_production)
    case.workflow_status = IpqcWorkflowStatus.FAILED
    if note:
        case.notes = ((case.notes or "") + "\n" + note.strip()).strip()
    case.save(
        update_fields=[
            "failure_detected",
            "failure_decision",
            "stop_production_signal",
            "workflow_status",
            "notes",
            "updated_at",
        ]
    )
    _refresh_context(case)
    _history(
        organization_id=case.organization_id,
        actor=user,
        event_type="IPQC_FAILURE_RECORDED",
        inspection_case=case,
        note=note,
        metadata=decision.as_dict(),
    )
    event_type = (
        "IPQC_STOP_PRODUCTION_SIGNALLED" if decision.stop_production else "IPQC_FAILURE_RECORDED"
    )
    record_event(
        event_type=event_type,
        actor=user,
        metadata={
            "ipqc_case_id": str(case.id),
            **decision.as_dict(),
        },
    )
    return case


@atomic_fn
def escalate_ipqc_to_ncr(
    *,
    actor: User | None,
    case: IpqcInspectionCase,
    code: str,
    title: str,
    summary: str = "",
) -> IpqcInspectionCase:
    """Controlled escalation into NCR — never auto-invoked from FAIL alone."""
    user = _require_actor(actor)
    require_permission(user, ESCALATE, scope=_org_scope(case.organization_id))
    _assert_not_terminal(case)
    if case.nonconformance_id is not None:
        return case
    if not case.failure_detected:
        raise ValidationError({"failure": "NCR escalation requires a recorded IPQC failure."})

    ncr = create_nonconformance(
        actor=user,
        organization=case.organization,
        code=code,
        title=title,
        summary=summary
        or f"IPQC escalation from case {case.definition.code} / {case.occurrence_key}",
        source=NonConformanceSource.OTHER,
        batch_reference=case.batch_reference,
        checklist_task_id=case.checklist_task_id,
        checklist_submission_id=case.checklist_submission_id,
    )
    case.nonconformance = ncr
    case.workflow_status = IpqcWorkflowStatus.ESCALATED
    case.save(update_fields=["nonconformance", "workflow_status", "updated_at"])
    _refresh_context(case)
    record_event(
        event_type="IPQC_ESCALATED_TO_NCR",
        actor=user,
        metadata={
            "ipqc_case_id": str(case.id),
            "nonconformance_id": str(ncr.id),
        },
    )
    return case


@atomic_fn
def escalate_ipqc_to_hold(
    *,
    actor: User | None,
    case: IpqcInspectionCase,
    code: str,
    reason_reference: str,
    scope: str = "",
) -> IpqcInspectionCase:
    """Controlled escalation into HOLD — never auto-invoked from FAIL alone."""
    user = _require_actor(actor)
    require_permission(user, ESCALATE, scope=_org_scope(case.organization_id))
    _assert_not_terminal(case)
    if case.hold_case_id is not None:
        return case
    if not case.failure_detected:
        raise ValidationError({"failure": "HOLD escalation requires a recorded IPQC failure."})

    hold = create_hold_case(
        actor=user,
        organization=case.organization,
        code=code,
        reason_reference=reason_reference,
        scope=scope or case.production_line_code or case.batch_reference,
        nonconformance_id=case.nonconformance_id,
        batch_reference=case.batch_reference,
    )
    case.hold_case = hold
    case.workflow_status = IpqcWorkflowStatus.ESCALATED
    case.save(update_fields=["hold_case", "workflow_status", "updated_at"])
    _refresh_context(case)
    record_event(
        event_type="IPQC_ESCALATED_TO_HOLD",
        actor=user,
        metadata={
            "ipqc_case_id": str(case.id),
            "hold_case_id": str(hold.id),
        },
    )
    return case


@atomic_fn
def attach_ipqc_submission(
    *,
    actor: User | None,
    case: IpqcInspectionCase,
    checklist_submission: ChecklistSubmission,
) -> IpqcInspectionCase:
    user = _require_actor(actor)
    require_permission(user, MANAGE, scope=_org_scope(case.organization_id))
    _assert_not_terminal(case)
    if checklist_submission.checklist_record.organization_id != case.organization_id:
        raise ValidationError(
            {"checklist_submission": "Submission must belong to the organization."}
        )
    case.checklist_submission = checklist_submission
    case.save(update_fields=["checklist_submission", "updated_at"])
    _refresh_context(case)
    return case


@atomic_fn
def complete_ipqc_case(
    *,
    actor: User | None,
    case: IpqcInspectionCase,
    notes: str = "",
) -> IpqcInspectionCase:
    """Complete IPQC case — does not grant Finished Goods release."""
    user = _require_actor(actor)
    require_permission(user, MANAGE, scope=_org_scope(case.organization_id))
    if case.workflow_status == IpqcWorkflowStatus.CLOSED:
        return case
    case.workflow_status = IpqcWorkflowStatus.COMPLETED
    case.closed_at = timezone.now()
    if notes:
        case.notes = ((case.notes or "") + "\n" + notes.strip()).strip()
    case.save(update_fields=["workflow_status", "closed_at", "notes", "updated_at"])
    _refresh_context(case)
    record_event(
        event_type="IPQC_CASE_COMPLETED",
        actor=user,
        metadata={
            "ipqc_case_id": str(case.id),
            "not_fg_release": True,
            "failure_detected": case.failure_detected,
        },
    )
    return case
