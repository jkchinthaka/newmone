"""Phase 05E training / competency foundation — synthetic codes only."""

from __future__ import annotations

import datetime
import uuid

import pytest
from django.contrib.admin.sites import site as admin_site
from django.contrib.auth.models import Permission
from django.contrib.contenttypes.models import ContentType
from django.core.exceptions import PermissionDenied, ValidationError
from django.http import QueryDict
from tests.factories import grant_role, make_org, make_site, make_user

from apps.access_control.services import create_role
from apps.checklists.services import create_checklist_template
from apps.instruments.models import EquipmentType
from apps.instruments.services import create_equipment
from apps.organizations.models import Organization
from apps.security_audit.models import SecurityAuditEvent
from apps.training.admin import TrainingEnforcementPolicyAdmin, TrainingRecordAdmin
from apps.training.historical_safety import (
    refuse_hard_delete_training_policy,
    refuse_hard_delete_training_record,
)
from apps.training.models import (
    CompetencyScopeKind,
    TrainingCurrency,
    TrainingEnforcementPolicy,
    TrainingGateMode,
    TrainingRecord,
    TrainingRecordStatus,
    evaluate_training_currency,
    resolve_training_gate_mode,
)
from apps.training.selectors import (
    actor_can_manage_training,
    actor_can_view_training,
    get_training_enforcement_policy,
    get_training_record,
    list_training_records,
    list_valid_training_for_subject,
    organization_gate_mode,
    subject_has_valid_general_training,
)
from apps.training.services import (
    RecordingGateRecommendation,
    create_training_record,
    delete_training_enforcement_policy,
    delete_training_record,
    get_training_currency,
    recommend_recording_gate_action,
    set_training_enforcement_policy,
    set_training_record_status,
    update_training_record,
)


def _trn_perm(codename: str) -> Permission:
    ct = ContentType.objects.get_for_model(TrainingRecord)
    perm, _ = Permission.objects.get_or_create(
        content_type=ct,
        codename=codename,
        defaults={"name": codename},
    )
    return perm


@pytest.mark.django_db
def test_active_training_currency_valid() -> None:
    org = make_org(code="ORG05E1")
    actor = make_user(employee_code="TR05E01", is_superuser=True)
    subject = make_user(employee_code="TR05ES1")
    record = create_training_record(
        actor=actor,
        organization=org,
        subject_user=subject,
        course_code=" syn-haccp-1 ",
        course_name="Synthetic HACCP",
        trained_on=datetime.date(2026, 1, 1),
        expires_on=datetime.date(2026, 12, 31),
    )
    assert record.course_code == "SYN-HACCP-1"
    assert (
        evaluate_training_currency(record, as_of=datetime.date(2026, 6, 1))
        == TrainingCurrency.VALID
    )
    assert get_training_currency(record, as_of=datetime.date(2026, 6, 1)) == TrainingCurrency.VALID


@pytest.mark.django_db
def test_expired_and_future_training() -> None:
    org = make_org(code="ORG05E2")
    actor = make_user(employee_code="TR05E02", is_superuser=True)
    subject = make_user(employee_code="TR05ES2")
    expired = create_training_record(
        actor=actor,
        organization=org,
        subject_user=subject,
        course_code="COURSE-EXP",
        trained_on=datetime.date(2025, 1, 1),
        expires_on=datetime.date(2025, 6, 1),
    )
    future = create_training_record(
        actor=actor,
        organization=org,
        subject_user=subject,
        course_code="COURSE-FUT",
        trained_on=datetime.date(2026, 8, 15),
        expires_on=datetime.date(2027, 1, 1),
    )
    as_of = datetime.date(2026, 8, 1)
    assert evaluate_training_currency(expired, as_of=as_of) == TrainingCurrency.EXPIRED
    assert evaluate_training_currency(future, as_of=as_of) == TrainingCurrency.FUTURE
    assert (
        subject_has_valid_general_training(
            organization=org,
            subject_user=subject,
            course_code="COURSE-EXP",
            as_of=as_of,
        )
        is False
    )


@pytest.mark.django_db
def test_scope_associations_and_invalid_dates() -> None:
    org = make_org(code="ORG05E3")
    actor = make_user(employee_code="TR05E03", is_superuser=True)
    subject = make_user(employee_code="TR05ES3")
    template = create_checklist_template(
        actor=actor, organization=org, code="T05E", name="Train hook"
    )
    equipment = create_equipment(
        actor=actor,
        organization=org,
        code="EQ05E",
        name="Scale",
        equipment_type=EquipmentType.SCALE,
    )
    role = create_role(code="R05ESCOPE", name="Synthetic role")

    create_training_record(
        actor=actor,
        organization=org,
        subject_user=subject,
        course_code="CL-SCOPE",
        trained_on=datetime.date(2026, 1, 1),
        competency_scope=CompetencyScopeKind.CHECKLIST,
        checklist_template=template,
    )
    create_training_record(
        actor=actor,
        organization=org,
        subject_user=subject,
        course_code="PR-SCOPE",
        trained_on=datetime.date(2026, 1, 1),
        competency_scope=CompetencyScopeKind.PROCESS,
        process_reference="COOK-LINE-A",
    )
    create_training_record(
        actor=actor,
        organization=org,
        subject_user=subject,
        course_code="EQ-SCOPE",
        trained_on=datetime.date(2026, 1, 1),
        competency_scope=CompetencyScopeKind.EQUIPMENT,
        equipment=equipment,
    )
    create_training_record(
        actor=actor,
        organization=org,
        subject_user=subject,
        course_code="BR-SCOPE",
        trained_on=datetime.date(2026, 1, 1),
        competency_scope=CompetencyScopeKind.BUSINESS_ROLE,
        business_role=role,
    )
    with pytest.raises(ValidationError):
        create_training_record(
            actor=actor,
            organization=org,
            subject_user=subject,
            course_code="BAD-DATE",
            trained_on=datetime.date(2026, 2, 1),
            expires_on=datetime.date(2026, 1, 1),
        )
    with pytest.raises(ValidationError):
        create_training_record(
            actor=actor,
            organization=org,
            subject_user=subject,
            course_code="BAD-CL",
            trained_on=datetime.date(2026, 1, 1),
            competency_scope=CompetencyScopeKind.CHECKLIST,
        )


@pytest.mark.django_db
def test_cross_org_and_operator_authorization() -> None:
    org_a = make_org(code="ORG05EA")
    org_b = make_org(code="ORG05EB")
    manager = make_user(employee_code="TR05E04", is_staff=True)
    role = create_role(
        code="R05ETRN",
        name="Training manager",
        permissions=[_trn_perm("manage_trainingrecord"), _trn_perm("view_trainingrecord")],
    )
    grant_role(manager, role, organization=org_a)
    subject = make_user(employee_code="TR05ES4")
    create_training_record(
        actor=manager,
        organization=org_a,
        subject_user=subject,
        course_code="ORG-A",
        trained_on=datetime.date(2026, 1, 1),
    )
    with pytest.raises(PermissionDenied):
        create_training_record(
            actor=manager,
            organization=org_b,
            subject_user=subject,
            course_code="ORG-B",
            trained_on=datetime.date(2026, 1, 1),
        )
    operator = make_user(employee_code="TR05EOP", is_staff=True)
    with pytest.raises(PermissionDenied):
        create_training_record(
            actor=operator,
            organization=org_a,
            subject_user=subject,
            course_code="DENY",
            trained_on=datetime.date(2026, 1, 1),
        )


@pytest.mark.django_db
def test_site_only_cannot_manage_training() -> None:
    org = make_org(code="ORG05E9")
    site = make_site(org, code="SITE05E9")
    user = make_user(employee_code="TR05E09", is_staff=True)
    role = create_role(
        code="R05ESITE",
        name="Site training",
        permissions=[_trn_perm("manage_trainingrecord"), _trn_perm("view_trainingrecord")],
    )
    grant_role(user, role, organization=org, site=site)
    subject = make_user(employee_code="TR05ES9")
    with pytest.raises(PermissionDenied):
        create_training_record(
            actor=user,
            organization=org,
            subject_user=subject,
            course_code="SITE-DENY",
            trained_on=datetime.date(2026, 1, 1),
        )


@pytest.mark.django_db
def test_historical_persistence_after_expiry_and_status() -> None:
    org = make_org(code="ORG05E5")
    actor = make_user(employee_code="TR05E05", is_superuser=True)
    subject = make_user(employee_code="TR05ES5")
    record = create_training_record(
        actor=actor,
        organization=org,
        subject_user=subject,
        course_code="HIST-1",
        trained_on=datetime.date(2025, 1, 1),
        expires_on=datetime.date(2025, 6, 1),
        evidence_reference="CERT-SYN-1",
    )
    assert TrainingRecord.objects.filter(pk=record.pk).exists()
    assert (
        evaluate_training_currency(record, as_of=datetime.date(2026, 1, 1))
        == TrainingCurrency.EXPIRED
    )
    set_training_record_status(
        actor=actor,
        training_record_id=record.id,
        status=TrainingRecordStatus.VOID,
    )
    record.refresh_from_db()
    assert record.status == TrainingRecordStatus.VOID
    assert evaluate_training_currency(record) == TrainingCurrency.INACTIVE
    assert SecurityAuditEvent.objects.filter(event_type="TRAINING_RECORD_STATUS_CHANGED").exists()
    with pytest.raises(ValidationError):
        refuse_hard_delete_training_record(record)
    with pytest.raises(ValidationError):
        delete_training_record(record)


@pytest.mark.django_db
def test_update_and_gate_policy_recommendations() -> None:
    org = make_org(code="ORG05E6")
    actor = make_user(employee_code="TR05E06", is_superuser=True)
    subject = make_user(employee_code="TR05ES6")
    record = create_training_record(
        actor=actor,
        organization=org,
        subject_user=subject,
        course_code="GATE-1",
        trained_on=datetime.date(2026, 1, 1),
        expires_on=datetime.date(2026, 3, 1),
    )
    updated = update_training_record(
        actor=actor,
        training_record_id=record.id,
        evidence_reference="EV-2",
        trainer_reference="Trainer Syn",
    )
    assert updated.evidence_reference == "EV-2"
    assert SecurityAuditEvent.objects.filter(event_type="TRAINING_RECORD_UPDATED").exists()

    assert resolve_training_gate_mode(org.id) == TrainingGateMode.OFF
    policy = set_training_enforcement_policy(
        actor=actor,
        organization=org,
        gate_mode=TrainingGateMode.WARN,
        notes="Architectural only",
    )
    assert policy.gate_mode == TrainingGateMode.WARN
    assert SecurityAuditEvent.objects.filter(
        event_type="TRAINING_ENFORCEMENT_POLICY_CREATED"
    ).exists()
    assert organization_gate_mode(org) == TrainingGateMode.WARN

    expired_currency = evaluate_training_currency(record, as_of=datetime.date(2026, 4, 1))
    assert (
        recommend_recording_gate_action(currency=expired_currency, gate_mode=TrainingGateMode.WARN)
        == RecordingGateRecommendation.WARN
    )
    assert (
        recommend_recording_gate_action(currency=expired_currency, gate_mode=TrainingGateMode.BLOCK)
        == RecordingGateRecommendation.BLOCK
    )
    assert (
        recommend_recording_gate_action(
            currency=TrainingCurrency.VALID,
            gate_mode=TrainingGateMode.BLOCK,
        )
        == RecordingGateRecommendation.ALLOW
    )
    assert (
        recommend_recording_gate_action(currency=expired_currency, gate_mode=TrainingGateMode.OFF)
        == RecordingGateRecommendation.ALLOW
    )
    set_training_enforcement_policy(
        actor=actor,
        organization=org,
        gate_mode=TrainingGateMode.BLOCK,
        notes="still architectural",
    )
    assert SecurityAuditEvent.objects.filter(
        event_type="TRAINING_ENFORCEMENT_POLICY_UPDATED"
    ).exists()
    with pytest.raises(ValidationError):
        refuse_hard_delete_training_policy(policy)
    with pytest.raises(ValidationError):
        delete_training_enforcement_policy(policy)


@pytest.mark.django_db
def test_selectors_and_coverage_edges() -> None:
    org_a = make_org(code="ORG05ECV")
    org_b = make_org(code="ORG05ECV2")
    actor = make_user(employee_code="TR05ECV", is_staff=True)
    role = create_role(
        code="R05ECV",
        name="Train cv",
        permissions=[_trn_perm("manage_trainingrecord"), _trn_perm("view_trainingrecord")],
    )
    grant_role(actor, role, organization=org_a)
    viewer = make_user(employee_code="TR05ECVV")
    grant_role(
        viewer,
        create_role(
            code="R05ECVV",
            name="Train view",
            permissions=[_trn_perm("view_trainingrecord")],
        ),
        organization=org_a,
    )
    subject = make_user(employee_code="TR05ECVS")

    with pytest.raises(ValidationError):
        create_training_record(
            actor=actor,
            organization=org_a,
            subject_user=subject,
            course_code="  ",
            trained_on=datetime.date(2026, 1, 1),
        )
    record = create_training_record(
        actor=actor,
        organization=org_a,
        subject_user=subject,
        course_code="CV-1",
        trained_on=datetime.date(2026, 1, 1),
        expires_on=datetime.date(2026, 12, 31),
    )
    update_training_record(actor=actor, training_record_id=record.id, course_name="Same noop")
    update_training_record(actor=actor, training_record_id=record.id, course_name="Named")
    with pytest.raises(ValidationError):
        update_training_record(actor=actor, training_record_id=uuid.uuid4(), course_name="X")
    with pytest.raises(ValidationError):
        set_training_record_status(
            actor=actor, training_record_id=uuid.uuid4(), status=TrainingRecordStatus.VOID
        )
    set_training_record_status(
        actor=actor, training_record_id=record.id, status=TrainingRecordStatus.ACTIVE
    )

    assert actor_can_view_training(viewer) is True
    assert actor_can_manage_training(viewer) is False
    assert get_training_record(viewer, record.id) is not None
    assert get_training_record(viewer, uuid.uuid4()) is None
    assert list_training_records(None).count() == 0
    assert list_training_records(viewer, organization=org_a).count() == 1
    assert list_training_records(viewer, organization=org_b).count() == 0
    valid = list_valid_training_for_subject(viewer, organization=org_a, subject_user=subject)
    assert len(valid) == 1

    other = create_training_record(
        actor=make_user(employee_code="TR05ECVB", is_superuser=True),
        organization=org_b,
        subject_user=subject,
        course_code="CV-B",
        trained_on=datetime.date(2026, 1, 1),
    )
    with pytest.raises(PermissionDenied):
        get_training_record(viewer, other.id)
    with pytest.raises(PermissionDenied):
        get_training_enforcement_policy(viewer, org_b)

    set_training_enforcement_policy(actor=actor, organization=org_a, gate_mode=TrainingGateMode.OFF)
    set_training_enforcement_policy(
        actor=actor, organization=org_a, gate_mode=TrainingGateMode.BLOCK, notes="stored only"
    )
    assert get_training_enforcement_policy(viewer, org_a) is not None
    with pytest.raises(ValidationError):
        set_training_enforcement_policy(actor=actor, organization=org_a, gate_mode="NOPE")

    with pytest.raises(ValidationError):
        TrainingRecord(
            organization=org_a,
            subject_user=subject,
            course_code="",
            trained_on=datetime.date(2026, 1, 1),
            recorded_by=actor,
        ).full_clean()


@pytest.mark.django_db
def test_admin_blocks_hard_delete() -> None:
    request = type(
        "R",
        (),
        {
            "user": make_user(employee_code="TR05EADM", is_superuser=True),
            "GET": QueryDict(),
        },
    )()
    assert TrainingRecordAdmin(TrainingRecord, admin_site).has_delete_permission(request) is False
    assert (
        TrainingEnforcementPolicyAdmin(TrainingEnforcementPolicy, admin_site).has_delete_permission(
            request
        )
        is False
    )
    assert "delete_selected" not in TrainingRecordAdmin(TrainingRecord, admin_site).get_actions(
        request
    )


@pytest.mark.django_db
def test_no_seeded_training_matrix() -> None:
    assert TrainingRecord.objects.count() == 0
    assert TrainingEnforcementPolicy.objects.count() == 0
    assert Organization.objects.filter(code__iexact="NELNA").count() == 0
