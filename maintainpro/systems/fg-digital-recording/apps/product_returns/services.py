"""Returned-product quality application services -- Phase 40."""

from __future__ import annotations

import uuid
from collections.abc import Iterable, Mapping
from datetime import datetime

from django.core.exceptions import PermissionDenied, ValidationError
from django.utils import timezone

from apps.core.persistence.transactions import atomic_fn
from apps.access_control.services import Scope, user_has_permission
from apps.accounts.models import User
from apps.checklists.models import ChecklistTemplate, ChecklistVersion
from apps.nonconformance.models import HoldCase
from apps.organizations.models import Organization
from apps.product_returns.erp_boundary import (
    prepare_return_erp_stock_movement,
    send_return_erp_stock_movement,
)
from apps.product_returns.models import (
    ReturnDisposition,
    ReturnQualityPolicy,
    ReturnQualityRecord,
    ReturnQualityStatus,
    ReturnQualityTimelineEntry,
    ReturnQuarantineState,
)
from apps.product_returns.policy import evaluate_return_erp_stock_movement
from apps.scheduling.services import create_batch_checklist_task
from apps.security_audit.services import record_event

VIEW = "product_returns.view_returnquality"
MANAGE = "product_returns.manage_returnquality"
INSPECT = "product_returns.inspect_returnquality"
DISPOSITION = "product_returns.disposition_returnquality"
MANAGE_POLICY = "product_returns.manage_returnpolicystub"


def _actor(actor: User | None) -> User:
    if actor is None or not getattr(actor, "is_authenticated", False) or not actor.is_active:
        raise PermissionDenied("Authentication required.")
    return actor


def _scope(organization_id: uuid.UUID) -> Scope:
    return Scope(organization_id=organization_id)


def _require(actor: User | None, permission: str, organization_id: uuid.UUID) -> User:
    user = _actor(actor)
    if not user_has_permission(user, permission, scope=_scope(organization_id)):
        raise PermissionDenied("Permission denied.")
    return user


def _timeline(
    *,
    record: ReturnQualityRecord,
    actor: User,
    event_type: str,
    metadata: Mapping[str, object] | None = None,
) -> ReturnQualityTimelineEntry:
    entry = ReturnQualityTimelineEntry(
        organization_id=record.organization_id,
        return_quality_record=record,
        event_type=event_type,
        metadata=metadata or {},
        actor=actor,
    )
    entry.full_clean()
    entry.save()
    return entry


def _clean_reference(value: object, *, max_length: int) -> str:
    return (str(value) if value is not None else "").strip()[:max_length]


@atomic_fn
def create_return_quality_record(
    *,
    actor: User | None,
    organization: Organization,
    erp_return_reference: str,
    product_reference: str,
    original_batch_reference: str,
    received_at: datetime | None = None,
    erp_return_line_reference: str = "",
    quantity_reference: str = "",
    uom_reference: str = "",
    erp_customer_reference: str = "",
    reason_reference: str = "",
    condition_reference: str = "",
    temperature_reference: str = "",
    evidence_attachment_id: uuid.UUID | None = None,
    hold_case: HoldCase | None = None,
) -> ReturnQualityRecord:
    user = _require(actor, MANAGE, organization.id)
    record = ReturnQualityRecord(
        organization=organization,
        erp_return_reference=_clean_reference(erp_return_reference, max_length=128),
        erp_return_line_reference=_clean_reference(erp_return_line_reference, max_length=128),
        product_reference=_clean_reference(product_reference, max_length=128),
        original_batch_reference=_clean_reference(original_batch_reference, max_length=128),
        quantity_reference=_clean_reference(quantity_reference, max_length=128),
        uom_reference=_clean_reference(uom_reference, max_length=64),
        erp_customer_reference=_clean_reference(erp_customer_reference, max_length=128),
        reason_reference=_clean_reference(reason_reference, max_length=255),
        condition_reference=_clean_reference(condition_reference, max_length=255),
        temperature_reference=_clean_reference(temperature_reference, max_length=255),
        evidence_attachment_id=evidence_attachment_id,
        received_at=received_at or timezone.now(),
        status=ReturnQualityStatus.RECEIVED,
        quarantine_state=ReturnQuarantineState.QUARANTINED,
        not_saleable_via_app=True,
        hold_case=hold_case,
        created_by=user,
    )
    record.full_clean()
    record.save()
    _timeline(
        record=record,
        actor=user,
        event_type="RETURN_QUALITY_CREATED",
        metadata={"quarantine_state": record.quarantine_state},
    )
    record_event(
        event_type="RETURN_QUALITY_CREATED",
        actor=user,
        metadata={
            "organization_id": str(record.organization_id),
            "return_quality_record_id": str(record.id),
            "erp_return_reference": record.erp_return_reference,
            "erp_return_line_reference": record.erp_return_line_reference,
            "not_saleable_via_app": True,
        },
    )
    return record


@atomic_fn
def update_return_quantity(
    *,
    actor: User | None,
    record: ReturnQualityRecord,
    quantity_reference: str,
    uom_reference: str | None = None,
) -> ReturnQualityRecord:
    user = _require(actor, MANAGE, record.organization_id)
    if record.status == ReturnQualityStatus.DISPOSITIONED:
        raise ValidationError({"status": "Dispositioned return records cannot be edited in place."})
    before = {
        "quantity_reference": record.quantity_reference,
        "uom_reference": record.uom_reference,
    }
    record.quantity_reference = _clean_reference(quantity_reference, max_length=128)
    if uom_reference is not None:
        record.uom_reference = _clean_reference(uom_reference, max_length=64)
    record.full_clean()
    record.save(
        update_fields=["quantity_reference", "uom_reference", "not_saleable_via_app", "updated_at"]
    )
    metadata = {
        "before": before,
        "after": {
            "quantity_reference": record.quantity_reference,
            "uom_reference": record.uom_reference,
        },
    }
    _timeline(
        record=record, actor=user, event_type="RETURN_QUALITY_QUANTITY_UPDATED", metadata=metadata
    )
    record_event(
        event_type="RETURN_QUALITY_QUANTITY_UPDATED",
        actor=user,
        metadata={
            "organization_id": str(record.organization_id),
            "return_quality_record_id": str(record.id),
            **metadata,
        },
    )
    return record


@atomic_fn
def start_return_inspection(
    *,
    actor: User | None,
    record: ReturnQualityRecord,
    checklist_template: ChecklistTemplate | None = None,
    checklist_version: ChecklistVersion | None = None,
    checklist_template_id: uuid.UUID | None = None,
    checklist_version_id: uuid.UUID | None = None,
) -> ReturnQualityRecord:
    user = _require(actor, INSPECT, record.organization_id)
    if record.status == ReturnQualityStatus.DISPOSITIONED:
        raise ValidationError({"status": "A dispositioned return cannot start inspection."})
    if record.checklist_task_id:
        return record
    template_id = checklist_template.id if checklist_template is not None else checklist_template_id
    version_id = checklist_version.id if checklist_version is not None else checklist_version_id
    if template_id is None or version_id is None:
        raise ValidationError(
            {"checklist": "A checklist template and published version are required."}
        )
    task = create_batch_checklist_task(
        actor=user,
        organization_id=record.organization_id,
        checklist_template_id=template_id,
        checklist_version_id=version_id,
        batch_reference=record.original_batch_reference,
    )
    template = ChecklistTemplate.objects.get(pk=template_id)
    version = ChecklistVersion.objects.select_related("template").get(pk=version_id)
    record.checklist_template = template
    record.checklist_version = version
    record.checklist_task = task
    record.status = ReturnQualityStatus.INSPECTION_IN_PROGRESS
    record.full_clean()
    record.save(
        update_fields=[
            "checklist_template",
            "checklist_version",
            "checklist_task",
            "status",
            "not_saleable_via_app",
            "updated_at",
        ]
    )
    metadata = {"checklist_task_id": str(task.id), "batch_reference": task.batch_reference}
    _timeline(
        record=record, actor=user, event_type="RETURN_QUALITY_INSPECTION_STARTED", metadata=metadata
    )
    record_event(
        event_type="RETURN_QUALITY_INSPECTION_STARTED",
        actor=user,
        metadata={
            "organization_id": str(record.organization_id),
            "return_quality_record_id": str(record.id),
            **metadata,
        },
    )
    return record


@atomic_fn
def mark_return_ready_for_disposition(
    *, actor: User | None, record: ReturnQualityRecord
) -> ReturnQualityRecord:
    user = _require(actor, INSPECT, record.organization_id)
    if record.status != ReturnQualityStatus.INSPECTION_IN_PROGRESS or not record.checklist_task_id:
        raise ValidationError(
            {"status": "Return inspection must be started before disposition readiness."}
        )
    record.status = ReturnQualityStatus.READY_FOR_DISPOSITION
    record.save(update_fields=["status", "not_saleable_via_app", "updated_at"])
    _timeline(
        record=record,
        actor=user,
        event_type="RETURN_QUALITY_READY_FOR_DISPOSITION",
        metadata={"not_saleable_via_app": True},
    )
    return record


def _allowed_dispositions(organization_id: uuid.UUID) -> set[str]:
    policy = ReturnQualityPolicy.objects.filter(organization_id=organization_id).first()
    return set(policy.allowed_disposition_codes if policy else [])


@atomic_fn
def apply_return_disposition(
    *, actor: User | None, record: ReturnQualityRecord, disposition: str, disposition_note: str = ""
) -> ReturnQualityRecord:
    user = _require(actor, DISPOSITION, record.organization_id)
    if record.status != ReturnQualityStatus.READY_FOR_DISPOSITION:
        raise ValidationError({"status": "Return must be ready for disposition."})
    code = _clean_reference(disposition, max_length=16).upper()
    if code not in ReturnDisposition.values:
        raise ValidationError(
            {"disposition": "Disposition must be RELEASE, HOLD, REWORK, or REJECT."}
        )
    if code not in _allowed_dispositions(record.organization_id):
        raise ValidationError(
            {"disposition": "Disposition is not enabled by the organization policy stub (APR-065)."}
        )
    quarantine_by_disposition = {
        ReturnDisposition.RELEASE: ReturnQuarantineState.QUARANTINED,
        ReturnDisposition.HOLD: ReturnQuarantineState.HOLD,
        ReturnDisposition.REWORK: ReturnQuarantineState.REWORK,
        ReturnDisposition.REJECT: ReturnQuarantineState.REJECTED,
    }
    record.disposition = code
    record.disposition_note = (disposition_note or "").strip()
    record.dispositioned_by = user
    record.dispositioned_at = timezone.now()
    record.status = ReturnQualityStatus.DISPOSITIONED
    record.quarantine_state = quarantine_by_disposition[ReturnDisposition(code)]
    record.not_saleable_via_app = True
    record.full_clean()
    record.save()
    metadata = {
        "disposition": code,
        "quarantine_state": record.quarantine_state,
        "not_saleable_via_app": True,
        "erp_stock_not_moved": True,
    }
    _timeline(
        record=record, actor=user, event_type="RETURN_QUALITY_DISPOSITIONED", metadata=metadata
    )
    record_event(
        event_type="RETURN_QUALITY_DISPOSITIONED",
        actor=user,
        metadata={
            "organization_id": str(record.organization_id),
            "return_quality_record_id": str(record.id),
            **metadata,
        },
    )
    return record


@atomic_fn
def upsert_return_quality_policy(
    *,
    actor: User | None,
    organization: Organization,
    erp_stock_movement_enabled: bool = False,
    allowed_disposition_codes: Iterable[str] = (),
    procedure_reference: str = "",
) -> ReturnQualityPolicy:
    user = _require(actor, MANAGE_POLICY, organization.id)
    normalized = [
        _clean_reference(code, max_length=16).upper() for code in allowed_disposition_codes
    ]
    policy = ReturnQualityPolicy.objects.filter(organization=organization).first()
    if policy is None:
        policy = ReturnQualityPolicy(organization=organization, updated_by=user)
    policy.erp_stock_movement_enabled = bool(erp_stock_movement_enabled)
    policy.allowed_disposition_codes = normalized
    policy.procedure_reference = _clean_reference(procedure_reference, max_length=255)
    policy.updated_by = user
    policy.full_clean()
    policy.save()
    record_event(
        event_type="RETURN_QUALITY_POLICY_UPSERTED",
        actor=user,
        metadata={
            "organization_id": str(organization.id),
            "erp_stock_movement_enabled": policy.erp_stock_movement_enabled,
            "allowed_disposition_codes": policy.allowed_disposition_codes,
        },
    )
    return policy


def attempt_return_erp_stock_movement(
    *, actor: User | None, record: ReturnQualityRecord, correlation_id: str = ""
) -> None:
    user = _actor(actor)
    scope = _scope(record.organization_id)
    if not (
        user_has_permission(user, MANAGE, scope=scope)
        or user_has_permission(user, DISPOSITION, scope=scope)
    ):
        raise PermissionDenied("Permission denied.")
    if record.status != ReturnQualityStatus.DISPOSITIONED:
        raise ValidationError(
            {"status": "A local disposition is required before ERP movement is attempted."}
        )
    decision = evaluate_return_erp_stock_movement(organization_id=record.organization_id)
    command = prepare_return_erp_stock_movement(record=record, correlation_id=correlation_id)
    send_return_erp_stock_movement(command=command, actor=user, reason_code=decision.reason_code)
