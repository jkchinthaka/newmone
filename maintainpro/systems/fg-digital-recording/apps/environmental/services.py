"""Environmental monitoring services — Phase 28."""

from __future__ import annotations

import uuid
from datetime import datetime
from decimal import Decimal
from typing import Any

from django.core.exceptions import PermissionDenied, ValidationError
from django.db import IntegrityError, transaction
from apps.core.persistence import lock_queryset, locked_get
from django.utils import timezone

from apps.access_control.services import Scope, require_permission
from apps.accounts.models import User
from apps.environmental.evaluation import (
    evaluate_against_limit_rule,
    freeze_limit_context,
)
from apps.environmental.models import (
    EnvironmentalExcursionPolicy,
    EnvironmentalHistoryEntry,
    MonitoringEvaluationOutcome,
    MonitoringExcursion,
    MonitoringLimitRule,
    MonitoringParameter,
    MonitoringPoint,
    MonitoringReading,
    MonitoringScheduleLink,
    MonitoringSourceType,
    MonitoringSpec,
    MonitoringSpecVersion,
    MonitoringSpecVersionStatus,
    MonitoringTrendIndex,
)
from apps.environmental.policy import evaluate_excursion_hold_policy
from apps.instruments.models import Equipment
from apps.laboratory.models import LabResult
from apps.organizations.models import Department, Organization, Site
from apps.organizations.services import normalize_code
from apps.scheduling.models import ChecklistSchedule
from apps.security_audit.services import record_event

MANAGE = "environmental.manage_environmental"
RECORD = "environmental.record_environmentalreading"
VIEW = "environmental.view_environmental"


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
    note: str = "",
    metadata: dict[str, Any] | None = None,
) -> EnvironmentalHistoryEntry:
    return EnvironmentalHistoryEntry.objects.create(
        organization_id=organization_id,
        event_type=event_type,
        note=(note or "").strip()[:255],
        metadata=metadata or {},
        actor=actor,
    )


def _assert_draft(version: MonitoringSpecVersion) -> None:
    if version.is_immutable:
        raise ValidationError(
            {"status": "Approved or retired monitoring spec versions are immutable."}
        )


def _device_trace_snapshot(equipment: Equipment | None) -> dict[str, Any]:
    if equipment is None:
        return {}
    return {
        "equipment_id": str(equipment.id),
        "equipment_code": equipment.code,
        "equipment_name": equipment.name,
        "equipment_type": equipment.equipment_type,
        "serial_number": equipment.serial_number or "",
        "operational_status": equipment.operational_status,
    }


@transaction.atomic
def create_monitoring_point(
    *,
    actor: User | None,
    organization: Organization,
    code: str,
    name: str,
    site: Site | None = None,
    department: Department | None = None,
    room_code: str = "",
    line_code: str = "",
    work_area_code: str = "",
    notes: str = "",
) -> MonitoringPoint:
    user = _require_actor(actor)
    require_permission(user, MANAGE, scope=_org_scope(organization.id))
    normalized = normalize_code(code)
    if not normalized or not (name or "").strip():
        raise ValidationError({"code": "Point code and name are required."})
    point = MonitoringPoint(
        organization=organization,
        code=normalized,
        name=name.strip(),
        site=site,
        department=department,
        room_code=(room_code or "").strip(),
        line_code=(line_code or "").strip(),
        work_area_code=(work_area_code or "").strip(),
        notes=(notes or "").strip(),
        created_by=user,
    )
    point.full_clean()
    try:
        point.save()
    except IntegrityError as exc:
        raise ValidationError({"code": "Point code already exists in organization."}) from exc
    _history(
        organization_id=organization.id,
        actor=user,
        event_type="EM_POINT_CREATED",
        note=point.code,
        metadata={"point_id": str(point.id)},
    )
    record_event(
        event_type="EM_POINT_CREATED",
        actor=user,
        metadata={"point_id": str(point.id), "organization_id": str(organization.id)},
    )
    return point


@transaction.atomic
def create_monitoring_parameter(
    *,
    actor: User | None,
    organization: Organization,
    code: str,
    name: str,
    unit: str = "",
    category: str = "",
    notes: str = "",
) -> MonitoringParameter:
    user = _require_actor(actor)
    require_permission(user, MANAGE, scope=_org_scope(organization.id))
    normalized = normalize_code(code)
    if not normalized or not (name or "").strip():
        raise ValidationError({"code": "Parameter code and name are required."})
    try:
        param = MonitoringParameter.objects.create(
            organization=organization,
            code=normalized,
            name=name.strip(),
            unit=(unit or "").strip(),
            category=(category or "").strip(),
            notes=(notes or "").strip(),
            created_by=user,
        )
    except IntegrityError as exc:
        raise ValidationError({"code": "Parameter code already exists in organization."}) from exc
    record_event(
        event_type="EM_PARAMETER_CREATED",
        actor=user,
        metadata={"parameter_id": str(param.id), "organization_id": str(organization.id)},
    )
    return param


@transaction.atomic
def create_monitoring_spec(
    *,
    actor: User | None,
    organization: Organization,
    code: str,
    title: str,
    description: str = "",
) -> MonitoringSpec:
    user = _require_actor(actor)
    require_permission(user, MANAGE, scope=_org_scope(organization.id))
    normalized = normalize_code(code)
    if not normalized or not (title or "").strip():
        raise ValidationError({"code": "Spec code and title are required."})
    try:
        spec = MonitoringSpec.objects.create(
            organization=organization,
            code=normalized,
            title=title.strip(),
            description=(description or "").strip(),
            created_by=user,
        )
    except IntegrityError as exc:
        raise ValidationError({"code": "Spec code already exists in organization."}) from exc
    _history(
        organization_id=organization.id,
        actor=user,
        event_type="EM_SPEC_CREATED",
        note=spec.code,
    )
    record_event(
        event_type="EM_SPEC_CREATED",
        actor=user,
        metadata={"spec_id": str(spec.id)},
    )
    return spec


@transaction.atomic
def create_draft_spec_version(
    *,
    actor: User | None,
    spec_id: uuid.UUID,
    change_summary: str = "",
) -> MonitoringSpecVersion:
    user = _require_actor(actor)
    spec = locked_get(MonitoringSpec, pk=spec_id)
    if spec is None:
        raise ValidationError({"spec": "Monitoring specification not found."})
    require_permission(user, MANAGE, scope=_org_scope(spec.organization_id))
    next_num = (
        MonitoringSpecVersion.objects.filter(spec=spec)
        .order_by("-version_number")
        .values_list("version_number", flat=True)
        .first()
        or 0
    ) + 1
    version = MonitoringSpecVersion.objects.create(
        spec=spec,
        version_number=next_num,
        change_summary=(change_summary or "").strip(),
        created_by=user,
    )
    record_event(
        event_type="EM_SPEC_VERSION_CREATED",
        actor=user,
        metadata={"spec_version_id": str(version.id), "version_number": next_num},
    )
    return version


@transaction.atomic
def add_limit_rule(
    *,
    actor: User | None,
    spec_version_id: uuid.UUID,
    monitoring_point: MonitoringPoint,
    parameter: MonitoringParameter,
    bound_min: Decimal | None = None,
    bound_max: Decimal | None = None,
    warn_min: Decimal | None = None,
    warn_max: Decimal | None = None,
    notes: str = "",
) -> MonitoringLimitRule:
    user = _require_actor(actor)
    version = (
        lock_queryset(
        MonitoringSpecVersion.objects.select_related("spec").filter(pk=spec_version_id)
        ).first()
    )
    if version is None:
        raise ValidationError({"spec_version": "Spec version not found."})
    require_permission(user, MANAGE, scope=_org_scope(version.spec.organization_id))
    _assert_draft(version)
    rule = MonitoringLimitRule(
        spec_version=version,
        monitoring_point=monitoring_point,
        parameter=parameter,
        bound_min=bound_min,
        bound_max=bound_max,
        warn_min=warn_min,
        warn_max=warn_max,
        notes=(notes or "").strip(),
    )
    rule.full_clean()
    try:
        rule.save()
    except IntegrityError as exc:
        raise ValidationError(
            {"parameter": "Limit rule already exists for this point/parameter."}
        ) from exc
    return rule


@transaction.atomic
def approve_spec_version(
    *,
    actor: User | None,
    spec_version_id: uuid.UUID,
) -> MonitoringSpecVersion:
    user = _require_actor(actor)
    version = (
        lock_queryset(
        MonitoringSpecVersion.objects.select_related("spec").filter(pk=spec_version_id)
        ).first()
    )
    if version is None:
        raise ValidationError({"spec_version": "Spec version not found."})
    require_permission(user, MANAGE, scope=_org_scope(version.spec.organization_id))
    if version.status != MonitoringSpecVersionStatus.DRAFT:
        raise ValidationError({"status": "Only DRAFT versions can be approved."})
    version.status = MonitoringSpecVersionStatus.APPROVED
    version.approved_by = user
    version.approved_at = timezone.now()
    version.save(update_fields=["status", "approved_by", "approved_at", "updated_at"])
    record_event(
        event_type="EM_SPEC_VERSION_APPROVED",
        actor=user,
        metadata={"spec_version_id": str(version.id)},
    )
    return version


@transaction.atomic
def retire_spec_version(
    *,
    actor: User | None,
    spec_version_id: uuid.UUID,
) -> MonitoringSpecVersion:
    user = _require_actor(actor)
    version = (
        lock_queryset(
        MonitoringSpecVersion.objects.select_related("spec").filter(pk=spec_version_id)
        ).first()
    )
    if version is None:
        raise ValidationError({"spec_version": "Spec version not found."})
    require_permission(user, MANAGE, scope=_org_scope(version.spec.organization_id))
    if version.status != MonitoringSpecVersionStatus.APPROVED:
        raise ValidationError({"status": "Only APPROVED versions can be retired."})
    version.status = MonitoringSpecVersionStatus.RETIRED
    version.save(update_fields=["status", "updated_at"])
    record_event(
        event_type="EM_SPEC_VERSION_RETIRED",
        actor=user,
        metadata={"spec_version_id": str(version.id)},
    )
    return version


@transaction.atomic
def link_monitoring_schedule(
    *,
    actor: User | None,
    organization: Organization,
    monitoring_point: MonitoringPoint,
    checklist_schedule: ChecklistSchedule,
    parameter: MonitoringParameter | None = None,
    label: str = "",
    notes: str = "",
) -> MonitoringScheduleLink:
    user = _require_actor(actor)
    require_permission(user, MANAGE, scope=_org_scope(organization.id))
    link = MonitoringScheduleLink(
        organization=organization,
        monitoring_point=monitoring_point,
        parameter=parameter,
        checklist_schedule=checklist_schedule,
        label=(label or "").strip(),
        notes=(notes or "").strip(),
    )
    link.full_clean()
    link.save()
    record_event(
        event_type="EM_SCHEDULE_LINKED",
        actor=user,
        metadata={
            "schedule_id": str(checklist_schedule.id),
            "point_id": str(monitoring_point.id),
        },
    )
    return link


def _resolve_approved_limit_rule(
    *,
    organization_id: uuid.UUID,
    monitoring_point_id: uuid.UUID,
    parameter_id: uuid.UUID,
    spec_version: MonitoringSpecVersion | None,
) -> tuple[MonitoringLimitRule | None, MonitoringSpecVersion | None]:
    if spec_version is not None:
        # Always reload — callers may hold a stale in-memory draft instance.
        resolved = (
            MonitoringSpecVersion.objects.select_related("spec").filter(pk=spec_version.pk).first()
        )
        if resolved is None:
            raise ValidationError({"spec_version": "Spec version not found."})
        if resolved.status != MonitoringSpecVersionStatus.APPROVED:
            raise ValidationError({"spec_version": "Only APPROVED spec versions may be used."})
        if resolved.spec.organization_id != organization_id:
            raise ValidationError({"spec_version": "Spec version belongs to another organization."})
        rule = (
            MonitoringLimitRule.objects.select_related("spec_version__spec")
            .filter(
                spec_version=resolved,
                monitoring_point_id=monitoring_point_id,
                parameter_id=parameter_id,
            )
            .first()
        )
        return rule, resolved
    rule = (
        MonitoringLimitRule.objects.select_related("spec_version__spec")
        .filter(
            monitoring_point_id=monitoring_point_id,
            parameter_id=parameter_id,
            spec_version__status=MonitoringSpecVersionStatus.APPROVED,
            spec_version__spec__organization_id=organization_id,
        )
        .order_by("-spec_version__version_number", "-spec_version__approved_at")
        .first()
    )
    return rule, (rule.spec_version if rule else None)


@transaction.atomic
def record_monitoring_reading(
    *,
    actor: User | None,
    organization: Organization,
    monitoring_point: MonitoringPoint,
    parameter: MonitoringParameter,
    source_type: str,
    numeric_value: Decimal,
    recorded_at: datetime | None = None,
    unit: str = "",
    equipment: Equipment | None = None,
    lab_result: LabResult | None = None,
    sensor_reference: str = "",
    spec_version: MonitoringSpecVersion | None = None,
    notes: str = "",
) -> tuple[MonitoringReading, MonitoringExcursion]:
    """
    Record a reading, evaluate limits, index trend, and optionally create HoldCase.

    Auto-HOLD remains OFF unless dual-gate policy is approved.
    """
    user = _require_actor(actor)
    require_permission(user, RECORD, scope=_org_scope(organization.id))

    if monitoring_point.organization_id != organization.id:
        raise ValidationError({"monitoring_point": "Point belongs to another organization."})
    if parameter.organization_id != organization.id:
        raise ValidationError({"parameter": "Parameter belongs to another organization."})
    if source_type not in MonitoringSourceType.values:
        raise ValidationError({"source_type": "Unknown source type."})
    if source_type == MonitoringSourceType.LAB and lab_result is None:
        raise ValidationError({"lab_result": "LAB source requires a linked lab result."})
    if source_type == MonitoringSourceType.SENSOR and not (sensor_reference or "").strip():
        # Placeholder allowed empty? User said sensor placeholder without requiring IoT.
        # Allow empty sensor_reference for SENSOR as explicit placeholder shell.
        pass
    if equipment is not None and equipment.organization_id != organization.id:
        raise ValidationError({"equipment": "Equipment belongs to another organization."})
    if lab_result is not None:
        if lab_result.organization_id != organization.id:
            raise ValidationError({"lab_result": "Lab result belongs to another organization."})

    rule, resolved_version = _resolve_approved_limit_rule(
        organization_id=organization.id,
        monitoring_point_id=monitoring_point.id,
        parameter_id=parameter.id,
        spec_version=spec_version,
    )
    evaluation = evaluate_against_limit_rule(value=numeric_value, rule=rule)
    moment = recorded_at or timezone.now()

    reading = MonitoringReading.objects.create(
        organization=organization,
        monitoring_point=monitoring_point,
        parameter=parameter,
        source_type=source_type,
        numeric_value=numeric_value,
        recorded_at=moment,
        unit=(unit or parameter.unit or "").strip(),
        equipment=equipment,
        lab_result=lab_result,
        sensor_reference=(sensor_reference or "").strip(),
        spec_version=resolved_version,
        device_trace_context=_device_trace_snapshot(equipment),
        notes=(notes or "").strip(),
        recorded_by=user,
    )

    hold_decision = evaluate_excursion_hold_policy(
        organization_id=organization.id,
        evaluation_outcome=evaluation.outcome,
    )
    hold_case = None
    auto_hold_created = False
    if hold_decision.create_hold:
        from apps.nonconformance.services import create_hold_case

        hold_code = f"EM-{str(reading.id).replace('-', '')[:12].upper()}"
        hold_case = create_hold_case(
            actor=user,
            organization=organization,
            code=hold_code,
            reason_reference=(
                f"Environmental monitoring excursion: {parameter.code}@"
                f"{monitoring_point.code} value={numeric_value}. "
                f"Policy={hold_decision.reason_code}. "
                "Company must confirm disposition — no invented corrective action."
            )[:2000],
            scope=(monitoring_point.work_area_code or monitoring_point.line_code or "")[:255],
        )
        auto_hold_created = True

    excursion = MonitoringExcursion.objects.create(
        organization=organization,
        reading=reading,
        outcome=evaluation.outcome,
        limit_rule=evaluation.limit_rule,
        frozen_limit_context=freeze_limit_context(evaluation.limit_rule),
        message=evaluation.message[:255],
        hold_recommended=evaluation.hold_recommended,
        auto_hold_created=auto_hold_created,
        hold_case=hold_case,
    )

    MonitoringTrendIndex.objects.create(
        organization=organization,
        reading=reading,
        monitoring_point=monitoring_point,
        parameter=parameter,
        source_type=source_type,
        numeric_value=numeric_value,
        recorded_at=moment,
        evaluation_outcome=evaluation.outcome,
    )

    record_event(
        event_type="EM_READING_RECORDED",
        actor=user,
        metadata={
            "reading_id": str(reading.id),
            "source_type": source_type,
            "outcome": evaluation.outcome,
            "auto_hold_created": auto_hold_created,
        },
    )
    if evaluation.outcome in {
        MonitoringEvaluationOutcome.EXCURSION,
        MonitoringEvaluationOutcome.WARN,
    }:
        record_event(
            event_type="EM_EXCURSION_EVALUATED",
            actor=user,
            metadata={
                "excursion_id": str(excursion.id),
                "outcome": evaluation.outcome,
                "hold_decision": hold_decision.as_dict(),
            },
        )
    return reading, excursion


@transaction.atomic
def upsert_environmental_excursion_policy(
    *,
    actor: User | None,
    organization: Organization,
    auto_hold_enabled: bool = False,
    procedure_reference: str = "",
    notes: str = "",
) -> EnvironmentalExcursionPolicy:
    user = _require_actor(actor)
    require_permission(user, MANAGE, scope=_org_scope(organization.id))
    policy, _ = EnvironmentalExcursionPolicy.objects.update_or_create(
        organization=organization,
        defaults={
            "auto_hold_enabled": bool(auto_hold_enabled),
            "procedure_reference": (procedure_reference or "").strip(),
            "notes": (notes or "").strip(),
            "updated_by": user,
        },
    )
    record_event(
        event_type="EM_EXCURSION_POLICY_UPDATED",
        actor=user,
        metadata={
            "organization_id": str(organization.id),
            "auto_hold_enabled": policy.auto_hold_enabled,
        },
    )
    return policy
