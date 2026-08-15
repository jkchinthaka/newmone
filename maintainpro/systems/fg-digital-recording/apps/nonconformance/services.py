"""Nonconformance and Hold case services — Phase 12 foundation.

No automatic case generation from FAIL/CCP. ChecklistCorrection is a separate
recording concern and is never created or closed here.
"""

from __future__ import annotations

import uuid
from typing import Any

from django.core.exceptions import PermissionDenied, ValidationError
from django.db import IntegrityError
from django.utils import timezone

from apps.access_control.services import Scope, require_permission, user_has_permission
from apps.accounts.models import User
from apps.core.persistence import (
    TransitionConflictError,
    atomic_fn,
    cas_status_transition,
    locked_get,
)
from apps.nonconformance.models import (
    NCR_STATUS_TRANSITIONS,
    HoldCase,
    HoldCaseStatus,
    NonConformanceRecord,
    NonConformanceSource,
    NonConformanceStatus,
    QualityCaseHistoryEntry,
    QualityCaseHistoryKind,
)
from apps.organizations.models import Organization
from apps.organizations.services import normalize_code, normalize_name
from apps.security_audit.services import record_event

VIEW_NONCONFORMANCE = "nonconformance.view_nonconformancerecord"
CREATE_NCR = "nonconformance.create_nonconformance"
MANAGE_NCR = "nonconformance.manage_nonconformance"
CLOSE_NCR = "nonconformance.close_nonconformance"
# Back-compat aliases
CREATE_NONCONFORMANCE = CREATE_NCR
MANAGE_NONCONFORMANCE = MANAGE_NCR
CLOSE_NONCONFORMANCE = CLOSE_NCR

VIEW_HOLD = "nonconformance.view_holdcase"
CREATE_HOLD = "nonconformance.create_holdcase"
MANAGE_HOLD = "nonconformance.manage_holdcase"
CLOSE_HOLD = "nonconformance.close_holdcase"


def _require_authenticated_actor(actor: User | None) -> User:
    if actor is None or not getattr(actor, "is_authenticated", False) or not actor.is_active:
        raise PermissionDenied("Authentication required.")
    return actor


def _guard_ncr_open(record: NonConformanceRecord) -> None:
    if record.status == NonConformanceStatus.CLOSED:
        raise ValidationError({"status": "Closed nonconformances cannot be updated."})
    matched = (
        NonConformanceRecord.objects.filter(pk=record.pk)
        .exclude(status=NonConformanceStatus.CLOSED)
        .update(updated_at=timezone.now())
    )
    if matched != 1:
        raise ValidationError({"status": "Closed nonconformances cannot be updated."})


def _verify_ncr_still_open(record: NonConformanceRecord) -> None:
    """Final CAS verification that NCR remained open during mutation."""
    matched = (
        NonConformanceRecord.objects.filter(pk=record.pk)
        .exclude(status=NonConformanceStatus.CLOSED)
        .update(updated_at=timezone.now())
    )
    if matched != 1:
        raise ValidationError({"status": "Nonconformance was closed during this operation."})


def _append_history(
    *,
    organization_id: uuid.UUID,
    case_kind: str,
    case_id: uuid.UUID,
    event_type: str,
    actor: User,
    from_status: str = "",
    to_status: str = "",
    note: str = "",
    metadata: dict[str, Any] | None = None,
) -> QualityCaseHistoryEntry:
    return QualityCaseHistoryEntry.objects.create(
        organization_id=organization_id,
        case_kind=case_kind,
        case_id=case_id,
        event_type=event_type,
        from_status=from_status or "",
        to_status=to_status or "",
        note=(note or "").strip(),
        metadata=metadata or {},
        actor=actor,
    )


def _code_conflict(exc: Exception, message: str) -> ValidationError:
    if isinstance(exc, IntegrityError) or "unique" in str(exc).lower():
        return ValidationError({"code": message})
    if isinstance(exc, ValidationError):
        return exc
    return ValidationError(str(exc))


def _can_close_ncr(user: User, organization_id: uuid.UUID) -> bool:
    scope = Scope(organization_id=organization_id)
    return user_has_permission(user, CLOSE_NCR, scope=scope) or user_has_permission(
        user, MANAGE_NCR, scope=scope
    )


@atomic_fn
def create_nonconformance(
    *,
    actor: User | None,
    organization: Organization,
    code: str,
    title: str,
    summary: str = "",
    description: str = "",
    source: str = NonConformanceSource.MANUAL,
    batch_reference: str = "",
    checklist_task_id: uuid.UUID | None = None,
    checklist_submission_id: uuid.UUID | None = None,
    quantity_reference: str = "",
    owner_id: uuid.UUID | None = None,
    containment: str = "",
    investigation: str = "",
) -> NonConformanceRecord:
    """Open a formal NCR. Never auto-invoked from FAIL/CCP evaluation."""
    user = _require_authenticated_actor(actor)
    org_scope = Scope(organization_id=organization.id)
    if not (
        user_has_permission(user, CREATE_NCR, scope=org_scope)
        or user_has_permission(user, MANAGE_NCR, scope=org_scope)
    ):
        raise PermissionDenied("Permission denied.")
    normalized_code = normalize_code(code)
    normalized_title = normalize_name(title)
    if not normalized_code:
        raise ValidationError({"code": "Code cannot be blank."})
    if not normalized_title:
        raise ValidationError({"title": "Title cannot be blank."})
    desc = (description or summary or "").strip()
    record = NonConformanceRecord(
        organization=organization,
        code=normalized_code,
        title=normalized_title,
        source=source or NonConformanceSource.MANUAL,
        status=NonConformanceStatus.OPEN,
        description=desc,
        summary=desc,
        batch_reference=(batch_reference or "").strip(),
        checklist_task_id=checklist_task_id,
        checklist_submission_id=checklist_submission_id,
        quantity_reference=(quantity_reference or "").strip(),
        owner_id=owner_id,
        containment=(containment or "").strip(),
        investigation=(investigation or "").strip(),
        created_by=user,
    )
    try:
        record.full_clean()
        record.save()
    except (ValidationError, IntegrityError) as exc:
        raise _code_conflict(
            exc, "A nonconformance with this code already exists in the organization."
        ) from exc
    _append_history(
        organization_id=organization.id,
        case_kind=QualityCaseHistoryKind.NONCONFORMANCE,
        case_id=record.id,
        event_type="CREATED",
        actor=user,
        to_status=record.status,
        note=record.title,
        metadata={"code": record.code, "source": record.source},
    )
    record_event(
        event_type="NONCONFORMANCE_CREATED",
        actor=user,
        metadata={
            "nonconformance_id": str(record.id),
            "organization_id": str(organization.id),
            "code": record.code,
            "source": record.source,
        },
    )
    return record


@atomic_fn
def update_nonconformance_case_fields(
    *,
    actor: User | None,
    nonconformance_id: uuid.UUID,
    title: str | None = None,
    description: str | None = None,
    batch_reference: str | None = None,
    quantity_reference: str | None = None,
    owner_id: uuid.UUID | None | object = ...,
    containment: str | None = None,
    investigation: str | None = None,
) -> NonConformanceRecord:
    """Update open NCR fields. Closed cases are immutable."""
    user = _require_authenticated_actor(actor)
    record = locked_get(NonConformanceRecord, pk=nonconformance_id)
    if record is None:
        raise ValidationError({"nonconformance": "Nonconformance not found."})
    require_permission(user, MANAGE_NCR, scope=Scope(organization_id=record.organization_id))
    _guard_ncr_open(record)
    changed: list[str] = []
    if title is not None:
        normalized_title = normalize_name(title)
        if not normalized_title:
            raise ValidationError({"title": "Title cannot be blank."})
        record.title = normalized_title
        changed.append("title")
    if description is not None:
        record.description = description.strip()
        record.summary = record.description
        changed.extend(["description", "summary"])
    if batch_reference is not None:
        record.batch_reference = batch_reference.strip()
        changed.append("batch_reference")
    if quantity_reference is not None:
        record.quantity_reference = quantity_reference.strip()
        changed.append("quantity_reference")
    if owner_id is not ...:
        record.owner_id = owner_id  # type: ignore[assignment]
        changed.append("owner")
    if containment is not None:
        record.containment = containment.strip()
        changed.append("containment")
    if investigation is not None:
        record.investigation = investigation.strip()
        changed.append("investigation")
    if not changed:
        return record
    # Never persist status via full-model save — a concurrent close would be
    # overwritten back to OPEN. Restrict update_fields and CAS on still-open.
    update_fields: list[str] = []
    field_map = {
        "title": "title",
        "description": "description",
        "summary": "summary",
        "batch_reference": "batch_reference",
        "quantity_reference": "quantity_reference",
        "owner": "owner_id",
        "containment": "containment",
        "investigation": "investigation",
    }
    for label in changed:
        mapped = field_map.get(label, label)
        if mapped not in update_fields:
            update_fields.append(mapped)
    update_fields.append("updated_at")
    record.updated_at = timezone.now()
    record.full_clean()
    payload = {name: getattr(record, name) for name in update_fields}
    matched = NonConformanceRecord.objects.filter(
        pk=record.pk,
    ).exclude(status=NonConformanceStatus.CLOSED).update(**payload)
    if matched != 1:
        raise ValidationError({"status": "Nonconformance was closed during this operation."})
    record.refresh_from_db()
    _append_history(
        organization_id=record.organization_id,
        case_kind=QualityCaseHistoryKind.NONCONFORMANCE,
        case_id=record.id,
        event_type="UPDATED",
        actor=user,
        from_status=record.status,
        to_status=record.status,
        note=",".join(changed),
        metadata={"fields": changed},
    )
    record_event(
        event_type="NONCONFORMANCE_UPDATED",
        actor=user,
        metadata={
            "nonconformance_id": str(record.id),
            "organization_id": str(record.organization_id),
            "code": record.code,
            "fields": changed,
        },
    )
    return record


@atomic_fn
def transition_nonconformance_status(
    *,
    actor: User | None,
    nonconformance_id: uuid.UUID,
    to_status: str,
    note: str = "",
) -> NonConformanceRecord:
    """Lifecycle transition. Closing must use close_nonconformance."""
    user = _require_authenticated_actor(actor)
    record = locked_get(NonConformanceRecord, pk=nonconformance_id)
    if record is None:
        raise ValidationError({"nonconformance": "Nonconformance not found."})
    require_permission(user, MANAGE_NCR, scope=Scope(organization_id=record.organization_id))
    if to_status == NonConformanceStatus.CLOSED:
        raise ValidationError(
            {"status": "Use close_nonconformance to close a nonconformance case."}
        )
    from_status = record.status
    allowed = NCR_STATUS_TRANSITIONS.get(from_status, frozenset())
    if to_status not in allowed:
        raise ValidationError(
            {"status": f"Transition from {from_status} to {to_status} is not allowed."}
        )
    now = timezone.now()
    try:
        cas_status_transition(
            NonConformanceRecord,
            pk=record.pk,
            from_status=from_status,
            to_status=to_status,
            extra_updates={"updated_at": now},
        )
    except TransitionConflictError as exc:
        raise ValidationError({"status": "Nonconformance was updated concurrently."}) from exc
    record.refresh_from_db()
    _append_history(
        organization_id=record.organization_id,
        case_kind=QualityCaseHistoryKind.NONCONFORMANCE,
        case_id=record.id,
        event_type="STATUS_CHANGED",
        actor=user,
        from_status=from_status,
        to_status=to_status,
        note=note,
    )
    record_event(
        event_type="NONCONFORMANCE_STATUS_CHANGED",
        actor=user,
        metadata={
            "nonconformance_id": str(record.id),
            "organization_id": str(record.organization_id),
            "code": record.code,
            "from_status": from_status,
            "to_status": to_status,
        },
    )
    return record


@atomic_fn
def close_nonconformance(
    *,
    actor: User | None,
    nonconformance_id: uuid.UUID,
    closure_notes: str = "",
) -> NonConformanceRecord:
    """Close NCR. Requires close_nonconformance or manage_nonconformance (legacy)."""
    user = _require_authenticated_actor(actor)
    record = locked_get(NonConformanceRecord, pk=nonconformance_id)
    if record is None:
        raise ValidationError({"nonconformance": "Nonconformance not found."})
    if not _can_close_ncr(user, record.organization_id):
        raise PermissionDenied("Missing close_nonconformance permission.")
    if record.status == NonConformanceStatus.CLOSED:
        return record
    allowed = NCR_STATUS_TRANSITIONS.get(record.status, frozenset())
    if NonConformanceStatus.CLOSED not in allowed:
        raise ValidationError(
            {"status": f"Cannot close nonconformance from status {record.status}."}
        )
    from_status = record.status
    now = timezone.now()
    notes = (closure_notes or "").strip()
    record.status = NonConformanceStatus.CLOSED
    record.closure_notes = notes
    record.closed_by = user
    record.closed_at = now
    record.full_clean()
    try:
        cas_status_transition(
            NonConformanceRecord,
            pk=record.pk,
            from_status=from_status,
            to_status=NonConformanceStatus.CLOSED,
            extra_updates={
                "closure_notes": notes,
                "closed_by_id": user.pk,
                "closed_at": now,
                "updated_at": now,
            },
        )
    except TransitionConflictError as exc:
        fresh = NonConformanceRecord.objects.filter(pk=nonconformance_id).first()
        if fresh is not None and fresh.status == NonConformanceStatus.CLOSED:
            return fresh
        raise ValidationError({"status": "Nonconformance was updated concurrently."}) from exc
    record.refresh_from_db()
    _append_history(
        organization_id=record.organization_id,
        case_kind=QualityCaseHistoryKind.NONCONFORMANCE,
        case_id=record.id,
        event_type="CLOSED",
        actor=user,
        from_status=from_status,
        to_status=NonConformanceStatus.CLOSED,
        note=record.closure_notes,
    )
    record_event(
        event_type="NONCONFORMANCE_CLOSED",
        actor=user,
        metadata={
            "nonconformance_id": str(record.id),
            "organization_id": str(record.organization_id),
            "code": record.code,
            "from_status": from_status,
        },
    )
    return record


@atomic_fn
def create_hold_case(
    *,
    actor: User | None,
    organization: Organization,
    code: str,
    reason_reference: str,
    scope: str = "",
    owner_id: uuid.UUID | None = None,
    nonconformance_id: uuid.UUID | None = None,
    batch_reference: str = "",
    quantity_reference: str = "",
) -> HoldCase:
    """Open a Hold case. Free-text reason/resolution only."""
    user = _require_authenticated_actor(actor)
    org_scope = Scope(organization_id=organization.id)
    if not (
        user_has_permission(user, CREATE_HOLD, scope=org_scope)
        or user_has_permission(user, MANAGE_HOLD, scope=org_scope)
    ):
        raise PermissionDenied("Permission denied.")
    normalized_code = normalize_code(code)
    reason = (reason_reference or "").strip()
    if not normalized_code:
        raise ValidationError({"code": "Code cannot be blank."})
    if not reason:
        raise ValidationError({"reason_reference": "Reason/reference cannot be blank."})
    ncr: NonConformanceRecord | None = None
    if nonconformance_id is not None:
        ncr = NonConformanceRecord.objects.filter(
            pk=nonconformance_id, organization_id=organization.id
        ).first()
        if ncr is None:
            raise ValidationError({"nonconformance": "Nonconformance not found in organization."})
    hold = HoldCase(
        organization=organization,
        code=normalized_code,
        reason_reference=reason,
        scope=(scope or "").strip(),
        status=HoldCaseStatus.OPEN,
        owner_id=owner_id,
        nonconformance=ncr,
        batch_reference=(batch_reference or "").strip(),
        quantity_reference=(quantity_reference or "").strip(),
        opened_by=user,
    )
    try:
        hold.full_clean()
        hold.save()
    except (ValidationError, IntegrityError) as exc:
        raise _code_conflict(
            exc, "A hold case with this code already exists in the organization."
        ) from exc
    _append_history(
        organization_id=organization.id,
        case_kind=QualityCaseHistoryKind.HOLD,
        case_id=hold.id,
        event_type="CREATED",
        actor=user,
        to_status=hold.status,
        note=hold.reason_reference,
        metadata={"code": hold.code},
    )
    record_event(
        event_type="HOLD_CASE_CREATED",
        actor=user,
        metadata={
            "hold_case_id": str(hold.id),
            "organization_id": str(organization.id),
            "code": hold.code,
            "nonconformance_id": str(ncr.id) if ncr else None,
        },
    )
    return hold


@atomic_fn
def close_hold_case(
    *,
    actor: User | None,
    hold_case_id: uuid.UUID,
    resolution: str = "",
) -> HoldCase:
    """Close hold with free-text resolution — no company resolution catalogue."""
    user = _require_authenticated_actor(actor)
    hold = locked_get(HoldCase, pk=hold_case_id)
    if hold is None:
        raise ValidationError({"hold_case": "Hold case not found."})
    org_scope = Scope(organization_id=hold.organization_id)
    if not (
        user_has_permission(user, CLOSE_HOLD, scope=org_scope)
        or user_has_permission(user, MANAGE_HOLD, scope=org_scope)
    ):
        raise PermissionDenied("Permission denied.")
    if hold.status == HoldCaseStatus.CLOSED:
        return hold
    now = timezone.now()
    resolution_text = (resolution or "").strip()
    try:
        cas_status_transition(
            HoldCase,
            pk=hold.pk,
            from_status=hold.status,
            to_status=HoldCaseStatus.CLOSED,
            extra_updates={
                "resolution": resolution_text,
                "closed_by_id": user.pk,
                "closed_at": now,
                "updated_at": now,
            },
        )
    except TransitionConflictError as exc:
        fresh = HoldCase.objects.filter(pk=hold_case_id).first()
        if fresh is not None and fresh.status == HoldCaseStatus.CLOSED:
            return fresh
        raise ValidationError({"status": "Hold case was updated concurrently."}) from exc
    hold.refresh_from_db()
    _append_history(
        organization_id=hold.organization_id,
        case_kind=QualityCaseHistoryKind.HOLD,
        case_id=hold.id,
        event_type="CLOSED",
        actor=user,
        from_status=HoldCaseStatus.OPEN,
        to_status=HoldCaseStatus.CLOSED,
        note=hold.resolution,
    )
    record_event(
        event_type="HOLD_CASE_CLOSED",
        actor=user,
        metadata={
            "hold_case_id": str(hold.id),
            "organization_id": str(hold.organization_id),
            "code": hold.code,
        },
    )
    return hold


# Stable aliases for alternate naming used across Phase 12 iterations.
transition_nonconformance = transition_nonconformance_status
update_nonconformance = update_nonconformance_case_fields
