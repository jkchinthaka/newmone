"""Mock recall exercise services — Phase 38.

MOCK exercises are visually and technically isolated from real recalls.
They never change ERP stock, send real notifications, create regulatory
notifications, or block dispatch.
"""

from __future__ import annotations

import uuid
from typing import Any

from django.core.exceptions import ValidationError
from django.utils import timezone

from apps.core.persistence.transactions import atomic_fn
from apps.access_control.services import require_permission
from apps.accounts.models import User
from apps.capa.services import create_corrective_action
from apps.nonconformance.services import create_nonconformance
from apps.organizations.models import Organization
from apps.recall.models import (
    MOCK_RECALL_BANNER,
    MOCK_RECALL_CASE_TYPE,
    MOCK_RECALL_CODE_PREFIX,
    MockCompletenessMark,
    MockExerciseMetrics,
    MockFindingLinkKind,
    MockImprovementAction,
    MockRecallFinding,
    RecallCase,
    RecallCaseMode,
    RecallCaseStatus,
)
from apps.recall.selectors import get_recall_case
from apps.recall.services import (
    _append_timeline,
    _org_scope,
    _require_actor,
    expand_genealogy_for_recall,
)
from apps.security_audit.services import record_event

RUN_MOCK = "recall.run_mock_recall"
MANAGE_FINDINGS = "recall.manage_mock_recall_findings"
CLOSE = "recall.close_recall"


def mock_side_effect_guard(*, case: RecallCase) -> dict[str, Any]:
    """Immutable isolation guarantees for mock exercises."""
    if not case.is_mock:
        return {
            "is_mock": False,
            "erp_stock_changed": None,
            "real_customer_notification_sent": None,
            "regulatory_notification_created": None,
            "blocks_dispatch": None,
        }
    return {
        "is_mock": True,
        "visual_banner": MOCK_RECALL_BANNER,
        "mode": RecallCaseMode.MOCK_EXERCISE,
        "erp_stock_changed": False,
        "real_customer_notification_sent": False,
        "regulatory_notification_created": False,
        "blocks_dispatch": False,
        "cannot_confuse_with_real_recall": True,
        "evidence_gate": "APR-063 / mock recall preparedness policy",
    }


def mock_blocks_dispatch(*, case: RecallCase) -> bool:
    """Mock recalls never block dispatch."""
    return False if case.is_mock else False  # real recall dispatch policy is out of Phase 38


def _require_mock_case(*, organization_id: uuid.UUID, case_id: uuid.UUID) -> RecallCase:
    case = get_recall_case(organization_id=organization_id, case_id=case_id)
    if case is None:
        raise ValidationError({"case_id": "Recall case not found."})
    if not case.is_mock or case.mode != RecallCaseMode.MOCK_EXERCISE:
        raise ValidationError({"case_id": "Operation requires a MOCK_EXERCISE recall case."})
    return case


def _ensure_metrics(case: RecallCase, *, actor: User) -> MockExerciseMetrics:
    metrics, _ = MockExerciseMetrics.objects.get_or_create(
        recall_case=case,
        defaults={"updated_by": actor},
    )
    return metrics


@atomic_fn
def create_mock_recall_exercise(
    *,
    actor: User | None,
    organization: Organization,
    code: str,
    reason: str,
    scope_notes: str = "",
    owner: User | None = None,
    start: bool = True,
) -> RecallCase:
    """
    Create a MOCK recall exercise.

    Requires run_mock_recall. Codes must use MOCK- prefix. Never a real recall.
    """
    user = _require_actor(actor)
    require_permission(user, RUN_MOCK, scope=_org_scope(organization.id))

    raw = (code or "").strip()
    if not raw.upper().startswith(MOCK_RECALL_CODE_PREFIX):
        raw = f"{MOCK_RECALL_CODE_PREFIX}{raw}"

    case = RecallCase(
        organization=organization,
        code=raw,
        mode=RecallCaseMode.MOCK_EXERCISE,
        is_mock=True,
        case_type_reference=MOCK_RECALL_CASE_TYPE,
        reason=(reason or "").strip(),
        scope_notes=(scope_notes or "").strip(),
        owner=owner or user,
        status=RecallCaseStatus.OPEN if start else RecallCaseStatus.DRAFT,
        metadata={
            "mock_exercise": True,
            "visual_banner": MOCK_RECALL_BANNER,
            "no_real_side_effects": True,
        },
    )
    if start:
        case.initiated_by = user
        case.initiated_at = timezone.now()
    case.full_clean()
    case.save()

    metrics = _ensure_metrics(case, actor=user)
    if start:
        metrics.started_at = case.initiated_at
        metrics.scope_snapshot = case.scope_notes
        metrics.updated_by = user
        metrics.save()

    _append_timeline(
        case=case,
        actor=user,
        event_type="MOCK_EXERCISE_CREATED",
        summary=f"{MOCK_RECALL_BANNER}: {case.code} created",
        payload=mock_side_effect_guard(case=case),
    )
    record_event(
        event_type="MOCK_RECALL_EXERCISE_CREATED",
        actor=user,
        metadata={
            "organization_id": str(organization.id),
            "recall_case_id": str(case.id),
            "code": case.code,
            "is_mock": True,
            **{k: v for k, v in mock_side_effect_guard(case=case).items() if k != "visual_banner"},
        },
    )
    return case


@atomic_fn
def start_mock_exercise(
    *,
    actor: User | None,
    organization: Organization,
    case_id: uuid.UUID,
) -> MockExerciseMetrics:
    user = _require_actor(actor)
    require_permission(user, RUN_MOCK, scope=_org_scope(organization.id))
    case = _require_mock_case(organization_id=organization.id, case_id=case_id)
    if case.status in {RecallCaseStatus.CLOSED, RecallCaseStatus.CANCELLED}:
        raise ValidationError({"status": "Cannot start a closed/cancelled mock exercise."})
    if case.status == RecallCaseStatus.DRAFT:
        case.status = RecallCaseStatus.OPEN
        case.initiated_by = user
        case.initiated_at = timezone.now()
        case.save(update_fields=["status", "initiated_by", "initiated_at", "updated_at"])
    metrics = _ensure_metrics(case, actor=user)
    if metrics.started_at is None:
        metrics.started_at = timezone.now()
    metrics.scope_snapshot = case.scope_notes or metrics.scope_snapshot
    metrics.updated_by = user
    metrics.save()
    _append_timeline(
        case=case,
        actor=user,
        event_type="MOCK_EXERCISE_STARTED",
        summary=f"Mock exercise {case.code} started",
        payload={"started_at": metrics.started_at.isoformat()},
    )
    record_event(
        event_type="MOCK_RECALL_EXERCISE_STARTED",
        actor=user,
        metadata={
            "organization_id": str(organization.id),
            "recall_case_id": str(case.id),
            "started_at": metrics.started_at.isoformat() if metrics.started_at else None,
        },
    )
    return metrics


@atomic_fn
def update_mock_exercise_metrics(
    *,
    actor: User | None,
    organization: Organization,
    case_id: uuid.UUID,
    scope_snapshot: str | None = None,
    traceback_completeness: str | None = None,
    traceback_notes: str | None = None,
    traceforward_completeness: str | None = None,
    traceforward_notes: str | None = None,
    quantity_reconciliation_notes: str | None = None,
    gaps: list[Any] | None = None,
    actions: list[Any] | None = None,
) -> dict[str, Any]:
    user = _require_actor(actor)
    require_permission(user, RUN_MOCK, scope=_org_scope(organization.id))
    case = _require_mock_case(organization_id=organization.id, case_id=case_id)
    metrics = _ensure_metrics(case, actor=user)

    if scope_snapshot is not None:
        metrics.scope_snapshot = scope_snapshot.strip()
    if traceback_completeness is not None:
        if traceback_completeness not in MockCompletenessMark.values:
            raise ValidationError({"traceback_completeness": "Unknown completeness mark."})
        metrics.traceback_completeness = traceback_completeness
    if traceback_notes is not None:
        metrics.traceback_notes = traceback_notes.strip()
    if traceforward_completeness is not None:
        if traceforward_completeness not in MockCompletenessMark.values:
            raise ValidationError({"traceforward_completeness": "Unknown completeness mark."})
        metrics.traceforward_completeness = traceforward_completeness
    if traceforward_notes is not None:
        metrics.traceforward_notes = traceforward_notes.strip()
    if quantity_reconciliation_notes is not None:
        metrics.quantity_reconciliation_notes = quantity_reconciliation_notes.strip()
    if gaps is not None:
        metrics.gaps = list(gaps)
    if actions is not None:
        metrics.actions = list(actions)
    metrics.updated_by = user
    metrics.full_clean()
    metrics.save()

    snapshot = serialize_mock_metrics(metrics)
    _append_timeline(
        case=case,
        actor=user,
        event_type="MOCK_METRICS_UPDATED",
        summary=f"Mock exercise metrics updated for {case.code}",
        payload=snapshot,
    )
    record_event(
        event_type="MOCK_RECALL_METRICS_UPDATED",
        actor=user,
        metadata={
            "organization_id": str(organization.id),
            "recall_case_id": str(case.id),
            "traceback_completeness": metrics.traceback_completeness,
            "traceforward_completeness": metrics.traceforward_completeness,
        },
    )
    return snapshot


def serialize_mock_metrics(metrics: MockExerciseMetrics) -> dict[str, Any]:
    return {
        "recall_case_id": str(metrics.recall_case_id),
        "started_at": metrics.started_at.isoformat() if metrics.started_at else None,
        "completed_at": metrics.completed_at.isoformat() if metrics.completed_at else None,
        "scope": metrics.scope_snapshot,
        "traceback_completeness": metrics.traceback_completeness,
        "traceback_notes": metrics.traceback_notes,
        "traceforward_completeness": metrics.traceforward_completeness,
        "traceforward_notes": metrics.traceforward_notes,
        "quantity_reconciliation": metrics.quantity_reconciliation_notes,
        "gaps": list(metrics.gaps or []),
        "actions": list(metrics.actions or []),
        "no_invented_scoring": True,
        "is_mock": True,
    }


@atomic_fn
def complete_mock_exercise(
    *,
    actor: User | None,
    organization: Organization,
    case_id: uuid.UUID,
    closure_notes: str = "",
) -> dict[str, Any]:
    user = _require_actor(actor)
    require_permission(user, RUN_MOCK, scope=_org_scope(organization.id))
    require_permission(user, CLOSE, scope=_org_scope(organization.id))
    case = _require_mock_case(organization_id=organization.id, case_id=case_id)
    metrics = _ensure_metrics(case, actor=user)
    now = timezone.now()
    if metrics.started_at is None:
        metrics.started_at = case.initiated_at or now
    metrics.completed_at = now
    metrics.updated_by = user
    metrics.save()

    if case.status != RecallCaseStatus.CLOSED:
        if case.status not in {
            RecallCaseStatus.PENDING_CLOSURE,
            RecallCaseStatus.CLOSED,
        }:
            if case.status == RecallCaseStatus.DRAFT:
                raise ValidationError({"status": "Start the mock exercise before completing."})
            case.status = RecallCaseStatus.PENDING_CLOSURE
            case.save(update_fields=["status", "updated_at"])
        case.status = RecallCaseStatus.CLOSED
        case.closed_by = user
        case.closed_at = now
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

    payload = {
        **serialize_mock_metrics(metrics),
        **mock_side_effect_guard(case=case),
    }
    _append_timeline(
        case=case,
        actor=user,
        event_type="MOCK_EXERCISE_COMPLETED",
        summary=f"{MOCK_RECALL_BANNER}: {case.code} completed",
        payload=payload,
    )
    record_event(
        event_type="MOCK_RECALL_EXERCISE_COMPLETED",
        actor=user,
        metadata={
            "organization_id": str(organization.id),
            "recall_case_id": str(case.id),
            "code": case.code,
            "completed_at": metrics.completed_at.isoformat() if metrics.completed_at else None,
            "blocks_dispatch": False,
            "erp_stock_changed": False,
        },
    )
    return payload


@atomic_fn
def run_mock_genealogy_exercise(
    *,
    actor: User | None,
    organization: Organization,
    case_id: uuid.UUID,
    root_kind: str,
    root_external_key: str,
    directions: tuple[str, ...] = ("backward", "forward"),
) -> dict[str, Any]:
    """Expand genealogy on a mock case and capture completeness marks."""
    user = _require_actor(actor)
    require_permission(user, RUN_MOCK, scope=_org_scope(organization.id))
    case = _require_mock_case(organization_id=organization.id, case_id=case_id)

    results: dict[str, Any] = {"is_mock": True, "expansions": {}}
    for direction in directions:
        expansion = expand_genealogy_for_recall(
            actor=user,
            organization=organization,
            case_id=case.id,
            root_kind=root_kind,
            root_external_key=root_external_key,
            direction=direction,
        )
        results["expansions"][direction] = expansion

    metrics = _ensure_metrics(case, actor=user)
    back = results["expansions"].get("backward") or {}
    fwd = results["expansions"].get("forward") or {}
    if "backward" in results["expansions"]:
        added = back.get("added_batch_references") or []
        missing = back.get("missing_links") or []
        metrics.traceback_completeness = (
            MockCompletenessMark.GAPS_IDENTIFIED
            if missing
            else MockCompletenessMark.COMPLETE
            if added
            else MockCompletenessMark.PARTIAL
        )
        metrics.traceback_notes = f"missing={missing}; added={added}"[:2000]
    if "forward" in results["expansions"]:
        added = fwd.get("added_batch_references") or []
        missing = fwd.get("missing_links") or []
        metrics.traceforward_completeness = (
            MockCompletenessMark.GAPS_IDENTIFIED
            if missing
            else MockCompletenessMark.COMPLETE
            if added
            else MockCompletenessMark.PARTIAL
        )
        metrics.traceforward_notes = f"missing={missing}; added={added}"[:2000]
    metrics.updated_by = user
    metrics.save()
    results["metrics"] = serialize_mock_metrics(metrics)
    record_event(
        event_type="MOCK_RECALL_GENEALOGY_EXERCISED",
        actor=user,
        metadata={
            "organization_id": str(organization.id),
            "recall_case_id": str(case.id),
            "directions": list(directions),
            "is_mock": True,
        },
    )
    return results


def attempt_mock_side_effects(
    *,
    actor: User | None,
    organization: Organization,
    case_id: uuid.UUID,
) -> dict[str, Any]:
    """
    Prove mock isolation: ERP stock / real notify / regulatory / dispatch blocked.
    """
    user = _require_actor(actor)
    require_permission(user, RUN_MOCK, scope=_org_scope(organization.id))
    case = _require_mock_case(organization_id=organization.id, case_id=case_id)
    guard = mock_side_effect_guard(case=case)
    result = {
        **guard,
        "erp_stock_change_attempted": False,
        "erp_stock_change_applied": False,
        "customer_notification_attempted": False,
        "customer_notification_sent": False,
        "regulatory_notification_attempted": False,
        "regulatory_notification_created": False,
        "dispatch_block_attempted": False,
        "dispatch_blocked": mock_blocks_dispatch(case=case),
        "reason_code": "MOCK_SIDE_EFFECT_FORBIDDEN",
    }
    record_event(
        event_type="MOCK_RECALL_SIDE_EFFECT_BLOCKED",
        actor=user,
        metadata={
            "organization_id": str(organization.id),
            "recall_case_id": str(case.id),
            **result,
        },
    )
    _append_timeline(
        case=case,
        actor=user,
        event_type="MOCK_SIDE_EFFECT_BLOCKED",
        summary="Mock side effects forbidden (ERP/notify/regulatory/dispatch)",
        payload=result,
    )
    return result


@atomic_fn
def create_mock_finding(
    *,
    actor: User | None,
    organization: Organization,
    case_id: uuid.UUID,
    title: str,
    description: str = "",
) -> MockRecallFinding:
    user = _require_actor(actor)
    require_permission(user, MANAGE_FINDINGS, scope=_org_scope(organization.id))
    case = _require_mock_case(organization_id=organization.id, case_id=case_id)
    finding = MockRecallFinding(
        recall_case=case,
        title=(title or "").strip()[:255],
        description=(description or "").strip(),
        created_by=user,
    )
    if not finding.title:
        raise ValidationError({"title": "Finding title is required."})
    finding.full_clean()
    finding.save()
    _append_timeline(
        case=case,
        actor=user,
        event_type="MOCK_FINDING_RECORDED",
        summary=f"Mock finding recorded: {finding.title}",
        payload={"finding_id": str(finding.id)},
    )
    record_event(
        event_type="MOCK_RECALL_FINDING_RECORDED",
        actor=user,
        metadata={
            "organization_id": str(organization.id),
            "recall_case_id": str(case.id),
            "finding_id": str(finding.id),
        },
    )
    return finding


@atomic_fn
def link_mock_finding_to_ncr(
    *,
    actor: User | None,
    organization: Organization,
    finding_id: uuid.UUID,
    ncr_code: str,
    ncr_title: str,
    summary: str = "",
) -> MockRecallFinding:
    """Explicit user action: create NCR from mock finding (requires NCR create perm)."""
    user = _require_actor(actor)
    require_permission(user, MANAGE_FINDINGS, scope=_org_scope(organization.id))
    finding = (
        MockRecallFinding.objects.select_related("recall_case")
        .filter(id=finding_id, recall_case__organization_id=organization.id)
        .first()
    )
    if finding is None:
        raise ValidationError({"finding_id": "Mock finding not found."})
    if not finding.recall_case.is_mock:
        raise ValidationError({"finding_id": "Finding is not on a mock exercise."})

    ncr = create_nonconformance(
        actor=user,
        organization=organization,
        code=ncr_code,
        title=ncr_title,
        summary=summary or finding.description or finding.title,
        batch_reference="",
    )
    finding.link_kind = MockFindingLinkKind.NCR
    finding.nonconformance_id = ncr.id
    finding.save(update_fields=["link_kind", "nonconformance_id", "updated_at"])
    _append_timeline(
        case=finding.recall_case,
        actor=user,
        event_type="MOCK_FINDING_LINKED_NCR",
        summary=f"Mock finding linked to NCR {ncr.code} (explicit)",
        payload={
            "finding_id": str(finding.id),
            "nonconformance_id": str(ncr.id),
            "explicit_user_action": True,
        },
    )
    record_event(
        event_type="MOCK_RECALL_FINDING_LINKED_NCR",
        actor=user,
        metadata={
            "organization_id": str(organization.id),
            "recall_case_id": str(finding.recall_case_id),
            "finding_id": str(finding.id),
            "nonconformance_id": str(ncr.id),
            "explicit_user_action": True,
        },
    )
    return finding


@atomic_fn
def link_mock_finding_to_capa(
    *,
    actor: User | None,
    organization: Organization,
    finding_id: uuid.UUID,
    capa_code: str,
    capa_title: str,
    summary: str = "",
    nonconformance_id: uuid.UUID | None = None,
) -> MockRecallFinding:
    """Explicit user action: create CAPA from mock finding."""
    user = _require_actor(actor)
    require_permission(user, MANAGE_FINDINGS, scope=_org_scope(organization.id))
    finding = (
        MockRecallFinding.objects.select_related("recall_case")
        .filter(id=finding_id, recall_case__organization_id=organization.id)
        .first()
    )
    if finding is None:
        raise ValidationError({"finding_id": "Mock finding not found."})
    if not finding.recall_case.is_mock:
        raise ValidationError({"finding_id": "Finding is not on a mock exercise."})

    capa = create_corrective_action(
        actor=user,
        organization=organization,
        code=capa_code,
        title=capa_title,
        summary=summary or finding.description or finding.title,
        nonconformance_id=nonconformance_id or finding.nonconformance_id,
    )
    finding.link_kind = MockFindingLinkKind.CAPA
    finding.capa_id = capa.id
    finding.save(update_fields=["link_kind", "capa_id", "updated_at"])
    _append_timeline(
        case=finding.recall_case,
        actor=user,
        event_type="MOCK_FINDING_LINKED_CAPA",
        summary=f"Mock finding linked to CAPA {capa.code} (explicit)",
        payload={
            "finding_id": str(finding.id),
            "capa_id": str(capa.id),
            "explicit_user_action": True,
        },
    )
    record_event(
        event_type="MOCK_RECALL_FINDING_LINKED_CAPA",
        actor=user,
        metadata={
            "organization_id": str(organization.id),
            "recall_case_id": str(finding.recall_case_id),
            "finding_id": str(finding.id),
            "capa_id": str(capa.id),
            "explicit_user_action": True,
        },
    )
    return finding


@atomic_fn
def create_mock_improvement_action(
    *,
    actor: User | None,
    organization: Organization,
    finding_id: uuid.UUID,
    code: str,
    title: str,
    notes: str = "",
) -> MockImprovementAction:
    """Explicit user action: improvement action from mock finding."""
    user = _require_actor(actor)
    require_permission(user, MANAGE_FINDINGS, scope=_org_scope(organization.id))
    finding = (
        MockRecallFinding.objects.select_related("recall_case")
        .filter(id=finding_id, recall_case__organization_id=organization.id)
        .first()
    )
    if finding is None:
        raise ValidationError({"finding_id": "Mock finding not found."})
    if not finding.recall_case.is_mock:
        raise ValidationError({"finding_id": "Finding is not on a mock exercise."})

    action = MockImprovementAction(
        recall_case=finding.recall_case,
        finding=finding,
        code=(code or "").strip(),
        title=(title or "").strip()[:255],
        notes=(notes or "").strip(),
        created_by=user,
    )
    if not action.code or not action.title:
        raise ValidationError(
            {"code": "Code and title are required.", "title": "Code and title are required."}
        )
    action.full_clean()
    action.save()
    finding.link_kind = MockFindingLinkKind.IMPROVEMENT
    finding.improvement_action_id = action.id
    finding.save(update_fields=["link_kind", "improvement_action_id", "updated_at"])
    _append_timeline(
        case=finding.recall_case,
        actor=user,
        event_type="MOCK_IMPROVEMENT_CREATED",
        summary=f"Mock improvement action {action.code} created (explicit)",
        payload={
            "finding_id": str(finding.id),
            "improvement_action_id": str(action.id),
            "explicit_user_action": True,
        },
    )
    record_event(
        event_type="MOCK_RECALL_IMPROVEMENT_CREATED",
        actor=user,
        metadata={
            "organization_id": str(organization.id),
            "recall_case_id": str(finding.recall_case_id),
            "finding_id": str(finding.id),
            "improvement_action_id": str(action.id),
            "explicit_user_action": True,
        },
    )
    return action
