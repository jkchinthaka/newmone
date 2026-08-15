"""Quality change control services — Phase 44 (ADR-055)."""

from __future__ import annotations

import uuid
from datetime import date
from typing import Any

from django.core.exceptions import PermissionDenied, ValidationError
from django.utils import timezone

from apps.core.persistence.transactions import atomic_fn
from apps.access_control.services import Scope, user_has_permission
from apps.accounts.models import User
from apps.change_control.models import (
    CHANGE_TRANSITIONS,
    MUTABLE_LINK_STATUSES,
    ChangeAffectedKind,
    ChangeImplementationKind,
    ChangeRequestStatus,
    QualityChangeAffectedLink,
    QualityChangeEvent,
    QualityChangeImpactAssessment,
    QualityChangeImplementationLink,
    QualityChangeRequest,
)
from apps.security_audit.services import record_event

PERM_VIEW = "change_control.view_qualitychange"
PERM_CREATE = "change_control.create_qualitychange"
PERM_ASSESS = "change_control.assess_qualitychange"
PERM_APPROVE = "change_control.approve_qualitychange"
PERM_IMPLEMENT = "change_control.implement_qualitychange"
PERM_VERIFY = "change_control.verify_qualitychange"


def _scope(organization_id: uuid.UUID) -> Scope:
    return Scope(organization_id=organization_id)


def _require(actor: User, permission: str, organization_id: uuid.UUID) -> None:
    if not user_has_permission(actor, permission, scope=_scope(organization_id)):
        raise PermissionDenied("Permission denied.")


def _append_event(
    *,
    change: QualityChangeRequest,
    event_type: str,
    actor: User,
    summary: str,
    payload: dict[str, Any] | None = None,
) -> QualityChangeEvent:
    return QualityChangeEvent.objects.create(
        change_request=change,
        event_type=event_type,
        summary=summary,
        payload=payload or {},
        actor=actor,
    )


def _assert_not_locked(change: QualityChangeRequest) -> None:
    if change.is_historically_locked:
        raise ValidationError({"status": "Closed change requests are historically immutable."})


def _transition(change: QualityChangeRequest, target: str) -> None:
    allowed = CHANGE_TRANSITIONS.get(change.status, frozenset())
    if target not in allowed:
        raise ValidationError({"status": f"Cannot transition from {change.status} to {target}."})


@atomic_fn
def create_quality_change(
    *,
    actor: User,
    organization_id: uuid.UUID,
    change_code: str,
    title: str,
    description: str,
    reason: str,
    owner: User | None = None,
    target_date: date | None = None,
    risk_impact_assessment: str = "",
) -> QualityChangeRequest:
    _require(actor, PERM_CREATE, organization_id)
    code = (change_code or "").strip()
    if QualityChangeRequest.objects.filter(
        organization_id=organization_id, change_code__iexact=code
    ).exists():
        raise ValidationError({"change_code": "A change with this identifier already exists."})
    change = QualityChangeRequest(
        organization_id=organization_id,
        change_code=code,
        title=(title or "").strip(),
        description=description,
        reason=reason,
        requester=actor,
        owner=owner,
        status=ChangeRequestStatus.REQUESTED,
        requested_at=timezone.now(),
        target_date=target_date,
        risk_impact_assessment=risk_impact_assessment,
        created_by=actor,
    )
    change.full_clean()
    change.save()
    _append_event(
        change=change,
        event_type="CHANGE_REQUESTED",
        actor=actor,
        summary="Quality change request created.",
        payload={"change_code": change.change_code},
    )
    record_event(
        event_type="CHANGE_REQUESTED",
        actor=actor,
        metadata={
            "organization_id": str(organization_id),
            "change_id": str(change.id),
            "change_code": change.change_code,
        },
    )
    return change


@atomic_fn
def start_change_assessment(*, actor: User, change_id: uuid.UUID) -> QualityChangeRequest:
    change = QualityChangeRequest.objects.select_related("organization").get(pk=change_id)
    _require(actor, PERM_ASSESS, change.organization_id)
    _assert_not_locked(change)
    _transition(change, ChangeRequestStatus.ASSESSMENT)
    change.status = ChangeRequestStatus.ASSESSMENT
    change.save(update_fields=["status", "updated_at"])
    _append_event(
        change=change,
        event_type="CHANGE_ASSESSMENT_STARTED",
        actor=actor,
        summary="Change moved to assessment.",
        payload={},
    )
    record_event(
        event_type="CHANGE_ASSESSMENT_STARTED",
        actor=actor,
        metadata={
            "organization_id": str(change.organization_id),
            "change_id": str(change.id),
        },
    )
    return change


@atomic_fn
def record_change_impact_assessment(
    *,
    actor: User,
    change_id: uuid.UUID,
    quality_impact: str,
    food_safety_impact: str,
    technical_impact: str,
    training_impact: str,
    validation_requirement: str,
    data_migration_impact: str,
    risk_impact_assessment: str | None = None,
) -> QualityChangeImpactAssessment:
    change = QualityChangeRequest.objects.select_related("organization").get(pk=change_id)
    _require(actor, PERM_ASSESS, change.organization_id)
    _assert_not_locked(change)
    if change.status != ChangeRequestStatus.ASSESSMENT:
        raise ValidationError(
            {"status": "Impact assessment can only be recorded during assessment."}
        )
    now = timezone.now()
    assessment, _created = QualityChangeImpactAssessment.objects.get_or_create(
        change_request=change,
        defaults={
            "quality_impact": quality_impact,
            "food_safety_impact": food_safety_impact,
            "technical_impact": technical_impact,
            "training_impact": training_impact,
            "validation_requirement": validation_requirement,
            "data_migration_impact": data_migration_impact,
            "assessed_by": actor,
            "assessed_at": now,
        },
    )
    assessment.quality_impact = quality_impact
    assessment.food_safety_impact = food_safety_impact
    assessment.technical_impact = technical_impact
    assessment.training_impact = training_impact
    assessment.validation_requirement = validation_requirement
    assessment.data_migration_impact = data_migration_impact
    assessment.assessed_by = actor
    assessment.assessed_at = now
    assessment.full_clean()
    assessment.save()
    if risk_impact_assessment is not None:
        change.risk_impact_assessment = risk_impact_assessment
        change.save(update_fields=["risk_impact_assessment", "updated_at"])
    _append_event(
        change=change,
        event_type="CHANGE_IMPACT_RECORDED",
        actor=actor,
        summary="Impact assessment recorded.",
        payload={},
    )
    record_event(
        event_type="CHANGE_IMPACT_RECORDED",
        actor=actor,
        metadata={
            "organization_id": str(change.organization_id),
            "change_id": str(change.id),
        },
    )
    return assessment


@atomic_fn
def add_affected_link(
    *,
    actor: User,
    change_id: uuid.UUID,
    linked_kind: str,
    linked_object_id: uuid.UUID | None = None,
    linked_reference: str = "",
    notes: str = "",
) -> QualityChangeAffectedLink:
    change = QualityChangeRequest.objects.select_related("organization").get(pk=change_id)
    _require(actor, PERM_CREATE, change.organization_id)
    _assert_not_locked(change)
    if change.status not in MUTABLE_LINK_STATUSES:
        raise ValidationError(
            {
                "status": (
                    "Affected-area links cannot be added after approval. "
                    "The approved scope is historically preserved."
                )
            }
        )
    if linked_kind not in ChangeAffectedKind.values:
        raise ValidationError({"linked_kind": "Unknown affected-area kind."})
    existing = QualityChangeAffectedLink.objects.filter(
        change_request=change,
        linked_kind=linked_kind,
        linked_object_id=linked_object_id,
        linked_reference=(linked_reference or "").strip(),
    ).first()
    if existing is not None:
        return existing
    link = QualityChangeAffectedLink(
        change_request=change,
        linked_kind=linked_kind,
        linked_object_id=linked_object_id,
        linked_reference=(linked_reference or "").strip(),
        notes=notes,
        created_by=actor,
    )
    link.full_clean()
    link.save()
    _append_event(
        change=change,
        event_type="CHANGE_AFFECTED_LINKED",
        actor=actor,
        summary="Affected area linked.",
        payload={
            "linked_kind": linked_kind,
            "linked_object_id": str(linked_object_id) if linked_object_id else "",
            "linked_reference": link.linked_reference,
        },
    )
    record_event(
        event_type="CHANGE_AFFECTED_LINKED",
        actor=actor,
        metadata={
            "organization_id": str(change.organization_id),
            "change_id": str(change.id),
            "linked_kind": linked_kind,
        },
    )
    return link


@atomic_fn
def approve_quality_change(
    *,
    actor: User,
    change_id: uuid.UUID,
    approval_reference: str,
) -> QualityChangeRequest:
    change = QualityChangeRequest.objects.select_related("organization").get(pk=change_id)
    _require(actor, PERM_APPROVE, change.organization_id)
    _assert_not_locked(change)
    if actor.pk in {change.requester_id, change.created_by_id}:
        raise PermissionDenied("Requester cannot approve their own change request.")
    ref = (approval_reference or "").strip()
    if not ref:
        raise ValidationError({"approval_reference": "Approval reference is required."})
    _transition(change, ChangeRequestStatus.APPROVED)
    if not hasattr(change, "impact_assessment"):
        raise ValidationError(
            {"impact_assessment": "Impact assessment is required before approval."}
        )
    now = timezone.now()
    change.status = ChangeRequestStatus.APPROVED
    change.approval_reference = ref
    change.approved_by = actor
    change.approved_at = now
    change.save(
        update_fields=[
            "status",
            "approval_reference",
            "approved_by",
            "approved_at",
            "updated_at",
        ]
    )
    _append_event(
        change=change,
        event_type="CHANGE_APPROVED",
        actor=actor,
        summary="Change approved. Engineering completion remains non-approving.",
        payload={"approval_reference": ref, "engineering_complete_is_not_approval": True},
    )
    record_event(
        event_type="CHANGE_APPROVED",
        actor=actor,
        metadata={
            "organization_id": str(change.organization_id),
            "change_id": str(change.id),
            "approval_reference": ref,
        },
    )
    return change


@atomic_fn
def start_change_implementation(*, actor: User, change_id: uuid.UUID) -> QualityChangeRequest:
    change = QualityChangeRequest.objects.select_related("organization").get(pk=change_id)
    _require(actor, PERM_IMPLEMENT, change.organization_id)
    _assert_not_locked(change)
    _transition(change, ChangeRequestStatus.IMPLEMENTING)
    change.status = ChangeRequestStatus.IMPLEMENTING
    change.save(update_fields=["status", "updated_at"])
    _append_event(
        change=change,
        event_type="CHANGE_IMPLEMENTATION_STARTED",
        actor=actor,
        summary="Approved change moved to implementation.",
        payload={},
    )
    record_event(
        event_type="CHANGE_IMPLEMENTATION_STARTED",
        actor=actor,
        metadata={
            "organization_id": str(change.organization_id),
            "change_id": str(change.id),
        },
    )
    return change


@atomic_fn
def record_implementation_link(
    *,
    actor: User,
    change_id: uuid.UUID,
    implemented_kind: str,
    implemented_reference: str,
    implemented_object_id: uuid.UUID | None = None,
    notes: str = "",
) -> QualityChangeImplementationLink:
    change = QualityChangeRequest.objects.select_related("organization").get(pk=change_id)
    _require(actor, PERM_IMPLEMENT, change.organization_id)
    _assert_not_locked(change)
    if implemented_kind not in ChangeImplementationKind.values:
        raise ValidationError({"implemented_kind": "Unknown implementation kind."})
    if change.status not in {
        ChangeRequestStatus.IMPLEMENTING,
        ChangeRequestStatus.VERIFICATION,
    }:
        raise ValidationError(
            {
                "status": (
                    "Implementation links may be recorded only after approval, "
                    "during implementation or verification."
                )
            }
        )
    ref = (implemented_reference or "").strip()
    if not ref:
        raise ValidationError({"implemented_reference": "Deployed reference is required."})
    link = QualityChangeImplementationLink(
        change_request=change,
        implemented_kind=implemented_kind,
        implemented_object_id=implemented_object_id,
        implemented_reference=ref,
        notes=notes,
        recorded_by=actor,
        recorded_at=timezone.now(),
        does_not_constitute_approval=True,
    )
    link.save()
    change.engineering_complete = True
    change.save(update_fields=["engineering_complete", "updated_at"])
    _append_event(
        change=change,
        event_type="CHANGE_IMPLEMENTATION_LINKED",
        actor=actor,
        summary="Deployed configuration/version linked. This is not business approval.",
        payload={
            "implemented_kind": implemented_kind,
            "implemented_reference": ref,
            "does_not_constitute_approval": True,
        },
    )
    record_event(
        event_type="CHANGE_IMPLEMENTATION_LINKED",
        actor=actor,
        metadata={
            "organization_id": str(change.organization_id),
            "change_id": str(change.id),
            "does_not_constitute_approval": True,
        },
    )
    return link


@atomic_fn
def submit_change_for_verification(*, actor: User, change_id: uuid.UUID) -> QualityChangeRequest:
    change = QualityChangeRequest.objects.select_related("organization").get(pk=change_id)
    _require(actor, PERM_IMPLEMENT, change.organization_id)
    _assert_not_locked(change)
    if not change.implementation_links.exists():
        raise ValidationError(
            {"implementation": "At least one implementation link is required before verification."}
        )
    _transition(change, ChangeRequestStatus.VERIFICATION)
    change.status = ChangeRequestStatus.VERIFICATION
    change.save(update_fields=["status", "updated_at"])
    _append_event(
        change=change,
        event_type="CHANGE_VERIFICATION_STARTED",
        actor=actor,
        summary="Engineering work submitted for verification. Not an approval.",
        payload={"engineering_complete_is_not_approval": True},
    )
    record_event(
        event_type="CHANGE_VERIFICATION_STARTED",
        actor=actor,
        metadata={
            "organization_id": str(change.organization_id),
            "change_id": str(change.id),
        },
    )
    return change


@atomic_fn
def verify_and_close_quality_change(
    *,
    actor: User,
    change_id: uuid.UUID,
    verification_reference: str,
) -> QualityChangeRequest:
    change = QualityChangeRequest.objects.select_related("organization").get(pk=change_id)
    _require(actor, PERM_VERIFY, change.organization_id)
    _assert_not_locked(change)
    if actor.pk == change.approved_by_id:
        raise PermissionDenied("Approver cannot also close verification (separation of duty).")
    ref = (verification_reference or "").strip()
    if not ref:
        raise ValidationError({"verification_reference": "Verification reference is required."})
    if not change.implementation_links.exists():
        raise ValidationError({"implementation": "Verification requires a linked implementation."})
    _transition(change, ChangeRequestStatus.CLOSED)
    now = timezone.now()
    change.status = ChangeRequestStatus.CLOSED
    change.verification_reference = ref
    change.verified_by = actor
    change.verified_at = now
    change.closed_by = actor
    change.closed_at = now
    change.save(
        update_fields=[
            "status",
            "verification_reference",
            "verified_by",
            "verified_at",
            "closed_by",
            "closed_at",
            "updated_at",
        ]
    )
    _append_event(
        change=change,
        event_type="CHANGE_CLOSED",
        actor=actor,
        summary="Change verified and closed.",
        payload={"verification_reference": ref},
    )
    record_event(
        event_type="CHANGE_CLOSED",
        actor=actor,
        metadata={
            "organization_id": str(change.organization_id),
            "change_id": str(change.id),
            "verification_reference": ref,
        },
    )
    return change
