"""Transactional domain services for quality quarantine management."""

from __future__ import annotations

import uuid
from datetime import datetime

from django.core.exceptions import PermissionDenied, ValidationError
from apps.core.persistence import atomic_fn, lock_queryset
from django.utils import timezone

from apps.access_control.services import Scope, require_permission, user_has_permission
from apps.accounts.models import User
from apps.organizations.models import Organization
from apps.quality_quarantine.erp_boundary import (
    prepare_quarantine_erp_sync,
    send_quarantine_erp_sync,
)
from apps.quality_quarantine.models import (
    QualityQuarantineEvent,
    QualityQuarantinePolicy,
    QualityQuarantineRecord,
    QuarantineErpSyncStatus,
    QuarantineSource,
    QuarantineStatus,
)
from apps.quality_quarantine.policy import (
    evaluate_quarantine_erp_sync,
    evaluate_quarantine_release,
)
from apps.security_audit.services import record_event

VIEW = "quality_quarantine.view_qualityquarantine"
MANAGE = "quality_quarantine.manage_qualityquarantine"
RELEASE = "quality_quarantine.release_qualityquarantine"
MANAGE_POLICY = "quality_quarantine.manage_quarantinepolicystub"


def _actor(actor: User | None) -> User:
    if actor is None or not getattr(actor, "is_authenticated", False) or not actor.is_active:
        raise PermissionDenied("Authentication required.")
    return actor


def _scope(organization_id: uuid.UUID) -> Scope:
    return Scope(organization_id=organization_id)


def _require(actor: User | None, permission: str, organization_id: uuid.UUID) -> User:
    user = _actor(actor)
    require_permission(user, permission, scope=_scope(organization_id))
    return user


def _clean(value: object, *, max_length: int) -> str:
    return (str(value) if value is not None else "").strip()[:max_length]


def _policy(organization_id: uuid.UUID) -> QualityQuarantinePolicy | None:
    return QualityQuarantinePolicy.objects.filter(organization_id=organization_id).first()


def _append_event(
    *,
    quarantine: QualityQuarantineRecord,
    event_type: str,
    actor: User | None,
    summary: str = "",
    payload: dict[str, object] | None = None,
) -> QualityQuarantineEvent:
    event = QualityQuarantineEvent(
        quarantine=quarantine,
        event_type=event_type,
        summary=_clean(summary, max_length=255),
        payload=payload or {},
        actor=actor,
    )
    event.full_clean()
    event.save()
    return event


@atomic_fn
def open_quarantine_record(
    *,
    actor: User | None,
    organization: Organization,
    code: str,
    batch_reference: str,
    source: str,
    source_reference: str,
    reason_reference: str,
    opened_at: datetime | None = None,
    sub_lot_reference: str = "",
    quantity_reference: str = "",
    uom_reference: str = "",
    owner: User | None = None,
    metadata: dict[str, object] | None = None,
) -> QualityQuarantineRecord:
    user = _require(actor, MANAGE, organization.id)
    source_code = _clean(source, max_length=32).upper()
    if source_code not in QuarantineSource.values:
        raise ValidationError(
            {
                "source": (
                    "Source must be one of QA_HOLD, RETURNED_PRODUCT, "
                    "INCOMING_INSPECTION, LAB_PENDING, NCR, or MANUAL."
                )
            }
        )
    quantity = _clean(quantity_reference, max_length=128)
    uom = _clean(uom_reference, max_length=64)
    policy = _policy(organization.id)
    if (quantity or uom) and (policy is None or not policy.quantity_recording_enabled):
        raise ValidationError(
            {"quantity_reference": "Quantity references are disabled by organization policy."}
        )
    record = QualityQuarantineRecord(
        organization=organization,
        code=_clean(code, max_length=128),
        batch_reference=_clean(batch_reference, max_length=128),
        sub_lot_reference=_clean(sub_lot_reference, max_length=128),
        quantity_reference=quantity,
        uom_reference=uom,
        source=source_code,
        source_reference=_clean(source_reference, max_length=128),
        reason_reference=_clean(reason_reference, max_length=255),
        opened_by=user,
        opened_at=opened_at or timezone.now(),
        owner=owner,
        status=QuarantineStatus.OPEN,
        erp_sync_status=QuarantineErpSyncStatus.NOT_SENT,
        not_inventory_ledger=True,
        metadata=metadata or {},
    )
    record.full_clean()
    record.save()
    _append_event(
        quarantine=record,
        event_type="QUARANTINE_OPENED",
        actor=user,
        summary="Quality quarantine opened",
        payload={
            "source": record.source,
            "source_reference": record.source_reference,
            "reason_reference": record.reason_reference,
            "inventory_ledger_unchanged": True,
        },
    )
    record_event(
        event_type="QUARANTINE_OPENED",
        actor=user,
        metadata={
            "organization_id": str(record.organization_id),
            "quarantine_id": str(record.id),
            "quarantine_code": record.code,
            "source": record.source,
            "source_reference": record.source_reference,
            "inventory_ledger_unchanged": True,
        },
    )
    return record


@atomic_fn
def update_quarantine_quantity(
    *,
    actor: User | None,
    quarantine: QualityQuarantineRecord,
    quantity_reference: str,
    uom_reference: str | None = None,
) -> QualityQuarantineRecord:
    user = _require(actor, MANAGE, quarantine.organization_id)
    record = lock_queryset(QualityQuarantineRecord.objects.filter(pk=quarantine.pk)).get()
    if record.status != QuarantineStatus.OPEN:
        raise ValidationError(
            {"status": "Only open quarantine records can change quantity references."}
        )
    policy = _policy(record.organization_id)
    if policy is None or not policy.quantity_recording_enabled:
        raise ValidationError(
            {"quantity_reference": "Quantity references are disabled by organization policy."}
        )
    before = {
        "quantity_reference": record.quantity_reference,
        "uom_reference": record.uom_reference,
    }
    record.quantity_reference = _clean(quantity_reference, max_length=128)
    if uom_reference is not None:
        record.uom_reference = _clean(uom_reference, max_length=64)
    record.full_clean()
    record.save(
        update_fields=["quantity_reference", "uom_reference", "not_inventory_ledger", "updated_at"]
    )
    payload = {
        "before": before,
        "after": {
            "quantity_reference": record.quantity_reference,
            "uom_reference": record.uom_reference,
        },
        "inventory_ledger_unchanged": True,
    }
    _append_event(
        quarantine=record,
        event_type="QUARANTINE_QUANTITY_UPDATED",
        actor=user,
        summary="Quantity reference updated",
        payload=payload,
    )
    record_event(
        event_type="QUARANTINE_QUANTITY_UPDATED",
        actor=user,
        metadata={
            "organization_id": str(record.organization_id),
            "quarantine_id": str(record.id),
            **payload,
        },
    )
    return record


@atomic_fn
def release_quarantine_record(
    *,
    actor: User | None,
    quarantine: QualityQuarantineRecord,
    resolution_reference: str = "",
) -> QualityQuarantineRecord:
    user = _require(actor, RELEASE, quarantine.organization_id)
    record = lock_queryset(QualityQuarantineRecord.objects.filter(pk=quarantine.pk)).get()
    if record.status != QuarantineStatus.OPEN:
        raise ValidationError({"status": "Only open quarantine records can be released."})
    decision = evaluate_quarantine_release(organization_id=record.organization_id)
    if not decision.allowed:
        raise ValidationError(
            {
                "release": (
                    "Quality quarantine release approval is not enabled "
                    "(APR-066 EVIDENCE REQUIRED)."
                )
            }
        )
    record.status = QuarantineStatus.RELEASED
    record.resolution_reference = _clean(resolution_reference, max_length=255)
    record.resolved_by = user
    record.resolved_at = timezone.now()
    record.full_clean()
    record.save(
        update_fields=[
            "status",
            "resolution_reference",
            "resolved_by",
            "resolved_at",
            "not_inventory_ledger",
            "updated_at",
        ]
    )
    payload = {
        "resolution_reference": record.resolution_reference,
        "gate": decision.as_dict(),
        "inventory_ledger_unchanged": True,
    }
    _append_event(
        quarantine=record,
        event_type="QUARANTINE_RELEASED",
        actor=user,
        summary="Quality quarantine released",
        payload=payload,
    )
    record_event(
        event_type="QUARANTINE_RELEASED",
        actor=user,
        metadata={
            "organization_id": str(record.organization_id),
            "quarantine_id": str(record.id),
            **payload,
        },
    )
    return record


@atomic_fn
def cancel_quarantine_record(
    *,
    actor: User | None,
    quarantine: QualityQuarantineRecord,
    resolution_reference: str = "",
) -> QualityQuarantineRecord:
    user = _require(actor, MANAGE, quarantine.organization_id)
    record = lock_queryset(QualityQuarantineRecord.objects.filter(pk=quarantine.pk)).get()
    if record.status != QuarantineStatus.OPEN:
        raise ValidationError({"status": "Only open quarantine records can be cancelled."})
    record.status = QuarantineStatus.CANCELLED
    record.resolution_reference = _clean(resolution_reference, max_length=255)
    record.resolved_by = user
    record.resolved_at = timezone.now()
    record.full_clean()
    record.save(
        update_fields=[
            "status",
            "resolution_reference",
            "resolved_by",
            "resolved_at",
            "not_inventory_ledger",
            "updated_at",
        ]
    )
    _append_event(
        quarantine=record,
        event_type="QUARANTINE_CANCELLED",
        actor=user,
        summary="Quality quarantine cancelled",
        payload={"resolution_reference": record.resolution_reference},
    )
    return record


@atomic_fn
def record_erp_sync_status(
    *,
    actor: User | None,
    quarantine: QualityQuarantineRecord,
    status: str,
    detail: str = "",
) -> QualityQuarantineRecord:
    user = _require(actor, MANAGE, quarantine.organization_id)
    if status not in QuarantineErpSyncStatus.values:
        raise ValidationError({"erp_sync_status": "Unsupported ERP sync status."})
    record = lock_queryset(QualityQuarantineRecord.objects.filter(pk=quarantine.pk)).get()
    before = {"status": record.erp_sync_status, "detail": record.erp_sync_detail}
    record.erp_sync_status = status
    record.erp_sync_detail = _clean(detail, max_length=2000)
    record.full_clean()
    record.save(
        update_fields=["erp_sync_status", "erp_sync_detail", "not_inventory_ledger", "updated_at"]
    )
    payload = {
        "before": before,
        "after": {"status": record.erp_sync_status, "detail": record.erp_sync_detail},
        "status_tracking_only": True,
        "inventory_ledger_unchanged": True,
    }
    _append_event(
        quarantine=record,
        event_type="QUARANTINE_ERP_SYNC_STATUS_UPDATED",
        actor=user,
        summary="ERP sync status tracked locally",
        payload=payload,
    )
    record_event(
        event_type="QUARANTINE_ERP_SYNC_STATUS_UPDATED",
        actor=user,
        metadata={
            "organization_id": str(record.organization_id),
            "quarantine_id": str(record.id),
            **payload,
        },
    )
    return record


def attempt_quarantine_erp_sync(
    *, actor: User | None, quarantine: QualityQuarantineRecord, correlation_id: str = ""
) -> None:
    user = _actor(actor)
    if not user_has_permission(user, MANAGE, scope=_scope(quarantine.organization_id)):
        raise PermissionDenied("Permission denied.")
    decision = evaluate_quarantine_erp_sync(organization_id=quarantine.organization_id)
    command = prepare_quarantine_erp_sync(record=quarantine, correlation_id=correlation_id)
    send_quarantine_erp_sync(command=command, actor=user, reason_code=decision.reason_code)


@atomic_fn
def upsert_quarantine_policy(
    *,
    actor: User | None,
    organization: Organization,
    quantity_recording_enabled: bool = False,
    erp_sync_enabled: bool = False,
    procedure_reference: str = "",
    notes: str = "",
) -> QualityQuarantinePolicy:
    user = _require(actor, MANAGE_POLICY, organization.id)
    policy = QualityQuarantinePolicy.objects.filter(organization=organization).first()
    if policy is None:
        policy = QualityQuarantinePolicy(organization=organization, updated_by=user)
    policy.quantity_recording_enabled = bool(quantity_recording_enabled)
    policy.erp_sync_enabled = bool(erp_sync_enabled)
    policy.procedure_reference = _clean(procedure_reference, max_length=255)
    policy.notes = _clean(notes, max_length=4000)
    policy.updated_by = user
    policy.full_clean()
    policy.save()
    record_event(
        event_type="QUARANTINE_POLICY_UPSERTED",
        actor=user,
        metadata={
            "organization_id": str(organization.id),
            "quantity_recording_enabled": policy.quantity_recording_enabled,
            "erp_sync_enabled": policy.erp_sync_enabled,
            "evidence_gate": "APR-066",
        },
    )
    return policy
