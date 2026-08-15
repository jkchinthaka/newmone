"""Phase 09C — Supervisor review governance evaluation.

Uses Phase 03C permission mappings. Does not invent Supervisor job titles.
Self-review prohibition applies only when owner-approved policy is PROHIBIT.
Optional review SLA uses configured minutes only — never invents timing.
Temporary delegation uses time-bounded ScopedRoleAssignment (no shadow authority).
"""

from __future__ import annotations

import datetime as dt
import uuid
from dataclasses import dataclass
from typing import Any

from django.core.exceptions import PermissionDenied, ValidationError
from django.utils import timezone

from apps.access_control.models import Role, ScopedRoleAssignment
from apps.access_control.services import (
    Scope,
    assign_role,
    create_role,
    require_permission,
    revoke_role_assignment,
)
from apps.accounts.models import User
from apps.core.persistence import atomic_fn, lock_queryset
from apps.organizations.models import Organization
from apps.recording.models import ChecklistSubmission
from apps.reviews.models import (
    SelfReviewPolicyMode,
    SupervisorReview,
    SupervisorReviewGovernancePolicy,
)
from apps.security_audit.services import record_event

REVIEW_CHECKLIST_SUBMISSION = "reviews.review_checklistsubmission"

QUEUE_PENDING = "pending"
QUEUE_OVERDUE = "overdue"
QUEUE_RESUBMISSION = "resubmission"
QUEUE_CHOICES = (QUEUE_PENDING, QUEUE_OVERDUE, QUEUE_RESUBMISSION)

SOD_SELF_REVIEW_QUESTION = "Can a recorder review their own submission?"


@dataclass(frozen=True)
class SelfReviewEvaluation:
    mode: str
    blocked: bool
    is_self_review: bool
    evidence_reference: str
    status_label: str
    enforcement: str


@dataclass(frozen=True)
class ReviewDueEvaluation:
    due_at: dt.datetime | None
    sla_minutes: int | None
    is_overdue: bool
    overdue_reason: str


def _require_authenticated_actor(actor: User | None) -> User:
    if actor is None or not getattr(actor, "is_authenticated", False) or not actor.is_active:
        raise PermissionDenied("Authentication required.")
    return actor


def get_governance_policy(
    organization_id: uuid.UUID,
) -> SupervisorReviewGovernancePolicy | None:
    return SupervisorReviewGovernancePolicy.objects.filter(organization_id=organization_id).first()


def default_self_review_evaluation(*, is_self_review: bool) -> SelfReviewEvaluation:
    return SelfReviewEvaluation(
        mode=SelfReviewPolicyMode.PENDING,
        blocked=False,
        is_self_review=is_self_review,
        evidence_reference="",
        status_label="PENDING — owner decision required (APR-010); prohibition not enforced",
        enforcement="NOT_ENFORCED",
    )


def evaluate_self_review(
    *,
    actor: User,
    submission: ChecklistSubmission,
) -> SelfReviewEvaluation:
    """Evaluate self-review against org policy. PENDING never blocks."""
    is_self = submission.submitted_by_id == actor.id
    policy = get_governance_policy(submission.checklist_record.organization_id)
    if policy is None:
        return default_self_review_evaluation(is_self_review=is_self)

    mode = policy.self_review_mode or SelfReviewPolicyMode.PENDING
    evidence = (policy.evidence_reference or "").strip()
    if mode == SelfReviewPolicyMode.PROHIBIT:
        return SelfReviewEvaluation(
            mode=mode,
            blocked=bool(is_self),
            is_self_review=is_self,
            evidence_reference=evidence,
            status_label="PROHIBIT — owner-approved self-review ban",
            enforcement="ENFORCED" if is_self else "ENFORCED_IF_SELF",
        )
    if mode == SelfReviewPolicyMode.ALLOW:
        return SelfReviewEvaluation(
            mode=mode,
            blocked=False,
            is_self_review=is_self,
            evidence_reference=evidence,
            status_label="ALLOW — owner-approved self-review permitted",
            enforcement="ALLOWED",
        )
    return SelfReviewEvaluation(
        mode=SelfReviewPolicyMode.PENDING,
        blocked=False,
        is_self_review=is_self,
        evidence_reference=evidence,
        status_label="PENDING — owner decision required (APR-010); prohibition not enforced",
        enforcement="NOT_ENFORCED",
    )


def assert_self_review_allowed(
    *, actor: User, submission: ChecklistSubmission
) -> SelfReviewEvaluation:
    evaluation = evaluate_self_review(actor=actor, submission=submission)
    if evaluation.blocked:
        raise ValidationError(
            {
                "reviewed_by": (
                    "Self-review is prohibited by owner-approved governance policy "
                    f"(evidence: {evaluation.evidence_reference or 'recorded'})."
                )
            }
        )
    return evaluation


def resolve_review_due(
    *,
    submission: ChecklistSubmission,
    as_of: dt.datetime | None = None,
    policy: SupervisorReviewGovernancePolicy | None = None,
) -> ReviewDueEvaluation:
    """Due only from configured review_sla_minutes. Null SLA => no overdue."""
    instant = as_of or timezone.now()
    if timezone.is_naive(instant):
        instant = timezone.make_aware(instant, timezone.get_current_timezone())
    if policy is None:
        policy = get_governance_policy(submission.checklist_record.organization_id)
    if policy is None or policy.review_sla_minutes is None:
        return ReviewDueEvaluation(
            due_at=None,
            sla_minutes=None,
            is_overdue=False,
            overdue_reason="NO_CONFIGURED_SLA",
        )
    minutes = int(policy.review_sla_minutes)
    due_at = submission.submitted_at + dt.timedelta(minutes=minutes)
    overdue = instant >= due_at
    return ReviewDueEvaluation(
        due_at=due_at,
        sla_minutes=minutes,
        is_overdue=overdue,
        overdue_reason="PAST_CONFIGURED_DUE" if overdue else "WITHIN_CONFIGURED_SLA",
    )


@atomic_fn
def upsert_supervisor_review_governance_policy(
    *,
    actor: User | None,
    organization_id: uuid.UUID,
    self_review_mode: str = SelfReviewPolicyMode.PENDING,
    review_sla_minutes: int | None = None,
    evidence_reference: str = "",
    notes: str = "",
) -> SupervisorReviewGovernancePolicy:
    """
    Create/update org governance policy.

    PROHIBIT/ALLOW require evidence_reference. Does not invent SLA values when null.
    Actor must hold Supervisor review permission in that organization (Phase 03C mapping).
    """
    user = _require_authenticated_actor(actor)
    org = Organization.objects.filter(pk=organization_id).first()
    if org is None:
        raise ValidationError({"organization": "Organization not found."})
    require_permission(
        user,
        REVIEW_CHECKLIST_SUBMISSION,
        scope=Scope(organization_id=org.id),
    )
    if self_review_mode not in SelfReviewPolicyMode.values:
        raise ValidationError({"self_review_mode": "Invalid self-review policy mode."})

    policy = lock_queryset(
        SupervisorReviewGovernancePolicy.objects.filter(organization_id=org.id)
    ).first()
    if policy is None:
        policy = SupervisorReviewGovernancePolicy(organization=org)
    policy.self_review_mode = self_review_mode
    policy.review_sla_minutes = review_sla_minutes
    policy.evidence_reference = (evidence_reference or "").strip()
    policy.notes = (notes or "").strip()
    policy.updated_by = user
    policy.full_clean()
    policy.save()

    record_event(
        event_type="SUPERVISOR_REVIEW_GOVERNANCE_POLICY_SET",
        actor=user,
        metadata={
            "organization_id": str(org.id),
            "policy_id": str(policy.id),
            "self_review_mode": policy.self_review_mode,
            "review_sla_minutes": policy.review_sla_minutes,
            "evidence_reference": policy.evidence_reference,
            "sod_question": SOD_SELF_REVIEW_QUESTION,
        },
    )
    return policy


def _technical_review_delegate_role(*, organization: Organization) -> Role:
    """
    Technical review-only role for temporary delegation.

    Code avoids business Supervisor titles (Phase 03C).
    """
    from django.contrib.auth.models import Permission
    from django.contrib.contenttypes.models import ContentType

    code = f"TECH_REV_DELG_{organization.code}"[:64]
    ct = ContentType.objects.get_for_model(SupervisorReview)
    perm, _ = Permission.objects.get_or_create(
        content_type=ct,
        codename="review_checklistsubmission",
        defaults={"name": "Can review checklist submissions (Supervisor review)"},
    )
    existing = Role.objects.filter(code__iexact=code).first()
    if existing is not None:
        existing.permissions.add(perm)
        return existing
    return create_role(
        code=code,
        name=f"Technical review delegate ({organization.code})",
        description=(
            "Phase 09C technical role for time-bounded review delegation. "
            "Not a Nelna Supervisor job title."
        ),
        permissions=[perm],
    )


@atomic_fn
def grant_temporary_supervisor_review_delegation(
    *,
    actor: User | None,
    organization_id: uuid.UUID,
    delegate_user_id: uuid.UUID,
    valid_until: dt.datetime,
    valid_from: dt.datetime | None = None,
    reason_code: str = "TEMPORARY_COVERAGE",
) -> ScopedRoleAssignment:
    """
    Grant temporary review capability via ScopedRoleAssignment windows.

    Requires valid_until (no permanent hidden authority). Uses technical
    review-only role — not invented Supervisor titles. Still RBAC-visible.
    """
    user = _require_authenticated_actor(actor)
    org = Organization.objects.filter(pk=organization_id).first()
    if org is None:
        raise ValidationError({"organization": "Organization not found."})
    require_permission(
        user,
        REVIEW_CHECKLIST_SUBMISSION,
        scope=Scope(organization_id=org.id),
    )
    delegate = User.objects.filter(pk=delegate_user_id, is_active=True).first()
    if delegate is None:
        raise ValidationError({"delegate_user": "Delegate user not found or inactive."})
    if valid_until is None:
        raise ValidationError(
            {"valid_until": "Temporary delegation requires valid_until (no permanent grant)."}
        )
    if timezone.is_naive(valid_until):
        valid_until = timezone.make_aware(valid_until, timezone.get_current_timezone())
    start = valid_from or timezone.now()
    if timezone.is_naive(start):
        start = timezone.make_aware(start, timezone.get_current_timezone())
    if start >= valid_until:
        raise ValidationError({"valid_until": "valid_until must be after valid_from."})

    role = _technical_review_delegate_role(organization=org)
    assignment = assign_role(
        user=delegate,
        role=role,
        organization=org,
        assigned_by=user,
        valid_from=start,
        valid_until=valid_until,
    )
    record_event(
        event_type="SUPERVISOR_REVIEW_DELEGATION_GRANTED",
        actor=user,
        subject_user=delegate,
        metadata={
            "organization_id": str(org.id),
            "assignment_id": str(assignment.id),
            "role_code": role.code,
            "delegate_user_id": str(delegate.id),
            "valid_from": start.isoformat(),
            "valid_until": valid_until.isoformat(),
            "reason_code": (reason_code or "TEMPORARY_COVERAGE")[:64],
            "authority_path": "ScopedRoleAssignment",
            "permanent": False,
        },
    )
    return assignment


@atomic_fn
def revoke_temporary_supervisor_review_delegation(
    *,
    actor: User | None,
    assignment_id: uuid.UUID,
) -> ScopedRoleAssignment:
    """Revoke a temporary review delegation assignment (is_active=False)."""
    user = _require_authenticated_actor(actor)
    assignment = (
        ScopedRoleAssignment.objects.select_related("role", "organization", "user")
        .filter(pk=assignment_id)
        .first()
    )
    if assignment is None:
        raise ValidationError({"assignment": "Delegation assignment not found."})
    if assignment.organization_id is None:
        raise ValidationError({"assignment": "Delegation must be organization-scoped."})
    require_permission(
        user,
        REVIEW_CHECKLIST_SUBMISSION,
        scope=Scope(organization_id=assignment.organization_id),
    )
    if not str(assignment.role.code).upper().startswith("TECH_REV_DELG_"):
        raise ValidationError(
            {"assignment": "Only technical review-delegate assignments may be revoked here."}
        )
    revoked = revoke_role_assignment(assignment, actor=user)
    record_event(
        event_type="SUPERVISOR_REVIEW_DELEGATION_REVOKED",
        actor=user,
        subject_user=assignment.user,
        metadata={
            "organization_id": str(assignment.organization_id),
            "assignment_id": str(assignment.id),
            "role_code": assignment.role.code,
            "delegate_user_id": str(assignment.user_id),
        },
    )
    return revoked


def governance_context_for_submission(
    *,
    actor: User,
    submission: ChecklistSubmission,
    as_of: dt.datetime | None = None,
) -> dict[str, Any]:
    """UI/service helper — explicit governance decision status."""
    self_eval = evaluate_self_review(actor=actor, submission=submission)
    due_eval = resolve_review_due(submission=submission, as_of=as_of)
    return {
        "self_review": self_eval,
        "review_due": due_eval,
        "sod_question": SOD_SELF_REVIEW_QUESTION,
        "uses_phase_03c_permission": REVIEW_CHECKLIST_SUBMISSION,
    }
