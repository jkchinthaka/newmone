"""Phase 37 — Product recall / withdrawal case management tests."""

from __future__ import annotations

import uuid
from typing import Any

import pytest
from django.contrib import admin
from django.contrib.auth.models import Permission
from django.contrib.contenttypes.models import ContentType
from django.core.exceptions import PermissionDenied, ValidationError
from django.test import override_settings
from tests.factories import grant_role, make_org, make_role_with_permission, make_user

from apps.accounts.models import User
from apps.batch_genealogy.models import GenealogyNode, GenealogyNodeKind, GenealogyRelationKind
from apps.batch_genealogy.services import ingest_erp_genealogy_link
from apps.organizations.models import Organization
from apps.recall.admin import SoftRetentionAdmin
from apps.recall.models import (
    RecallAffectedBatch,
    RecallCase,
    RecallCaseStatus,
    RecallPolicy,
)
from apps.recall.policy import (
    evaluate_recall_erp_distribution_pull,
    evaluate_recall_external_notification,
    recall_erp_distribution_pull_approved,
    recall_external_notification_approved,
)
from apps.recall.selectors import (
    batches_for_case,
    get_recall_case,
    get_recall_case_by_code,
    timeline_for_case,
)
from apps.recall.services import (
    add_affected_batch,
    add_affected_product,
    attempt_erp_distribution_pull,
    attempt_external_notification,
    close_recall_case,
    create_recall_case,
    expand_genealogy_for_recall,
    get_recall_timeline,
    initiate_recall_case,
    record_communication_reference,
    serialize_recall_case,
    upsert_quantity_reconciliation,
    upsert_recall_policy,
    user_has_explicit_scoped_permission,
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


def _recall_user(
    *,
    org: Organization,
    initiate: bool = False,
    close: bool = False,
    genealogy: bool = False,
    policy: bool = False,
) -> User:
    suffix = uuid.uuid4().hex[:6].upper()
    user = make_user(employee_code=f"RC{suffix}", is_staff=True)
    role = make_role_with_permission(
        code=f"RC{suffix}",
        name=f"Recall {suffix}",
        permission=_perm(RecallCase, "view_recall"),
    )
    role.permissions.add(_perm(RecallCase, "manage_recallcase"))
    if initiate:
        role.permissions.add(_perm(RecallCase, "initiate_recall"))
    if close:
        role.permissions.add(_perm(RecallCase, "close_recall"))
    if policy:
        role.permissions.add(_perm(RecallCase, "manage_recallpolicy"))
    if genealogy:
        role.permissions.add(_perm(GenealogyNode, "view_batchgenealogy"))
        role.permissions.add(_perm(GenealogyNode, "ingest_batchgenealogy"))
    grant_role(user, role, organization=org)
    return user


def _link(
    actor: User,
    org: Organization,
    *,
    from_kind: str,
    from_key: str,
    to_kind: str,
    to_key: str,
    relation: str = GenealogyRelationKind.CONSUMED_INTO,
) -> Any:
    return ingest_erp_genealogy_link(
        actor=actor,
        organization=org,
        from_kind=from_kind,
        from_external_key=from_key,
        to_kind=to_kind,
        to_external_key=to_key,
        relation=relation,
        source_system="ERP-TEST",
        source_event_id=f"EVT-{uuid.uuid4().hex}",
    )


@pytest.mark.django_db
def test_affected_batch_selection_and_closure() -> None:
    org = make_org(code=f"R{uuid.uuid4().hex[:5].upper()}")
    actor = _recall_user(org=org, initiate=True, close=True)

    case = create_recall_case(
        actor=actor,
        organization=org,
        code=f"RC-{uuid.uuid4().hex[:8].upper()}",
        reason="Suspected quality issue — company procedure reference only",
        case_type_reference="COMPANY-PROC-TBC",
        scope_notes="Scope TBD by owners",
        initiate=True,
    )
    assert case.status == RecallCaseStatus.OPEN
    assert case.initiated_by_id == actor.id
    assert case.initiated_at is not None

    product = add_affected_product(
        actor=actor,
        organization=org,
        case_id=case.id,
        product_reference="PROD-REF-TBC",
    )
    assert product.product_reference == "PROD-REF-TBC"

    batch = add_affected_batch(
        actor=actor,
        organization=org,
        case_id=case.id,
        batch_reference="FG-BATCH-001",
        selected_via="MANUAL",
    )
    assert batch.selected_via == "MANUAL"
    case.refresh_from_db()
    assert case.status == RecallCaseStatus.IN_PROGRESS

    line = upsert_quantity_reconciliation(
        actor=actor,
        organization=org,
        case_id=case.id,
        batch_reference="FG-BATCH-001",
        produced_reference="1000",
        distributed_reference="600",
        remaining_reference="400",
        recovered_reference="50",
        disposed_reference="10",
        reworked_reference="5",
        uom_reference="KG-TBC",
    )
    assert line.produced_reference == "1000"
    assert line.distributed_reference == "600"
    assert line.remaining_reference == "400"
    assert line.recovered_reference == "50"
    assert line.disposed_reference == "10"
    assert line.reworked_reference == "5"
    case.refresh_from_db()
    assert case.status == RecallCaseStatus.RECONCILING

    closed = close_recall_case(
        actor=actor,
        organization=org,
        case_id=case.id,
        closure_notes="Closed pending owner evidence",
    )
    assert closed.status == RecallCaseStatus.CLOSED
    assert closed.closed_by_id == actor.id

    payload = serialize_recall_case(
        get_recall_case(organization_id=org.id, case_id=case.id)  # type: ignore[arg-type]
    )
    assert payload["no_invented_regulatory_class"] is True
    assert len(payload["affected_batches"]) == 1
    assert payload["quantity_lines"][0]["no_invented_variance"] is True

    timeline = get_recall_timeline(actor=actor, organization=org, case_id=case.id)
    assert any(e["event_type"] == "CASE_CLOSED" and e["immutable"] for e in timeline)
    assert SecurityAuditEvent.objects.filter(event_type="RECALL_CASE_CLOSED").exists()


@pytest.mark.django_db
def test_genealogy_expansion_and_missing_erp_links() -> None:
    org = make_org(code=f"G{uuid.uuid4().hex[:5].upper()}")
    actor = _recall_user(org=org, initiate=True, genealogy=True)

    fg = f"FG-{uuid.uuid4().hex[:8].upper()}"
    mat = f"MAT-{uuid.uuid4().hex[:6].upper()}"
    ship = f"SHIP-{uuid.uuid4().hex[:6].upper()}"
    _link(
        actor,
        org,
        from_kind=GenealogyNodeKind.RAW_MATERIAL_LOT,
        from_key=mat,
        to_kind=GenealogyNodeKind.FG_BATCH,
        to_key=fg,
    )
    _link(
        actor,
        org,
        from_kind=GenealogyNodeKind.FG_BATCH,
        from_key=fg,
        to_kind=GenealogyNodeKind.SHIPMENT_CUSTOMER,
        to_key=ship,
        relation=GenealogyRelationKind.SHIPPED_AS,
    )

    case = create_recall_case(
        actor=actor,
        organization=org,
        code=f"RC-{uuid.uuid4().hex[:8].upper()}",
        reason="Trace expansion drill",
        initiate=True,
    )
    add_affected_batch(
        actor=actor,
        organization=org,
        case_id=case.id,
        batch_reference=fg,
        selected_via="MANUAL",
        genealogy_node_kind=GenealogyNodeKind.FG_BATCH,
    )

    result = expand_genealogy_for_recall(
        actor=actor,
        organization=org,
        case_id=case.id,
        root_kind=GenealogyNodeKind.FG_BATCH,
        root_external_key=fg,
        direction="forward",
    )
    assert result["genealogy_not_invented"] is True
    refs = {b.batch_reference for b in batches_for_case(case_id=case.id)}
    assert fg in refs
    assert ship in refs
    expanded = RecallAffectedBatch.objects.get(recall_case_id=case.id, batch_reference=ship)
    assert expanded.selected_via == "GENEALOGY_EXPANSION"

    back = expand_genealogy_for_recall(
        actor=actor,
        organization=org,
        case_id=case.id,
        root_kind=GenealogyNodeKind.FG_BATCH,
        root_external_key=fg,
        direction="backward",
    )
    assert mat in back["added_batch_references"] or mat in {
        b.batch_reference for b in batches_for_case(case_id=case.id)
    }

    blocked = attempt_erp_distribution_pull(actor=actor, organization=org, case_id=case.id)
    assert blocked["allowed"] is False
    assert "ERP_DISTRIBUTION_PULL_GATE" in blocked["missing_erp_links"]
    assert blocked["live_pull_not_executed"] is True

    upsert_recall_policy(
        actor=_recall_user(org=org, policy=True),
        organization=org,
        erp_distribution_pull_enabled=True,
        procedure_reference="PROC-TBC",
    )
    with override_settings(RECALL_ERP_DISTRIBUTION_PULL_APPROVED=True):
        prepared = attempt_erp_distribution_pull(actor=actor, organization=org, case_id=case.id)
    assert prepared["allowed"] is True
    assert "LIVE_ERP_ADAPTER_NOT_APPROVED" in prepared["missing_erp_links"]
    assert ship in prepared["shipment_refs"]


@pytest.mark.django_db
def test_authorization_superuser_and_staff_denied_initiate() -> None:
    org = make_org(code=f"A{uuid.uuid4().hex[:5].upper()}")
    manager = _recall_user(org=org, initiate=False)
    case = create_recall_case(
        actor=manager,
        organization=org,
        code=f"RC-{uuid.uuid4().hex[:8].upper()}",
        reason="Draft only",
        initiate=False,
    )
    assert case.status == RecallCaseStatus.DRAFT

    with pytest.raises(PermissionDenied):
        initiate_recall_case(actor=manager, organization=org, case_id=case.id)

    with pytest.raises(PermissionDenied):
        create_recall_case(
            actor=manager,
            organization=org,
            code=f"RC-{uuid.uuid4().hex[:8].upper()}",
            reason="Should fail initiate",
            initiate=True,
        )

    # System Admin / staff / Django superuser without explicit scoped grant
    staff_admin = make_user(
        employee_code=f"SA{uuid.uuid4().hex[:6].upper()}",
        is_staff=True,
        is_superuser=True,
    )
    assert not user_has_explicit_scoped_permission(
        staff_admin, "recall.initiate_recall", organization_id=org.id
    )
    with pytest.raises(PermissionDenied):
        initiate_recall_case(actor=staff_admin, organization=org, case_id=case.id)

    initiator = _recall_user(org=org, initiate=True)
    opened = initiate_recall_case(actor=initiator, organization=org, case_id=case.id)
    assert opened.status == RecallCaseStatus.OPEN


@pytest.mark.django_db
def test_cross_org_isolation() -> None:
    org_a = make_org(code=f"X{uuid.uuid4().hex[:5].upper()}")
    org_b = make_org(code=f"Y{uuid.uuid4().hex[:5].upper()}")
    actor_a = _recall_user(org=org_a, initiate=True, close=True)
    actor_b = _recall_user(org=org_b, initiate=True)

    case = create_recall_case(
        actor=actor_a,
        organization=org_a,
        code=f"RC-{uuid.uuid4().hex[:8].upper()}",
        reason="Org A case",
        initiate=True,
    )
    assert get_recall_case(organization_id=org_b.id, case_id=case.id) is None

    with pytest.raises(ValidationError):
        add_affected_batch(
            actor=actor_b,
            organization=org_b,
            case_id=case.id,
            batch_reference="LEAK",
        )

    with pytest.raises(PermissionDenied):
        add_affected_batch(
            actor=actor_b,
            organization=org_a,
            case_id=case.id,
            batch_reference="LEAK",
        )


@pytest.mark.django_db
def test_quantity_reconciliation_and_communication_no_auto_send() -> None:
    org = make_org(code=f"Q{uuid.uuid4().hex[:5].upper()}")
    actor = _recall_user(org=org, initiate=True, policy=True)

    case = create_recall_case(
        actor=actor,
        organization=org,
        code=f"RC-{uuid.uuid4().hex[:8].upper()}",
        reason="Qty + comms",
        initiate=True,
    )
    add_affected_batch(
        actor=actor,
        organization=org,
        case_id=case.id,
        batch_reference="BATCH-Q1",
    )
    with pytest.raises(ValidationError):
        upsert_quantity_reconciliation(
            actor=actor,
            organization=org,
            case_id=case.id,
            batch_reference="MISSING",
        )

    upsert_quantity_reconciliation(
        actor=actor,
        organization=org,
        case_id=case.id,
        batch_reference="BATCH-Q1",
        produced_reference="ERP-PROD-10",
        distributed_reference="ERP-DIST-7",
        remaining_reference="ERP-REM-3",
        recovered_reference="",
        disposed_reference="",
        reworked_reference="",
    )

    comm = record_communication_reference(
        actor=actor,
        organization=org,
        case_id=case.id,
        reference="COMM-REF-001",
        channel_reference="EMAIL-LOG-TBC",
        audience_reference="INTERNAL-ONLY",
    )
    assert comm.reference == "COMM-REF-001"

    blocked = attempt_external_notification(actor=actor, organization=org, case_id=case.id)
    assert blocked["allowed"] is False
    assert blocked["message_not_sent"] is True
    assert blocked["no_auto_authority_contact"] is True

    upsert_recall_policy(
        actor=actor,
        organization=org,
        external_notification_enabled=True,
        procedure_reference="NOTIFY-PROC-TBC",
    )
    assert recall_external_notification_approved() is False
    decision = evaluate_recall_external_notification(organization_id=org.id)
    assert decision.allowed is False
    assert decision.reason_code == "SETTINGS_APPROVAL_MISSING"

    with override_settings(RECALL_EXTERNAL_NOTIFICATION_APPROVED=True):
        prepared = attempt_external_notification(actor=actor, organization=org, case_id=case.id)
    assert prepared["allowed"] is True
    assert prepared["message_not_sent"] is True

    assert recall_erp_distribution_pull_approved() is False
    erp_decision = evaluate_recall_erp_distribution_pull(organization_id=org.id)
    assert erp_decision.allowed is False


@pytest.mark.django_db
def test_selectors_admin_and_invalid_direction() -> None:
    org = make_org(code=f"S{uuid.uuid4().hex[:5].upper()}")
    actor = _recall_user(org=org, initiate=True, genealogy=True, close=True)
    code = f"RC-{uuid.uuid4().hex[:8].upper()}"
    case = create_recall_case(
        actor=actor,
        organization=org,
        code=code,
        reason="selectors",
        initiate=True,
    )
    assert get_recall_case_by_code(organization_id=org.id, code=code) is not None
    assert get_recall_case_by_code(organization_id=org.id, code="") is None
    assert list(timeline_for_case(case_id=case.id))

    with pytest.raises(ValidationError):
        expand_genealogy_for_recall(
            actor=actor,
            organization=org,
            case_id=case.id,
            root_kind=GenealogyNodeKind.FG_BATCH,
            root_external_key="NOPE",
            direction="sideways",
        )

    assert isinstance(admin.site._registry[RecallCase], SoftRetentionAdmin)
    assert not admin.site._registry[RecallPolicy].has_delete_permission(
        request=type("R", (), {"user": actor})()
    )

    draft = create_recall_case(
        actor=actor,
        organization=org,
        code=f"RC-{uuid.uuid4().hex[:8].upper()}",
        reason="draft close",
        initiate=False,
    )
    with pytest.raises(ValidationError):
        close_recall_case(actor=actor, organization=org, case_id=draft.id)

    closed = close_recall_case(actor=actor, organization=org, case_id=case.id)
    assert closed.status == RecallCaseStatus.CLOSED
    assert (
        close_recall_case(actor=actor, organization=org, case_id=case.id).status
        == RecallCaseStatus.CLOSED
    )
