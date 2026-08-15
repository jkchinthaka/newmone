"""HACCP plan services — Phase 23.

High-privilege manage vs approve separation. System Admin is not assumed to hold
food-safety approval authority. No Nelna CCPs/limits/actions are seeded.
Approved/retired versions are immutable. Auto HOLD/NCR stays off by default.
"""

from __future__ import annotations

import uuid
from datetime import date
from typing import Any

from django.core.exceptions import PermissionDenied, ValidationError
from django.db import IntegrityError
from apps.core.persistence import atomic_fn, lock_queryset, locked_get
from django.utils import timezone

from apps.access_control.services import (
    Scope,
    _active_assignments_qs,
    _assignment_covers_scope,
    _permission_codename_matches,
)
from apps.accounts.models import User
from apps.checklists.models import ChecklistItem, ChecklistVersionStatus
from apps.haccp.models import (
    ChecklistItemHaccpBinding,
    ControlMeasure,
    ControlPoint,
    CorrectiveActionReference,
    CriticalLimitReference,
    HaccpHistoryEntry,
    HaccpPlan,
    HaccpPlanVersion,
    HaccpPlanVersionStatus,
    Hazard,
    HazardCategory,
    MonitoringRule,
    ProcessStep,
)
from apps.master_data.models import SpecificationParameter
from apps.organizations.models import Organization
from apps.organizations.services import normalize_code
from apps.security_audit.services import record_event

MANAGE = "haccp.manage_haccpplan"
APPROVE = "haccp.approve_haccpplan"
VIEW = "haccp.view_haccp"


def _require_actor(actor: User | None) -> User:
    if actor is None or not getattr(actor, "is_authenticated", False) or not actor.is_active:
        raise PermissionDenied("Authentication required.")
    return actor


def _org_scope(organization_id: uuid.UUID) -> Scope:
    return Scope(organization_id=organization_id)


def _require_haccp_permission(
    user: User,
    permission: str,
    organization_id: uuid.UUID,
) -> None:
    """
    Food-safety HACCP authority requires an explicit scoped role grant.

    Django ``is_staff`` / ``is_superuser`` alone is not food-safety authority.
    """
    scope = _org_scope(organization_id)
    for assignment in _active_assignments_qs(user):
        if not _assignment_covers_scope(assignment, scope):
            continue
        for perm in assignment.role.permissions.all():
            if _permission_codename_matches(perm, permission):
                return
    raise PermissionDenied(
        "HACCP permission required via scoped role assignment "
        "(Django staff/superuser is not food-safety authority)."
    )


def _history(
    *,
    organization_id: uuid.UUID,
    actor: User,
    event_type: str,
    plan: HaccpPlan | None = None,
    plan_version: HaccpPlanVersion | None = None,
    note: str = "",
    metadata: dict[str, Any] | None = None,
) -> HaccpHistoryEntry:
    return HaccpHistoryEntry.objects.create(
        organization_id=organization_id,
        plan=plan,
        plan_version=plan_version,
        event_type=event_type,
        note=(note or "").strip()[:255],
        metadata=metadata or {},
        actor=actor,
    )


def _assert_draft(version: HaccpPlanVersion) -> None:
    if version.is_immutable:
        raise ValidationError({"status": "Approved or retired HACCP plan versions are immutable."})


def _freeze_binding_context(
    *, plan_version: HaccpPlanVersion, control_point: ControlPoint
) -> dict[str, Any]:
    return {
        "plan_id": str(plan_version.plan_id),
        "plan_code": plan_version.plan.code,
        "plan_version_id": str(plan_version.id),
        "version_number": plan_version.version_number,
        "plan_version_status": plan_version.status,
        "control_point_id": str(control_point.id),
        "control_point_code": control_point.code,
        "control_point_type": control_point.control_point_type,
        "process_step_id": str(control_point.process_step_id),
        "process_step_code": control_point.process_step.code,
    }


@atomic_fn
def create_haccp_plan(
    *,
    actor: User | None,
    organization: Organization,
    code: str,
    title: str,
    description: str = "",
) -> HaccpPlan:
    user = _require_actor(actor)
    _require_haccp_permission(user, MANAGE, organization.id)
    normalized = normalize_code(code)
    if not normalized or not (title or "").strip():
        raise ValidationError({"code": "Plan code and title are required."})
    try:
        plan = HaccpPlan.objects.create(
            organization=organization,
            code=normalized,
            title=title.strip(),
            description=(description or "").strip(),
            created_by=user,
        )
    except IntegrityError as exc:
        raise ValidationError({"code": "Plan code already exists in organization."}) from exc
    _history(
        organization_id=organization.id,
        actor=user,
        event_type="PLAN_CREATED",
        plan=plan,
    )
    record_event(
        event_type="HACCP_PLAN_CREATED",
        actor=user,
        metadata={"organization_id": str(organization.id), "plan_id": str(plan.id)},
    )
    return plan


@atomic_fn
def create_draft_plan_version(
    *,
    actor: User | None,
    plan_id: uuid.UUID,
    change_summary: str = "",
    effective_from: date | None = None,
    effective_to: date | None = None,
) -> HaccpPlanVersion:
    user = _require_actor(actor)
    plan = locked_get(HaccpPlan, pk=plan_id)
    if plan is None:
        raise ValidationError({"plan": "HACCP plan not found."})
    _require_haccp_permission(user, MANAGE, plan.organization_id)
    if effective_from is not None and effective_to is not None and effective_to < effective_from:
        raise ValidationError({"effective_to": "effective_to cannot be before effective_from."})
    next_number = (
        HaccpPlanVersion.objects.filter(plan_id=plan.id)
        .order_by("-version_number")
        .values_list("version_number", flat=True)
        .first()
        or 0
    ) + 1
    version = HaccpPlanVersion.objects.create(
        plan=plan,
        version_number=next_number,
        status=HaccpPlanVersionStatus.DRAFT,
        change_summary=(change_summary or "").strip(),
        effective_from=effective_from,
        effective_to=effective_to,
        created_by=user,
    )
    _history(
        organization_id=plan.organization_id,
        actor=user,
        event_type="VERSION_CREATED",
        plan=plan,
        plan_version=version,
        metadata={"version_number": next_number},
    )
    record_event(
        event_type="HACCP_PLAN_VERSION_CREATED",
        actor=user,
        metadata={
            "organization_id": str(plan.organization_id),
            "plan_id": str(plan.id),
            "plan_version_id": str(version.id),
            "version_number": next_number,
        },
    )
    return version


@atomic_fn
def add_process_step(
    *,
    actor: User | None,
    plan_version_id: uuid.UUID,
    code: str,
    title: str,
    sequence: int = 1,
    notes: str = "",
) -> ProcessStep:
    user = _require_actor(actor)
    version = HaccpPlanVersion.objects.select_related("plan").filter(pk=plan_version_id).first()
    if version is None:
        raise ValidationError({"plan_version": "Plan version not found."})
    _require_haccp_permission(user, MANAGE, version.plan.organization_id)
    _assert_draft(version)
    normalized = normalize_code(code)
    if not normalized or not (title or "").strip():
        raise ValidationError({"code": "Process step code and title are required."})
    try:
        step = ProcessStep.objects.create(
            plan_version=version,
            code=normalized,
            title=title.strip(),
            sequence=max(1, int(sequence)),
            notes=(notes or "").strip(),
        )
    except IntegrityError as exc:
        raise ValidationError(
            {"code": "Process step code already exists on this version."}
        ) from exc
    _history(
        organization_id=version.plan.organization_id,
        actor=user,
        event_type="PROCESS_STEP_ADDED",
        plan=version.plan,
        plan_version=version,
        metadata={"process_step_id": str(step.id)},
    )
    return step


@atomic_fn
def add_hazard(
    *,
    actor: User | None,
    process_step_id: uuid.UUID,
    code: str,
    title: str,
    category: str,
    description: str = "",
) -> Hazard:
    user = _require_actor(actor)
    step = (
        ProcessStep.objects.select_related("plan_version", "plan_version__plan")
        .filter(pk=process_step_id)
        .first()
    )
    if step is None:
        raise ValidationError({"process_step": "Process step not found."})
    org_id = step.plan_version.plan.organization_id
    _require_haccp_permission(user, MANAGE, org_id)
    _assert_draft(step.plan_version)
    if category not in HazardCategory.values:
        raise ValidationError({"category": "Hazard category is not recognized."})
    normalized = normalize_code(code)
    if not normalized or not (title or "").strip():
        raise ValidationError({"code": "Hazard code and title are required."})
    try:
        hazard = Hazard.objects.create(
            process_step=step,
            code=normalized,
            title=title.strip(),
            category=category,
            description=(description or "").strip(),
        )
    except IntegrityError as exc:
        raise ValidationError({"code": "Hazard code already exists on this step."}) from exc
    return hazard


@atomic_fn
def add_control_measure(
    *,
    actor: User | None,
    hazard_id: uuid.UUID,
    code: str,
    title: str,
    description: str = "",
) -> ControlMeasure:
    user = _require_actor(actor)
    hazard = (
        Hazard.objects.select_related(
            "process_step",
            "process_step__plan_version",
            "process_step__plan_version__plan",
        )
        .filter(pk=hazard_id)
        .first()
    )
    if hazard is None:
        raise ValidationError({"hazard": "Hazard not found."})
    version = hazard.process_step.plan_version
    _require_haccp_permission(user, MANAGE, version.plan.organization_id)
    _assert_draft(version)
    normalized = normalize_code(code)
    if not normalized or not (title or "").strip():
        raise ValidationError({"code": "Control measure code and title are required."})
    try:
        return ControlMeasure.objects.create(
            hazard=hazard,
            code=normalized,
            title=title.strip(),
            description=(description or "").strip(),
        )
    except IntegrityError as exc:
        raise ValidationError({"code": "Control measure code already exists."}) from exc


@atomic_fn
def add_control_point(
    *,
    actor: User | None,
    plan_version_id: uuid.UUID,
    process_step_id: uuid.UUID,
    code: str,
    title: str,
    control_point_type: str,
    hazard_id: uuid.UUID | None = None,
    notes: str = "",
) -> ControlPoint:
    user = _require_actor(actor)
    version = HaccpPlanVersion.objects.select_related("plan").filter(pk=plan_version_id).first()
    if version is None:
        raise ValidationError({"plan_version": "Plan version not found."})
    _require_haccp_permission(user, MANAGE, version.plan.organization_id)
    _assert_draft(version)
    step = ProcessStep.objects.filter(pk=process_step_id, plan_version=version).first()
    if step is None:
        raise ValidationError({"process_step": "Process step not found on this version."})
    hazard = None
    if hazard_id is not None:
        hazard = Hazard.objects.filter(pk=hazard_id, process_step=step).first()
        if hazard is None:
            raise ValidationError({"hazard": "Hazard must belong to the process step."})
    normalized = normalize_code(code)
    if not normalized or not (title or "").strip():
        raise ValidationError({"code": "Control point code and title are required."})
    cp = ControlPoint(
        plan_version=version,
        process_step=step,
        hazard=hazard,
        code=normalized,
        title=title.strip(),
        control_point_type=control_point_type,
        notes=(notes or "").strip(),
    )
    cp.full_clean()
    try:
        cp.save()
    except IntegrityError as exc:
        raise ValidationError(
            {"code": "Control point code already exists on this version."}
        ) from exc
    _history(
        organization_id=version.plan.organization_id,
        actor=user,
        event_type="CONTROL_POINT_ADDED",
        plan=version.plan,
        plan_version=version,
        metadata={"control_point_id": str(cp.id), "control_point_type": cp.control_point_type},
    )
    record_event(
        event_type="HACCP_CONTROL_POINT_MAPPED",
        actor=user,
        metadata={
            "organization_id": str(version.plan.organization_id),
            "plan_version_id": str(version.id),
            "control_point_id": str(cp.id),
            "control_point_type": cp.control_point_type,
        },
    )
    return cp


@atomic_fn
def set_critical_limit_reference(
    *,
    actor: User | None,
    control_point_id: uuid.UUID,
    rule_reference: str = "",
    unit: str = "",
    precision: int | None = None,
    boundary_semantics: str = "INCLUSIVE",
    specification_parameter: SpecificationParameter | None = None,
    source_reference: str = "",
    notes: str = "",
) -> CriticalLimitReference:
    """Attach limit *references* only — does not invent numeric critical limits."""
    user = _require_actor(actor)
    cp = (
        ControlPoint.objects.select_related("plan_version", "plan_version__plan")
        .filter(pk=control_point_id)
        .first()
    )
    if cp is None:
        raise ValidationError({"control_point": "Control point not found."})
    org_id = cp.plan_version.plan.organization_id
    _require_haccp_permission(user, MANAGE, org_id)
    _assert_draft(cp.plan_version)
    if specification_parameter is not None:
        spec_org = specification_parameter.version.specification.organization_id
        if spec_org != org_id:
            raise PermissionDenied("Cross-organization specification link is denied.")
    ref, _ = CriticalLimitReference.objects.update_or_create(
        control_point=cp,
        defaults={
            "specification_parameter": specification_parameter,
            "rule_reference": (rule_reference or "").strip(),
            "unit": (unit or "").strip(),
            "precision": precision,
            "boundary_semantics": boundary_semantics,
            # Explicitly keep numeric bounds null — no invented values.
            "lower_bound": None,
            "upper_bound": None,
            "source_reference": (source_reference or "").strip(),
            "notes": (notes or "").strip(),
        },
    )
    return ref


@atomic_fn
def set_monitoring_rule(
    *,
    actor: User | None,
    control_point_id: uuid.UUID,
    method_reference: str = "",
    frequency_reference: str = "",
    responsible_category: str = "",
    required_equipment_reference: str = "",
    verification_requirement: str = "",
    notes: str = "",
) -> MonitoringRule:
    user = _require_actor(actor)
    cp = (
        ControlPoint.objects.select_related("plan_version", "plan_version__plan")
        .filter(pk=control_point_id)
        .first()
    )
    if cp is None:
        raise ValidationError({"control_point": "Control point not found."})
    _require_haccp_permission(user, MANAGE, cp.plan_version.plan.organization_id)
    _assert_draft(cp.plan_version)
    rule, _ = MonitoringRule.objects.update_or_create(
        control_point=cp,
        defaults={
            "method_reference": (method_reference or "").strip(),
            "frequency_reference": (frequency_reference or "").strip(),
            "responsible_category": (responsible_category or "").strip(),
            "required_equipment_reference": (required_equipment_reference or "").strip(),
            "verification_requirement": (verification_requirement or "").strip(),
            "notes": (notes or "").strip(),
        },
    )
    return rule


@atomic_fn
def set_corrective_action_reference(
    *,
    actor: User | None,
    control_point_id: uuid.UUID,
    procedure_reference: str,
    title: str = "",
    notes: str = "",
    auto_raise_hold_enabled: bool = False,
    auto_raise_ncr_enabled: bool = False,
) -> CorrectiveActionReference:
    user = _require_actor(actor)
    cp = (
        ControlPoint.objects.select_related("plan_version", "plan_version__plan")
        .filter(pk=control_point_id)
        .first()
    )
    if cp is None:
        raise ValidationError({"control_point": "Control point not found."})
    _require_haccp_permission(user, MANAGE, cp.plan_version.plan.organization_id)
    _assert_draft(cp.plan_version)
    cleaned = (procedure_reference or "").strip()
    if not cleaned:
        raise ValidationError({"procedure_reference": "Procedure reference is required."})
    # Soft-guard: enabling auto flags without company approval remains advisory-only
    # and is discouraged; services accept False by default.
    ref, _ = CorrectiveActionReference.objects.update_or_create(
        control_point=cp,
        defaults={
            "procedure_reference": cleaned,
            "title": (title or "").strip(),
            "notes": (notes or "").strip(),
            "auto_raise_hold_enabled": bool(auto_raise_hold_enabled),
            "auto_raise_ncr_enabled": bool(auto_raise_ncr_enabled),
        },
    )
    return ref


@atomic_fn
def approve_plan_version(
    *,
    actor: User | None,
    plan_version_id: uuid.UUID,
    effective_from: date | None = None,
    effective_to: date | None = None,
) -> HaccpPlanVersion:
    """Food-safety approval privilege — separate from manage / System Admin."""
    user = _require_actor(actor)
    version = (
        lock_queryset(
        HaccpPlanVersion.objects.select_related("plan").filter(pk=plan_version_id)
        ).first()
    )
    if version is None:
        raise ValidationError({"plan_version": "Plan version not found."})
    _require_haccp_permission(user, APPROVE, version.plan.organization_id)
    if version.status != HaccpPlanVersionStatus.DRAFT:
        raise ValidationError({"status": "Only DRAFT versions can be approved."})
    if effective_from is not None:
        version.effective_from = effective_from
    if effective_to is not None:
        version.effective_to = effective_to
    if (
        version.effective_from is not None
        and version.effective_to is not None
        and version.effective_to < version.effective_from
    ):
        raise ValidationError({"effective_to": "effective_to cannot be before effective_from."})
    version.status = HaccpPlanVersionStatus.APPROVED
    version.approved_by = user
    version.approved_at = timezone.now()
    version.save(
        update_fields=[
            "status",
            "approved_by",
            "approved_at",
            "effective_from",
            "effective_to",
            "updated_at",
        ]
    )
    _history(
        organization_id=version.plan.organization_id,
        actor=user,
        event_type="VERSION_APPROVED",
        plan=version.plan,
        plan_version=version,
        note=f"effective_from={version.effective_from}",
    )
    record_event(
        event_type="HACCP_PLAN_VERSION_APPROVED",
        actor=user,
        metadata={
            "organization_id": str(version.plan.organization_id),
            "plan_version_id": str(version.id),
            "version_number": version.version_number,
            "effective_from": str(version.effective_from) if version.effective_from else "",
            "effective_to": str(version.effective_to) if version.effective_to else "",
        },
    )
    return version


@atomic_fn
def retire_plan_version(*, actor: User | None, plan_version_id: uuid.UUID) -> HaccpPlanVersion:
    user = _require_actor(actor)
    version = (
        lock_queryset(
        HaccpPlanVersion.objects.select_related("plan").filter(pk=plan_version_id)
        ).first()
    )
    if version is None:
        raise ValidationError({"plan_version": "Plan version not found."})
    _require_haccp_permission(user, APPROVE, version.plan.organization_id)
    if version.status != HaccpPlanVersionStatus.APPROVED:
        raise ValidationError({"status": "Only APPROVED versions can be retired."})
    version.status = HaccpPlanVersionStatus.RETIRED
    version.save(update_fields=["status", "updated_at"])
    _history(
        organization_id=version.plan.organization_id,
        actor=user,
        event_type="VERSION_RETIRED",
        plan=version.plan,
        plan_version=version,
    )
    record_event(
        event_type="HACCP_PLAN_VERSION_RETIRED",
        actor=user,
        metadata={
            "organization_id": str(version.plan.organization_id),
            "plan_version_id": str(version.id),
            "version_number": version.version_number,
        },
    )
    return version


@atomic_fn
def bind_checklist_item_to_control_point(
    *,
    actor: User | None,
    checklist_item_id: uuid.UUID,
    plan_version_id: uuid.UUID,
    control_point_id: uuid.UUID,
) -> ChecklistItemHaccpBinding:
    """
    Bind a checklist item to an exact plan version + control point.

    Frozen context preserves historical identity even if future versions change.
    """
    user = _require_actor(actor)
    item = (
        ChecklistItem.objects.select_related(
            "section",
            "section__version",
            "section__version__template",
            "section__version__template__organization",
        )
        .filter(pk=checklist_item_id)
        .first()
    )
    if item is None:
        raise ValidationError({"checklist_item": "Checklist item not found."})
    org_id = item.section.version.template.organization_id
    _require_haccp_permission(user, MANAGE, org_id)
    version = HaccpPlanVersion.objects.select_related("plan").filter(pk=plan_version_id).first()
    if version is None:
        raise ValidationError({"plan_version": "Plan version not found."})
    if version.plan.organization_id != org_id:
        raise PermissionDenied("Cross-organization HACCP binding is denied.")
    if item.section.version.status == ChecklistVersionStatus.PUBLISHED:
        raise ValidationError(
            {
                "checklist_item": (
                    "Cannot alter HACCP binding on a published checklist version. "
                    "Clone a new checklist version to change HACCP context."
                )
            }
        )
    cp = (
        ControlPoint.objects.select_related("process_step")
        .filter(pk=control_point_id, plan_version=version)
        .first()
    )
    if cp is None:
        raise ValidationError({"control_point": "Control point not found on plan version."})
    frozen = _freeze_binding_context(plan_version=version, control_point=cp)
    binding, created = ChecklistItemHaccpBinding.objects.update_or_create(
        checklist_item=item,
        defaults={
            "plan_version": version,
            "control_point": cp,
            "frozen_haccp_context": frozen,
        },
    )
    binding.full_clean()
    _history(
        organization_id=org_id,
        actor=user,
        event_type="CHECKLIST_ITEM_BOUND",
        plan=version.plan,
        plan_version=version,
        metadata={
            "checklist_item_id": str(item.id),
            "control_point_id": str(cp.id),
            "created": created,
        },
    )
    record_event(
        event_type="HACCP_CHECKLIST_BINDING_SET",
        actor=user,
        metadata={
            "organization_id": str(org_id),
            "checklist_item_id": str(item.id),
            "plan_version_id": str(version.id),
            "control_point_id": str(cp.id),
        },
    )
    return binding
