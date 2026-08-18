"""Foreign-body / metal-detector challenge services — Phase 26."""

from __future__ import annotations

import uuid
from datetime import datetime
from typing import Any

from django.core.exceptions import PermissionDenied, ValidationError
from django.db import IntegrityError
from apps.core.persistence import atomic_fn, lock_queryset, locked_get
from django.utils import timezone

from apps.access_control.services import Scope, require_permission
from apps.accounts.models import User
from apps.foreign_body.evaluation import (
    ChallengeDeviceDecision,
    assess_challenge_device,
    evaluate_challenge_result,
)
from apps.foreign_body.models import (
    ChallengeScheduleMode,
    ChallengeScheduleRule,
    ChallengeTestResult,
    ChallengeTestStatus,
    ContainmentAssessment,
    ForeignBodyHistoryEntry,
    MetalDetectorChallengeTest,
    TestPiece,
)
from apps.foreign_body.policy import (
    auto_hold_approved,
    compute_affected_interval,
    maybe_create_hold_case,
)
from apps.instruments.models import Equipment
from apps.organizations.models import Organization, Site
from apps.organizations.services import normalize_code
from apps.security_audit.services import record_event

MANAGE_PIECE = "foreign_body.manage_testpiece"
RECORD = "foreign_body.record_challengeresult"
VERIFY = "foreign_body.verify_challengeresult"
VIEW = "foreign_body.view_foreignbody"


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
    challenge_test: MetalDetectorChallengeTest | None = None,
    note: str = "",
    metadata: dict[str, Any] | None = None,
) -> ForeignBodyHistoryEntry:
    return ForeignBodyHistoryEntry.objects.create(
        organization_id=organization_id,
        challenge_test=challenge_test,
        event_type=event_type,
        note=(note or "").strip()[:255],
        metadata=metadata or {},
        actor=actor,
    )


def _device_snapshot(equipment: Equipment, decision: ChallengeDeviceDecision) -> dict[str, Any]:
    return {
        "equipment_id": str(equipment.id),
        "equipment_code": equipment.code,
        "equipment_type": equipment.equipment_type,
        "operational_status": equipment.operational_status,
        "is_active": equipment.is_active,
        "fitness": decision.fitness,
        "eligibility": decision.as_dict(),
        "not_qa_disposition": True,
    }


def _piece_snapshot(piece: TestPiece, expected_detected: bool) -> dict[str, Any]:
    return {
        "test_piece_id": str(piece.id),
        "code": piece.code,
        "title": piece.title,
        "category_label": piece.category_label,
        "size_label": piece.size_label,
        "expected_detected": expected_detected,
        "not_invented_catalogue": True,
    }


@atomic_fn
def create_test_piece(
    *,
    actor: User | None,
    organization: Organization,
    code: str,
    title: str,
    category_label: str = "",
    size_label: str = "",
    expected_detected: bool = True,
    notes: str = "",
) -> TestPiece:
    user = _require_actor(actor)
    require_permission(user, MANAGE_PIECE, scope=_org_scope(organization.id))
    normalized = normalize_code(code)
    if not normalized or not (title or "").strip():
        raise ValidationError({"code": "Test piece code and title are required."})
    try:
        piece = TestPiece.objects.create(
            organization=organization,
            code=normalized,
            title=title.strip(),
            category_label=(category_label or "").strip(),
            size_label=(size_label or "").strip(),
            expected_detected=bool(expected_detected),
            notes=(notes or "").strip(),
            created_by=user,
        )
    except IntegrityError as exc:
        raise ValidationError({"code": "Test piece code already exists in organization."}) from exc
    record_event(
        event_type="FOREIGN_BODY_TEST_PIECE_CREATED",
        actor=user,
        metadata={
            "organization_id": str(organization.id),
            "test_piece_id": str(piece.id),
            "code": piece.code,
        },
    )
    return piece


@atomic_fn
def create_schedule_rule(
    *,
    actor: User | None,
    organization: Organization,
    code: str,
    title: str = "",
    schedule_mode: str = ChallengeScheduleMode.AD_HOC,
    rule_code: str = "",
    equipment: Equipment | None = None,
    checklist_template_id: uuid.UUID | None = None,
    notes: str = "",
) -> ChallengeScheduleRule:
    user = _require_actor(actor)
    require_permission(user, MANAGE_PIECE, scope=_org_scope(organization.id))
    normalized = normalize_code(code)
    if not normalized:
        raise ValidationError({"code": "Schedule rule code is required."})
    if schedule_mode not in ChallengeScheduleMode.values:
        raise ValidationError({"schedule_mode": "Unknown schedule mode."})
    if equipment is not None and equipment.organization_id != organization.id:
        raise PermissionDenied("Cross-organization equipment link denied.")
    rule = ChallengeScheduleRule(
        organization=organization,
        code=normalized,
        title=(title or "").strip(),
        schedule_mode=schedule_mode,
        rule_code=(rule_code or "").strip(),
        equipment=equipment,
        checklist_template_id=checklist_template_id,
        notes=(notes or "").strip(),
        created_by=user,
    )
    rule.full_clean()
    try:
        rule.save()
    except IntegrityError as exc:
        raise ValidationError(
            {"code": "Schedule rule code already exists in organization."}
        ) from exc
    record_event(
        event_type="FOREIGN_BODY_SCHEDULE_RULE_CREATED",
        actor=user,
        metadata={
            "organization_id": str(organization.id),
            "schedule_rule_id": str(rule.id),
            "schedule_mode": rule.schedule_mode,
        },
    )
    return rule


@atomic_fn
def record_challenge_test(
    *,
    actor: User | None,
    organization: Organization,
    equipment_id: uuid.UUID,
    test_piece_id: uuid.UUID,
    observed_detected: bool,
    performed_at: datetime | None = None,
    site: Site | None = None,
    production_line_code: str = "",
    batch_reference: str = "",
    sub_lot_reference: str = "",
    expected_detected: bool | None = None,
    schedule_mode: str = ChallengeScheduleMode.AD_HOC,
    schedule_rule_id: uuid.UUID | None = None,
    checklist_task_id: uuid.UUID | None = None,
    evidence_reference: str = "",
    notes: str = "",
    require_metal_detector_type: bool = True,
) -> MetalDetectorChallengeTest:
    user = _require_actor(actor)
    require_permission(user, RECORD, scope=_org_scope(organization.id))
    equipment = Equipment.objects.filter(pk=equipment_id).first()
    decision = assess_challenge_device(
        equipment=equipment,
        organization_id=organization.id,
        require_metal_detector_type=require_metal_detector_type,
    )
    if not decision.eligible:
        raise ValidationError({"equipment": f"Device invalid ({decision.reason_code})."})
    if equipment is None:
        raise ValidationError({"equipment": "Device invalid (missing equipment)."})
    piece = TestPiece.objects.filter(pk=test_piece_id, organization=organization).first()
    if piece is None or not piece.is_active:
        raise ValidationError({"test_piece": "Active test piece not found in organization."})
    if site is not None and site.organization_id != organization.id:
        raise ValidationError({"site": "Site must belong to the organization."})
    if schedule_mode not in ChallengeScheduleMode.values:
        raise ValidationError({"schedule_mode": "Unknown schedule mode."})
    expected = (
        bool(expected_detected) if expected_detected is not None else bool(piece.expected_detected)
    )
    result = evaluate_challenge_result(
        expected_detected=expected,
        observed_detected=bool(observed_detected),
    )
    moment = performed_at or timezone.now()
    schedule_rule = None
    if schedule_rule_id is not None:
        schedule_rule = ChallengeScheduleRule.objects.filter(
            pk=schedule_rule_id, organization=organization, is_active=True
        ).first()
        if schedule_rule is None:
            raise ValidationError({"schedule_rule": "Schedule rule not found."})
    test = MetalDetectorChallengeTest(
        organization=organization,
        site=site,
        equipment=equipment,
        production_line_code=(production_line_code or "").strip(),
        batch_reference=(batch_reference or "").strip(),
        sub_lot_reference=(sub_lot_reference or "").strip(),
        performed_at=moment,
        test_piece=piece,
        expected_detected=expected,
        observed_detected=bool(observed_detected),
        result=result,
        status=ChallengeTestStatus.RECORDED,
        schedule_mode=schedule_mode,
        schedule_rule=schedule_rule,
        checklist_task_id=checklist_task_id,
        operator=user,
        evidence_reference=(evidence_reference or "").strip(),
        notes=(notes or "").strip(),
        frozen_device_context=_device_snapshot(equipment, decision),
        frozen_test_piece_context=_piece_snapshot(piece, expected),
        created_by=user,
    )
    test.full_clean()
    test.save()
    _history(
        organization_id=organization.id,
        actor=user,
        event_type="CHALLENGE_RECORDED",
        challenge_test=test,
        metadata={"result": result, "device_reason": decision.reason_code},
    )
    record_event(
        event_type="FOREIGN_BODY_CHALLENGE_RECORDED",
        actor=user,
        metadata={
            "organization_id": str(organization.id),
            "challenge_test_id": str(test.id),
            "result": result,
            "equipment_id": str(equipment.id),
        },
    )
    if result == ChallengeTestResult.FAIL:
        assess_and_persist_containment(actor=user, failed_test=test)
    return test


@atomic_fn
def verify_challenge_test(
    *,
    actor: User | None,
    challenge_test_id: uuid.UUID,
) -> MetalDetectorChallengeTest:
    user = _require_actor(actor)
    test = (
        lock_queryset(
        MetalDetectorChallengeTest.objects.select_related("organization").filter(pk=challenge_test_id)
        ).first()
    )
    if test is None:
        raise ValidationError({"challenge_test": "Challenge test not found."})
    require_permission(user, VERIFY, scope=_org_scope(test.organization_id))
    if test.status != ChallengeTestStatus.RECORDED:
        raise ValidationError({"status": "Only RECORDED tests can be verified."})
    if test.operator_id == user.id:
        raise ValidationError(
            {"verifier": "Operator cannot verify their own challenge test (SoD)."}
        )
    test.status = ChallengeTestStatus.VERIFIED
    test.verifier = user
    test.verified_at = timezone.now()
    test.save(update_fields=["status", "verifier", "verified_at", "updated_at"])
    _history(
        organization_id=test.organization_id,
        actor=user,
        event_type="CHALLENGE_VERIFIED",
        challenge_test=test,
    )
    record_event(
        event_type="FOREIGN_BODY_CHALLENGE_VERIFIED",
        actor=user,
        metadata={
            "organization_id": str(test.organization_id),
            "challenge_test_id": str(test.id),
        },
    )
    return test


@atomic_fn
def void_challenge_test(
    *,
    actor: User | None,
    challenge_test_id: uuid.UUID,
    reason: str,
) -> MetalDetectorChallengeTest:
    user = _require_actor(actor)
    test = (
        locked_get(MetalDetectorChallengeTest, pk=challenge_test_id)
    )
    if test is None:
        raise ValidationError({"challenge_test": "Challenge test not found."})
    require_permission(user, VERIFY, scope=_org_scope(test.organization_id))
    if test.status == ChallengeTestStatus.VOID:
        return test
    if not (reason or "").strip():
        raise ValidationError({"reason": "Void reason is required."})
    test.status = ChallengeTestStatus.VOID
    test.void_reason = reason.strip()[:255]
    test.save(update_fields=["status", "void_reason", "updated_at"])
    _history(
        organization_id=test.organization_id,
        actor=user,
        event_type="CHALLENGE_VOIDED",
        challenge_test=test,
        note=test.void_reason,
    )
    record_event(
        event_type="FOREIGN_BODY_CHALLENGE_VOIDED",
        actor=user,
        metadata={
            "organization_id": str(test.organization_id),
            "challenge_test_id": str(test.id),
        },
    )
    return test


@atomic_fn
def assess_and_persist_containment(
    *,
    actor: User,
    failed_test: MetalDetectorChallengeTest,
) -> ContainmentAssessment:
    """Compute affected interval; create HOLD only when explicitly approved."""
    interval = compute_affected_interval(failed_test=failed_test)
    hold = None
    hold_created = False
    hold_error = ""
    if auto_hold_approved():
        try:
            hold = maybe_create_hold_case(
                actor=actor,
                organization=failed_test.organization,
                failed_test=failed_test,
                interval=interval,
            )
            hold_created = hold is not None
        except (PermissionDenied, ValidationError) as exc:
            # Challenge history must still persist; HOLD remains advisory.
            hold = None
            hold_created = False
            hold_error = str(exc)[:255]
    previous = None
    if interval.previous_pass_test_id:
        previous = MetalDetectorChallengeTest.objects.filter(
            pk=interval.previous_pass_test_id
        ).first()
    context = interval.as_dict()
    if hold_error:
        context["hold_error"] = hold_error
    assessment, _ = ContainmentAssessment.objects.update_or_create(
        failed_test=failed_test,
        defaults={
            "organization_id": failed_test.organization_id,
            "previous_pass_test": previous,
            "interval_start": interval.interval_start,
            "interval_end": interval.interval_end,
            "affected_batch_references": list(interval.affected_batch_references),
            "hold_recommended": interval.hold_recommended,
            "hold_created": hold_created,
            "hold_case": hold,
            "assessment_context": context,
            "created_by": actor,
        },
    )
    record_event(
        event_type="FOREIGN_BODY_CONTAINMENT_ASSESSED",
        actor=actor,
        metadata={
            "organization_id": str(failed_test.organization_id),
            "challenge_test_id": str(failed_test.id),
            "hold_created": hold_created,
            "auto_hold_approved": auto_hold_approved(),
        },
    )
    return assessment
