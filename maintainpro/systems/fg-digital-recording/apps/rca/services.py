"""RCA services — Phase 49 (ADR-060).

Optional 5 Why / fishbone / cause-evidence tools. Software and AI must not
auto-confirm a root cause. Confirmation is a human permissioned act.
"""

from __future__ import annotations

import uuid
from typing import Any

from django.core.exceptions import PermissionDenied, ValidationError
from django.db import IntegrityError
from django.utils import timezone

from apps.access_control.services import Scope, user_has_permission
from apps.accounts.models import User
from apps.capa.services import create_corrective_action
from apps.core.persistence import (
    TransitionConflictError,
    atomic_fn,
    lock_queryset,
    require_conditional_update,
)
from apps.rca.models import (
    TERMINAL_RCA_STATUSES,
    RcaCapaLink,
    RcaCause,
    RcaCauseState,
    RcaEvent,
    RcaEvidenceLink,
    RcaFishboneCategory,
    RcaFishboneEntry,
    RcaFiveWhyStep,
    RcaParticipant,
    RcaSourceKind,
    RcaStatus,
    RootCauseAnalysis,
)
from apps.security_audit.services import record_event

PERM_VIEW = "rca.view_rca"
PERM_MANAGE = "rca.manage_rca"
PERM_CONFIRM = "rca.confirm_rca"
PERM_CAPA = "rca.link_rca_capa"

RCA_TRANSITIONS: dict[str, frozenset[str]] = {
    RcaStatus.DRAFT: frozenset({RcaStatus.IN_PROGRESS, RcaStatus.CANCELLED}),
    RcaStatus.IN_PROGRESS: frozenset({RcaStatus.ROOT_CAUSE_CONFIRMED, RcaStatus.CANCELLED}),
    RcaStatus.ROOT_CAUSE_CONFIRMED: frozenset({RcaStatus.VERIFIED, RcaStatus.CLOSED}),
    RcaStatus.VERIFIED: frozenset({RcaStatus.CLOSED}),
    RcaStatus.CLOSED: frozenset(),
    RcaStatus.CANCELLED: frozenset(),
}


def _scope(organization_id: uuid.UUID) -> Scope:
    return Scope(organization_id=organization_id)


def _require(actor: User, permission: str, organization_id: uuid.UUID) -> None:
    if not user_has_permission(actor, permission, scope=_scope(organization_id)):
        raise PermissionDenied("Permission denied.")


def _append_event(
    *,
    rca: RootCauseAnalysis,
    event_type: str,
    actor: User,
    summary: str,
    payload: dict[str, Any] | None = None,
) -> RcaEvent:
    return RcaEvent.objects.create(
        rca=rca,
        event_type=event_type,
        summary=summary,
        payload=payload or {},
        actor=actor,
    )


def _assert_mutable(rca: RootCauseAnalysis) -> None:
    if rca.status in TERMINAL_RCA_STATUSES:
        raise ValidationError(
            {"status": "Closed or cancelled RCA records are historically immutable."}
        )


def _transition(rca: RootCauseAnalysis, target: str) -> None:
    allowed = RCA_TRANSITIONS.get(rca.status, frozenset())
    if target not in allowed:
        raise ValidationError({"status": f"Cannot transition RCA from {rca.status} to {target}."})


def _locked_rca(rca_id: uuid.UUID) -> RootCauseAnalysis:
    """Load RCA for mutation. PostgreSQL uses row lock; Mongo relies on CAS/transactions."""
    rca = lock_queryset(
        RootCauseAnalysis.objects.select_related("organization")
    ).filter(pk=rca_id).first()
    if rca is None:
        raise ValidationError({"rca": "RCA not found."})
    return rca


def _locked_cause(cause_id: uuid.UUID) -> RcaCause:
    """Lock parent RCA then cause to serialize status and cause-state mutations."""
    cause = RcaCause.objects.filter(pk=cause_id).only("id", "rca_id").first()
    if cause is None:
        raise ValidationError({"cause": "Cause not found."})
    rca = _locked_rca(cause.rca_id)
    locked = lock_queryset(
        RcaCause.objects.select_related("rca", "rca__organization")
    ).filter(pk=cause_id, rca_id=rca.id).first()
    if locked is None:
        raise ValidationError({"cause": "Cause not found."})
    locked.rca = rca
    return locked


def _guard_rca_still_mutable(rca: RootCauseAnalysis) -> None:
    """Fail closed if another writer already moved RCA to a terminal status."""
    _assert_mutable(rca)
    matched = (
        RootCauseAnalysis.objects.filter(pk=rca.pk)
        .exclude(status__in=TERMINAL_RCA_STATUSES)
        .update(updated_at=timezone.now())
    )
    if matched != 1:
        raise ValidationError(
            {"status": "Closed or cancelled RCA records are historically immutable."}
        )


def _rca_code_conflict(exc: Exception) -> ValidationError:
    if isinstance(exc, IntegrityError) or "unique" in str(exc).lower():
        return ValidationError({"rca_code": "RCA with this identifier already exists."})
    if isinstance(exc, ValidationError):
        return exc
    return ValidationError(str(exc))


def _resolve_source_object(
    *, organization_id: uuid.UUID, source_kind: str, linked_object_id: uuid.UUID
) -> None:
    found = False
    if source_kind == RcaSourceKind.NCR:
        from apps.nonconformance.models import NonConformanceRecord

        found = NonConformanceRecord.objects.filter(
            pk=linked_object_id, organization_id=organization_id
        ).exists()
    elif source_kind == RcaSourceKind.COMPLAINT:
        from apps.customer_complaints.models import CustomerComplaintCase

        found = CustomerComplaintCase.objects.filter(
            pk=linked_object_id, organization_id=organization_id
        ).exists()
    elif source_kind == RcaSourceKind.AUDIT_FINDING:
        from apps.quality_audits.models import QualityAuditFinding

        found = QualityAuditFinding.objects.filter(
            pk=linked_object_id, audit__organization_id=organization_id
        ).exists()
    elif source_kind == RcaSourceKind.CAPA:
        from apps.capa.models import CorrectiveAction

        found = CorrectiveAction.objects.filter(
            pk=linked_object_id, organization_id=organization_id
        ).exists()
    elif source_kind == RcaSourceKind.OTHER:
        return
    if not found:
        raise ValidationError(
            {"linked_object_id": "Source case was not found in this organization."}
        )


def _cause_has_evidence(cause: RcaCause) -> bool:
    if (cause.evidence_citation or "").strip():
        return True
    return cause.evidence_links.exists()


@atomic_fn
def create_rca(
    *,
    actor: User,
    organization_id: uuid.UUID,
    rca_code: str,
    source_kind: str,
    problem_statement: str,
    source_citation: str = "",
    containment_reference: str = "",
    linked_object_id: uuid.UUID | None = None,
    facilitator: User | None = None,
    facilitator_reference: str = "",
) -> RootCauseAnalysis:
    _require(actor, PERM_MANAGE, organization_id)
    if source_kind not in RcaSourceKind.values:
        raise ValidationError({"source_kind": "Unknown RCA source kind."})
    code = (rca_code or "").strip()
    if RootCauseAnalysis.objects.filter(
        organization_id=organization_id, rca_code__iexact=code
    ).exists():
        raise ValidationError({"rca_code": "RCA with this identifier already exists."})
    if linked_object_id is not None:
        _resolve_source_object(
            organization_id=organization_id,
            source_kind=source_kind,
            linked_object_id=linked_object_id,
        )
    rca = RootCauseAnalysis(
        organization_id=organization_id,
        rca_code=code,
        source_kind=source_kind,
        source_citation=(source_citation or "").strip(),
        linked_object_id=linked_object_id,
        problem_statement=(problem_statement or "").strip(),
        containment_reference=(containment_reference or "").strip(),
        facilitator=facilitator,
        facilitator_reference=(facilitator_reference or "").strip(),
        started_at=timezone.now(),
        status=RcaStatus.DRAFT,
        created_by=actor,
    )
    try:
        rca.full_clean()
        rca.save()
    except (ValidationError, IntegrityError) as exc:
        raise _rca_code_conflict(exc) from exc
    _append_event(
        rca=rca,
        event_type="RCA_CREATED",
        actor=actor,
        summary="RCA record created. No method is required. No root cause confirmed.",
        payload={"source_kind": source_kind, "auto_confirmed": False},
    )
    record_event(
        event_type="RCA_CREATED",
        actor=actor,
        metadata={
            "organization_id": str(organization_id),
            "rca_id": str(rca.id),
            "module": "rca",
            "human_confirm_required": True,
        },
    )
    return rca


@atomic_fn
def start_rca(*, actor: User, rca_id: uuid.UUID) -> RootCauseAnalysis:
    rca = _locked_rca(rca_id)
    _require(actor, PERM_MANAGE, rca.organization_id)
    _guard_rca_still_mutable(rca)
    _transition(rca, RcaStatus.IN_PROGRESS)
    rca.status = RcaStatus.IN_PROGRESS
    rca.save(update_fields=["status", "updated_at"])
    _append_event(
        rca=rca,
        event_type="RCA_STARTED",
        actor=actor,
        summary="RCA investigation started.",
        payload={},
    )
    record_event(
        event_type="RCA_STARTED",
        actor=actor,
        metadata={"organization_id": str(rca.organization_id), "rca_id": str(rca.id)},
    )
    return rca


@atomic_fn
def add_rca_participant(
    *,
    actor: User,
    rca_id: uuid.UUID,
    participant: User | None = None,
    name_reference: str = "",
    role_note: str = "",
) -> RcaParticipant:
    rca = _locked_rca(rca_id)
    _require(actor, PERM_MANAGE, rca.organization_id)
    _guard_rca_still_mutable(rca)
    row = RcaParticipant(
        rca=rca,
        participant=participant,
        name_reference=(name_reference or "").strip(),
        role_note=(role_note or "").strip(),
        created_by=actor,
    )
    row.full_clean()
    row.save()
    _append_event(
        rca=rca,
        event_type="RCA_PARTICIPANT_ADDED",
        actor=actor,
        summary="RCA participant recorded.",
        payload={},
    )
    return row


@atomic_fn
def add_five_why_step(
    *,
    actor: User,
    rca_id: uuid.UUID,
    sequence: int,
    why_question: str,
    answer: str,
) -> RcaFiveWhyStep:
    rca = _locked_rca(rca_id)
    _require(actor, PERM_MANAGE, rca.organization_id)
    _guard_rca_still_mutable(rca)
    step = RcaFiveWhyStep(
        rca=rca,
        sequence=sequence,
        why_question=(why_question or "").strip(),
        answer=(answer or "").strip(),
        created_by=actor,
    )
    step.full_clean()
    step.save()
    _append_event(
        rca=rca,
        event_type="RCA_FIVE_WHY_RECORDED",
        actor=actor,
        summary="Optional 5 Why step recorded. Five steps are not required.",
        payload={"sequence": sequence},
    )
    record_event(
        event_type="RCA_FIVE_WHY_RECORDED",
        actor=actor,
        metadata={"organization_id": str(rca.organization_id), "rca_id": str(rca.id)},
    )
    return step


@atomic_fn
def add_fishbone_entry(
    *,
    actor: User,
    rca_id: uuid.UUID,
    category: str,
    description: str,
    category_label: str = "",
) -> RcaFishboneEntry:
    rca = _locked_rca(rca_id)
    _require(actor, PERM_MANAGE, rca.organization_id)
    _guard_rca_still_mutable(rca)
    if category not in RcaFishboneCategory.values:
        raise ValidationError({"category": "Unknown fishbone category."})
    entry = RcaFishboneEntry(
        rca=rca,
        category=category,
        category_label=(category_label or "").strip(),
        description=(description or "").strip(),
        created_by=actor,
    )
    entry.full_clean()
    entry.save()
    _append_event(
        rca=rca,
        event_type="RCA_FISHBONE_RECORDED",
        actor=actor,
        summary="Optional fishbone entry recorded. Fishbone is not mandatory.",
        payload={"category": category},
    )
    record_event(
        event_type="RCA_FISHBONE_RECORDED",
        actor=actor,
        metadata={"organization_id": str(rca.organization_id), "rca_id": str(rca.id)},
    )
    return entry


@atomic_fn
def add_possible_cause(
    *,
    actor: User,
    rca_id: uuid.UUID,
    statement: str,
    suggested_by_ai: bool = False,
    evidence_citation: str = "",
) -> RcaCause:
    rca = _locked_rca(rca_id)
    _require(actor, PERM_MANAGE, rca.organization_id)
    _guard_rca_still_mutable(rca)
    cause = RcaCause(
        rca=rca,
        statement=(statement or "").strip(),
        state=RcaCauseState.POSSIBLE_CAUSE,
        suggested_by_ai=suggested_by_ai,
        evidence_citation=(evidence_citation or "").strip(),
        created_by=actor,
    )
    cause.full_clean()
    cause.save()
    summary = (
        "AI-suggested hypothesis recorded as POSSIBLE_CAUSE only."
        if suggested_by_ai
        else "Possible cause recorded. Not confirmed."
    )
    _append_event(
        rca=rca,
        event_type="RCA_HYPOTHESIS_RECORDED",
        actor=actor,
        summary=summary,
        payload={"suggested_by_ai": suggested_by_ai, "state": RcaCauseState.POSSIBLE_CAUSE},
    )
    record_event(
        event_type="RCA_HYPOTHESIS_RECORDED",
        actor=actor,
        metadata={
            "organization_id": str(rca.organization_id),
            "rca_id": str(rca.id),
            "suggested_by_ai": suggested_by_ai,
        },
    )
    return cause


@atomic_fn
def add_rca_evidence(
    *,
    actor: User,
    rca_id: uuid.UUID,
    citation: str = "",
    cause_id: uuid.UUID | None = None,
    linked_object_id: uuid.UUID | None = None,
) -> RcaEvidenceLink:
    rca = _locked_rca(rca_id)
    _require(actor, PERM_MANAGE, rca.organization_id)
    _guard_rca_still_mutable(rca)
    cause = None
    if cause_id is not None:
        cause = lock_queryset(RcaCause.objects.filter(pk=cause_id, rca=rca)).first()
        if cause is None:
            raise ValidationError({"cause_id": "Cause does not belong to this RCA."})
    if linked_object_id is not None:
        from apps.evidence.models import EvidenceAttachment

        found = EvidenceAttachment.objects.filter(
            pk=linked_object_id, organization_id=rca.organization_id
        ).exists()
        if not found:
            raise ValidationError(
                {"linked_object_id": "Evidence object was not found in this organization."}
            )
    link = RcaEvidenceLink(
        rca=rca,
        cause=cause,
        citation=(citation or "").strip(),
        linked_object_id=linked_object_id,
        created_by=actor,
    )
    link.full_clean()
    link.save()
    _append_event(
        rca=rca,
        event_type="RCA_EVIDENCE_LINKED",
        actor=actor,
        summary="Evidence/reference recorded against the RCA or a cause.",
        payload={"has_cause": cause is not None},
    )
    record_event(
        event_type="RCA_EVIDENCE_LINKED",
        actor=actor,
        metadata={"organization_id": str(rca.organization_id), "rca_id": str(rca.id)},
    )
    return link


@atomic_fn
def mark_cause_supported(
    *, actor: User, cause_id: uuid.UUID, evidence_citation: str = ""
) -> RcaCause:
    cause = _locked_cause(cause_id)
    _require(actor, PERM_MANAGE, cause.rca.organization_id)
    _guard_rca_still_mutable(cause.rca)
    if cause.state != RcaCauseState.POSSIBLE_CAUSE:
        raise ValidationError({"state": "Only a possible cause can be marked supported."})
    extra = (evidence_citation or "").strip()
    if extra:
        cause.evidence_citation = extra
        cause.save(update_fields=["evidence_citation", "updated_at"])
    if not _cause_has_evidence(cause):
        raise ValidationError(
            {
                "evidence_citation": (
                    "Supported cause requires an evidence citation or evidence link."
                )
            }
        )
    cause.state = RcaCauseState.SUPPORTED_CAUSE
    cause.save(update_fields=["state", "updated_at"])
    _append_event(
        rca=cause.rca,
        event_type="RCA_CAUSE_STATE_CHANGED",
        actor=actor,
        summary="Cause marked SUPPORTED_CAUSE with evidence. Not confirmed.",
        payload={"cause_id": str(cause.id)},
    )
    record_event(
        event_type="RCA_CAUSE_STATE_CHANGED",
        actor=actor,
        metadata={
            "organization_id": str(cause.rca.organization_id),
            "rca_id": str(cause.rca_id),
            "cause_id": str(cause.id),
        },
    )
    return cause


@atomic_fn
def confirm_root_cause(
    *, actor: User, cause_id: uuid.UUID, confirmation_note: str = ""
) -> RcaCause:
    """Human-only confirmation. Software/AI must never call this autonomously."""
    cause = _locked_cause(cause_id)
    _require(actor, PERM_CONFIRM, cause.rca.organization_id)
    _guard_rca_still_mutable(cause.rca)
    if cause.state != RcaCauseState.SUPPORTED_CAUSE:
        raise ValidationError(
            {
                "state": (
                    "Only a SUPPORTED_CAUSE may be confirmed. "
                    "Software and AI cannot skip to CONFIRMED_ROOT_CAUSE."
                )
            }
        )
    if not _cause_has_evidence(cause):
        raise ValidationError(
            {"evidence_citation": "Root-cause confirmation requires evidence or a reference."}
        )
    # CAS the parent RCA before mutating the cause so a concurrent close/cancel
    # cannot leave a confirmed cause on a terminal RCA (Mongo has no row lock).
    rca = _locked_rca(cause.rca_id)
    _assert_mutable(rca)
    note = (confirmation_note or "").strip()
    confirmed_text = cause.statement if not note else f"{cause.statement}\n{note}"
    expected_status = rca.status
    target_status = expected_status
    if expected_status == RcaStatus.DRAFT:
        _transition(rca, RcaStatus.IN_PROGRESS)
        rca.status = RcaStatus.IN_PROGRESS
        _transition(rca, RcaStatus.ROOT_CAUSE_CONFIRMED)
        target_status = RcaStatus.ROOT_CAUSE_CONFIRMED
    elif expected_status == RcaStatus.IN_PROGRESS:
        _transition(rca, RcaStatus.ROOT_CAUSE_CONFIRMED)
        target_status = RcaStatus.ROOT_CAUSE_CONFIRMED
    elif expected_status != RcaStatus.ROOT_CAUSE_CONFIRMED:
        raise ValidationError(
            {"status": f"Cannot confirm root cause while RCA is {expected_status}."}
        )
    try:
        require_conditional_update(
            RootCauseAnalysis.objects.all(),
            expected={"pk": rca.id, "status": expected_status},
            updates={
                "status": target_status,
                "confirmed_root_cause_text": confirmed_text,
            },
        )
    except TransitionConflictError as exc:
        raise ValidationError(
            {"status": "Closed or cancelled RCA records are historically immutable."}
        ) from exc
    now = timezone.now()
    cause.state = RcaCauseState.CONFIRMED_ROOT_CAUSE
    cause.confirmed_by = actor
    cause.confirmed_at = now
    cause.save(update_fields=["state", "confirmed_by", "confirmed_at", "updated_at"])
    rca.refresh_from_db()
    _append_event(
        rca=rca,
        event_type="RCA_ROOT_CAUSE_CONFIRMED",
        actor=actor,
        summary="Human investigator confirmed root cause. Not an AI decision.",
        payload={
            "cause_id": str(cause.id),
            "suggested_by_ai": cause.suggested_by_ai,
            "human_confirmed": True,
        },
    )
    record_event(
        event_type="RCA_ROOT_CAUSE_CONFIRMED",
        actor=actor,
        metadata={
            "organization_id": str(rca.organization_id),
            "rca_id": str(rca.id),
            "cause_id": str(cause.id),
            "human_confirmed": True,
        },
    )
    return cause


@atomic_fn
def record_rca_verification(
    *, actor: User, rca_id: uuid.UUID, verification_notes: str
) -> RootCauseAnalysis:
    rca = _locked_rca(rca_id)
    _require(actor, PERM_CONFIRM, rca.organization_id)
    _guard_rca_still_mutable(rca)
    notes = (verification_notes or "").strip()
    if not notes:
        raise ValidationError({"verification_notes": "Verification notes are required."})
    _transition(rca, RcaStatus.VERIFIED)
    rca.status = RcaStatus.VERIFIED
    rca.verification_notes = notes
    rca.verified_by = actor
    rca.verified_at = timezone.now()
    rca.save(
        update_fields=[
            "status",
            "verification_notes",
            "verified_by",
            "verified_at",
            "updated_at",
        ]
    )
    _append_event(
        rca=rca,
        event_type="RCA_VERIFIED",
        actor=actor,
        summary="Human verification recorded against the confirmed root cause.",
        payload={},
    )
    record_event(
        event_type="RCA_VERIFIED",
        actor=actor,
        metadata={"organization_id": str(rca.organization_id), "rca_id": str(rca.id)},
    )
    return rca


@atomic_fn
def link_confirmed_cause_to_capa(
    *,
    actor: User,
    cause_id: uuid.UUID,
    create_follow_up: bool = False,
    capa_code: str = "",
    existing_capa_id: uuid.UUID | None = None,
) -> RcaCapaLink:
    cause = _locked_cause(cause_id)
    org = cause.rca.organization
    _require(actor, PERM_CAPA, org.id)
    _guard_rca_still_mutable(cause.rca)
    if cause.state != RcaCauseState.CONFIRMED_ROOT_CAUSE:
        raise ValidationError({"state": "CAPA may be linked only from a CONFIRMED_ROOT_CAUSE."})
    from apps.capa.models import CorrectiveAction

    capa: CorrectiveAction
    if create_follow_up:
        supplied = (capa_code or "").strip()
        if not supplied:
            raise ValidationError({"capa_code": "Owner-supplied CAPA code is required."})
        capa = create_corrective_action(
            actor=actor,
            organization=org,
            code=supplied,
            title=f"RCA {cause.rca.rca_code}",
            summary=cause.statement[:500],
        )
    elif existing_capa_id is not None:
        found = CorrectiveAction.objects.filter(pk=existing_capa_id, organization_id=org.id).first()
        if found is None:
            raise ValidationError({"existing_capa_id": "CAPA not found in organization."})
        capa = found
    else:
        raise ValidationError(
            {
                "citation": (
                    "Provide create_follow_up or existing_capa_id. "
                    "CAPA is never created automatically from RCA."
                )
            }
        )
    link = RcaCapaLink(cause=cause, corrective_action=capa, created_by=actor)
    link.full_clean()
    link.save()
    _append_event(
        rca=cause.rca,
        event_type="RCA_CAPA_LINKED",
        actor=actor,
        summary="Confirmed root cause linked to CAPA by explicit action.",
        payload={"create_follow_up": create_follow_up},
    )
    record_event(
        event_type="RCA_CAPA_LINKED",
        actor=actor,
        metadata={
            "organization_id": str(org.id),
            "rca_id": str(cause.rca_id),
            "cause_id": str(cause.id),
        },
    )
    return link


@atomic_fn
def close_rca(*, actor: User, rca_id: uuid.UUID) -> RootCauseAnalysis:
    rca = _locked_rca(rca_id)
    _require(actor, PERM_MANAGE, rca.organization_id)
    _guard_rca_still_mutable(rca)
    expected_status = rca.status
    _transition(rca, RcaStatus.CLOSED)
    now = timezone.now()
    try:
        require_conditional_update(
            RootCauseAnalysis.objects.all(),
            expected={"pk": rca.id, "status": expected_status},
            updates={
                "status": RcaStatus.CLOSED,
                "closed_by": actor,
                "closed_at": now,
            },
        )
    except TransitionConflictError as exc:
        raise ValidationError(
            {"status": "Closed or cancelled RCA records are historically immutable."}
        ) from exc
    rca.refresh_from_db()
    _append_event(
        rca=rca,
        event_type="RCA_CLOSED",
        actor=actor,
        summary="RCA closed and historically locked.",
        payload={},
    )
    record_event(
        event_type="RCA_CLOSED",
        actor=actor,
        metadata={"organization_id": str(rca.organization_id), "rca_id": str(rca.id)},
    )
    return rca


@atomic_fn
def cancel_rca(*, actor: User, rca_id: uuid.UUID) -> RootCauseAnalysis:
    rca = _locked_rca(rca_id)
    _require(actor, PERM_MANAGE, rca.organization_id)
    _guard_rca_still_mutable(rca)
    expected_status = rca.status
    _transition(rca, RcaStatus.CANCELLED)
    now = timezone.now()
    try:
        require_conditional_update(
            RootCauseAnalysis.objects.all(),
            expected={"pk": rca.id, "status": expected_status},
            updates={
                "status": RcaStatus.CANCELLED,
                "closed_by": actor,
                "closed_at": now,
            },
        )
    except TransitionConflictError as exc:
        raise ValidationError(
            {"status": "Closed or cancelled RCA records are historically immutable."}
        ) from exc
    rca.refresh_from_db()
    _append_event(
        rca=rca,
        event_type="RCA_CANCELLED",
        actor=actor,
        summary="RCA cancelled and historically locked.",
        payload={},
    )
    record_event(
        event_type="RCA_CANCELLED",
        actor=actor,
        metadata={"organization_id": str(rca.organization_id), "rca_id": str(rca.id)},
    )
    return rca
