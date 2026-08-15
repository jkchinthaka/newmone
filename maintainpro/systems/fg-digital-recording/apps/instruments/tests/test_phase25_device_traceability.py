"""Phase 25 — measurement device traceability tests."""

from __future__ import annotations

import datetime
import uuid
from decimal import Decimal
from typing import Any

import pytest
from django.contrib.auth.models import Permission
from django.contrib.contenttypes.models import ContentType
from django.core.exceptions import ValidationError
from django.test import override_settings
from django.utils import timezone
from tests.factories import grant_role, make_org, make_role_with_permission, make_user

from apps.accounts.models import User
from apps.checklists.models import ChecklistResponseType, ChecklistTemplate
from apps.checklists.services import (
    add_checklist_item,
    add_checklist_section,
    create_checklist_template,
    create_checklist_version,
    publish_checklist_version,
)
from apps.evidence.linking import resolve_linked_target
from apps.evidence.models import EvidenceLinkedKind
from apps.instruments.device_traceability import (
    apply_calibration_policy,
    assess_device_eligibility,
    build_device_trace_snapshot,
    equipment_choice_label,
)
from apps.instruments.models import (
    CalibrationFitness,
    Equipment,
    EquipmentOperationalStatus,
    EquipmentType,
)
from apps.instruments.services import create_calibration_record, create_equipment
from apps.organizations.models import Organization
from apps.recording.models import ChecklistRecord, ChecklistResponse, ChecklistSubmissionResponse
from apps.recording.services import (
    save_checklist_draft_responses,
    start_checklist_recording,
    submit_checklist_record,
)
from apps.scheduling.models import ChecklistTask
from apps.scheduling.services import create_batch_checklist_task
from apps.security_audit.models import SecurityAuditEvent


def _perm(model: type[Any], codename: str) -> Permission:
    ct = ContentType.objects.get_for_model(model)
    permission, _ = Permission.objects.get_or_create(
        content_type=ct,
        codename=codename,
        defaults={"name": f"Can {codename.replace('_', ' ')}"},
    )
    return permission


def _grant(user: User, org: Organization, model: type[Any], *codenames: str) -> None:
    suffix = uuid.uuid4().hex[:6].upper()
    role = make_role_with_permission(
        code=f"D{suffix}",
        name=f"Device role {suffix}",
        permission=_perm(model, codenames[0]),
    )
    for code in codenames[1:]:
        role.permissions.add(_perm(model, code))
    grant_role(user, role, organization=org)


def _task_manager(*, org: Organization) -> User:
    suffix = uuid.uuid4().hex[:6].upper()
    user = make_user(employee_code=f"TM{suffix}", is_staff=True)
    role = make_role_with_permission(
        code=f"TM{suffix}",
        name=f"Task Manager {suffix}",
        permission=_perm(ChecklistTask, "manage_checklisttask"),
    )
    role.permissions.add(_perm(ChecklistTask, "view_checklisttask"))
    manage = _perm(ChecklistTemplate, "manage_checklist")
    view = _perm(ChecklistTemplate, "view_checklisttemplate")
    role.permissions.add(manage, view)
    grant_role(user, role, organization=org)
    return user


def _recorder(*, org: Organization) -> User:
    suffix = uuid.uuid4().hex[:6].upper()
    user = make_user(employee_code=f"RC{suffix}", is_staff=True)
    role = make_role_with_permission(
        code=f"RC{suffix}",
        name=f"Recorder {suffix}",
        permission=_perm(ChecklistTask, "record_checklisttask"),
    )
    grant_role(user, role, organization=org)
    return user


def _start_device_record(
    *,
    org: Organization,
    required_type: str = "",
) -> tuple[User, User, ChecklistRecord, Any, User]:
    manager = _task_manager(org=org)
    recorder = _recorder(org=org)
    equip_admin = make_user(employee_code=f"EQ{uuid.uuid4().hex[:6].upper()}", is_staff=True)
    _grant(equip_admin, org, Equipment, "manage_equipment", "view_equipment")

    template = create_checklist_template(
        actor=manager,
        organization=org,
        code=f"T{uuid.uuid4().hex[:6].upper()}",
        name="Device form",
    )
    version = create_checklist_version(actor=manager, template_id=template.id)
    section = add_checklist_section(actor=manager, version_id=version.id, title="S1")
    item = add_checklist_item(
        actor=manager,
        section_id=section.id,
        code="TEMP",
        label="Temperature",
        response_type=ChecklistResponseType.NUMBER,
        unit="C",
        is_required=True,
        requires_equipment_reference=True,
    )
    if required_type:
        item.required_equipment_type = required_type
        item.save(update_fields=["required_equipment_type"])
    published = publish_checklist_version(actor=manager, version_id=version.id)
    task = create_batch_checklist_task(
        actor=manager,
        organization_id=org.id,
        checklist_template_id=template.id,
        checklist_version_id=published.id,
        batch_reference=f"B-{uuid.uuid4().hex[:8].upper()}",
    )
    record = start_checklist_recording(actor=recorder, task_id=task.id)
    return manager, recorder, record, item, equip_admin


@pytest.mark.django_db
def test_valid_device_snapshot_and_historical_freeze() -> None:
    org = make_org(code=f"D{uuid.uuid4().hex[:6].upper()}")
    _, recorder, record, item, equip_admin = _start_device_record(org=org)
    equipment = create_equipment(
        actor=equip_admin,
        organization=org,
        code=f"EQ-{uuid.uuid4().hex[:5].upper()}",
        name="Probe A",
        equipment_type=EquipmentType.PROBE,
    )
    calib = create_calibration_record(
        actor=equip_admin,
        equipment_id=equipment.id,
        calibrated_on=timezone.localdate() - datetime.timedelta(days=10),
        next_due_on=timezone.localdate() + datetime.timedelta(days=20),
        certificate_reference="CERT-OPAQUE-1",
    )
    save_checklist_draft_responses(
        actor=recorder,
        record_id=record.id,
        answers={(item.id, 1): Decimal("4.5")},
        equipment_refs={(item.id, 1): str(equipment.id)},
    )
    response = ChecklistResponse.objects.get(
        checklist_record=record, checklist_item=item, sample_index=1
    )
    assert response.equipment_id == equipment.id
    assert response.calibration_record_id == calib.id
    assert response.device_trace_context is not None
    assert response.device_trace_context["fitness_at_measurement"] == CalibrationFitness.VALID
    assert response.device_trace_context["certificate_reference"] == "CERT-OPAQUE-1"
    assert response.device_trace_context["not_qa_disposition"] is True
    frozen = dict(response.device_trace_context)

    equipment.name = "Renamed later"
    equipment.save(update_fields=["name", "updated_at"])
    response.refresh_from_db()
    assert response.device_trace_context == frozen
    assert response.device_trace_context["equipment_name"] == "Probe A"

    submit_checklist_record(actor=recorder, record_id=record.id)
    snap = ChecklistSubmissionResponse.objects.get(checklist_item=item, sample_index=1)
    assert snap.equipment_id == equipment.id
    assert snap.calibration_record_id == calib.id
    assert snap.device_trace_context is not None
    assert snap.device_trace_context["equipment_name"] == "Probe A"
    assert snap.device_trace_context["calibration_record_id"] == str(calib.id)


@pytest.mark.django_db
def test_inactive_wrong_org_wrong_type() -> None:
    org_a = make_org(code=f"A{uuid.uuid4().hex[:6].upper()}")
    org_b = make_org(code=f"B{uuid.uuid4().hex[:6].upper()}")
    equip_a = make_user(employee_code=f"EA{uuid.uuid4().hex[:6].upper()}", is_staff=True)
    equip_b = make_user(employee_code=f"EB{uuid.uuid4().hex[:6].upper()}", is_staff=True)
    _grant(equip_a, org_a, Equipment, "manage_equipment", "view_equipment")
    _grant(equip_b, org_b, Equipment, "manage_equipment", "view_equipment")
    eq_a = create_equipment(
        actor=equip_a,
        organization=org_a,
        code=f"EQA-{uuid.uuid4().hex[:4].upper()}",
        name="Scale",
        equipment_type=EquipmentType.SCALE,
    )
    eq_b = create_equipment(
        actor=equip_b,
        organization=org_b,
        code=f"EQB-{uuid.uuid4().hex[:4].upper()}",
        name="Foreign",
        equipment_type=EquipmentType.SCALE,
    )
    inactive = create_equipment(
        actor=equip_a,
        organization=org_a,
        code=f"EQI-{uuid.uuid4().hex[:4].upper()}",
        name="Inactive",
        equipment_type=EquipmentType.PROBE,
        is_active=False,
    )
    assert (
        assess_device_eligibility(equipment=eq_b, organization_id=org_a.id).reason_code
        == "WRONG_ORGANIZATION"
    )
    assert (
        assess_device_eligibility(equipment=inactive, organization_id=org_a.id).reason_code
        == "INACTIVE_DEVICE"
    )
    assert (
        assess_device_eligibility(
            equipment=eq_a,
            organization_id=org_a.id,
            required_equipment_type=EquipmentType.THERMOMETER,
        ).reason_code
        == "WRONG_EQUIPMENT_TYPE"
    )

    _, recorder, record, item, _ = _start_device_record(
        org=org_a, required_type=EquipmentType.THERMOMETER
    )
    with pytest.raises(ValidationError):
        save_checklist_draft_responses(
            actor=recorder,
            record_id=record.id,
            answers={(item.id, 1): Decimal("1")},
            equipment_refs={(item.id, 1): str(eq_a.id)},
        )


@pytest.mark.django_db
@override_settings(INSTRUMENTS_CALIBRATION_ENFORCEMENT="OFF")
def test_expired_calibration_policy_off_allows() -> None:
    org = make_org(code=f"D{uuid.uuid4().hex[:6].upper()}")
    admin = make_user(employee_code=f"U{uuid.uuid4().hex[:6].upper()}", is_staff=True)
    _grant(admin, org, Equipment, "manage_equipment", "view_equipment")
    equipment = create_equipment(
        actor=admin,
        organization=org,
        code=f"EQ-{uuid.uuid4().hex[:5].upper()}",
        name="Overdue probe",
        equipment_type=EquipmentType.PROBE,
    )
    create_calibration_record(
        actor=admin,
        equipment_id=equipment.id,
        calibrated_on=timezone.localdate() - datetime.timedelta(days=40),
        next_due_on=timezone.localdate() - datetime.timedelta(days=5),
    )
    eligibility = assess_device_eligibility(equipment=equipment, organization_id=org.id)
    assert eligibility.fitness == CalibrationFitness.OVERDUE
    policy = apply_calibration_policy(eligibility=eligibility)
    assert policy.allowed is True
    assert policy.outcome == "ALLOW"


@pytest.mark.django_db
@override_settings(INSTRUMENTS_CALIBRATION_ENFORCEMENT="WARN")
def test_expired_calibration_warn_allows_advisory() -> None:
    org = make_org(code=f"D{uuid.uuid4().hex[:6].upper()}")
    admin = make_user(employee_code=f"U{uuid.uuid4().hex[:6].upper()}", is_staff=True)
    _grant(admin, org, Equipment, "manage_equipment", "view_equipment")
    equipment = create_equipment(
        actor=admin,
        organization=org,
        code=f"EQ-{uuid.uuid4().hex[:5].upper()}",
        name="Warn probe",
        equipment_type=EquipmentType.PROBE,
    )
    create_calibration_record(
        actor=admin,
        equipment_id=equipment.id,
        calibrated_on=timezone.localdate() - datetime.timedelta(days=40),
        next_due_on=timezone.localdate() - datetime.timedelta(days=1),
    )
    eligibility = assess_device_eligibility(equipment=equipment, organization_id=org.id)
    policy = apply_calibration_policy(eligibility=eligibility)
    assert policy.allowed is True
    assert policy.outcome == "WARN"
    snap = build_device_trace_snapshot(
        equipment=equipment,
        calibration_record=eligibility.calibration_record,
        fitness=eligibility.fitness,
        policy=policy,
    )
    assert snap["policy"]["outcome"] == "WARN"


@pytest.mark.django_db
@override_settings(
    INSTRUMENTS_CALIBRATION_ENFORCEMENT="BLOCK",
    INSTRUMENTS_CALIBRATION_OVERRIDE_APPROVED=False,
)
def test_block_policy_enabled_without_override() -> None:
    org = make_org(code=f"D{uuid.uuid4().hex[:6].upper()}")
    _, recorder, record, item, equip_admin = _start_device_record(org=org)
    equipment = create_equipment(
        actor=equip_admin,
        organization=org,
        code=f"EQ-{uuid.uuid4().hex[:5].upper()}",
        name="Blocked",
        equipment_type=EquipmentType.PROBE,
    )
    create_calibration_record(
        actor=equip_admin,
        equipment_id=equipment.id,
        calibrated_on=timezone.localdate() - datetime.timedelta(days=40),
        next_due_on=timezone.localdate() - datetime.timedelta(days=1),
    )
    with pytest.raises(ValidationError):
        save_checklist_draft_responses(
            actor=recorder,
            record_id=record.id,
            answers={(item.id, 1): Decimal("2")},
            equipment_refs={(item.id, 1): str(equipment.id)},
        )


@pytest.mark.django_db
@override_settings(
    INSTRUMENTS_CALIBRATION_ENFORCEMENT="BLOCK",
    INSTRUMENTS_CALIBRATION_OVERRIDE_APPROVED=True,
)
def test_override_when_approved() -> None:
    org = make_org(code=f"D{uuid.uuid4().hex[:6].upper()}")
    _, recorder, record, item, equip_admin = _start_device_record(org=org)
    _grant(recorder, org, Equipment, "override_calibration_gate")
    equipment = create_equipment(
        actor=equip_admin,
        organization=org,
        code=f"EQ-{uuid.uuid4().hex[:5].upper()}",
        name="Override probe",
        equipment_type=EquipmentType.PROBE,
    )
    create_calibration_record(
        actor=equip_admin,
        equipment_id=equipment.id,
        calibrated_on=timezone.localdate() - datetime.timedelta(days=40),
        next_due_on=timezone.localdate() - datetime.timedelta(days=1),
    )
    save_checklist_draft_responses(
        actor=recorder,
        record_id=record.id,
        answers={(item.id, 1): Decimal("3")},
        equipment_refs={(item.id, 1): str(equipment.id)},
        calibration_overrides={(item.id, 1): {"override": True, "reason": "Emergency line check"}},
    )
    response = ChecklistResponse.objects.get(checklist_record=record, checklist_item=item)
    assert response.device_trace_context is not None
    assert response.device_trace_context["policy"]["outcome"] == "OVERRIDE"
    assert SecurityAuditEvent.objects.filter(event_type="DEVICE_CALIBRATION_OVERRIDE").exists()


@pytest.mark.django_db
def test_out_of_service_and_certificate_evidence_link() -> None:
    org = make_org(code=f"D{uuid.uuid4().hex[:6].upper()}")
    admin = make_user(employee_code=f"U{uuid.uuid4().hex[:6].upper()}", is_staff=True)
    _grant(admin, org, Equipment, "manage_equipment", "view_equipment")
    equipment = create_equipment(
        actor=admin,
        organization=org,
        code=f"EQ-{uuid.uuid4().hex[:5].upper()}",
        name="OOS",
        equipment_type=EquipmentType.SCALE,
        operational_status=EquipmentOperationalStatus.OUT_OF_SERVICE,
    )
    decision = assess_device_eligibility(equipment=equipment, organization_id=org.id)
    assert decision.reason_code == "OUT_OF_SERVICE"
    assert equipment.code in equipment_choice_label(equipment)

    live = create_equipment(
        actor=admin,
        organization=org,
        code=f"EQC-{uuid.uuid4().hex[:4].upper()}",
        name="Cert device",
        equipment_type=EquipmentType.SCALE,
    )
    calib = create_calibration_record(
        actor=admin,
        equipment_id=live.id,
        calibrated_on=timezone.localdate(),
        certificate_reference="CERT-LINK",
    )
    target = resolve_linked_target(
        kind=EvidenceLinkedKind.CALIBRATION_CERTIFICATE,
        object_id=calib.id,
    )
    assert target.organization_id == org.id
    assert target.linkage_immutable is True
