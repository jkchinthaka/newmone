"""Phase 28 — environmental monitoring foundation tests."""

from __future__ import annotations

import uuid
from decimal import Decimal
from typing import Any

import pytest
from django.contrib.auth.models import Permission
from django.contrib.contenttypes.models import ContentType
from django.core.exceptions import PermissionDenied, ValidationError
from django.test import override_settings
from tests.factories import (
    grant_role,
    make_department,
    make_org,
    make_role_with_permission,
    make_site,
    make_user,
)

from apps.accounts.models import User
from apps.checklists.models import ChecklistResponseType, ChecklistTemplate
from apps.checklists.services import (
    add_checklist_item,
    add_checklist_section,
    create_checklist_template,
    create_checklist_version,
    publish_checklist_version,
)
from apps.environmental.evaluation import evaluate_against_limit_rule
from apps.environmental.models import (
    MonitoringEvaluationOutcome,
    MonitoringPoint,
    MonitoringSourceType,
    MonitoringSpecVersionStatus,
)
from apps.environmental.policy import evaluate_excursion_hold_policy
from apps.environmental.selectors import trend_for_point_parameter
from apps.environmental.services import (
    add_limit_rule,
    approve_spec_version,
    create_draft_spec_version,
    create_monitoring_parameter,
    create_monitoring_point,
    create_monitoring_spec,
    link_monitoring_schedule,
    record_monitoring_reading,
    retire_spec_version,
    upsert_environmental_excursion_policy,
)
from apps.instruments.models import Equipment
from apps.instruments.services import create_equipment
from apps.laboratory.models import LabResult, LabSample, LabTest
from apps.nonconformance.models import HoldCase
from apps.organizations.models import Organization
from apps.scheduling.generation import create_checklist_schedule
from apps.scheduling.models import ChecklistSchedule, ChecklistTask, ChecklistTriggerType
from apps.security_audit.models import SecurityAuditEvent


def _perm(model: type[Any], codename: str) -> Permission:
    ct = ContentType.objects.get_for_model(model)
    permission, _ = Permission.objects.get_or_create(
        content_type=ct,
        codename=codename,
        defaults={"name": f"Can {codename.replace('_', ' ')}"},
    )
    return permission


def _manager(*, org: Organization) -> User:
    suffix = uuid.uuid4().hex[:6].upper()
    user = make_user(employee_code=f"EM{suffix}", is_staff=True)
    role = make_role_with_permission(
        code=f"EM{suffix}",
        name=f"EM role {suffix}",
        permission=_perm(MonitoringPoint, "manage_environmental"),
    )
    role.permissions.add(_perm(MonitoringPoint, "record_environmentalreading"))
    role.permissions.add(_perm(MonitoringPoint, "view_environmental"))
    role.permissions.add(_perm(Equipment, "manage_equipment"))
    role.permissions.add(_perm(Equipment, "view_equipment"))
    role.permissions.add(_perm(ChecklistTemplate, "manage_checklist"))
    role.permissions.add(_perm(ChecklistTemplate, "view_checklisttemplate"))
    role.permissions.add(_perm(ChecklistTask, "manage_checklisttask"))
    role.permissions.add(_perm(ChecklistSchedule, "manage_checklistschedule"))
    role.permissions.add(_perm(HoldCase, "create_holdcase"))
    role.permissions.add(_perm(HoldCase, "manage_holdcase"))
    grant_role(user, role, organization=org)
    return user


def _setup_point_param(manager: User, org: Organization) -> Any:
    site = make_site(org, code=f"ST{uuid.uuid4().hex[:4].upper()}")
    dept = make_department(org, code=f"D{uuid.uuid4().hex[:4].upper()}", site=site)
    point = create_monitoring_point(
        actor=manager,
        organization=org,
        code=f"MP-{uuid.uuid4().hex[:5].upper()}",
        name="Cold room shell",
        site=site,
        department=dept,
        room_code="ROOM-OPAQUE",
        line_code="LINE-OPAQUE",
        work_area_code="WA-OPAQUE",
    )
    param = create_monitoring_parameter(
        actor=manager,
        organization=org,
        code=f"TEMP-{uuid.uuid4().hex[:4].upper()}",
        name="Air temperature shell",
        unit="C",
        category="TEMPERATURE",
    )
    return point, param


@pytest.mark.django_db
def test_manual_reading_limit_evaluation_and_trend() -> None:
    org = make_org(code=f"E{uuid.uuid4().hex[:6].upper()}")
    manager = _manager(org=org)
    point, param = _setup_point_param(manager, org)
    equipment = create_equipment(
        actor=manager,
        organization=org,
        code=f"EQ-{uuid.uuid4().hex[:5].upper()}",
        name="Probe shell",
    )
    spec = create_monitoring_spec(
        actor=manager, organization=org, code=f"SP-{uuid.uuid4().hex[:5].upper()}", title="EM spec"
    )
    version = create_draft_spec_version(actor=manager, spec_id=spec.id)
    add_limit_rule(
        actor=manager,
        spec_version_id=version.id,
        monitoring_point=point,
        parameter=param,
        bound_min=Decimal("0"),
        bound_max=Decimal("10"),
        warn_min=Decimal("1"),
        warn_max=Decimal("9"),
    )
    approve_spec_version(actor=manager, spec_version_id=version.id)
    version.refresh_from_db()

    reading, excursion = record_monitoring_reading(
        actor=manager,
        organization=org,
        monitoring_point=point,
        parameter=param,
        source_type=MonitoringSourceType.MANUAL,
        numeric_value=Decimal("5"),
        equipment=equipment,
        spec_version=version,
    )
    assert excursion.outcome == MonitoringEvaluationOutcome.IN_RANGE
    assert reading.device_trace_context["equipment_code"] == equipment.code
    assert reading.spec_version_id == version.id
    assert (
        trend_for_point_parameter(
            organization_id=org.id,
            monitoring_point_id=point.id,
            parameter_id=param.id,
        ).count()
        == 1
    )
    assert SecurityAuditEvent.objects.filter(event_type="EM_READING_RECORDED").exists()


@pytest.mark.django_db
def test_excursion_no_automatic_disposition_by_default() -> None:
    org = make_org(code=f"E{uuid.uuid4().hex[:6].upper()}")
    manager = _manager(org=org)
    point, param = _setup_point_param(manager, org)
    spec = create_monitoring_spec(
        actor=manager, organization=org, code=f"SP-{uuid.uuid4().hex[:5].upper()}", title="Limits"
    )
    version = create_draft_spec_version(actor=manager, spec_id=spec.id)
    add_limit_rule(
        actor=manager,
        spec_version_id=version.id,
        monitoring_point=point,
        parameter=param,
        bound_min=Decimal("0"),
        bound_max=Decimal("5"),
    )
    approve_spec_version(actor=manager, spec_version_id=version.id)
    version.refresh_from_db()

    _reading, excursion = record_monitoring_reading(
        actor=manager,
        organization=org,
        monitoring_point=point,
        parameter=param,
        source_type=MonitoringSourceType.MANUAL,
        numeric_value=Decimal("20"),
    )
    assert excursion.outcome == MonitoringEvaluationOutcome.EXCURSION
    assert excursion.hold_recommended is True
    assert excursion.auto_hold_created is False
    assert excursion.hold_case_id is None
    decision = evaluate_excursion_hold_policy(
        organization_id=org.id, evaluation_outcome=MonitoringEvaluationOutcome.EXCURSION
    )
    assert decision.create_hold is False
    assert decision.reason_code == "POLICY_DISABLED"


@pytest.mark.django_db
@override_settings(ENVIRONMENTAL_AUTO_HOLD_APPROVED=False)
def test_policy_enabled_still_blocked_without_settings() -> None:
    org = make_org(code=f"E{uuid.uuid4().hex[:6].upper()}")
    manager = _manager(org=org)
    upsert_environmental_excursion_policy(actor=manager, organization=org, auto_hold_enabled=True)
    decision = evaluate_excursion_hold_policy(
        organization_id=org.id, evaluation_outcome=MonitoringEvaluationOutcome.EXCURSION
    )
    assert decision.create_hold is False
    assert decision.reason_code == "SETTINGS_APPROVAL_MISSING"


@pytest.mark.django_db
def test_sensor_placeholder_and_not_evaluated_without_limits() -> None:
    org = make_org(code=f"E{uuid.uuid4().hex[:6].upper()}")
    manager = _manager(org=org)
    point, param = _setup_point_param(manager, org)
    reading, excursion = record_monitoring_reading(
        actor=manager,
        organization=org,
        monitoring_point=point,
        parameter=param,
        source_type=MonitoringSourceType.SENSOR,
        numeric_value=Decimal("3.5"),
        sensor_reference="SENSOR-PLACEHOLDER-1",
    )
    assert reading.source_type == MonitoringSourceType.SENSOR
    assert excursion.outcome == MonitoringEvaluationOutcome.NOT_EVALUATED
    bare = evaluate_against_limit_rule(value=Decimal("1"), rule=None)
    assert bare.outcome == MonitoringEvaluationOutcome.NOT_EVALUATED


@pytest.mark.django_db
def test_lab_result_link_requires_same_org() -> None:
    org = make_org(code=f"E{uuid.uuid4().hex[:6].upper()}")
    manager = _manager(org=org)
    point, param = _setup_point_param(manager, org)
    with pytest.raises(ValidationError):
        record_monitoring_reading(
            actor=manager,
            organization=org,
            monitoring_point=point,
            parameter=param,
            source_type=MonitoringSourceType.LAB,
            numeric_value=Decimal("1"),
            lab_result=None,
        )


@pytest.mark.django_db
def test_lab_result_link_happy_path() -> None:
    org = make_org(code=f"E{uuid.uuid4().hex[:6].upper()}")
    manager = _manager(org=org)
    point, param = _setup_point_param(manager, org)

    from apps.laboratory.models import (
        LabResultStatus,
        LabResultType,
        LabSampleStatus,
        LabTestParameter,
    )

    sample = LabSample.objects.create(
        organization=org,
        code=f"LS-{uuid.uuid4().hex[:6].upper()}",
        status=LabSampleStatus.REGISTERED,
        registered_by=manager,
    )
    lab_test = LabTest.objects.create(
        organization=org,
        sample=sample,
        code=f"T-{uuid.uuid4().hex[:4].upper()}",
        title="EM water shell",
    )
    lab_param = LabTestParameter.objects.create(
        organization=org,
        code=f"LP-{uuid.uuid4().hex[:4].upper()}",
        name="EM param shell",
        result_type=LabResultType.NUMERIC,
    )
    lab_result = LabResult.objects.create(
        organization=org,
        lab_test=lab_test,
        parameter=lab_param,
        revision_number=1,
        status=LabResultStatus.ENTERED,
        result_type=LabResultType.NUMERIC,
        numeric_value=Decimal("2"),
        entered_by=manager,
    )

    reading, excursion = record_monitoring_reading(
        actor=manager,
        organization=org,
        monitoring_point=point,
        parameter=param,
        source_type=MonitoringSourceType.LAB,
        numeric_value=Decimal("2"),
        lab_result=lab_result,
    )
    assert reading.lab_result_id == lab_result.id
    assert excursion.outcome == MonitoringEvaluationOutcome.NOT_EVALUATED


@pytest.mark.django_db
def test_cross_org_denied() -> None:
    org_a = make_org(code=f"A{uuid.uuid4().hex[:6].upper()}")
    org_b = make_org(code=f"B{uuid.uuid4().hex[:6].upper()}")
    manager_a = _manager(org=org_a)
    manager_b = _manager(org=org_b)
    point_a, param_a = _setup_point_param(manager_a, org_a)
    point_b, _param_b = _setup_point_param(manager_b, org_b)
    with pytest.raises(ValidationError):
        record_monitoring_reading(
            actor=manager_a,
            organization=org_a,
            monitoring_point=point_b,
            parameter=param_a,
            source_type=MonitoringSourceType.MANUAL,
            numeric_value=Decimal("1"),
        )
    with pytest.raises(PermissionDenied):
        create_monitoring_point(
            actor=manager_b,
            organization=org_a,
            code="XORG",
            name="Bad",
        )


@pytest.mark.django_db
def test_historical_spec_version_frozen() -> None:
    org = make_org(code=f"E{uuid.uuid4().hex[:6].upper()}")
    manager = _manager(org=org)
    point, param = _setup_point_param(manager, org)
    spec = create_monitoring_spec(
        actor=manager, organization=org, code=f"SP-{uuid.uuid4().hex[:5].upper()}", title="Hist"
    )
    v1 = create_draft_spec_version(actor=manager, spec_id=spec.id)
    add_limit_rule(
        actor=manager,
        spec_version_id=v1.id,
        monitoring_point=point,
        parameter=param,
        bound_min=Decimal("0"),
        bound_max=Decimal("10"),
    )
    approve_spec_version(actor=manager, spec_version_id=v1.id)
    v1.refresh_from_db()
    reading, excursion = record_monitoring_reading(
        actor=manager,
        organization=org,
        monitoring_point=point,
        parameter=param,
        source_type=MonitoringSourceType.MANUAL,
        numeric_value=Decimal("5"),
        spec_version=v1,
    )
    frozen = dict(excursion.frozen_limit_context)
    assert frozen["spec_version_id"] == str(v1.id)
    assert frozen["bound_max"] in {"10", "10.000000"}

    retire_spec_version(actor=manager, spec_version_id=v1.id)
    v1.refresh_from_db()
    assert v1.status == MonitoringSpecVersionStatus.RETIRED
    # Historical reading retains PROTECT FK + frozen context.
    reading.refresh_from_db()
    assert reading.spec_version_id == v1.id
    excursion.refresh_from_db()
    assert excursion.frozen_limit_context == frozen

    with pytest.raises(ValidationError):
        add_limit_rule(
            actor=manager,
            spec_version_id=v1.id,
            monitoring_point=point,
            parameter=param,
            bound_max=Decimal("99"),
        )


@pytest.mark.django_db
def test_schedule_link_and_location_scope() -> None:
    org = make_org(code=f"E{uuid.uuid4().hex[:6].upper()}")
    manager = _manager(org=org)
    point, param = _setup_point_param(manager, org)
    template = create_checklist_template(
        actor=manager,
        organization=org,
        code=f"CL-{uuid.uuid4().hex[:5].upper()}",
        name="EM checklist shell",
    )
    version = create_checklist_version(actor=manager, template_id=template.id)
    section = add_checklist_section(actor=manager, version_id=version.id, title="S")
    add_checklist_item(
        actor=manager,
        section_id=section.id,
        code="R1",
        label="Reading",
        response_type=ChecklistResponseType.NUMBER,
        is_required=True,
    )
    publish_checklist_version(actor=manager, version_id=version.id)
    schedule = create_checklist_schedule(
        actor=manager,
        organization_id=org.id,
        checklist_template_id=template.id,
        code=f"SCH-{uuid.uuid4().hex[:5].upper()}",
        name="EM recurring shell",
        trigger_type=ChecklistTriggerType.MANUAL,
    )
    link = link_monitoring_schedule(
        actor=manager,
        organization=org,
        monitoring_point=point,
        parameter=param,
        checklist_schedule=schedule,
        label="Periodic EM",
    )
    assert link.checklist_schedule_id == schedule.id
    assert point.site_id is not None
    assert point.room_code == "ROOM-OPAQUE"


@pytest.mark.django_db
@override_settings(ENVIRONMENTAL_AUTO_HOLD_APPROVED=True)
def test_auto_hold_when_dual_gate_enabled() -> None:
    org = make_org(code=f"E{uuid.uuid4().hex[:6].upper()}")
    manager = _manager(org=org)
    point, param = _setup_point_param(manager, org)
    upsert_environmental_excursion_policy(
        actor=manager, organization=org, auto_hold_enabled=True, procedure_reference="OPAQUE"
    )
    spec = create_monitoring_spec(
        actor=manager, organization=org, code=f"SP-{uuid.uuid4().hex[:5].upper()}", title="Hold"
    )
    version = create_draft_spec_version(actor=manager, spec_id=spec.id)
    add_limit_rule(
        actor=manager,
        spec_version_id=version.id,
        monitoring_point=point,
        parameter=param,
        bound_max=Decimal("1"),
    )
    approve_spec_version(actor=manager, spec_version_id=version.id)
    version.refresh_from_db()
    _reading, excursion = record_monitoring_reading(
        actor=manager,
        organization=org,
        monitoring_point=point,
        parameter=param,
        source_type=MonitoringSourceType.MANUAL,
        numeric_value=Decimal("9"),
    )
    assert excursion.auto_hold_created is True
    assert excursion.hold_case_id is not None


@pytest.mark.django_db
def test_warning_band_evaluation() -> None:
    org = make_org(code=f"E{uuid.uuid4().hex[:6].upper()}")
    manager = _manager(org=org)
    point, param = _setup_point_param(manager, org)
    from apps.environmental.selectors import (
        parameters_for_organization,
        points_for_organization,
        specs_for_organization,
    )

    assert points_for_organization(org.id).filter(pk=point.id).exists()
    assert parameters_for_organization(org.id).filter(pk=param.id).exists()
    spec = create_monitoring_spec(
        actor=manager, organization=org, code=f"SP-{uuid.uuid4().hex[:5].upper()}", title="Warn"
    )
    assert specs_for_organization(org.id).filter(pk=spec.id).exists()
    version = create_draft_spec_version(actor=manager, spec_id=spec.id)
    add_limit_rule(
        actor=manager,
        spec_version_id=version.id,
        monitoring_point=point,
        parameter=param,
        bound_min=Decimal("0"),
        bound_max=Decimal("10"),
        warn_min=Decimal("2"),
        warn_max=Decimal("8"),
    )
    approve_spec_version(actor=manager, spec_version_id=version.id)
    version.refresh_from_db()
    _reading, excursion = record_monitoring_reading(
        actor=manager,
        organization=org,
        monitoring_point=point,
        parameter=param,
        source_type=MonitoringSourceType.MANUAL,
        numeric_value=Decimal("1.5"),
        spec_version=version,
    )
    assert excursion.outcome == MonitoringEvaluationOutcome.WARN
    assert excursion.hold_recommended is False
    assert (
        evaluate_excursion_hold_policy(
            organization_id=org.id, evaluation_outcome=MonitoringEvaluationOutcome.WARN
        ).as_dict()["create_hold"]
        is False
    )
