"""Phase 26 — foreign-body / metal-detector challenge foundation tests."""

from __future__ import annotations

import datetime
import uuid
from typing import Any

import pytest
from django.contrib.auth.models import Permission
from django.contrib.contenttypes.models import ContentType
from django.core.exceptions import PermissionDenied, ValidationError
from django.test import override_settings
from django.utils import timezone
from tests.factories import grant_role, make_org, make_role_with_permission, make_site, make_user

from apps.accounts.models import User
from apps.foreign_body.evaluation import assess_challenge_device, evaluate_challenge_result
from apps.foreign_body.models import (
    ChallengeScheduleMode,
    ChallengeScheduleRule,
    ChallengeTestResult,
    ChallengeTestStatus,
    ContainmentAssessment,
    ForeignBodyHistoryEntry,
    MetalDetectorChallengeTest,
)
from apps.foreign_body.models import (
    TestPiece as FbTestPiece,
)
from apps.foreign_body.policy import (
    auto_hold_approved,
    compute_affected_interval,
    maybe_create_hold_case,
)
from apps.foreign_body.selectors import (
    challenge_tests_for_organization,
    list_test_pieces_for_organization,
    schedule_rules_for_organization,
)
from apps.foreign_body.services import (
    create_schedule_rule,
    create_test_piece,
    record_challenge_test,
    verify_challenge_test,
    void_challenge_test,
)
from apps.instruments.models import (
    Equipment,
    EquipmentOperationalStatus,
    EquipmentType,
)
from apps.instruments.services import (
    create_calibration_record,
    create_equipment,
    deactivate_equipment,
    set_equipment_operational_status,
)
from apps.nonconformance.models import HoldCase
from apps.organizations.models import Organization
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
        code=f"F{suffix}",
        name=f"FB role {suffix}",
        permission=_perm(model, codenames[0]),
    )
    for code in codenames[1:]:
        role.permissions.add(_perm(model, code))
    grant_role(user, role, organization=org)


def _equip_admin(org: Organization) -> User:
    user = make_user(employee_code=f"EQ{uuid.uuid4().hex[:6].upper()}", is_staff=True)
    _grant(user, org, Equipment, "manage_equipment", "view_equipment")
    return user


def _fb_users(org: Organization) -> tuple[User, User]:
    recorder = make_user(employee_code=f"FR{uuid.uuid4().hex[:6].upper()}", is_staff=True)
    verifier = make_user(employee_code=f"FV{uuid.uuid4().hex[:6].upper()}", is_staff=True)
    _grant(
        recorder,
        org,
        FbTestPiece,
        "manage_testpiece",
        "record_challengeresult",
        "view_foreignbody",
    )
    _grant(verifier, org, FbTestPiece, "verify_challengeresult", "view_foreignbody")
    return recorder, verifier


def _detector(org: Organization, admin: User) -> Equipment:
    equipment = create_equipment(
        actor=admin,
        organization=org,
        code=f"MD-{uuid.uuid4().hex[:5].upper()}",
        name="Line detector",
        equipment_type=EquipmentType.METAL_DETECTOR,
    )
    create_calibration_record(
        actor=admin,
        equipment_id=equipment.id,
        calibrated_on=timezone.localdate() - datetime.timedelta(days=5),
        next_due_on=timezone.localdate() + datetime.timedelta(days=30),
    )
    return equipment


@pytest.mark.django_db
def test_pass_fail_and_historical_record() -> None:
    org = make_org(code=f"F{uuid.uuid4().hex[:6].upper()}")
    admin = _equip_admin(org)
    recorder, verifier = _fb_users(org)
    detector = _detector(org, admin)
    piece = create_test_piece(
        actor=recorder,
        organization=org,
        code=f"TP-{uuid.uuid4().hex[:4].upper()}",
        title="Configured piece",
        category_label="",
        size_label="",
        expected_detected=True,
    )
    passed = record_challenge_test(
        actor=recorder,
        organization=org,
        equipment_id=detector.id,
        test_piece_id=piece.id,
        observed_detected=True,
        batch_reference="BATCH-A",
        production_line_code="LINE-1",
        schedule_mode=ChallengeScheduleMode.BATCH,
    )
    assert passed.result == ChallengeTestResult.PASS
    assert passed.status == ChallengeTestStatus.RECORDED
    assert passed.frozen_device_context["equipment_code"] == detector.code
    assert passed.frozen_test_piece_context["size_label"] == ""
    assert passed.is_immutable is False
    verified = verify_challenge_test(actor=verifier, challenge_test_id=passed.id)
    assert verified.status == ChallengeTestStatus.VERIFIED
    assert verified.verifier_id == verifier.id
    assert verified.is_immutable is True

    failed = record_challenge_test(
        actor=recorder,
        organization=org,
        equipment_id=detector.id,
        test_piece_id=piece.id,
        observed_detected=False,
        batch_reference="BATCH-B",
        performed_at=timezone.now() + datetime.timedelta(minutes=5),
    )
    assert failed.result == ChallengeTestResult.FAIL
    assessment = ContainmentAssessment.objects.get(failed_test=failed)
    assert assessment.hold_recommended is True
    assert assessment.hold_created is False
    assert assessment.assessment_context["not_qa_disposition"] is True
    assert assessment.previous_pass_test_id == passed.id
    assert "BATCH-B" in assessment.affected_batch_references

    piece.title = "Renamed later"
    piece.save(update_fields=["title", "updated_at"])
    failed.refresh_from_db()
    assert failed.frozen_test_piece_context["title"] == "Configured piece"
    assert challenge_tests_for_organization(org.id).count() == 2
    assert ForeignBodyHistoryEntry.objects.filter(event_type="CHALLENGE_RECORDED").exists()
    assert SecurityAuditEvent.objects.filter(event_type="FOREIGN_BODY_CHALLENGE_RECORDED").exists()
    assert str(piece)
    assert str(failed)
    assert str(assessment)


@pytest.mark.django_db
def test_device_invalid_and_calibration_invalid() -> None:
    org = make_org(code=f"F{uuid.uuid4().hex[:6].upper()}")
    org_b = make_org(code=f"B{uuid.uuid4().hex[:6].upper()}")
    admin = _equip_admin(org)
    recorder, _ = _fb_users(org)
    piece = create_test_piece(
        actor=recorder,
        organization=org,
        code=f"TP-{uuid.uuid4().hex[:4].upper()}",
        title="Piece",
    )
    scale = create_equipment(
        actor=admin,
        organization=org,
        code=f"SC-{uuid.uuid4().hex[:4].upper()}",
        name="Not a detector",
        equipment_type=EquipmentType.SCALE,
    )
    with pytest.raises(ValidationError):
        record_challenge_test(
            actor=recorder,
            organization=org,
            equipment_id=scale.id,
            test_piece_id=piece.id,
            observed_detected=True,
        )

    none_decision = assess_challenge_device(equipment=None, organization_id=org.id)
    assert none_decision.reason_code == "DEVICE_REQUIRED"

    overdue = create_equipment(
        actor=admin,
        organization=org,
        code=f"MD-{uuid.uuid4().hex[:4].upper()}",
        name="Overdue MD",
        equipment_type=EquipmentType.METAL_DETECTOR,
    )
    create_calibration_record(
        actor=admin,
        equipment_id=overdue.id,
        calibrated_on=timezone.localdate() - datetime.timedelta(days=40),
        next_due_on=timezone.localdate() - datetime.timedelta(days=1),
    )
    row = record_challenge_test(
        actor=recorder,
        organization=org,
        equipment_id=overdue.id,
        test_piece_id=piece.id,
        observed_detected=True,
    )
    assert row.frozen_device_context["eligibility"]["reason_code"] == "CALIBRATION_INVALID_ADVISORY"

    inactive = create_equipment(
        actor=admin,
        organization=org,
        code=f"MD-{uuid.uuid4().hex[:4].upper()}",
        name="Inactive",
        equipment_type=EquipmentType.METAL_DETECTOR,
    )
    deactivate_equipment(actor=admin, equipment_id=inactive.id)
    with pytest.raises(ValidationError):
        record_challenge_test(
            actor=recorder,
            organization=org,
            equipment_id=inactive.id,
            test_piece_id=piece.id,
            observed_detected=True,
        )

    oos = create_equipment(
        actor=admin,
        organization=org,
        code=f"MD-{uuid.uuid4().hex[:4].upper()}",
        name="OOS",
        equipment_type=EquipmentType.METAL_DETECTOR,
    )
    set_equipment_operational_status(
        actor=admin,
        equipment_id=oos.id,
        operational_status=EquipmentOperationalStatus.OUT_OF_SERVICE,
    )
    with pytest.raises(ValidationError):
        record_challenge_test(
            actor=recorder,
            organization=org,
            equipment_id=oos.id,
            test_piece_id=piece.id,
            observed_detected=True,
        )

    foreign = create_equipment(
        actor=_equip_admin(org_b),
        organization=org_b,
        code=f"MD-{uuid.uuid4().hex[:4].upper()}",
        name="Other org",
        equipment_type=EquipmentType.METAL_DETECTOR,
    )
    wrong_org = assess_challenge_device(equipment=foreign, organization_id=org.id)
    assert wrong_org.reason_code == "WRONG_ORGANIZATION"
    assert (
        evaluate_challenge_result(expected_detected=True, observed_detected=None)
        == ChallengeTestResult.NOT_EVALUATED
    )


@pytest.mark.django_db
@override_settings(FOREIGN_BODY_AUTO_HOLD_APPROVED=False)
def test_policy_disabled_hold_and_interval_architecture() -> None:
    assert auto_hold_approved() is False
    org = make_org(code=f"F{uuid.uuid4().hex[:6].upper()}")
    admin = _equip_admin(org)
    recorder, _ = _fb_users(org)
    detector = _detector(org, admin)
    piece = create_test_piece(
        actor=recorder,
        organization=org,
        code=f"TP-{uuid.uuid4().hex[:4].upper()}",
        title="Piece",
    )
    first = record_challenge_test(
        actor=recorder,
        organization=org,
        equipment_id=detector.id,
        test_piece_id=piece.id,
        observed_detected=True,
        batch_reference="LOT-1",
        performed_at=timezone.now() - datetime.timedelta(hours=2),
    )
    fail = record_challenge_test(
        actor=recorder,
        organization=org,
        equipment_id=detector.id,
        test_piece_id=piece.id,
        observed_detected=False,
        batch_reference="LOT-2",
        performed_at=timezone.now(),
    )
    interval = compute_affected_interval(failed_test=fail)
    assert interval.previous_pass_test_id == str(first.id)
    assert interval.interval_start == first.performed_at
    assert interval.interval_end == fail.performed_at
    assert interval.hold_will_create is False
    assert interval.auto_hold_approved is False
    assert (
        maybe_create_hold_case(
            actor=recorder,
            organization=org,
            failed_test=fail,
            interval=interval,
        )
        is None
    )
    assessment = ContainmentAssessment.objects.get(failed_test=fail)
    assert assessment.hold_case_id is None
    assert assessment.hold_created is False
    assert interval.as_dict()["evidence_gate"].startswith("APR-052")


@pytest.mark.django_db
@override_settings(FOREIGN_BODY_AUTO_HOLD_APPROVED=True)
def test_auto_hold_when_approved_and_authorized() -> None:
    org = make_org(code=f"F{uuid.uuid4().hex[:6].upper()}")
    admin = _equip_admin(org)
    recorder, _ = _fb_users(org)
    _grant(recorder, org, HoldCase, "create_holdcase")
    detector = _detector(org, admin)
    piece = create_test_piece(
        actor=recorder,
        organization=org,
        code=f"TP-{uuid.uuid4().hex[:4].upper()}",
        title="Piece",
    )
    fail = record_challenge_test(
        actor=recorder,
        organization=org,
        equipment_id=detector.id,
        test_piece_id=piece.id,
        observed_detected=False,
        batch_reference="HOLD-LOT",
    )
    assessment = ContainmentAssessment.objects.get(failed_test=fail)
    assert assessment.hold_created is True
    assert assessment.hold_case_id is not None
    assert HoldCase.objects.filter(pk=assessment.hold_case_id).exists()


@pytest.mark.django_db
def test_authorization_schedule_and_void() -> None:
    org = make_org(code=f"F{uuid.uuid4().hex[:6].upper()}")
    stranger = make_user(employee_code=f"X{uuid.uuid4().hex[:6].upper()}")
    with pytest.raises(PermissionDenied):
        create_test_piece(actor=stranger, organization=org, code="X", title="no")
    admin = _equip_admin(org)
    recorder, verifier = _fb_users(org)
    # SoD: recorder also has verify, but cannot verify own challenge.
    _grant(recorder, org, FbTestPiece, "verify_challengeresult")
    detector = _detector(org, admin)
    site = make_site(org, code=f"S{uuid.uuid4().hex[:4].upper()}")
    piece = create_test_piece(
        actor=recorder,
        organization=org,
        code=f"TP-{uuid.uuid4().hex[:4].upper()}",
        title="P",
    )
    assert list_test_pieces_for_organization(org.id).count() == 1
    rule = create_schedule_rule(
        actor=recorder,
        organization=org,
        code=f"SR-{uuid.uuid4().hex[:4].upper()}",
        schedule_mode=ChallengeScheduleMode.SHIFT,
        rule_code="COMPANY-SHIFT-RULE",
        equipment=detector,
    )
    assert rule.rule_code == "COMPANY-SHIFT-RULE"
    assert str(rule)
    assert schedule_rules_for_organization(org.id).count() == 1
    row = record_challenge_test(
        actor=recorder,
        organization=org,
        equipment_id=detector.id,
        test_piece_id=piece.id,
        observed_detected=True,
        schedule_mode=ChallengeScheduleMode.SHIFT,
        schedule_rule_id=rule.id,
        site=site,
        evidence_reference="EV-REF-1",
        notes="challenge note",
    )
    with pytest.raises(ValidationError):
        verify_challenge_test(actor=recorder, challenge_test_id=row.id)
    with pytest.raises(ValidationError):
        verify_challenge_test(actor=verifier, challenge_test_id=uuid.uuid4())
    voided = void_challenge_test(
        actor=verifier, challenge_test_id=row.id, reason="Entered in error"
    )
    assert voided.status == ChallengeTestStatus.VOID
    assert voided.is_immutable is True
    assert MetalDetectorChallengeTest.objects.filter(pk=row.id).exists()
    again = void_challenge_test(actor=verifier, challenge_test_id=row.id, reason="idempotent")
    assert again.status == ChallengeTestStatus.VOID
    fresh = record_challenge_test(
        actor=recorder,
        organization=org,
        equipment_id=detector.id,
        test_piece_id=piece.id,
        observed_detected=True,
        performed_at=timezone.now() + datetime.timedelta(minutes=1),
    )
    with pytest.raises(ValidationError):
        void_challenge_test(actor=verifier, challenge_test_id=fresh.id, reason="")
    with pytest.raises(ValidationError):
        create_test_piece(actor=recorder, organization=org, code="", title="")
    with pytest.raises(ValidationError):
        create_schedule_rule(
            actor=recorder,
            organization=org,
            code="BAD",
            schedule_mode="NOT_A_MODE",
        )
    assert ChallengeScheduleRule.objects.filter(pk=rule.id).exists()
