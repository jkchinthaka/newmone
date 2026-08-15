"""Phase 38 — Mock recall exercise isolation, metrics, findings, authz."""

from __future__ import annotations

import uuid
from typing import Any

import pytest
from django.contrib.auth.models import Permission
from django.contrib.contenttypes.models import ContentType
from django.core.exceptions import PermissionDenied, ValidationError
from tests.factories import grant_role, make_org, make_role_with_permission, make_user

from apps.accounts.models import User
from apps.batch_genealogy.models import GenealogyNode, GenealogyNodeKind, GenealogyRelationKind
from apps.batch_genealogy.services import ingest_erp_genealogy_link
from apps.capa.models import CorrectiveAction
from apps.nonconformance.models import NonConformanceRecord
from apps.organizations.models import Organization
from apps.recall.mock_services import (
    attempt_mock_side_effects,
    complete_mock_exercise,
    create_mock_finding,
    create_mock_improvement_action,
    create_mock_recall_exercise,
    link_mock_finding_to_capa,
    link_mock_finding_to_ncr,
    mock_blocks_dispatch,
    mock_side_effect_guard,
    run_mock_genealogy_exercise,
    start_mock_exercise,
    update_mock_exercise_metrics,
)
from apps.recall.models import (
    MOCK_RECALL_BANNER,
    MOCK_RECALL_CODE_PREFIX,
    MockCompletenessMark,
    MockExerciseMetrics,
    MockFindingLinkKind,
    MockImprovementAction,
    RecallCase,
    RecallCaseMode,
    RecallCaseStatus,
)
from apps.recall.services import (
    attempt_erp_distribution_pull,
    attempt_external_notification,
    create_recall_case,
    initiate_recall_case,
    serialize_recall_case,
)
from apps.security_audit.models import SecurityAuditEvent


def _perm(model: type[Any], codename: str) -> Permission:
    ct = ContentType.objects.get_for_model(model)
    permission, _ = Permission.objects.get_or_create(
        content_type=ct,
        codename=codename,
        defaults={"name": f"Can {codename.replace('_', ' ')}"},
    )
    return permission


def _mock_user(
    *,
    org: Organization,
    findings: bool = False,
    close: bool = False,
    genealogy: bool = False,
    ncr: bool = False,
    capa: bool = False,
    manage: bool = True,
) -> User:
    suffix = uuid.uuid4().hex[:6].upper()
    user = make_user(employee_code=f"MK{suffix}", is_staff=True)
    role = make_role_with_permission(
        code=f"MK{suffix}",
        name=f"Mock Recall {suffix}",
        permission=_perm(RecallCase, "view_recall"),
    )
    role.permissions.add(_perm(RecallCase, "run_mock_recall"))
    if manage:
        role.permissions.add(_perm(RecallCase, "manage_recallcase"))
    if findings:
        role.permissions.add(_perm(RecallCase, "manage_mock_recall_findings"))
    if close:
        role.permissions.add(_perm(RecallCase, "close_recall"))
    if genealogy:
        role.permissions.add(_perm(GenealogyNode, "view_batchgenealogy"))
        role.permissions.add(_perm(GenealogyNode, "ingest_batchgenealogy"))
    if ncr:
        role.permissions.add(_perm(NonConformanceRecord, "create_nonconformance"))
    if capa:
        role.permissions.add(_perm(CorrectiveAction, "create_capa"))
    grant_role(user, role, organization=org)
    return user


@pytest.mark.django_db
def test_mock_isolation_impossible_to_confuse_with_real() -> None:
    org = make_org(code=f"MO{uuid.uuid4().hex[:4].upper()}")
    actor = _mock_user(org=org, close=True)
    case = create_mock_recall_exercise(
        actor=actor,
        organization=org,
        code="EX-001",
        reason="Preparedness drill",
        scope_notes="FG lot drill scope",
    )
    assert case.is_mock is True
    assert case.mode == RecallCaseMode.MOCK_EXERCISE
    assert case.code.startswith(MOCK_RECALL_CODE_PREFIX)
    assert case.visual_banner == MOCK_RECALL_BANNER
    assert "[MOCK]" in str(case)
    serialized = serialize_recall_case(case)
    assert serialized["is_mock"] is True
    assert serialized["mode"] == RecallCaseMode.MOCK_EXERCISE
    assert serialized["visual_banner"] == MOCK_RECALL_BANNER
    assert serialized["blocks_dispatch"] is False
    assert serialized["erp_stock_changed"] is False

    with pytest.raises(ValidationError):
        create_recall_case(
            actor=actor,
            organization=org,
            code="MOCK-SHOULD-FAIL",
            reason="real attempt with mock prefix",
        )


@pytest.mark.django_db
def test_mock_authorization_run_mock_required() -> None:
    org = make_org(code=f"MA{uuid.uuid4().hex[:4].upper()}")
    outsider = make_user(employee_code=f"OUT{uuid.uuid4().hex[:4].upper()}")
    role = make_role_with_permission(
        code=f"OUT{uuid.uuid4().hex[:4].upper()}",
        name="Viewer only",
        permission=_perm(RecallCase, "view_recall"),
    )
    role.permissions.add(_perm(RecallCase, "manage_recallcase"))
    grant_role(outsider, role, organization=org)
    with pytest.raises(PermissionDenied):
        create_mock_recall_exercise(
            actor=outsider,
            organization=org,
            code="NOPE",
            reason="unauthorized",
        )


@pytest.mark.django_db
def test_mock_exercise_metrics_capture() -> None:
    org = make_org(code=f"MM{uuid.uuid4().hex[:4].upper()}")
    actor = _mock_user(org=org, close=True)
    case = create_mock_recall_exercise(
        actor=actor,
        organization=org,
        code="METRICS",
        reason="metrics drill",
        start=False,
    )
    assert case.status == RecallCaseStatus.DRAFT
    metrics = start_mock_exercise(actor=actor, organization=org, case_id=case.id)
    assert metrics.started_at is not None
    snap = update_mock_exercise_metrics(
        actor=actor,
        organization=org,
        case_id=case.id,
        scope_snapshot="Batch FG-1",
        traceback_completeness=MockCompletenessMark.PARTIAL,
        traceforward_completeness=MockCompletenessMark.COMPLETE,
        quantity_reconciliation_notes="Produced=10 Recovered=8 (opaque)",
        gaps=["Missing warehouse bin ref"],
        actions=["Escalated to QA trainer"],
    )
    assert snap["scope"] == "Batch FG-1"
    assert snap["traceback_completeness"] == MockCompletenessMark.PARTIAL
    assert snap["gaps"] == ["Missing warehouse bin ref"]
    assert snap["actions"] == ["Escalated to QA trainer"]
    assert snap["no_invented_scoring"] is True
    completed = complete_mock_exercise(
        actor=actor, organization=org, case_id=case.id, closure_notes="Drill done"
    )
    assert completed["completed_at"] is not None
    assert completed["blocks_dispatch"] is False
    case.refresh_from_db()
    assert case.status == RecallCaseStatus.CLOSED
    assert MockExerciseMetrics.objects.filter(recall_case=case).exists()


@pytest.mark.django_db
def test_mock_no_erp_side_effect_and_no_dispatch_block() -> None:
    org = make_org(code=f"ME{uuid.uuid4().hex[:4].upper()}")
    actor = _mock_user(org=org)
    case = create_mock_recall_exercise(
        actor=actor, organization=org, code="ERP", reason="isolation"
    )
    guard = mock_side_effect_guard(case=case)
    assert guard["erp_stock_changed"] is False
    assert guard["real_customer_notification_sent"] is False
    assert guard["regulatory_notification_created"] is False
    assert guard["blocks_dispatch"] is False
    assert mock_blocks_dispatch(case=case) is False

    notify = attempt_external_notification(actor=actor, organization=org, case_id=case.id)
    assert notify["allowed"] is False
    assert notify["reason_code"] in {
        "MOCK_CASE_NO_SIDE_EFFECTS",
        "MOCK_SIDE_EFFECT_FORBIDDEN",
    }
    assert notify["message_not_sent"] is True

    erp = attempt_erp_distribution_pull(actor=actor, organization=org, case_id=case.id)
    assert erp["allowed"] is False
    assert erp["live_pull_not_executed"] is True
    assert erp.get("erp_stock_changed") is False

    blocked = attempt_mock_side_effects(actor=actor, organization=org, case_id=case.id)
    assert blocked["erp_stock_change_applied"] is False
    assert blocked["customer_notification_sent"] is False
    assert blocked["regulatory_notification_created"] is False
    assert blocked["dispatch_blocked"] is False
    assert SecurityAuditEvent.objects.filter(event_type="MOCK_RECALL_SIDE_EFFECT_BLOCKED").exists()


@pytest.mark.django_db
def test_mock_genealogy_exercise() -> None:
    org = make_org(code=f"MG{uuid.uuid4().hex[:4].upper()}")
    actor = _mock_user(org=org, genealogy=True)
    ingest_erp_genealogy_link(
        actor=actor,
        organization=org,
        from_kind=GenealogyNodeKind.RAW_MATERIAL_LOT,
        from_external_key="RM-MOCK-1",
        to_kind=GenealogyNodeKind.FG_BATCH,
        to_external_key="FG-MOCK-1",
        relation=GenealogyRelationKind.CONSUMED_INTO,
        source_system="ERP-TEST",
        source_event_id=f"EVT-{uuid.uuid4().hex}",
    )
    case = create_mock_recall_exercise(
        actor=actor, organization=org, code="GEN", reason="genealogy drill"
    )
    result = run_mock_genealogy_exercise(
        actor=actor,
        organization=org,
        case_id=case.id,
        root_kind=GenealogyNodeKind.FG_BATCH,
        root_external_key="FG-MOCK-1",
        directions=("backward", "forward"),
    )
    assert result["is_mock"] is True
    assert "backward" in result["expansions"]
    assert "forward" in result["expansions"]
    metrics = result["metrics"]
    assert metrics["traceback_completeness"] != MockCompletenessMark.NOT_ASSESSED
    assert metrics["traceforward_completeness"] != MockCompletenessMark.NOT_ASSESSED
    case.mock_metrics.refresh_from_db()
    assert case.mock_metrics.traceback_completeness != MockCompletenessMark.NOT_ASSESSED


@pytest.mark.django_db
def test_mock_finding_capa_link_explicit_user_action() -> None:
    org = make_org(code=f"MC{uuid.uuid4().hex[:4].upper()}")
    actor = _mock_user(org=org, findings=True, ncr=True, capa=True)
    case = create_mock_recall_exercise(
        actor=actor, organization=org, code="CAPA", reason="finding drill"
    )
    finding = create_mock_finding(
        actor=actor,
        organization=org,
        case_id=case.id,
        title="Trace gap in warehouse labels",
        description="Operator noted missing bin id",
    )
    assert finding.link_kind == MockFindingLinkKind.NONE

    linked_ncr = link_mock_finding_to_ncr(
        actor=actor,
        organization=org,
        finding_id=finding.id,
        ncr_code=f"NCR-M-{uuid.uuid4().hex[:6].upper()}",
        ncr_title="Mock drill NCR",
    )
    assert linked_ncr.link_kind == MockFindingLinkKind.NCR
    assert linked_ncr.nonconformance_id is not None
    assert NonConformanceRecord.objects.filter(id=linked_ncr.nonconformance_id).exists()

    linked_capa = link_mock_finding_to_capa(
        actor=actor,
        organization=org,
        finding_id=finding.id,
        capa_code=f"CAPA-M-{uuid.uuid4().hex[:6].upper()}",
        capa_title="Mock drill CAPA",
        nonconformance_id=linked_ncr.nonconformance_id,
    )
    assert linked_capa.link_kind == MockFindingLinkKind.CAPA
    assert linked_capa.capa_id is not None
    assert CorrectiveAction.objects.filter(id=linked_capa.capa_id).exists()
    assert SecurityAuditEvent.objects.filter(
        event_type="MOCK_RECALL_FINDING_LINKED_CAPA",
        metadata__explicit_user_action=True,
    ).exists()

    improvement = create_mock_improvement_action(
        actor=actor,
        organization=org,
        finding_id=finding.id,
        code=f"IMP-M-{uuid.uuid4().hex[:6].upper()}",
        title="Label SOP coaching",
    )
    assert isinstance(improvement, MockImprovementAction)
    finding.refresh_from_db()
    assert finding.link_kind == MockFindingLinkKind.IMPROVEMENT


@pytest.mark.django_db
def test_mock_cannot_use_real_initiate() -> None:
    org = make_org(code=f"MI{uuid.uuid4().hex[:4].upper()}")
    mock_actor = _mock_user(org=org)
    case = create_mock_recall_exercise(
        actor=mock_actor,
        organization=org,
        code="INIT",
        reason="no real initiate",
        start=False,
    )
    initiator = make_user(employee_code=f"IN{uuid.uuid4().hex[:4].upper()}")
    role = make_role_with_permission(
        code=f"IN{uuid.uuid4().hex[:4].upper()}",
        name="Real initiator",
        permission=_perm(RecallCase, "initiate_recall"),
    )
    role.permissions.add(_perm(RecallCase, "view_recall"))
    role.permissions.add(_perm(RecallCase, "manage_recallcase"))
    grant_role(initiator, role, organization=org)
    with pytest.raises(ValidationError):
        initiate_recall_case(actor=initiator, organization=org, case_id=case.id)


@pytest.mark.django_db
def test_findings_permission_required() -> None:
    org = make_org(code=f"MF{uuid.uuid4().hex[:4].upper()}")
    actor = _mock_user(org=org, findings=False)
    case = create_mock_recall_exercise(actor=actor, organization=org, code="FIND", reason="authz")
    with pytest.raises(PermissionDenied):
        create_mock_finding(
            actor=actor,
            organization=org,
            case_id=case.id,
            title="Should fail",
        )
