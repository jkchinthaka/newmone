"""Phase 05D equipment and calibration foundation — synthetic codes only."""

from __future__ import annotations

import datetime

import pytest
from django.contrib.admin.sites import site as admin_site
from django.contrib.auth.models import Permission
from django.contrib.contenttypes.models import ContentType
from django.core.exceptions import PermissionDenied, ValidationError
from django.http import QueryDict
from tests.factories import grant_role, make_org, make_site, make_user

from apps.access_control.services import create_role
from apps.checklists.models import ChecklistItem
from apps.checklists.services import (
    add_checklist_item,
    add_checklist_section,
    create_checklist_template,
    create_checklist_version,
)
from apps.instruments.admin import CalibrationRecordAdmin, EquipmentAdmin
from apps.instruments.historical_safety import (
    refuse_hard_delete_calibration,
    refuse_hard_delete_equipment,
)
from apps.instruments.models import (
    CalibrationFitness,
    CalibrationRecord,
    Equipment,
    EquipmentOperationalStatus,
    EquipmentType,
    evaluate_calibration_fitness,
)
from apps.instruments.selectors import (
    equipment_fitness_label,
    get_equipment,
    list_calibration_records,
    list_equipment,
)
from apps.instruments.services import (
    activate_equipment,
    create_calibration_record,
    create_equipment,
    deactivate_equipment,
    delete_calibration_record,
    delete_equipment,
    get_equipment_calibration_fitness,
    set_equipment_operational_status,
    update_calibration_certificate_metadata,
    update_equipment,
)
from apps.organizations.models import Organization
from apps.security_audit.models import SecurityAuditEvent


def _equip_perm(codename: str) -> Permission:
    ct = ContentType.objects.get_for_model(Equipment)
    perm, _ = Permission.objects.get_or_create(
        content_type=ct,
        codename=codename,
        defaults={"name": codename},
    )
    return perm


@pytest.mark.django_db
def test_equipment_identity_normalized_unique_within_org() -> None:
    org = make_org(code="ORG05D1")
    actor = make_user(employee_code="EQ05D01", is_superuser=True)
    create_equipment(
        actor=actor,
        organization=org,
        code=" syn-scale-1 ",
        name="Synthetic Scale",
        equipment_type=EquipmentType.SCALE,
    )
    with pytest.raises(ValidationError):
        create_equipment(
            actor=actor,
            organization=org,
            code="SYN-SCALE-1",
            name="Dup",
            equipment_type=EquipmentType.SCALE,
        )


@pytest.mark.django_db
def test_cross_org_and_operator_denied() -> None:
    org_a = make_org(code="ORG05DA")
    org_b = make_org(code="ORG05DB")
    manager = make_user(employee_code="EQ05D02", is_staff=True)
    role = create_role(
        code="R05DEQ",
        name="Equip manager",
        permissions=[_equip_perm("manage_equipment"), _equip_perm("view_equipment")],
    )
    grant_role(manager, role, organization=org_a)
    create_equipment(actor=manager, organization=org_a, code="EQA1", name="A")
    with pytest.raises(PermissionDenied):
        create_equipment(actor=manager, organization=org_b, code="EQB1", name="B")
    operator = make_user(employee_code="EQ05DOP", is_staff=True)
    with pytest.raises(PermissionDenied):
        create_equipment(actor=operator, organization=org_a, code="EQOP", name="Denied")


@pytest.mark.django_db
def test_inactive_equipment_preserves_calibration_history() -> None:
    org = make_org(code="ORG05D2")
    actor = make_user(employee_code="EQ05D03", is_superuser=True)
    equipment = create_equipment(
        actor=actor,
        organization=org,
        code="EQHIST",
        name="Hist Probe",
        equipment_type=EquipmentType.PROBE,
    )
    record = create_calibration_record(
        actor=actor,
        equipment_id=equipment.id,
        calibrated_on=datetime.date(2026, 1, 1),
        next_due_on=datetime.date(2026, 6, 1),
        certificate_reference="CERT-SYN-1",
    )
    deactivate_equipment(actor=actor, equipment_id=equipment.id)
    equipment.refresh_from_db()
    assert equipment.is_active is False
    assert CalibrationRecord.objects.filter(pk=record.pk).exists()
    assert (
        evaluate_calibration_fitness(equipment, as_of=datetime.date(2026, 3, 1))
        == CalibrationFitness.OUT_OF_SERVICE
    )
    with pytest.raises(ValidationError):
        refuse_hard_delete_equipment(equipment)
    with pytest.raises(ValidationError):
        refuse_hard_delete_calibration(record)
    with pytest.raises(ValidationError):
        delete_equipment(equipment)
    with pytest.raises(ValidationError):
        delete_calibration_record(record)


@pytest.mark.django_db
def test_due_overdue_valid_and_invalid_dates() -> None:
    org = make_org(code="ORG05D3")
    actor = make_user(employee_code="EQ05D04", is_superuser=True)
    equipment = create_equipment(
        actor=actor,
        organization=org,
        code="EQCAL",
        name="Therm",
        equipment_type=EquipmentType.THERMOMETER,
    )
    assert (
        evaluate_calibration_fitness(equipment, as_of=datetime.date(2026, 1, 15))
        == CalibrationFitness.UNKNOWN
    )
    create_calibration_record(
        actor=actor,
        equipment_id=equipment.id,
        calibrated_on=datetime.date(2026, 1, 1),
        next_due_on=datetime.date(2026, 1, 10),
    )
    assert (
        evaluate_calibration_fitness(equipment, as_of=datetime.date(2026, 1, 5))
        == CalibrationFitness.VALID
    )
    assert (
        evaluate_calibration_fitness(equipment, as_of=datetime.date(2026, 1, 10))
        == CalibrationFitness.DUE
    )
    assert (
        evaluate_calibration_fitness(equipment, as_of=datetime.date(2026, 1, 11))
        == CalibrationFitness.OVERDUE
    )
    with pytest.raises(ValidationError):
        create_calibration_record(
            actor=actor,
            equipment_id=equipment.id,
            calibrated_on=datetime.date(2026, 2, 1),
            next_due_on=datetime.date(2026, 1, 1),
        )


@pytest.mark.django_db
def test_status_change_and_certificate_metadata_audited() -> None:
    org = make_org(code="ORG05D4")
    actor = make_user(employee_code="EQ05D05", is_superuser=True)
    equipment = create_equipment(
        actor=actor,
        organization=org,
        code="EQSTAT",
        name="MD",
        equipment_type=EquipmentType.METAL_DETECTOR,
    )
    set_equipment_operational_status(
        actor=actor,
        equipment_id=equipment.id,
        operational_status=EquipmentOperationalStatus.OUT_OF_SERVICE,
    )
    assert SecurityAuditEvent.objects.filter(event_type="EQUIPMENT_STATUS_CHANGED").exists()
    record = create_calibration_record(
        actor=actor,
        equipment_id=equipment.id,
        calibrated_on=datetime.date(2026, 1, 1),
        certificate_reference="OLD",
    )
    update_calibration_certificate_metadata(
        actor=actor,
        calibration_record_id=record.id,
        certificate_reference="NEW-CERT",
        provider_reference="Lab Syn",
    )
    record.refresh_from_db()
    assert record.certificate_reference == "NEW-CERT"
    assert SecurityAuditEvent.objects.filter(
        event_type="CALIBRATION_CERTIFICATE_METADATA_UPDATED"
    ).exists()


@pytest.mark.django_db
def test_site_mismatch_and_update() -> None:
    org_a = make_org(code="ORG05D5")
    org_b = make_org(code="ORG05D6")
    site_b = make_site(org_b, code="SITE05DB")
    actor = make_user(employee_code="EQ05D06", is_superuser=True)
    with pytest.raises(ValidationError):
        create_equipment(
            actor=actor,
            organization=org_a,
            code="EQBAD",
            name="Bad site",
            site=site_b,
        )
    equipment = create_equipment(
        actor=actor,
        organization=org_a,
        code="EQUPD",
        name="Upd",
        equipment_type=EquipmentType.OTHER,
    )
    updated = update_equipment(actor=actor, equipment_id=equipment.id, name="Updated Name")
    assert updated.name == "Updated Name"


@pytest.mark.django_db
def test_checklist_equipment_reference_optional_default_false() -> None:
    org = make_org(code="ORG05D7")
    actor = make_user(employee_code="EQ05D07", is_superuser=True)
    template = create_checklist_template(
        actor=actor, organization=org, code="T05D", name="Equip hook"
    )
    version = create_checklist_version(actor=actor, template_id=template.id)
    section = add_checklist_section(actor=actor, version_id=version.id, title="S1")
    item = add_checklist_item(
        actor=actor,
        section_id=section.id,
        code="I1",
        label="Temp",
        response_type="NUMBER",
    )
    assert item.requires_equipment_reference is False
    assert ChecklistItem.objects.filter(requires_equipment_reference=True).count() == 0


@pytest.mark.django_db
def test_selectors_list_activate_and_fitness() -> None:
    org = make_org(code="ORG05D8")
    actor = make_user(employee_code="EQ05D08", is_superuser=True)
    equipment = create_equipment(
        actor=actor,
        organization=org,
        code="EQSEL",
        name="Selector Probe",
        equipment_type=EquipmentType.PROBE,
        serial_number="SN-1",
    )
    create_calibration_record(
        actor=actor,
        equipment_id=equipment.id,
        calibrated_on=datetime.date(2026, 1, 1),
        next_due_on=datetime.date(2026, 12, 31),
    )
    assert list_equipment(actor, organization=org, search="EQSEL").count() == 1
    assert get_equipment(actor, equipment.id) is not None
    assert list_calibration_records(actor, equipment=equipment).count() == 1
    assert equipment_fitness_label(equipment) == CalibrationFitness.VALID
    deactivate_equipment(actor=actor, equipment_id=equipment.id)
    activate_equipment(actor=actor, equipment_id=equipment.id)
    equipment.refresh_from_db()
    assert equipment.is_active is True
    set_equipment_operational_status(
        actor=actor,
        equipment_id=equipment.id,
        operational_status=EquipmentOperationalStatus.OUT_OF_SERVICE,
    )
    equipment.refresh_from_db()
    assert (
        get_equipment_calibration_fitness(equipment, as_of=datetime.date(2026, 1, 1))
        == CalibrationFitness.OUT_OF_SERVICE
    )


@pytest.mark.django_db
def test_site_only_cannot_create_org_wide_equipment() -> None:
    org = make_org(code="ORG05D9")
    site = make_site(org, code="SITE05D9")
    user = make_user(employee_code="EQ05D09", is_staff=True)
    role = create_role(
        code="R05DSITE",
        name="Site equip",
        permissions=[_equip_perm("manage_equipment"), _equip_perm("view_equipment")],
    )
    grant_role(user, role, organization=org, site=site)
    with pytest.raises(PermissionDenied):
        create_equipment(actor=user, organization=org, code="EQORG", name="Org wide")
    # Organization-scoped equipment administration (FG Product pattern).
    with pytest.raises(PermissionDenied):
        create_equipment(
            actor=user,
            organization=org,
            site=site,
            code="EQSITE",
            name="Site asset",
            equipment_type=EquipmentType.SCALE,
        )


@pytest.mark.django_db
def test_authorization_and_validation_coverage_edges() -> None:
    import uuid

    from django.db import IntegrityError, transaction

    from apps.instruments.models import CalibrationRecordStatus
    from apps.instruments.selectors import (
        actor_can_manage_equipment,
        actor_can_manage_equipment_asset,
        actor_can_view_equipment,
    )

    org_a = make_org(code="ORG05DCV")
    org_b = make_org(code="ORG05DCV2")
    actor = make_user(employee_code="EQ05DCV", is_staff=True)
    role = create_role(
        code="R05DCV",
        name="Equip cv",
        permissions=[_equip_perm("manage_equipment"), _equip_perm("view_equipment")],
    )
    grant_role(actor, role, organization=org_a)
    viewer = make_user(employee_code="EQ05DCVV")
    grant_role(
        viewer,
        create_role(
            code="R05DCVV",
            name="Equip view",
            permissions=[_equip_perm("view_equipment")],
        ),
        organization=org_a,
    )

    with pytest.raises(ValidationError):
        create_equipment(actor=actor, organization=org_a, code="  ", name="X")
    with pytest.raises(ValidationError):
        create_equipment(actor=actor, organization=org_a, code="X", name="  ")
    with pytest.raises(ValidationError):
        create_equipment(
            actor=actor, organization=org_a, code="BADT", name="Bad", equipment_type="NOPE"
        )
    equipment = create_equipment(actor=actor, organization=org_a, code="EQCV1", name="Cover")
    with pytest.raises(IntegrityError), transaction.atomic():
        Equipment.objects.create(organization=org_a, code="EQCV1", name="DupDB")

    update_equipment(actor=actor, equipment_id=equipment.id, name="Cover")
    with pytest.raises(ValidationError):
        update_equipment(actor=actor, equipment_id=uuid.uuid4(), name="Missing")
    with pytest.raises(ValidationError):
        update_equipment(actor=actor, equipment_id=equipment.id, code="  ")
    with pytest.raises(ValidationError):
        activate_equipment(actor=actor, equipment_id=uuid.uuid4())
    with pytest.raises(ValidationError):
        deactivate_equipment(actor=actor, equipment_id=uuid.uuid4())
    with pytest.raises(ValidationError):
        create_calibration_record(
            actor=actor, equipment_id=uuid.uuid4(), calibrated_on=datetime.date(2026, 1, 1)
        )

    record = create_calibration_record(
        actor=actor,
        equipment_id=equipment.id,
        calibrated_on=datetime.date(2026, 1, 1),
        certificate_reference="C1",
    )
    update_calibration_certificate_metadata(
        actor=actor,
        calibration_record_id=record.id,
        certificate_reference="C2",
        provider_reference="P2",
        notes="n2",
    )
    update_calibration_certificate_metadata(
        actor=actor, calibration_record_id=record.id, certificate_reference="C2"
    )
    with pytest.raises(ValidationError):
        update_calibration_certificate_metadata(
            actor=actor, calibration_record_id=uuid.uuid4(), certificate_reference="X"
        )

    assert actor_can_view_equipment(viewer) is True
    assert actor_can_manage_equipment(viewer) is False
    assert actor_can_manage_equipment_asset(None, equipment) is False
    assert get_equipment(viewer, equipment.id) is not None
    assert get_equipment(viewer, uuid.uuid4()) is None
    assert list_equipment(None).count() == 0
    assert list_equipment(viewer, status="inactive").count() == 0
    assert list_equipment(viewer, equipment_type=EquipmentType.OTHER).count() == 1
    assert list_equipment(viewer, organization=org_b).count() == 0
    other = create_equipment(
        actor=make_user(employee_code="EQ05DCVB", is_superuser=True),
        organization=org_b,
        code="EQCVB",
        name="B",
    )
    with pytest.raises(PermissionDenied):
        get_equipment(viewer, other.id)
    with pytest.raises(PermissionDenied):
        list_calibration_records(viewer, equipment=other)

    CalibrationRecord.objects.filter(pk=record.pk).update(status=CalibrationRecordStatus.VOID)
    assert (
        evaluate_calibration_fitness(equipment, as_of=datetime.date(2026, 1, 2))
        == CalibrationFitness.UNKNOWN
    )
    with pytest.raises(ValidationError):
        Equipment(organization=org_a, code="", name="").full_clean()
    with pytest.raises(ValidationError):
        CalibrationRecord(
            equipment=equipment,
            calibrated_on=datetime.date(2026, 2, 1),
            next_due_on=datetime.date(2026, 1, 1),
            recorded_by=actor,
        ).full_clean()


@pytest.mark.django_db
def test_admin_blocks_hard_delete() -> None:
    request = type(
        "R",
        (),
        {
            "user": make_user(employee_code="EQ05DADM", is_superuser=True),
            "GET": QueryDict(),
        },
    )()
    assert EquipmentAdmin(Equipment, admin_site).has_delete_permission(request) is False
    assert (
        CalibrationRecordAdmin(CalibrationRecord, admin_site).has_delete_permission(request)
        is False
    )
    assert "delete_selected" not in EquipmentAdmin(Equipment, admin_site).get_actions(request)


@pytest.mark.django_db
def test_no_seeded_equipment_assets() -> None:
    assert Equipment.objects.count() == 0
    assert Organization.objects.filter(code__iexact="NELNA").count() == 0
