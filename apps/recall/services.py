"""Product recall / withdrawal services — Phase 37.

High-risk initiation requires an explicit scoped Role grant of initiate_recall.
is_staff / business System Admin RoleTemplates do not imply initiation.
Django is_superuser break-glass also requires an explicit scoped grant for
initiation (APR-062).
"""

from __future__ import annotations

import uuid
from typing import Any

from django.contrib.auth.models import Permission
from django.core.exceptions import PermissionDenied, ValidationError
from django.db import transaction
from django.db.models import Q
from django.utils import timezone

from apps.access_control.models import ScopedRoleAssignment
from apps.access_control.services import Scope, require_permission, user_has_permission
from apps.accounts.models import User
from apps.batch_genealogy.models import GenealogyNodeKind
from apps.batch_genealogy.services import trace_backward, trace_forward
from apps.core.persistence import prefetch_related_compat
from apps.organizations.models import Organization
from apps.recall.models import (
    MOCK_RECALL_BANNER,
    MOCK_RECALL_CODE_PREFIX,
    RECALL_STATUS_TRANSITIONS,
    RecallAffectedBatch,
    RecallAffectedProduct,
    RecallCase,
    RecallCaseMode,
    RecallCaseStatus,
    RecallCommunicationRecord,
    RecallPolicy,
    RecallQuantityLine,
    RecallTimelineEntry,
)
from apps.recall.policy import (
    evaluate_recall_erp_distribution_pull,
    evaluate_recall_external_notification,
)
from apps.recall.selectors import get_recall_case, timeline_for_case
from apps.security_audit.services import record_event

VIEW = "recall.view_recall"
INITIATE = "recall.initiate_recall"
MANAGE = "recall.manage_recallcase"
CLOSE = "recall.close_recall"
MANAGE_POLICY = "recall.manage_recallpolicy"


def _require_actor(actor: User | None) -> User:
    if actor is None or not getattr(actor, "is_authenticated", False) or not actor.is_active:
        raise PermissionDenied("Authentication required.")
    return actor


def _org_scope(organization_id: uuid.UUID) -> Scope:
    return Scope(organization_id=organization_id)


def _permission_matches(perm: Permission, permission: str) -> bool:
    app_label, _, codename = permission.partition(".")
    return perm.content_type.app_label == app_label and perm.codename == codename


def user_has_explicit_scoped_permission(
    user: User | None,
    permission: str,
    *,
    organization_id: uuid.UUID,
) -> bool:
    """
    Scoped Role assignment check that ignores is_superuser / is_staff.

    Used for high-risk recall initiation so System Admin and Django superuser
    do not automatically hold recall authority (APR-062).
    """
    if user is None or not getattr(user, "is_authenticated", False) or not user.is_active:
        return False
    now = timezone.now()
    assignments = prefetch_related_compat(
        ScopedRoleAssignment.objects.filter(user=user, is_active=True, role__is_active=True)
        .filter(Q(valid_from__isnull=True) | Q(valid_from__lte=now))
        .filter(Q(valid_until__isnull=True) | Q(valid_until__gt=now))
        .select_related("role"),
        "role__permissions__content_type",
    )
    for assignment in assignments:
        if assignment.organization_id is None:
            covers = True
        elif assignment.organization_id != organization_id:
            covers = False
        else:
            covers = True
        if not covers:
            continue
        for perm in assignment.role.permissions.all():
            if _permission_matches(perm, permission):
                return True
    return False


def require_explicit_initiate_recall(user: User | None, *, organization_id: uuid.UUID) -> User:
    actor = _require_actor(user)
    if not user_has_explicit_scoped_permission(actor, INITIATE, organization_id=organization_id):
        raise PermissionDenied(
            "initiate_recall requires an explicit scoped Role grant "
            "(not System Admin / is_staff / is_superuser by default)."
        )
    return actor


def _append_timeline(
    *,
    case: RecallCase,
    actor: User | None,
    event_type: str,
    summary: str,
    payload: dict[str, Any] | None = None,
) -> RecallTimelineEntry:
    return RecallTimelineEntry.objects.create(
        recall_case=case,
        event_type=event_type,
        summary=(summary or "")[:512],
        payload=dict(payload or {}),
        actor=actor,
    )


def _transition(case: RecallCase, new_status: str) -> None:
    allowed = RECALL_STATUS_TRANSITIONS.get(case.status, frozenset())
    if new_status not in allowed:
        raise ValidationError(
            {"status": (f"Cannot transition from {case.status} to {new_status}.")}
        )
    case.status = new_status


@transaction.atomic
def upsert_recall_policy(
    *,
    actor: User | None,
    organization: Organization,
    external_notification_enabled: bool = False,
    erp_distribution_pull_enabled: bool = False,
    procedure_reference: str = "",
    notes: str = "",
) -> RecallPolicy:
    user = _require_actor(actor)
    require_permission(user, MANAGE_POLICY, scope=_org_scope(organization.id))
    policy, _ = RecallPolicy.objects.update_or_create(
        organization=organization,
        defaults={
            "external_notification_enabled": bool(external_notification_enabled),
            "erp_distribution_pull_enabled": bool(erp_distribution_pull_enabled),
            "procedure_reference": (procedure_reference or "").strip()[:255],
            "notes": (notes or "").strip(),
            "updated_by": user,
        },
    )
    record_event(
        event_type="RECALL_POLICY_UPDATED",
        actor=user,
        metadata={
            "organization_id": str(organization.id),
            "external_notification_enabled": policy.external_notification_enabled,
            "erp_distribution_pull_enabled": policy.erp_distribution_pull_enabled,
        },
    )
    return policy


@transaction.atomic
def create_recall_case(
    *,
    actor: User | None,
    organization: Organization,
    code: str,
    reason: str,
    case_type_reference: str = "",
    scope_notes: str = "",
    owner: User | None = None,
    initiate: bool = False,
) -> RecallCase:
    """
    Create a recall/withdrawal case. Set initiate=True to open immediately
    (requires explicit initiate_recall scoped grant).
    """
    user = _require_actor(actor)
    require_permission(user, MANAGE, scope=_org_scope(organization.id))
    if initiate:
        require_explicit_initiate_recall(user, organization_id=organization.id)

    normalized_code = (code or "").strip()
    if normalized_code.upper().startswith(MOCK_RECALL_CODE_PREFIX):
        raise ValidationError(
            {
                "code": (
                    f"Use create_mock_recall_exercise for {MOCK_RECALL_CODE_PREFIX} "
                    "mock exercises — real recall create cannot use the mock prefix."
                )
            }
        )

    case = RecallCase(
        organization=organization,
        code=normalized_code,
        mode=RecallCaseMode.REAL,
        is_mock=False,
        case_type_reference=(case_type_reference or "").strip()[:128],
        reason=(reason or "").strip(),
        scope_notes=(scope_notes or "").strip(),
        owner=owner or user,
        status=RecallCaseStatus.DRAFT,
    )
    if initiate:
        case.status = RecallCaseStatus.OPEN
        case.initiated_by = user
        case.initiated_at = timezone.now()
    case.full_clean()
    case.save()
    _append_timeline(
        case=case,
        actor=user,
        event_type="CASE_CREATED",
        summary=f"Recall case {case.code} created ({case.status})",
        payload={"initiate": bool(initiate)},
    )
    if initiate:
        _append_timeline(
            case=case,
            actor=user,
            event_type="CASE_INITIATED",
            summary=f"Recall case {case.code} initiated",
        )
        record_event(
            event_type="RECALL_CASE_INITIATED",
            actor=user,
            metadata={
                "organization_id": str(organization.id),
                "recall_case_id": str(case.id),
                "code": case.code,
            },
        )
    else:
        record_event(
            event_type="RECALL_CASE_CREATED",
            actor=user,
            metadata={
                "organization_id": str(organization.id),
                "recall_case_id": str(case.id),
                "code": case.code,
            },
        )
    return case


@transaction.atomic
def initiate_recall_case(
    *, actor: User | None, organization: Organization, case_id: uuid.UUID
) -> RecallCase:
    user = require_explicit_initiate_recall(actor, organization_id=organization.id)
    case = get_recall_case(organization_id=organization.id, case_id=case_id)
    if case is None:
        raise ValidationError({"case_id": "Recall case not found."})
    if case.is_mock:
        raise ValidationError(
            {
                "case_id": (
                    "Mock exercises cannot be initiated via real recall initiate — "
                    "use start_mock_exercise."
                )
            }
        )
    _transition(case, RecallCaseStatus.OPEN)
    case.initiated_by = user
    case.initiated_at = timezone.now()
    case.save(update_fields=["status", "initiated_by", "initiated_at", "updated_at"])
    _append_timeline(
        case=case,
        actor=user,
        event_type="CASE_INITIATED",
        summary=f"Recall case {case.code} initiated",
    )
    record_event(
        event_type="RECALL_CASE_INITIATED",
        actor=user,
        metadata={
            "organization_id": str(organization.id),
            "recall_case_id": str(case.id),
            "code": case.code,
        },
    )
    return case


@transaction.atomic
def add_affected_product(
    *,
    actor: User | None,
    organization: Organization,
    case_id: uuid.UUID,
    product_reference: str,
    notes: str = "",
) -> RecallAffectedProduct:
    user = _require_actor(actor)
    require_permission(user, MANAGE, scope=_org_scope(organization.id))
    case = get_recall_case(organization_id=organization.id, case_id=case_id)
    if case is None:
        raise ValidationError({"case_id": "Recall case not found."})
    if case.status in {RecallCaseStatus.CLOSED, RecallCaseStatus.CANCELLED}:
        raise ValidationError({"status": "Cannot modify a closed/cancelled case."})
    ref = (product_reference or "").strip()
    if not ref:
        raise ValidationError({"product_reference": "Product reference is required."})
    row, created = RecallAffectedProduct.objects.get_or_create(
        recall_case=case,
        product_reference=ref,
        defaults={"notes": (notes or "").strip()[:512]},
    )
    if created:
        _append_timeline(
            case=case,
            actor=user,
            event_type="PRODUCT_ADDED",
            summary=f"Affected product {ref} added",
            payload={"product_reference": ref},
        )
        record_event(
            event_type="RECALL_AFFECTED_PRODUCT_ADDED",
            actor=user,
            metadata={
                "organization_id": str(organization.id),
                "recall_case_id": str(case.id),
                "product_reference": ref,
            },
        )
    return row


@transaction.atomic
def add_affected_batch(
    *,
    actor: User | None,
    organization: Organization,
    case_id: uuid.UUID,
    batch_reference: str,
    genealogy_node_id: uuid.UUID | None = None,
    genealogy_node_kind: str = "",
    selected_via: str = "MANUAL",
    notes: str = "",
) -> RecallAffectedBatch:
    user = _require_actor(actor)
    require_permission(user, MANAGE, scope=_org_scope(organization.id))
    case = get_recall_case(organization_id=organization.id, case_id=case_id)
    if case is None:
        raise ValidationError({"case_id": "Recall case not found."})
    if case.status in {RecallCaseStatus.CLOSED, RecallCaseStatus.CANCELLED}:
        raise ValidationError({"status": "Cannot modify a closed/cancelled case."})
    ref = (batch_reference or "").strip()
    if not ref:
        raise ValidationError({"batch_reference": "Batch reference is required."})
    row, created = RecallAffectedBatch.objects.get_or_create(
        recall_case=case,
        batch_reference=ref,
        defaults={
            "genealogy_node_id": genealogy_node_id,
            "genealogy_node_kind": (genealogy_node_kind or "").strip()[:32],
            "selected_via": (selected_via or "MANUAL").strip()[:64],
            "notes": (notes or "").strip()[:512],
        },
    )
    if created:
        if case.status == RecallCaseStatus.OPEN:
            _transition(case, RecallCaseStatus.IN_PROGRESS)
            case.save(update_fields=["status", "updated_at"])
        _append_timeline(
            case=case,
            actor=user,
            event_type="BATCH_ADDED",
            summary=f"Affected batch {ref} added ({row.selected_via})",
            payload={
                "batch_reference": ref,
                "selected_via": row.selected_via,
                "genealogy_node_id": str(genealogy_node_id) if genealogy_node_id else None,
            },
        )
        record_event(
            event_type="RECALL_AFFECTED_BATCH_ADDED",
            actor=user,
            metadata={
                "organization_id": str(organization.id),
                "recall_case_id": str(case.id),
                "batch_reference": ref,
                "selected_via": row.selected_via,
            },
        )
    return row


@transaction.atomic
def expand_genealogy_for_recall(
    *,
    actor: User | None,
    organization: Organization,
    case_id: uuid.UUID,
    root_kind: str,
    root_external_key: str,
    direction: str = "forward",
    max_depth: int | None = None,
) -> dict[str, Any]:
    """
    Expand Phase 36 genealogy into the recall case as affected batches.

    Does not invent links — uses ERP-sourced genealogy only.
    """
    user = _require_actor(actor)
    case = get_recall_case(organization_id=organization.id, case_id=case_id)
    if case is None:
        raise ValidationError({"case_id": "Recall case not found."})
    if case.is_mock:
        if not (
            user_has_permission(user, MANAGE, scope=_org_scope(organization.id))
            or user_has_permission(
                user, "recall.run_mock_recall", scope=_org_scope(organization.id)
            )
        ):
            raise PermissionDenied("Permission denied.")
    else:
        require_permission(user, MANAGE, scope=_org_scope(organization.id))
    require_permission(
        user, "batch_genealogy.view_batchgenealogy", scope=_org_scope(organization.id)
    )
    if case.status in {RecallCaseStatus.CLOSED, RecallCaseStatus.CANCELLED}:
        raise ValidationError({"status": "Cannot modify a closed/cancelled case."})

    if direction == "backward":
        trace = trace_backward(
            actor=user,
            organization=organization,
            kind=root_kind,
            external_key=root_external_key,
            max_depth=max_depth,
        )
    elif direction == "forward":
        trace = trace_forward(
            actor=user,
            organization=organization,
            kind=root_kind,
            external_key=root_external_key,
            max_depth=max_depth,
        )
    else:
        raise ValidationError({"direction": "direction must be forward or backward."})

    added: list[str] = []
    for node in trace.nodes:
        kind = str(node.get("kind") or "")
        key = str(node.get("external_key") or "").strip()
        if not key:
            continue
        if kind not in {
            GenealogyNodeKind.FG_BATCH,
            GenealogyNodeKind.PRODUCTION_BATCH,
            GenealogyNodeKind.REWORK_BATCH,
            GenealogyNodeKind.SUB_LOT_PALLET,
            GenealogyNodeKind.RAW_MATERIAL_LOT,
            GenealogyNodeKind.SHIPMENT_CUSTOMER,
        }:
            continue
        node_id_raw = node.get("id")
        node_uuid = uuid.UUID(str(node_id_raw)) if node_id_raw else None
        row, created = RecallAffectedBatch.objects.get_or_create(
            recall_case=case,
            batch_reference=key,
            defaults={
                "genealogy_node_id": node_uuid,
                "genealogy_node_kind": kind,
                "selected_via": "GENEALOGY_EXPANSION",
            },
        )
        if created:
            added.append(row.batch_reference)

    if added and case.status == RecallCaseStatus.OPEN:
        _transition(case, RecallCaseStatus.IN_PROGRESS)
        case.save(update_fields=["status", "updated_at"])

    _append_timeline(
        case=case,
        actor=user,
        event_type="GENEALOGY_EXPANDED",
        summary=(
            f"Genealogy {direction} expansion from {root_kind}:{root_external_key} "
            f"added/seen {len(added)} nodes"
        ),
        payload={
            "direction": direction,
            "root_kind": root_kind,
            "root_external_key": root_external_key,
            "added_count": len(added),
            "missing_links": list(trace.missing_links),
            "truncated": trace.truncated,
        },
    )
    record_event(
        event_type="RECALL_GENEALOGY_EXPANDED",
        actor=user,
        metadata={
            "organization_id": str(organization.id),
            "recall_case_id": str(case.id),
            "direction": direction,
            "added_count": len(added),
            "missing_links": list(trace.missing_links),
        },
    )
    return {
        "recall_case_id": str(case.id),
        "direction": direction,
        "added_batch_references": added,
        "missing_links": list(trace.missing_links),
        "truncated": trace.truncated,
        "genealogy_not_invented": True,
    }


@transaction.atomic
def upsert_quantity_reconciliation(
    *,
    actor: User | None,
    organization: Organization,
    case_id: uuid.UUID,
    batch_reference: str,
    produced_reference: str = "",
    distributed_reference: str = "",
    remaining_reference: str = "",
    recovered_reference: str = "",
    disposed_reference: str = "",
    reworked_reference: str = "",
    uom_reference: str = "",
    erp_source_system: str = "",
    erp_source_event_id: str = "",
    notes: str = "",
) -> RecallQuantityLine:
    """
    Store opaque quantity references. No invented variance thresholds.
    """
    user = _require_actor(actor)
    require_permission(user, MANAGE, scope=_org_scope(organization.id))
    case = get_recall_case(organization_id=organization.id, case_id=case_id)
    if case is None:
        raise ValidationError({"case_id": "Recall case not found."})
    if case.status in {RecallCaseStatus.CLOSED, RecallCaseStatus.CANCELLED}:
        raise ValidationError({"status": "Cannot modify a closed/cancelled case."})
    batch = RecallAffectedBatch.objects.filter(
        recall_case=case, batch_reference__iexact=(batch_reference or "").strip()
    ).first()
    if batch is None:
        raise ValidationError({"batch_reference": "Affected batch not on this case."})

    line, _ = RecallQuantityLine.objects.update_or_create(
        recall_case=case,
        affected_batch=batch,
        defaults={
            "produced_reference": (produced_reference or "").strip()[:128],
            "distributed_reference": (distributed_reference or "").strip()[:128],
            "remaining_reference": (remaining_reference or "").strip()[:128],
            "recovered_reference": (recovered_reference or "").strip()[:128],
            "disposed_reference": (disposed_reference or "").strip()[:128],
            "reworked_reference": (reworked_reference or "").strip()[:128],
            "uom_reference": (uom_reference or "").strip()[:64],
            "erp_source_system": (erp_source_system or "").strip()[:64],
            "erp_source_event_id": (erp_source_event_id or "").strip()[:128],
            "notes": (notes or "").strip(),
            "updated_by": user,
        },
    )
    if case.status in {RecallCaseStatus.OPEN, RecallCaseStatus.IN_PROGRESS}:
        _transition(case, RecallCaseStatus.RECONCILING)
        case.save(update_fields=["status", "updated_at"])
    _append_timeline(
        case=case,
        actor=user,
        event_type="QUANTITY_RECONCILED",
        summary=f"Quantity reconciliation updated for {batch.batch_reference}",
        payload={
            "batch_reference": batch.batch_reference,
            "produced_reference": line.produced_reference,
            "distributed_reference": line.distributed_reference,
            "remaining_reference": line.remaining_reference,
            "recovered_reference": line.recovered_reference,
            "disposed_reference": line.disposed_reference,
            "reworked_reference": line.reworked_reference,
            "no_invented_variance": True,
        },
    )
    record_event(
        event_type="RECALL_QUANTITY_RECONCILED",
        actor=user,
        metadata={
            "organization_id": str(organization.id),
            "recall_case_id": str(case.id),
            "batch_reference": batch.batch_reference,
            "quantity_line_id": str(line.id),
        },
    )
    return line


@transaction.atomic
def record_communication_reference(
    *,
    actor: User | None,
    organization: Organization,
    case_id: uuid.UUID,
    reference: str,
    channel_reference: str = "",
    audience_reference: str = "",
    evidence_attachment_id: uuid.UUID | None = None,
    notes: str = "",
) -> RecallCommunicationRecord:
    """Store a communication reference/evidence — does not send messages."""
    user = _require_actor(actor)
    require_permission(user, MANAGE, scope=_org_scope(organization.id))
    case = get_recall_case(organization_id=organization.id, case_id=case_id)
    if case is None:
        raise ValidationError({"case_id": "Recall case not found."})
    ref = (reference or "").strip()
    if not ref:
        raise ValidationError({"reference": "Communication reference is required."})
    row = RecallCommunicationRecord.objects.create(
        recall_case=case,
        reference=ref[:128],
        channel_reference=(channel_reference or "").strip()[:128],
        audience_reference=(audience_reference or "").strip()[:128],
        evidence_attachment_id=evidence_attachment_id,
        notes=(notes or "").strip(),
        recorded_by=user,
    )
    _append_timeline(
        case=case,
        actor=user,
        event_type="COMMUNICATION_RECORDED",
        summary=f"Communication reference {ref} recorded (no auto-send)",
        payload={
            "reference": ref,
            "channel_reference": row.channel_reference,
            "auto_send": False,
        },
    )
    record_event(
        event_type="RECALL_COMMUNICATION_RECORDED",
        actor=user,
        metadata={
            "organization_id": str(organization.id),
            "recall_case_id": str(case.id),
            "communication_id": str(row.id),
            "auto_send": False,
        },
    )
    return row


def attempt_external_notification(
    *,
    actor: User | None,
    organization: Organization,
    case_id: uuid.UUID,
) -> dict[str, Any]:
    """Dual-gated OFF — never auto-contacts authorities/customers in Phase 37."""
    user = _require_actor(actor)
    require_permission(user, MANAGE, scope=_org_scope(organization.id))
    case = get_recall_case(organization_id=organization.id, case_id=case_id)
    if case is None:
        raise ValidationError({"case_id": "Recall case not found."})
    if case.is_mock:
        result = {
            "allowed": False,
            "reason_code": "MOCK_SIDE_EFFECT_FORBIDDEN",
            "message_not_sent": True,
            "real_customer_notification_sent": False,
            "regulatory_notification_created": False,
            "is_mock": True,
            "visual_banner": MOCK_RECALL_BANNER,
            "recall_case_id": str(case.id),
            "evidence_gate": "APR-063 / mock recall preparedness policy",
        }
        record_event(
            event_type="MOCK_RECALL_SIDE_EFFECT_BLOCKED",
            actor=user,
            metadata={
                "organization_id": str(organization.id),
                "recall_case_id": str(case.id),
                "gate": "EXTERNAL_NOTIFICATION",
                **result,
            },
        )
        _append_timeline(
            case=case,
            actor=user,
            event_type="MOCK_SIDE_EFFECT_BLOCKED",
            summary="Mock external notification forbidden",
            payload=result,
        )
        return result
    decision = evaluate_recall_external_notification(organization_id=organization.id)
    record_event(
        event_type=(
            "RECALL_EXTERNAL_NOTIFICATION_PREPARED"
            if decision.allowed
            else "RECALL_EXTERNAL_NOTIFICATION_BLOCKED"
        ),
        actor=user,
        metadata={
            "organization_id": str(organization.id),
            "recall_case_id": str(case.id),
            "decision": decision.as_dict(),
            "message_not_sent": True,
        },
    )
    _append_timeline(
        case=case,
        actor=user,
        event_type="EXTERNAL_NOTIFICATION_GATE",
        summary=(
            "External notification prepared (no send)"
            if decision.allowed
            else f"External notification blocked ({decision.reason_code})"
        ),
        payload=decision.as_dict(),
    )
    return {
        **decision.as_dict(),
        "message_not_sent": True,
        "recall_case_id": str(case.id),
    }


def attempt_erp_distribution_pull(
    *,
    actor: User | None,
    organization: Organization,
    case_id: uuid.UUID,
) -> dict[str, Any]:
    """
    Dual-gated ERP distribution/customer pull hook.

    When blocked or when no ERP-sourced distribution edges exist, returns
    missing_erp_links without inventing customer destinations.
    """
    user = _require_actor(actor)
    require_permission(user, MANAGE, scope=_org_scope(organization.id))
    case = get_recall_case(organization_id=organization.id, case_id=case_id)
    if case is None:
        raise ValidationError({"case_id": "Recall case not found."})
    if case.is_mock:
        result = {
            "allowed": False,
            "reason_code": "MOCK_SIDE_EFFECT_FORBIDDEN",
            "missing_erp_links": ["MOCK_SIDE_EFFECT_FORBIDDEN"],
            "shipment_refs": [],
            "live_pull_not_executed": True,
            "erp_stock_changed": False,
            "is_mock": True,
            "visual_banner": MOCK_RECALL_BANNER,
            "recall_case_id": str(case.id),
            "evidence_gate": "APR-063 / mock recall preparedness policy",
        }
        record_event(
            event_type="MOCK_RECALL_SIDE_EFFECT_BLOCKED",
            actor=user,
            metadata={
                "organization_id": str(organization.id),
                "recall_case_id": str(case.id),
                "gate": "ERP_DISTRIBUTION_PULL",
                **result,
            },
        )
        _append_timeline(
            case=case,
            actor=user,
            event_type="MOCK_SIDE_EFFECT_BLOCKED",
            summary="Mock ERP distribution/stock change forbidden",
            payload=result,
        )
        return result
    decision = evaluate_recall_erp_distribution_pull(organization_id=organization.id)
    missing: list[str] = []
    shipment_refs: list[str] = []
    if not decision.allowed:
        missing.append("ERP_DISTRIBUTION_PULL_GATE")
    else:
        # Pull remains prepare-only — live adapter not approved (Phase 17).
        missing.append("LIVE_ERP_ADAPTER_NOT_APPROVED")
        for batch in case.affected_batches.all():
            if batch.genealogy_node_kind == GenealogyNodeKind.SHIPMENT_CUSTOMER:
                shipment_refs.append(batch.batch_reference)
        if not shipment_refs:
            missing.append("NO_ERP_SHIPMENT_CUSTOMER_LINKS")

    record_event(
        event_type=(
            "RECALL_ERP_DISTRIBUTION_PREPARED"
            if decision.allowed
            else "RECALL_ERP_DISTRIBUTION_BLOCKED"
        ),
        actor=user,
        metadata={
            "organization_id": str(organization.id),
            "recall_case_id": str(case.id),
            "decision": decision.as_dict(),
            "missing_erp_links": missing,
            "shipment_refs": shipment_refs,
        },
    )
    _append_timeline(
        case=case,
        actor=user,
        event_type="ERP_DISTRIBUTION_GATE",
        summary=f"ERP distribution pull gate ({decision.reason_code})",
        payload={
            **decision.as_dict(),
            "missing_erp_links": missing,
            "shipment_refs": shipment_refs,
        },
    )
    return {
        **decision.as_dict(),
        "recall_case_id": str(case.id),
        "missing_erp_links": missing,
        "shipment_refs": shipment_refs,
        "live_pull_not_executed": True,
    }


@transaction.atomic
def close_recall_case(
    *,
    actor: User | None,
    organization: Organization,
    case_id: uuid.UUID,
    closure_notes: str = "",
) -> RecallCase:
    user = _require_actor(actor)
    require_permission(user, CLOSE, scope=_org_scope(organization.id))
    case = get_recall_case(organization_id=organization.id, case_id=case_id)
    if case is None:
        raise ValidationError({"case_id": "Recall case not found."})
    if case.status == RecallCaseStatus.DRAFT:
        raise ValidationError({"status": "Initiate the case before closure."})
    if case.status == RecallCaseStatus.CLOSED:
        return case
    if case.status != RecallCaseStatus.PENDING_CLOSURE:
        if case.status in {
            RecallCaseStatus.OPEN,
            RecallCaseStatus.IN_PROGRESS,
            RecallCaseStatus.RECONCILING,
        }:
            _transition(case, RecallCaseStatus.PENDING_CLOSURE)
            case.save(update_fields=["status", "updated_at"])
        else:
            raise ValidationError({"status": f"Cannot close from {case.status}."})
    _transition(case, RecallCaseStatus.CLOSED)
    case.closed_by = user
    case.closed_at = timezone.now()
    case.closure_notes = (closure_notes or "").strip()
    case.save(
        update_fields=[
            "status",
            "closed_by",
            "closed_at",
            "closure_notes",
            "updated_at",
        ]
    )
    _append_timeline(
        case=case,
        actor=user,
        event_type="CASE_CLOSED",
        summary=f"Recall case {case.code} closed",
        payload={"closure_notes": case.closure_notes[:200]},
    )
    record_event(
        event_type="RECALL_CASE_CLOSED",
        actor=user,
        metadata={
            "organization_id": str(organization.id),
            "recall_case_id": str(case.id),
            "code": case.code,
        },
    )
    return case


def get_recall_timeline(
    *,
    actor: User | None,
    organization: Organization,
    case_id: uuid.UUID,
) -> list[dict[str, Any]]:
    user = _require_actor(actor)
    require_permission(user, VIEW, scope=_org_scope(organization.id))
    case = get_recall_case(organization_id=organization.id, case_id=case_id)
    if case is None:
        raise ValidationError({"case_id": "Recall case not found."})
    return [
        {
            "id": str(e.id),
            "event_type": e.event_type,
            "summary": e.summary,
            "payload": e.payload,
            "actor_id": str(e.actor_id) if e.actor_id else None,
            "created_at": e.created_at.isoformat(),
            "immutable": True,
        }
        for e in timeline_for_case(case_id=case.id)
    ]


def serialize_recall_case(case: RecallCase) -> dict[str, Any]:
    payload: dict[str, Any] = {
        "id": str(case.id),
        "code": case.code,
        "mode": case.mode,
        "is_mock": case.is_mock,
        "visual_banner": case.visual_banner,
        "cannot_confuse_with_real_recall": bool(case.is_mock),
        "case_type_reference": case.case_type_reference,
        "reason": case.reason,
        "status": case.status,
        "scope_notes": case.scope_notes,
        "initiated_by_id": str(case.initiated_by_id) if case.initiated_by_id else None,
        "initiated_at": case.initiated_at.isoformat() if case.initiated_at else None,
        "owner_id": str(case.owner_id) if case.owner_id else None,
        "closed_by_id": str(case.closed_by_id) if case.closed_by_id else None,
        "closed_at": case.closed_at.isoformat() if case.closed_at else None,
        "closure_notes": case.closure_notes,
        "affected_products": [
            {"id": str(p.id), "product_reference": p.product_reference}
            for p in case.affected_products.all()
        ],
        "affected_batches": [
            {
                "id": str(b.id),
                "batch_reference": b.batch_reference,
                "genealogy_node_id": str(b.genealogy_node_id) if b.genealogy_node_id else None,
                "genealogy_node_kind": b.genealogy_node_kind,
                "selected_via": b.selected_via,
            }
            for b in case.affected_batches.all()
        ],
        "quantity_lines": [
            {
                "id": str(q.id),
                "batch_reference": q.affected_batch.batch_reference,
                "produced_reference": q.produced_reference,
                "distributed_reference": q.distributed_reference,
                "remaining_reference": q.remaining_reference,
                "recovered_reference": q.recovered_reference,
                "disposed_reference": q.disposed_reference,
                "reworked_reference": q.reworked_reference,
                "uom_reference": q.uom_reference,
                "no_invented_variance": True,
            }
            for q in case.quantity_lines.select_related("affected_batch").all()
        ],
        "no_invented_regulatory_class": True,
        "evidence_gate": (
            "APR-063 / mock recall preparedness policy"
            if case.is_mock
            else "APR-062 / company recall / withdrawal policy"
        ),
    }
    if case.is_mock:
        payload.update(
            {
                "erp_stock_changed": False,
                "real_customer_notification_sent": False,
                "regulatory_notification_created": False,
                "blocks_dispatch": False,
            }
        )
    return payload
