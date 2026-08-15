"""CAPA domain services — Phase 12 configurable foundation.

Human-only closure. No AI final CAPA closure. No auto-create from FAIL/CCP.
"""

from __future__ import annotations

import uuid
from datetime import date
from typing import Any

from django.core.exceptions import PermissionDenied, ValidationError
from django.db import IntegrityError
from django.utils import timezone

from apps.access_control.services import Scope, require_permission, user_has_permission
from apps.accounts.models import User
from apps.capa.models import (
    CAPA_STATUS_TRANSITIONS,
    CapaActionItem,
    CapaActionItemStatus,
    CapaHistoryEntry,
    CorrectiveAction,
    CorrectiveActionStatus,
)
from apps.core.idempotency import execute_idempotent
from apps.core.persistence import (
    TransitionConflictError,
    atomic_fn,
    cas_status_transition,
    lock_queryset,
    locked_get,
)
from apps.nonconformance.models import NonConformanceRecord
from apps.organizations.models import Organization
from apps.organizations.services import normalize_code, normalize_name
from apps.security_audit.services import record_event

VIEW_CAPA = "capa.view_correctiveaction"
CREATE_CAPA = "capa.create_capa"
MANAGE_CAPA = "capa.manage_capa"
CLOSE_CAPA = "capa.close_capa"


def _require_authenticated_actor(actor: User | None) -> User:
    if actor is None or not getattr(actor, "is_authenticated", False) or not actor.is_active:
        raise PermissionDenied("Authentication required.")
    return actor


def _guard_capa_open(action: CorrectiveAction) -> None:
    """Fail closed if another writer already closed the CAPA (Mongo-safe CAS)."""
    if action.status == CorrectiveActionStatus.CLOSED:
        raise ValidationError({"status": "Closed CAPA records cannot be modified."})
    matched = (
        CorrectiveAction.objects.filter(pk=action.pk)
        .exclude(status=CorrectiveActionStatus.CLOSED)
        .update(updated_at=timezone.now())
    )
    if matched != 1:
        raise ValidationError({"status": "Closed CAPA records cannot be modified."})


def _verify_capa_still_open(action: CorrectiveAction) -> None:
    """Final CAS verification that CAPA remained open during mutation."""
    matched = (
        CorrectiveAction.objects.filter(pk=action.pk)
        .exclude(status=CorrectiveActionStatus.CLOSED)
        .update(updated_at=timezone.now())
    )
    if matched != 1:
        raise ValidationError({"status": "CAPA was closed during this operation."})


def _append_history(
    *,
    capa: CorrectiveAction,
    event_type: str,
    actor: User,
    from_status: str = "",
    to_status: str = "",
    note: str = "",
    metadata: dict[str, Any] | None = None,
) -> CapaHistoryEntry:
    return CapaHistoryEntry.objects.create(
        organization_id=capa.organization_id,
        capa=capa,
        event_type=event_type,
        from_status=from_status or "",
        to_status=to_status or "",
        note=(note or "").strip(),
        metadata=metadata or {},
        actor=actor,
    )


def _code_conflict(exc: Exception) -> ValidationError:
    if isinstance(exc, IntegrityError) or "unique" in str(exc).lower():
        return ValidationError(
            {"code": "A CAPA with this code already exists in the organization."}
        )
    if isinstance(exc, ValidationError):
        return exc
    return ValidationError(str(exc))


def _can_close_capa(user: User, organization_id: uuid.UUID) -> bool:
    scope = Scope(organization_id=organization_id)
    return user_has_permission(user, CLOSE_CAPA, scope=scope) or user_has_permission(
        user, MANAGE_CAPA, scope=scope
    )


@atomic_fn
def create_corrective_action(
    *,
    actor: User | None,
    organization: Organization,
    code: str,
    title: str,
    summary: str = "",
    nonconformance_id: uuid.UUID | None = None,
    owner_id: uuid.UUID | None = None,
) -> CorrectiveAction:
    user = _require_authenticated_actor(actor)
    require_permission(user, CREATE_CAPA, scope=Scope(organization_id=organization.id))
    normalized_code = normalize_code(code)
    normalized_title = normalize_name(title)
    if not normalized_code:
        raise ValidationError({"code": "Code cannot be blank."})
    if not normalized_title:
        raise ValidationError({"title": "Title cannot be blank."})
    ncr: NonConformanceRecord | None = None
    if nonconformance_id is not None:
        ncr = NonConformanceRecord.objects.filter(
            pk=nonconformance_id, organization_id=organization.id
        ).first()
        if ncr is None:
            raise ValidationError({"nonconformance": "Nonconformance not found in organization."})
    action = CorrectiveAction(
        organization=organization,
        code=normalized_code,
        title=normalized_title,
        summary=(summary or "").strip(),
        nonconformance=ncr,
        owner_id=owner_id,
        status=CorrectiveActionStatus.OPEN,
        created_by=user,
    )
    try:
        action.full_clean()
        action.save()
    except (ValidationError, IntegrityError) as exc:
        raise _code_conflict(exc) from exc
    _append_history(
        capa=action,
        event_type="CREATED",
        actor=user,
        to_status=action.status,
        note=action.title,
        metadata={"code": action.code, "nonconformance_id": str(ncr.id) if ncr else None},
    )
    record_event(
        event_type="CAPA_CREATED",
        actor=user,
        metadata={
            "capa_id": str(action.id),
            "organization_id": str(organization.id),
            "code": action.code,
            "nonconformance_id": str(ncr.id) if ncr else None,
        },
    )
    return action


@atomic_fn
def transition_capa_status(
    *,
    actor: User | None,
    capa_id: uuid.UUID,
    to_status: str,
    note: str = "",
    idempotency_key: str = "",
) -> CorrectiveAction:
    user = _require_authenticated_actor(actor)
    action = locked_get(CorrectiveAction, pk=capa_id)
    if action is None:
        raise ValidationError({"capa": "Corrective action not found."})
    require_permission(user, MANAGE_CAPA, scope=Scope(organization_id=action.organization_id))
    if to_status == CorrectiveActionStatus.CLOSED:
        raise ValidationError({"status": "Use close_corrective_action to close a CAPA."})
    from_status = action.status
    if from_status == to_status:
        return action
    allowed = CAPA_STATUS_TRANSITIONS.get(from_status, frozenset())
    if to_status not in allowed:
        raise ValidationError(
            {"status": f"Transition from {from_status} to {to_status} is not allowed."}
        )

    def _transition() -> CorrectiveAction:
        current = locked_get(CorrectiveAction, pk=capa_id)
        if current is None:
            raise ValidationError({"capa": "Corrective action not found."})
        if current.status == to_status:
            return current
        if current.status != from_status:
            live_allowed = CAPA_STATUS_TRANSITIONS.get(current.status, frozenset())
            if to_status not in live_allowed:
                raise ValidationError(
                    {"status": f"Transition from {current.status} to {to_status} is not allowed."}
                )
        actual_from_status = current.status
        now = timezone.now()
        try:
            cas_status_transition(
                CorrectiveAction,
                pk=current.pk,
                from_status=current.status,
                to_status=to_status,
                extra_updates={"updated_at": now},
            )
        except TransitionConflictError as exc:
            raise ValidationError({"status": "CAPA was updated concurrently."}) from exc
        current.refresh_from_db()
        _append_history(
            capa=current,
            event_type="STATUS_CHANGED",
            actor=user,
            from_status=actual_from_status,
            to_status=to_status,
            note=note,
        )
        record_event(
            event_type="CAPA_STATUS_CHANGED",
            actor=user,
            metadata={
                "capa_id": str(current.id),
                "organization_id": str(current.organization_id),
                "code": current.code,
                "from_status": actual_from_status,
                "to_status": to_status,
            },
        )
        return current

    key = (idempotency_key or "").strip()
    return execute_idempotent(
        organization=action.organization,
        scope="capa.transition",
        key=key,
        fn=_transition,
        reload=lambda ref: CorrectiveAction.objects.filter(pk=ref).first(),
    )


@atomic_fn
def record_capa_verification(
    *,
    actor: User | None,
    capa_id: uuid.UUID,
    notes: str,
) -> CorrectiveAction:
    """Record verification notes and move case to VERIFICATION."""
    user = _require_authenticated_actor(actor)
    action = locked_get(CorrectiveAction, pk=capa_id)
    if action is None:
        raise ValidationError({"capa": "Corrective action not found."})
    require_permission(user, MANAGE_CAPA, scope=Scope(organization_id=action.organization_id))
    _guard_capa_open(action)
    text = (notes or "").strip()
    if not text:
        raise ValidationError({"notes": "Verification notes cannot be blank."})
    from_status = action.status
    now = timezone.now()
    if from_status != CorrectiveActionStatus.VERIFICATION:
        allowed = CAPA_STATUS_TRANSITIONS.get(from_status, frozenset())
        if CorrectiveActionStatus.VERIFICATION not in allowed:
            raise ValidationError(
                {"status": (f"Cannot move to VERIFICATION from status {from_status}.")}
            )
    action.verification_notes = text
    action.verified_by = user
    action.verified_at = now
    action.status = CorrectiveActionStatus.VERIFICATION
    action.full_clean()
    try:
        cas_status_transition(
            CorrectiveAction,
            pk=action.pk,
            from_status=from_status,
            to_status=CorrectiveActionStatus.VERIFICATION,
            extra_updates={
                "verification_notes": text,
                "verified_by_id": user.pk,
                "verified_at": now,
                "updated_at": now,
            },
        )
    except TransitionConflictError as exc:
        raise ValidationError({"status": "CAPA was updated concurrently."}) from exc
    action.refresh_from_db()
    _append_history(
        capa=action,
        event_type="VERIFICATION_RECORDED",
        actor=user,
        from_status=from_status,
        to_status=action.status,
        note=text,
    )
    record_event(
        event_type="CAPA_VERIFICATION_RECORDED",
        actor=user,
        metadata={
            "capa_id": str(action.id),
            "organization_id": str(action.organization_id),
            "code": action.code,
            "from_status": from_status,
            "to_status": action.status,
        },
    )
    return action


@atomic_fn
def record_capa_effectiveness_review(
    *,
    actor: User | None,
    capa_id: uuid.UUID,
    notes: str,
) -> CorrectiveAction:
    """Record effectiveness review and move case to EFFECTIVENESS_REVIEW."""
    user = _require_authenticated_actor(actor)
    action = locked_get(CorrectiveAction, pk=capa_id)
    if action is None:
        raise ValidationError({"capa": "Corrective action not found."})
    require_permission(user, MANAGE_CAPA, scope=Scope(organization_id=action.organization_id))
    _guard_capa_open(action)
    text = (notes or "").strip()
    if not text:
        raise ValidationError({"notes": "Effectiveness review notes cannot be blank."})
    from_status = action.status
    now = timezone.now()
    if from_status != CorrectiveActionStatus.EFFECTIVENESS_REVIEW:
        allowed = CAPA_STATUS_TRANSITIONS.get(from_status, frozenset())
        if CorrectiveActionStatus.EFFECTIVENESS_REVIEW not in allowed:
            raise ValidationError(
                {"status": (f"Cannot move to EFFECTIVENESS_REVIEW from status {from_status}.")}
            )
    action.effectiveness_notes = text
    action.effectiveness_reviewed_by = user
    action.effectiveness_reviewed_at = now
    action.status = CorrectiveActionStatus.EFFECTIVENESS_REVIEW
    action.full_clean()
    try:
        cas_status_transition(
            CorrectiveAction,
            pk=action.pk,
            from_status=from_status,
            to_status=CorrectiveActionStatus.EFFECTIVENESS_REVIEW,
            extra_updates={
                "effectiveness_notes": text,
                "effectiveness_reviewed_by_id": user.pk,
                "effectiveness_reviewed_at": now,
                "updated_at": now,
            },
        )
    except TransitionConflictError as exc:
        raise ValidationError({"status": "CAPA was updated concurrently."}) from exc
    action.refresh_from_db()
    _append_history(
        capa=action,
        event_type="EFFECTIVENESS_REVIEW_RECORDED",
        actor=user,
        from_status=from_status,
        to_status=action.status,
        note=text,
    )
    record_event(
        event_type="CAPA_EFFECTIVENESS_REVIEWED",
        actor=user,
        metadata={
            "capa_id": str(action.id),
            "organization_id": str(action.organization_id),
            "code": action.code,
            "from_status": from_status,
            "to_status": action.status,
        },
    )
    return action


@atomic_fn
def add_capa_action_item(
    *,
    actor: User | None,
    capa_id: uuid.UUID,
    description: str,
    owner_id: uuid.UUID | None = None,
    due_date: date | None = None,
) -> CapaActionItem:
    user = _require_authenticated_actor(actor)
    action = locked_get(CorrectiveAction, pk=capa_id)
    if action is None:
        raise ValidationError({"capa": "Corrective action not found."})
    require_permission(user, MANAGE_CAPA, scope=Scope(organization_id=action.organization_id))
    _guard_capa_open(action)
    desc = (description or "").strip()
    if not desc:
        raise ValidationError({"description": "Description cannot be blank."})
    item = CapaActionItem(
        capa=action,
        description=desc,
        owner_id=owner_id,
        due_date=due_date,
        status=CapaActionItemStatus.OPEN,
    )
    item.full_clean()
    item.save()
    _verify_capa_still_open(action)
    _append_history(
        capa=action,
        event_type="ACTION_ITEM_ADDED",
        actor=user,
        from_status=action.status,
        to_status=action.status,
        note=desc[:200],
        metadata={"action_item_id": str(item.id)},
    )
    record_event(
        event_type="CAPA_ACTION_ADDED",
        actor=user,
        metadata={
            "capa_id": str(action.id),
            "action_item_id": str(item.id),
            "organization_id": str(action.organization_id),
            "code": action.code,
        },
    )
    return item


@atomic_fn
def complete_capa_action_item(
    *,
    actor: User | None,
    action_item_id: uuid.UUID,
) -> CapaActionItem:
    user = _require_authenticated_actor(actor)
    item = lock_queryset(
        CapaActionItem.objects.select_related("capa").filter(pk=action_item_id)
    ).first()
    if item is None:
        raise ValidationError({"action_item": "CAPA action item not found."})
    require_permission(user, MANAGE_CAPA, scope=Scope(organization_id=item.capa.organization_id))
    _guard_capa_open(item.capa)
    if item.status == CapaActionItemStatus.DONE:
        return item
    if item.status == CapaActionItemStatus.CANCELLED:
        raise ValidationError({"status": "Cancelled action items cannot be completed."})
    item.status = CapaActionItemStatus.DONE
    item.completed_at = timezone.now()
    item.full_clean()
    item.save(update_fields=["status", "completed_at", "updated_at"])
    _verify_capa_still_open(item.capa)
    _append_history(
        capa=item.capa,
        event_type="ACTION_ITEM_COMPLETED",
        actor=user,
        from_status=item.capa.status,
        to_status=item.capa.status,
        metadata={"action_item_id": str(item.id)},
    )
    return item


@atomic_fn
def close_corrective_action(
    *,
    actor: User | None,
    capa_id: uuid.UUID,
    closure_notes: str = "",
) -> CorrectiveAction:
    """Human-only CAPA closure. Never callable by AI decision paths."""
    user = _require_authenticated_actor(actor)
    action = locked_get(CorrectiveAction, pk=capa_id)
    if action is None:
        raise ValidationError({"capa": "Corrective action not found."})
    if not _can_close_capa(user, action.organization_id):
        raise PermissionDenied("Missing close_capa permission.")
    if action.status == CorrectiveActionStatus.CLOSED:
        return action
    allowed = CAPA_STATUS_TRANSITIONS.get(action.status, frozenset())
    if CorrectiveActionStatus.CLOSED not in allowed:
        raise ValidationError({"status": f"Cannot close CAPA from status {action.status}."})
    from_status = action.status
    now = timezone.now()
    notes = (closure_notes or "").strip()
    action.status = CorrectiveActionStatus.CLOSED
    action.closure_notes = notes
    action.closed_by = user
    action.closed_at = now
    action.full_clean()
    try:
        cas_status_transition(
            CorrectiveAction,
            pk=action.pk,
            from_status=from_status,
            to_status=CorrectiveActionStatus.CLOSED,
            extra_updates={
                "closure_notes": notes,
                "closed_by_id": user.pk,
                "closed_at": now,
                "updated_at": now,
            },
        )
    except TransitionConflictError as exc:
        fresh = CorrectiveAction.objects.filter(pk=capa_id).first()
        if fresh is not None and fresh.status == CorrectiveActionStatus.CLOSED:
            return fresh
        raise ValidationError({"status": "CAPA was updated concurrently."}) from exc
    action.refresh_from_db()
    _append_history(
        capa=action,
        event_type="CLOSED",
        actor=user,
        from_status=from_status,
        to_status=CorrectiveActionStatus.CLOSED,
        note=action.closure_notes,
    )
    record_event(
        event_type="CAPA_CLOSED",
        actor=user,
        metadata={
            "capa_id": str(action.id),
            "organization_id": str(action.organization_id),
            "code": action.code,
            "from_status": from_status,
        },
    )
    return action
