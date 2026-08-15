"""Transactional domain services for controlled rework — Phase 42 (ADR-053)."""

from __future__ import annotations

import uuid
from decimal import Decimal, InvalidOperation

from django.core.exceptions import PermissionDenied, ValidationError
from django.db import IntegrityError, transaction
from django.utils import timezone

from apps.access_control.services import Scope, require_permission, user_has_permission
from apps.accounts.models import User
from apps.batch_genealogy.models import GenealogyNodeKind, GenealogyRelationKind
from apps.batch_genealogy.services import ingest_erp_genealogy_edge, upsert_genealogy_node
from apps.core.persistence import lock_queryset
from apps.nonconformance.models import HoldCase, NonConformanceRecord
from apps.organizations.models import Organization
from apps.quality.models import QAReview
from apps.rework.erp_boundary import (
    prepare_rework_erp_stock_movement,
    send_rework_erp_stock_movement,
)
from apps.rework.models import ReworkCase, ReworkCaseEvent, ReworkPolicyStub
from apps.rework.policy import evaluate_rework_erp_stock_movement
from apps.scheduling.services import create_batch_checklist_task
from apps.security_audit.services import record_event

VIEW = "rework.view_reworkcase"
CREATE = "rework.create_reworkcase"
AUTHORIZE = "rework.authorize_reworkcase"
EXECUTE = "rework.execute_reworkcase"
MANAGE_POLICY = "rework.manage_reworkpolicystub"
LOCAL_GENEALOGY_SOURCE = "nelna.rework"


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


def _append_event(
    *,
    case: ReworkCase,
    event_type: str,
    actor: User | None,
    detail_reference: str = "",
) -> ReworkCaseEvent:
    event = ReworkCaseEvent(
        organization=case.organization,
        case=case,
        event_type=event_type,
        detail_reference=_clean(detail_reference, max_length=255),
        actor=actor,
    )
    event.full_clean()
    event.save()
    return event


def _parse_qty(value: str) -> Decimal | None:
    text = (value or "").strip()
    if not text:
        return None
    try:
        qty = Decimal(text)
    except InvalidOperation:
        return None
    return qty


def assert_quantity_conservation(
    *,
    source_quantity_reference: str,
    resulting_quantity_reference: str,
    remaining_source_quantity_reference: str,
) -> None:
    source = _parse_qty(source_quantity_reference)
    result = _parse_qty(resulting_quantity_reference)
    remaining = _parse_qty(remaining_source_quantity_reference)
    parsed = [item is not None for item in (source, result, remaining)]
    if not all(parsed):
        if any(parsed):
            raise ValidationError(
                {
                    "quantity": (
                        "Quantity conservation requires numeric source, resulting, "
                        "and remaining references, or all-opaque references."
                    )
                }
            )
        if (
            not resulting_quantity_reference.strip()
            or not remaining_source_quantity_reference.strip()
        ):
            raise ValidationError(
                {"quantity": ("Resulting and remaining source quantity references are required.")}
            )
        return
    if source is None or result is None or remaining is None:
        raise ValidationError({"quantity": "Quantity references could not be parsed."})
    if result < 0 or remaining < 0:
        raise ValidationError({"quantity": "Rework quantities cannot be negative."})
    if result + remaining != source:
        raise ValidationError(
            {
                "quantity": (
                    "Quantity conservation failed: source must equal resulting plus remaining."
                )
            }
        )
    if result == 0:
        raise ValidationError({"quantity": "Resulting rework quantity must be greater than zero."})


def reject_does_not_create_rework() -> None:
    """Explicit invariant: QA/return REJECT is not an automatic rework trigger."""
    return None


@transaction.atomic
def create_rework_case(
    *,
    actor: User | None,
    organization: Organization,
    execution_key: str,
    source_batch_reference: str,
    source_quantity_reference: str,
    source_uom_reference: str,
    reason_reference: str,
    source_sublot_reference: str = "",
    instruction_reference: str = "",
    source_qa_review: QAReview | None = None,
    source_hold_case: HoldCase | None = None,
    source_ncr: NonConformanceRecord | None = None,
) -> ReworkCase:
    user = _require(actor, CREATE, organization.id)
    key = _clean(execution_key, max_length=128)
    if not key:
        raise ValidationError({"execution_key": "Execution key is required."})
    existing = ReworkCase.objects.filter(organization=organization, execution_key=key).first()
    if existing is not None:
        same = (
            existing.source_batch_reference == _clean(source_batch_reference, max_length=128)
            and existing.source_quantity_reference
            == _clean(source_quantity_reference, max_length=64)
            and existing.reason_reference == _clean(reason_reference, max_length=255)
        )
        if same:
            return existing
        raise ValidationError(
            {"execution_key": "Duplicate rework execution key for this organization."}
        )
    case = ReworkCase(
        organization=organization,
        execution_key=key,
        source_batch_reference=_clean(source_batch_reference, max_length=128),
        source_sublot_reference=_clean(source_sublot_reference, max_length=128),
        source_quantity_reference=_clean(source_quantity_reference, max_length=64),
        source_uom_reference=_clean(source_uom_reference, max_length=32),
        reason_reference=_clean(reason_reference, max_length=255),
        instruction_reference=_clean(instruction_reference, max_length=255),
        source_qa_review=source_qa_review,
        source_hold_case=source_hold_case,
        source_ncr=source_ncr,
        status=ReworkCase.Status.DRAFT,
        created_by=user,
    )
    try:
        case.full_clean()
        case.save()
    except IntegrityError as exc:
        raise ValidationError(
            {"execution_key": "Duplicate rework execution key for this organization."}
        ) from exc
    _append_event(case=case, event_type=ReworkCaseEvent.EventType.CREATED, actor=user)
    record_event(
        event_type="REWORK_CASE_CREATED",
        actor=user,
        metadata={
            "organization_id": str(organization.id),
            "rework_case_id": str(case.id),
            "execution_key": case.execution_key,
            "source_batch_reference": case.source_batch_reference,
            "reject_does_not_auto_rework": True,
        },
    )
    return case


@transaction.atomic
def authorize_rework_case(*, actor: User | None, case: ReworkCase) -> ReworkCase:
    user = _require(actor, AUTHORIZE, case.organization_id)
    locked = lock_queryset(ReworkCase.objects.filter(pk=case.pk)).get()
    if locked.status == ReworkCase.Status.AUTHORIZED:
        return locked
    if locked.status != ReworkCase.Status.DRAFT:
        raise ValidationError({"status": "Only draft rework cases can be authorized."})
    locked.status = ReworkCase.Status.AUTHORIZED
    locked.authorized_by = user
    locked.authorized_at = timezone.now()
    locked.full_clean()
    locked.save(update_fields=["status", "authorized_by", "authorized_at", "updated_at"])
    _append_event(case=locked, event_type=ReworkCaseEvent.EventType.AUTHORIZED, actor=user)
    record_event(
        event_type="REWORK_CASE_AUTHORIZED",
        actor=user,
        metadata={
            "organization_id": str(locked.organization_id),
            "rework_case_id": str(locked.id),
            "execution_key": locked.execution_key,
        },
    )
    return locked


@transaction.atomic
def start_rework_case(*, actor: User | None, case: ReworkCase) -> ReworkCase:
    user = _require(actor, EXECUTE, case.organization_id)
    locked = lock_queryset(ReworkCase.objects.filter(pk=case.pk)).get()
    if locked.status == ReworkCase.Status.IN_PROGRESS:
        return locked
    if locked.status != ReworkCase.Status.AUTHORIZED:
        raise ValidationError({"status": "Rework must be authorized before execution starts."})
    locked.status = ReworkCase.Status.IN_PROGRESS
    locked.started_at = timezone.now()
    locked.full_clean()
    locked.save(update_fields=["status", "started_at", "updated_at"])
    _append_event(case=locked, event_type=ReworkCaseEvent.EventType.STARTED, actor=user)
    record_event(
        event_type="REWORK_CASE_STARTED",
        actor=user,
        metadata={
            "organization_id": str(locked.organization_id),
            "rework_case_id": str(locked.id),
            "execution_key": locked.execution_key,
        },
    )
    return locked


def _record_genealogy(*, actor: User, case: ReworkCase) -> None:
    source_node = upsert_genealogy_node(
        actor=actor,
        organization=case.organization,
        kind=GenealogyNodeKind.FG_BATCH,
        external_key=case.source_batch_reference,
        display_label=case.source_batch_reference,
    )
    result_node = upsert_genealogy_node(
        actor=actor,
        organization=case.organization,
        kind=GenealogyNodeKind.REWORK_BATCH,
        external_key=case.resulting_batch_reference,
        display_label=case.resulting_batch_reference,
    )
    ingest_erp_genealogy_edge(
        actor=actor,
        organization=case.organization,
        from_node=source_node,
        to_node=result_node,
        relation=GenealogyRelationKind.REWORKED_FROM,
        source_system=LOCAL_GENEALOGY_SOURCE,
        source_event_id=f"rework:{case.id}",
        quantity_reference=case.source_quantity_reference,
        is_rework=True,
        metadata={
            "resulting_quantity_reference": case.resulting_quantity_reference,
            "remaining_source_quantity_reference": case.remaining_source_quantity_reference,
            "execution_key": case.execution_key,
        },
    )
    _append_event(
        case=case,
        event_type=ReworkCaseEvent.EventType.GENEALOGY_RECORDED,
        actor=actor,
        detail_reference=case.resulting_batch_reference,
    )
    record_event(
        event_type="REWORK_GENEALOGY_RECORDED",
        actor=actor,
        metadata={
            "organization_id": str(case.organization_id),
            "rework_case_id": str(case.id),
            "source_batch_reference": case.source_batch_reference,
            "resulting_batch_reference": case.resulting_batch_reference,
            "source_quantity_reference": case.source_quantity_reference,
            "remaining_source_quantity_reference": case.remaining_source_quantity_reference,
            "source_system": LOCAL_GENEALOGY_SOURCE,
        },
    )


@transaction.atomic
def complete_rework_case(
    *,
    actor: User | None,
    case: ReworkCase,
    resulting_batch_reference: str,
    resulting_quantity_reference: str,
    remaining_source_quantity_reference: str,
) -> ReworkCase:
    user = _require(actor, EXECUTE, case.organization_id)
    locked = lock_queryset(ReworkCase.objects.filter(pk=case.pk)).get()
    result_ref = _clean(resulting_batch_reference, max_length=128)
    result_qty = _clean(resulting_quantity_reference, max_length=64)
    remaining_qty = _clean(remaining_source_quantity_reference, max_length=64)
    if locked.status == ReworkCase.Status.COMPLETED:
        if (
            locked.resulting_batch_reference == result_ref
            and locked.resulting_quantity_reference == result_qty
            and locked.remaining_source_quantity_reference == remaining_qty
        ):
            return locked
        raise ValidationError(
            {"status": "Rework already completed with different result references."}
        )
    if locked.status != ReworkCase.Status.IN_PROGRESS:
        raise ValidationError({"status": "Only in-progress rework can be completed."})
    if not result_ref:
        raise ValidationError(
            {"resulting_batch_reference": "Resulting batch reference is required."}
        )
    if result_ref == locked.source_batch_reference:
        raise ValidationError(
            {
                "resulting_batch_reference": (
                    "Resulting batch must be a new reference; source RELEASE is never reused."
                )
            }
        )
    assert_quantity_conservation(
        source_quantity_reference=locked.source_quantity_reference,
        resulting_quantity_reference=result_qty,
        remaining_source_quantity_reference=remaining_qty,
    )
    locked.resulting_batch_reference = result_ref
    locked.resulting_quantity_reference = result_qty
    locked.remaining_source_quantity_reference = remaining_qty
    locked.status = ReworkCase.Status.COMPLETED
    locked.completed_at = timezone.now()
    locked.full_clean()
    locked.save(
        update_fields=[
            "resulting_batch_reference",
            "resulting_quantity_reference",
            "remaining_source_quantity_reference",
            "status",
            "completed_at",
            "updated_at",
        ]
    )
    _append_event(case=locked, event_type=ReworkCaseEvent.EventType.COMPLETED, actor=user)
    _record_genealogy(actor=user, case=locked)
    record_event(
        event_type="REWORK_CASE_COMPLETED",
        actor=user,
        metadata={
            "organization_id": str(locked.organization_id),
            "rework_case_id": str(locked.id),
            "execution_key": locked.execution_key,
            "source_batch_reference": locked.source_batch_reference,
            "resulting_batch_reference": locked.resulting_batch_reference,
            "remaining_source_quantity_reference": locked.remaining_source_quantity_reference,
            "original_quality_history_unchanged": True,
        },
    )
    return locked


@transaction.atomic
def cancel_rework_case(
    *, actor: User | None, case: ReworkCase, detail_reference: str = ""
) -> ReworkCase:
    user = _require(actor, EXECUTE, case.organization_id)
    locked = lock_queryset(ReworkCase.objects.filter(pk=case.pk)).get()
    if locked.status == ReworkCase.Status.CANCELLED:
        return locked
    if locked.status == ReworkCase.Status.COMPLETED:
        raise ValidationError({"status": "Completed rework cannot be cancelled."})
    locked.status = ReworkCase.Status.CANCELLED
    locked.full_clean()
    locked.save(update_fields=["status", "updated_at"])
    _append_event(
        case=locked,
        event_type=ReworkCaseEvent.EventType.CANCELLED,
        actor=user,
        detail_reference=detail_reference,
    )
    record_event(
        event_type="REWORK_CASE_CANCELLED",
        actor=user,
        metadata={
            "organization_id": str(locked.organization_id),
            "rework_case_id": str(locked.id),
            "execution_key": locked.execution_key,
        },
    )
    return locked


@transaction.atomic
def open_rework_reinspection(
    *,
    actor: User | None,
    case: ReworkCase,
    checklist_template_id: uuid.UUID,
    checklist_version_id: uuid.UUID,
) -> ReworkCase:
    user = _require(actor, EXECUTE, case.organization_id)
    locked = lock_queryset(ReworkCase.objects.filter(pk=case.pk)).get()
    if locked.status != ReworkCase.Status.COMPLETED:
        raise ValidationError({"status": "Reinspection requires a completed rework result."})
    if not locked.resulting_batch_reference:
        raise ValidationError(
            {"resulting_batch_reference": "Resulting batch is required for reinspection."}
        )
    if locked.inspection_task_id:
        return locked
    task = create_batch_checklist_task(
        actor=user,
        organization_id=locked.organization_id,
        checklist_template_id=checklist_template_id,
        checklist_version_id=checklist_version_id,
        batch_reference=locked.resulting_batch_reference,
    )
    if task.batch_reference == locked.source_batch_reference:
        raise ValidationError(
            {
                "inspection_task": (
                    "Rework reinspection must target the resulting batch, not the source RELEASE."
                )
            }
        )
    locked.inspection_task = task
    locked.full_clean()
    locked.save(update_fields=["inspection_task", "updated_at"])
    _append_event(
        case=locked,
        event_type=ReworkCaseEvent.EventType.REINSPECTION_OPENED,
        actor=user,
        detail_reference=str(task.id),
    )
    record_event(
        event_type="REWORK_REINSPECTION_OPENED",
        actor=user,
        metadata={
            "organization_id": str(locked.organization_id),
            "rework_case_id": str(locked.id),
            "checklist_task_id": str(task.id),
            "batch_reference": task.batch_reference,
            "source_release_not_reused": True,
        },
    )
    return locked


@transaction.atomic
def upsert_rework_policy(
    *,
    actor: User | None,
    organization: Organization,
    policy_key: str,
    policy_value_reference: str,
    erp_stock_movement_enabled: bool = False,
) -> ReworkPolicyStub:
    user = _require(actor, MANAGE_POLICY, organization.id)
    stub, _created = ReworkPolicyStub.objects.update_or_create(
        organization=organization,
        policy_key=_clean(policy_key, max_length=64),
        defaults={
            "policy_value_reference": _clean(policy_value_reference, max_length=255),
            "erp_stock_movement_enabled": bool(erp_stock_movement_enabled),
            "updated_by": user,
        },
    )
    record_event(
        event_type="REWORK_POLICY_UPSERTED",
        actor=user,
        metadata={
            "organization_id": str(organization.id),
            "policy_key": stub.policy_key,
            "erp_stock_movement_enabled": stub.erp_stock_movement_enabled,
            "evidence_gate": "APR-067",
        },
    )
    return stub


def attempt_rework_erp_stock_movement(
    *, actor: User | None, case: ReworkCase, correlation_id: str = ""
) -> None:
    user = _actor(actor)
    if not user_has_permission(user, EXECUTE, scope=_scope(case.organization_id)):
        raise PermissionDenied("Permission denied.")
    decision = evaluate_rework_erp_stock_movement(organization_id=case.organization_id)
    command = prepare_rework_erp_stock_movement(case=case, correlation_id=correlation_id)
    send_rework_erp_stock_movement(command=command, actor=user, reason_code=decision.reason_code)
