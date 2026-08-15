"""Dispatch / loading quality services — Phase 13 foundation.

No ERP writes. No invented temperature limits. QA RELEASE gate defaults OFF.
AI suggestions never block or release loading.
"""

from __future__ import annotations

import uuid
from datetime import datetime
from decimal import Decimal, InvalidOperation
from typing import Any, cast

from django.core.exceptions import PermissionDenied, ValidationError
from django.db import IntegrityError
from django.utils import timezone

from apps.access_control.services import Scope, require_permission, user_has_permission
from apps.accounts.models import User
from apps.core.persistence import atomic, atomic_fn, lock_queryset, locked_get
from apps.dispatch.models import (
    ColdChainTemperatureReading,
    DispatchHistoryEntry,
    DispatchHistoryEventType,
    DispatchQualityRecord,
    DispatchQuantityLine,
    DispatchRecordStatus,
    DispatchReleasePolicy,
)
from apps.organizations.models import Organization
from apps.organizations.services import normalize_code
from apps.quality.models import QAReview, QAReviewDecision
from apps.security_audit.services import record_event

CREATE_DISPATCH = "dispatch.create_dispatchqualityrecord"
MANAGE_DISPATCH = "dispatch.manage_dispatchqualityrecord"
COMPLETE_DISPATCH = "dispatch.complete_dispatchqualityrecord"
MANAGE_RELEASE_POLICY = "dispatch.manage_dispatchreleasepolicy"
VIEW_DISPATCH = "dispatch.view_dispatchqualityrecord"


def _require_authenticated_actor(actor: User | None) -> User:
    if actor is None or not getattr(actor, "is_authenticated", False) or not actor.is_active:
        raise PermissionDenied("Authentication required.")
    return actor


def _append_history(
    *,
    record: DispatchQualityRecord,
    event_type: str,
    actor: User,
    from_status: str = "",
    to_status: str = "",
    note: str = "",
    metadata: dict[str, Any] | None = None,
) -> DispatchHistoryEntry:
    return DispatchHistoryEntry.objects.create(
        organization_id=record.organization_id,
        dispatch_record=record,
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
            {"code": "A dispatch quality record with this code already exists in the organization."}
        )
    if isinstance(exc, ValidationError):
        return exc
    return ValidationError(str(exc))


def _to_decimal(value: Decimal | str | int | float | None, field: str) -> Decimal | None:
    if value is None:
        return None
    if isinstance(value, Decimal):
        return value
    try:
        return Decimal(str(value).strip())
    except (InvalidOperation, ValueError) as exc:
        raise ValidationError({field: f"Invalid decimal for {field}."}) from exc


def get_or_create_release_policy(
    *, organization: Organization, actor: User
) -> DispatchReleasePolicy:
    """Return org policy; creates disabled default when missing."""
    policy = DispatchReleasePolicy.objects.filter(organization=organization).first()
    if policy is not None:
        return policy
    return DispatchReleasePolicy.objects.create(
        organization=organization,
        require_qa_release_before_loading=False,
        updated_by=actor,
    )


def evaluate_release_gate(
    *,
    record: DispatchQualityRecord,
    policy: DispatchReleasePolicy | None = None,
) -> dict[str, Any]:
    """
    Evaluate QA RELEASE loading gate.

    Never uses AI report outcomes. Gate disabled by default.
    """
    if policy is None:
        policy = DispatchReleasePolicy.objects.filter(
            organization_id=record.organization_id
        ).first()
    enabled = bool(policy and policy.require_qa_release_before_loading)
    result: dict[str, Any] = {
        "gate_enabled": enabled,
        "allowed": True,
        "reason": "Gate disabled — QA RELEASE not required before loading.",
        "qa_review_id": str(record.qa_review_id) if record.qa_review_id else None,
        "qa_decision": None,
    }
    if not enabled:
        return result
    qa_review = record.qa_review
    if qa_review is None:
        result["allowed"] = False
        result["reason"] = (
            "QA RELEASE gate enabled: link a QAReview with decision RELEASE before completing."
        )
        return result
    decision = qa_review.decision
    result["qa_decision"] = decision
    if decision != QAReviewDecision.RELEASE:
        result["allowed"] = False
        result["reason"] = (
            f"QA RELEASE gate enabled: linked QAReview decision is {decision}, not RELEASE."
        )
        return result
    result["reason"] = "QA RELEASE gate enabled and linked QAReview is RELEASE."
    return result


@atomic_fn
def create_dispatch_quality_record(
    *,
    actor: User | None,
    organization: Organization,
    code: str,
    delivery_loading_reference: str = "",
    vehicle_reference: str = "",
    driver_reference: str = "",
    loading_bay: str = "",
    started_at: datetime | None = None,
    ended_at: datetime | None = None,
    seal_number: str = "",
    quantity: Decimal | str | int | float | None = None,
    quantity_uom: str = "",
    batch_reference: str = "",
    sub_lot_reference: str = "",
    owner_id: uuid.UUID | None = None,
    notes: str = "",
    vehicle_inspection_checklist_version_id: uuid.UUID | None = None,
    qa_review_id: uuid.UUID | None = None,
) -> DispatchQualityRecord:
    user = _require_authenticated_actor(actor)
    org_scope = Scope(organization_id=organization.id)
    if not (
        user_has_permission(user, CREATE_DISPATCH, scope=org_scope)
        or user_has_permission(user, MANAGE_DISPATCH, scope=org_scope)
    ):
        raise PermissionDenied("Permission denied.")
    normalized_code = normalize_code(code)
    if not normalized_code:
        raise ValidationError({"code": "Code cannot be blank."})
    qty = _to_decimal(quantity, "quantity")
    record = DispatchQualityRecord(
        organization=organization,
        code=normalized_code,
        delivery_loading_reference=(delivery_loading_reference or "").strip(),
        vehicle_reference=(vehicle_reference or "").strip(),
        driver_reference=(driver_reference or "").strip(),
        loading_bay=(loading_bay or "").strip(),
        started_at=started_at,
        ended_at=ended_at,
        seal_number=(seal_number or "").strip(),
        quantity=qty,
        quantity_uom=(quantity_uom or "").strip(),
        batch_reference=(batch_reference or "").strip(),
        sub_lot_reference=(sub_lot_reference or "").strip(),
        status=DispatchRecordStatus.OPEN,
        owner_id=owner_id,
        notes=(notes or "").strip(),
        vehicle_inspection_checklist_version_id=vehicle_inspection_checklist_version_id,
        qa_review_id=qa_review_id,
        created_by=user,
    )
    try:
        record.full_clean()
        record.save()
    except (ValidationError, IntegrityError) as exc:
        raise _code_conflict(exc) from exc
    # Ensure disabled policy row exists for org (no auto-enable).
    get_or_create_release_policy(organization=organization, actor=user)
    _append_history(
        record=record,
        event_type=DispatchHistoryEventType.CREATED,
        actor=user,
        to_status=record.status,
        note=record.code,
        metadata={"code": record.code},
    )
    record_event(
        event_type="DISPATCH_QUALITY_RECORD_CREATED",
        actor=user,
        metadata={
            "dispatch_record_id": str(record.id),
            "organization_id": str(organization.id),
            "code": record.code,
        },
    )
    return record


@atomic_fn
def update_dispatch_quality_record(
    *,
    actor: User | None,
    dispatch_record_id: uuid.UUID,
    delivery_loading_reference: str | None = None,
    vehicle_reference: str | None = None,
    driver_reference: str | None = None,
    loading_bay: str | None = None,
    started_at: datetime | None | object = ...,
    ended_at: datetime | None | object = ...,
    seal_number: str | None = None,
    quantity: Decimal | str | int | float | None | object = ...,
    quantity_uom: str | None = None,
    batch_reference: str | None = None,
    sub_lot_reference: str | None = None,
    owner_id: uuid.UUID | None | object = ...,
    notes: str | None = None,
) -> DispatchQualityRecord:
    user = _require_authenticated_actor(actor)
    record = locked_get(DispatchQualityRecord, pk=dispatch_record_id)
    if record is None:
        raise ValidationError({"dispatch_record": "Dispatch quality record not found."})
    require_permission(user, MANAGE_DISPATCH, scope=Scope(organization_id=record.organization_id))
    if record.status != DispatchRecordStatus.OPEN:
        raise ValidationError({"status": "Only OPEN dispatch records can be updated."})
    changed: list[str] = []
    if delivery_loading_reference is not None:
        record.delivery_loading_reference = delivery_loading_reference.strip()
        changed.append("delivery_loading_reference")
    if vehicle_reference is not None:
        record.vehicle_reference = vehicle_reference.strip()
        changed.append("vehicle_reference")
    if driver_reference is not None:
        record.driver_reference = driver_reference.strip()
        changed.append("driver_reference")
    if loading_bay is not None:
        record.loading_bay = loading_bay.strip()
        changed.append("loading_bay")
    if started_at is not ...:
        record.started_at = cast(datetime | None, started_at)
        changed.append("started_at")
    if ended_at is not ...:
        record.ended_at = cast(datetime | None, ended_at)
        changed.append("ended_at")
    if seal_number is not None:
        record.seal_number = seal_number.strip()
        changed.append("seal_number")
    if quantity is not ...:
        record.quantity = _to_decimal(quantity, "quantity")  # type: ignore[arg-type]
        changed.append("quantity")
    if quantity_uom is not None:
        record.quantity_uom = quantity_uom.strip()
        changed.append("quantity_uom")
    if batch_reference is not None:
        record.batch_reference = batch_reference.strip()
        changed.append("batch_reference")
    if sub_lot_reference is not None:
        record.sub_lot_reference = sub_lot_reference.strip()
        changed.append("sub_lot_reference")
    if owner_id is not ...:
        record.owner_id = owner_id  # type: ignore[assignment]
        changed.append("owner")
    if notes is not None:
        record.notes = notes.strip()
        changed.append("notes")
    if not changed:
        return record
    record.full_clean()
    record.save()
    _append_history(
        record=record,
        event_type=DispatchHistoryEventType.UPDATED,
        actor=user,
        from_status=record.status,
        to_status=record.status,
        note=",".join(changed),
        metadata={"fields": changed},
    )
    record_event(
        event_type="DISPATCH_QUALITY_RECORD_UPDATED",
        actor=user,
        metadata={
            "dispatch_record_id": str(record.id),
            "organization_id": str(record.organization_id),
            "code": record.code,
            "fields": changed,
        },
    )
    return record


@atomic_fn
def link_vehicle_inspection(
    *,
    actor: User | None,
    dispatch_record_id: uuid.UUID,
    checklist_version_id: uuid.UUID | None = None,
    submission_id: uuid.UUID | None = None,
) -> DispatchQualityRecord:
    """Link dynamic checklist definition/submission — no hardcoded inspection questions."""
    user = _require_authenticated_actor(actor)
    record = locked_get(DispatchQualityRecord, pk=dispatch_record_id)
    if record is None:
        raise ValidationError({"dispatch_record": "Dispatch quality record not found."})
    require_permission(user, MANAGE_DISPATCH, scope=Scope(organization_id=record.organization_id))
    if record.status != DispatchRecordStatus.OPEN:
        raise ValidationError({"status": "Only OPEN dispatch records can be updated."})
    if checklist_version_id is not None:
        record.vehicle_inspection_checklist_version_id = checklist_version_id
    if submission_id is not None:
        record.vehicle_inspection_submission_id = submission_id
    record.full_clean()
    record.save()
    _append_history(
        record=record,
        event_type=DispatchHistoryEventType.VEHICLE_INSPECTION_LINKED,
        actor=user,
        from_status=record.status,
        to_status=record.status,
        metadata={
            "checklist_version_id": str(record.vehicle_inspection_checklist_version_id)
            if record.vehicle_inspection_checklist_version_id
            else None,
            "submission_id": str(record.vehicle_inspection_submission_id)
            if record.vehicle_inspection_submission_id
            else None,
        },
    )
    record_event(
        event_type="DISPATCH_VEHICLE_INSPECTION_LINKED",
        actor=user,
        metadata={
            "dispatch_record_id": str(record.id),
            "organization_id": str(record.organization_id),
            "code": record.code,
        },
    )
    return record


@atomic_fn
def link_qa_review(
    *,
    actor: User | None,
    dispatch_record_id: uuid.UUID,
    qa_review_id: uuid.UUID,
) -> DispatchQualityRecord:
    user = _require_authenticated_actor(actor)
    record = locked_get(DispatchQualityRecord, pk=dispatch_record_id)
    if record is None:
        raise ValidationError({"dispatch_record": "Dispatch quality record not found."})
    require_permission(user, MANAGE_DISPATCH, scope=Scope(organization_id=record.organization_id))
    if record.status != DispatchRecordStatus.OPEN:
        raise ValidationError({"status": "Only OPEN dispatch records can be updated."})
    qa = QAReview.objects.filter(pk=qa_review_id, organization_id=record.organization_id).first()
    if qa is None:
        raise ValidationError({"qa_review": "QA review not found in organization."})
    record.qa_review = qa
    record.full_clean()
    record.save(update_fields=["qa_review", "updated_at"])
    _append_history(
        record=record,
        event_type=DispatchHistoryEventType.QA_REVIEW_LINKED,
        actor=user,
        from_status=record.status,
        to_status=record.status,
        metadata={"qa_review_id": str(qa.id), "decision": qa.decision},
    )
    record_event(
        event_type="DISPATCH_QA_REVIEW_LINKED",
        actor=user,
        metadata={
            "dispatch_record_id": str(record.id),
            "organization_id": str(record.organization_id),
            "qa_review_id": str(qa.id),
            "decision": qa.decision,
        },
    )
    return record


@atomic_fn
def record_cold_chain_temperature(
    *,
    actor: User | None,
    dispatch_record_id: uuid.UUID,
    reading_at: datetime,
    temperature_celsius: Decimal | str | int | float,
    device_reference: str = "",
    equipment_id: uuid.UUID | None = None,
    reading_context: str = "",
) -> ColdChainTemperatureReading:
    """Record temperature as Decimal — no allowable range evaluation."""
    user = _require_authenticated_actor(actor)
    record = locked_get(DispatchQualityRecord, pk=dispatch_record_id)
    if record is None:
        raise ValidationError({"dispatch_record": "Dispatch quality record not found."})
    require_permission(user, MANAGE_DISPATCH, scope=Scope(organization_id=record.organization_id))
    if record.status == DispatchRecordStatus.CANCELLED:
        raise ValidationError({"status": "Cannot record temperatures on a cancelled record."})
    temp = _to_decimal(temperature_celsius, "temperature_celsius")
    if temp is None:
        raise ValidationError({"temperature_celsius": "temperature_celsius is required."})
    reading = ColdChainTemperatureReading(
        organization_id=record.organization_id,
        dispatch_record=record,
        reading_at=reading_at,
        temperature_celsius=temp,
        device_reference=(device_reference or "").strip(),
        equipment_id=equipment_id,
        reading_context=(reading_context or "").strip(),
        recorded_by=user,
    )
    reading.full_clean()
    reading.save()
    _append_history(
        record=record,
        event_type=DispatchHistoryEventType.TEMPERATURE_RECORDED,
        actor=user,
        from_status=record.status,
        to_status=record.status,
        note=str(temp),
        metadata={
            "reading_id": str(reading.id),
            "temperature_celsius": str(temp),
            "device_reference": reading.device_reference,
        },
    )
    record_event(
        event_type="DISPATCH_TEMPERATURE_RECORDED",
        actor=user,
        metadata={
            "dispatch_record_id": str(record.id),
            "reading_id": str(reading.id),
            "organization_id": str(record.organization_id),
            "temperature_celsius": str(temp),
        },
    )
    return reading


@atomic_fn
def set_dispatch_quantity_line(
    *,
    actor: User | None,
    dispatch_record_id: uuid.UUID,
    released_quantity: Decimal | str | int | float,
    loaded_quantity: Decimal | str | int | float = Decimal("0"),
    line_reference: str = "",
    product_reference: str = "",
    batch_reference: str = "",
    sub_lot_reference: str = "",
    unit_of_measure: str = "",
    source_reference: str = "",
    quantity_line_id: uuid.UUID | None = None,
) -> DispatchQuantityLine:
    """Set released/loaded quantities; derive remaining. Not an ERP ledger."""
    user = _require_authenticated_actor(actor)
    record = locked_get(DispatchQualityRecord, pk=dispatch_record_id)
    if record is None:
        raise ValidationError({"dispatch_record": "Dispatch quality record not found."})
    require_permission(user, MANAGE_DISPATCH, scope=Scope(organization_id=record.organization_id))
    if record.status != DispatchRecordStatus.OPEN:
        raise ValidationError({"status": "Only OPEN dispatch records accept quantity lines."})
    released = _to_decimal(released_quantity, "released_quantity")
    loaded = _to_decimal(loaded_quantity, "loaded_quantity")
    if released is None:
        raise ValidationError({"released_quantity": "released_quantity is required."})
    if loaded is None:
        loaded = Decimal("0")
    remaining = released - loaded
    if quantity_line_id is not None:
        line = lock_queryset(
            DispatchQuantityLine.objects.filter(pk=quantity_line_id, dispatch_record=record)
        ).first()
        if line is None:
            raise ValidationError({"quantity_line": "Quantity line not found on this record."})
        line.released_quantity = released
        line.loaded_quantity = loaded
        line.remaining_quantity = remaining
        line.line_reference = (line_reference or line.line_reference).strip()
        if product_reference:
            line.product_reference = product_reference.strip()
        if batch_reference:
            line.batch_reference = batch_reference.strip()
        if sub_lot_reference:
            line.sub_lot_reference = sub_lot_reference.strip()
        if unit_of_measure:
            line.unit_of_measure = unit_of_measure.strip()
        if source_reference:
            line.source_reference = source_reference.strip()
        line.updated_by = user
    else:
        line = DispatchQuantityLine(
            organization_id=record.organization_id,
            dispatch_record=record,
            line_reference=(line_reference or "").strip(),
            product_reference=(product_reference or "").strip(),
            batch_reference=(batch_reference or record.batch_reference or "").strip(),
            sub_lot_reference=(sub_lot_reference or record.sub_lot_reference or "").strip(),
            released_quantity=released,
            loaded_quantity=loaded,
            remaining_quantity=remaining,
            unit_of_measure=(unit_of_measure or "").strip(),
            source_reference=(source_reference or "").strip(),
            created_by=user,
            updated_by=user,
        )
    line.full_clean()
    line.save()
    _append_history(
        record=record,
        event_type=DispatchHistoryEventType.QUANTITY_LINE_SET,
        actor=user,
        from_status=record.status,
        to_status=record.status,
        metadata={
            "quantity_line_id": str(line.id),
            "released_quantity": str(line.released_quantity),
            "loaded_quantity": str(line.loaded_quantity),
            "remaining_quantity": str(line.remaining_quantity),
        },
    )
    record_event(
        event_type="DISPATCH_QUANTITY_LINE_SET",
        actor=user,
        metadata={
            "dispatch_record_id": str(record.id),
            "quantity_line_id": str(line.id),
            "organization_id": str(record.organization_id),
            "released_quantity": str(line.released_quantity),
            "loaded_quantity": str(line.loaded_quantity),
            "remaining_quantity": str(line.remaining_quantity),
        },
    )
    return line


@atomic_fn
def set_dispatch_release_policy(
    *,
    actor: User | None,
    organization: Organization,
    require_qa_release_before_loading: bool,
    notes: str = "",
) -> DispatchReleasePolicy:
    """Configure QA RELEASE gate. Default/disabled until owner evidence enables it."""
    user = _require_authenticated_actor(actor)
    require_permission(user, MANAGE_RELEASE_POLICY, scope=Scope(organization_id=organization.id))
    policy = get_or_create_release_policy(organization=organization, actor=user)
    policy.require_qa_release_before_loading = bool(require_qa_release_before_loading)
    if notes is not None:
        policy.notes = notes.strip()
    policy.updated_by = user
    policy.full_clean()
    policy.save()
    record_event(
        event_type="DISPATCH_RELEASE_POLICY_UPDATED",
        actor=user,
        metadata={
            "organization_id": str(organization.id),
            "require_qa_release_before_loading": policy.require_qa_release_before_loading,
        },
    )
    return policy


def complete_dispatch_quality_record(
    *,
    actor: User | None,
    dispatch_record_id: uuid.UUID,
    note: str = "",
) -> DispatchQualityRecord:
    """
    Complete loading/dispatch quality record.

    Applies configurable QA RELEASE gate when enabled. Never blocks based on AI.
    Never writes to ERP.
    """
    user = _require_authenticated_actor(actor)
    try:
        with atomic():
            record = lock_queryset(
                DispatchQualityRecord.objects.filter(pk=dispatch_record_id)
            ).first()
            if record is None:
                raise ValidationError({"dispatch_record": "Dispatch quality record not found."})
            can_complete = user_has_permission(
                user, COMPLETE_DISPATCH, scope=Scope(organization_id=record.organization_id)
            ) or user_has_permission(
                user, MANAGE_DISPATCH, scope=Scope(organization_id=record.organization_id)
            )
            if not can_complete:
                raise PermissionDenied("Missing complete_dispatchqualityrecord permission.")
            if record.status == DispatchRecordStatus.COMPLETED:
                return record
            if record.status != DispatchRecordStatus.OPEN:
                raise ValidationError({"status": f"Cannot complete from status {record.status}."})
            policy = get_or_create_release_policy(organization=record.organization, actor=user)
            gate = evaluate_release_gate(record=record, policy=policy)
            _append_history(
                record=record,
                event_type=DispatchHistoryEventType.RELEASE_GATE_EVALUATED,
                actor=user,
                from_status=record.status,
                to_status=record.status,
                note=gate["reason"],
                metadata=gate,
            )
            record_event(
                event_type="DISPATCH_RELEASE_GATE_EVALUATED",
                actor=user,
                metadata={
                    "dispatch_record_id": str(record.id),
                    "organization_id": str(record.organization_id),
                    **gate,
                },
            )
            if not gate["allowed"]:
                raise ValidationError({"release_gate": gate["reason"]})
            from_status = record.status
            record.status = DispatchRecordStatus.COMPLETED
            record.completed_by = user
            record.completed_at = timezone.now()
            if not record.ended_at:
                record.ended_at = record.completed_at
            record.full_clean()
            record.save()
            _append_history(
                record=record,
                event_type=DispatchHistoryEventType.COMPLETED,
                actor=user,
                from_status=from_status,
                to_status=DispatchRecordStatus.COMPLETED,
                note=note,
            )
            record_event(
                event_type="DISPATCH_QUALITY_RECORD_COMPLETED",
                actor=user,
                metadata={
                    "dispatch_record_id": str(record.id),
                    "organization_id": str(record.organization_id),
                    "code": record.code,
                    "gate_enabled": gate["gate_enabled"],
                },
            )
            return record
    except ValidationError as exc:
        if "release_gate" in getattr(exc, "message_dict", {}):
            record = DispatchQualityRecord.objects.filter(pk=dispatch_record_id).first()
            if record is not None:
                release_policy: DispatchReleasePolicy | None = DispatchReleasePolicy.objects.filter(
                    organization_id=record.organization_id
                ).first()
                gate = evaluate_release_gate(record=record, policy=release_policy)
                record_event(
                    event_type="DISPATCH_RELEASE_GATE_BLOCKED",
                    actor=user,
                    metadata={
                        "dispatch_record_id": str(record.id),
                        "organization_id": str(record.organization_id),
                        **gate,
                    },
                )
        raise


@atomic_fn
def cancel_dispatch_quality_record(
    *,
    actor: User | None,
    dispatch_record_id: uuid.UUID,
    note: str = "",
) -> DispatchQualityRecord:
    user = _require_authenticated_actor(actor)
    record = locked_get(DispatchQualityRecord, pk=dispatch_record_id)
    if record is None:
        raise ValidationError({"dispatch_record": "Dispatch quality record not found."})
    require_permission(user, MANAGE_DISPATCH, scope=Scope(organization_id=record.organization_id))
    if record.status == DispatchRecordStatus.CANCELLED:
        return record
    if record.status == DispatchRecordStatus.COMPLETED:
        raise ValidationError({"status": "Completed dispatch records cannot be cancelled."})
    from_status = record.status
    record.status = DispatchRecordStatus.CANCELLED
    record.cancelled_by = user
    record.cancelled_at = timezone.now()
    record.full_clean()
    record.save()
    _append_history(
        record=record,
        event_type=DispatchHistoryEventType.CANCELLED,
        actor=user,
        from_status=from_status,
        to_status=DispatchRecordStatus.CANCELLED,
        note=note,
    )
    record_event(
        event_type="DISPATCH_QUALITY_RECORD_CANCELLED",
        actor=user,
        metadata={
            "dispatch_record_id": str(record.id),
            "organization_id": str(record.organization_id),
            "code": record.code,
        },
    )
    return record
