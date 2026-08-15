"""Phase 37 — Product recall / withdrawal management tests."""

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
from apps.batch_genealogy.models import GenealogyNodeKind, GenealogyRelationKind
from apps.batch_genealogy.services import ingest_erp_genealogy_link
from apps.organizations.models import Organization
from apps.recall.admin import SoftRetentionAdmin
from apps.recall.models import RecallCase, RecallCaseStatus, RecallPolicy
from apps.recall.policy import (
    evaluate_recall_erp_distribution_pull,
    evaluate_recall_external_notification,
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
    initiate: bool = True,
    close: bool = True,
    genealogy: bool = True,
) -> User:
    suffix = uuid.uuid4().hex[:6].upper()
    user = make_user(employee_code=f"RC{suffix}", is_staff=True)
    role = make_role_with_permission(
        code=f"RC{suffix}",
        name=f"Recall {suffix}",
        permission=_perm(RecallCase, "view_recall"),
    )
    role.permissions.add(_perm(RecallCase, "manage_recallcase"))
    role.permissions.add(_perm(RecallCase, "manage_recallpolicy"))
    if initiate:
        role.permissions.add(_perm(RecallCase, "initiate_recall"))
    if close:
        role.permissions.add(_perm(RecallCase, "close_recall"))
    if genealogy:
        from apps.batch_genealogy.models import GenealogyNode

        role.permissions.add(_perm(GenealogyNode, "view_batchgenealogy"))
        role.permissions.add(_perm(GenealogyNode, "ingest_batchgenealogy"))
    grant_role(user, role, organization=org)
    return user


def _seed_genealogy(actor: User, org: Organization, *, fg: str, mat: str, ship: str) -> Any:
    ingest_erp_genealogy_link(
        actor=actor,
        organization=org,
        from_kind=GenealogyNodeKind.RAW_MATERIAL_LOT,
        from_external_key=mat,
        to_kind=GenealogyNodeKind.FG_BATCH,
        to_external_key=fg,
        relation=GenealogyRelationKind.CONSUMED_INTO,
        source_system="ERP-TEST",
        source_event_id=f"EVT-{uuid.uuid4().hex}",
    )
    ingest_erp_genealogy_link(
        actor=actor,
        organization=org,
        from_kind=GenealogyNodeKind.FG_BATCH,
        from_external_key=fg,
        to_kind=GenealogyNodeKind.SHIPMENT_CUSTOMER,
        to_external_key=ship,
        relation=GenealogyRelationKind.SHIPPED_AS,
        source_system="ERP-TEST",
        source_event_id=f"EVT-{uuid.uuid4().hex}",
        to_customer_reference="CUST-TBC",
    )


@pytest.mark.django_db
def test_batch_selection_genealogy_qty_auth_cross_org_closure_missing_erp() -> None:
    org = make_org(code=f"R{uuid.uuid4().hex[:5].upper()}")
    org_b = make_org(code=f"S{uuid.uuid4().hex[:5].upper()}")
    actor = _recall_user(org=org)
    outsider = _recall_user(org=org_b)
    staff_only = make_user(employee_code=f"ST{uuid.uuid4().hex[:6].upper()}", is_staff=True)
    # Staff System-Admin-like user without initiate_recall
    adminish = make_user(
        employee_code=f"AD{uuid.uuid4().hex[:6].upper()}",
        is_staff=True,
        is_superuser=True,
    )

    fg = f"FG-{uuid.uuid4().hex[:8].upper()}"
    mat = f"MAT-{uuid.uuid4().hex[:6].upper()}"
    ship = f"SHIP-{uuid.uuid4().hex[:6].upper()}"
    _seed_genealogy(actor, org, fg=fg, mat=mat, ship=ship)

    case = create_recall_case(
        actor=actor,
        organization=org,
        code=f"RC-{uuid.uuid4().hex[:6].upper()}",
        reason="Synthetic quality concern — procedure TBC",
        case_type_reference="PROC-WITHDRAWAL-TBC",
        initiate=True,
    )
    assert case.status == RecallCaseStatus.OPEN
    assert case.initiated_by_id == actor.id
    assert case.initiated_at is not None

    add_affected_product(
        actor=actor,
        organization=org,
        case_id=case.id,
        product_reference=f"PRD-{uuid.uuid4().hex[:5].upper()}",
    )
    add_affected_batch(
        actor=actor,
        organization=org,
        case_id=case.id,
        batch_reference=fg,
        selected_via="MANUAL",
    )

    expansion = expand_genealogy_for_recall(
        actor=actor,
        organization=org,
        case_id=case.id,
        root_kind=GenealogyNodeKind.FG_BATCH,
        root_external_key=fg,
        direction="forward",
    )
    assert expansion["genealogy_not_invented"] is True
    assert ship in expansion["added_batch_references"] or ship in {
        b.batch_reference for b in case.affected_batches.all()
    }
    case.refresh_from_db()
    batch_refs = {b.batch_reference for b in case.affected_batches.all()}
    assert fg in batch_refs
    assert ship in batch_refs

    qty = upsert_quantity_reconciliation(
        actor=actor,
        organization=org,
        case_id=case.id,
        batch_reference=fg,
        produced_reference="1000",
        distributed_reference="700",
        remaining_reference="200",
        recovered_reference="50",
        disposed_reference="30",
        reworked_reference="20",
        uom_reference="KG-TBC",
        erp_source_system="ERP-TEST",
        erp_source_event_id=f"QTY-{uuid.uuid4().hex[:8]}",
    )
    assert qty.produced_reference == "1000"
    case.refresh_from_db()
    assert case.status == RecallCaseStatus.RECONCILING

    record_communication_reference(
        actor=actor,
        organization=org,
        case_id=case.id,
        reference=f"COM-{uuid.uuid4().hex[:6].upper()}",
        channel_reference="EMAIL-LOG-TBC",
        audience_reference="INTERNAL-QA-TBC",
    )

    blocked = attempt_external_notification(actor=actor, organization=org, case_id=case.id)
    assert blocked["allowed"] is False
    assert blocked["message_not_sent"] is True

    erp = attempt_erp_distribution_pull(actor=actor, organization=org, case_id=case.id)
    assert erp["allowed"] is False
    assert "ERP_DISTRIBUTION_PULL_GATE" in erp["missing_erp_links"]
    assert erp["live_pull_not_executed"] is True

    # Authorization: staff without explicit initiate cannot initiate
    draft = create_recall_case(
        actor=actor,
        organization=org,
        code=f"RD-{uuid.uuid4().hex[:6].upper()}",
        reason="Draft only",
        initiate=False,
    )
    with pytest.raises(PermissionDenied):
        initiate_recall_case(actor=staff_only, organization=org, case_id=draft.id)
    # Superuser without scoped initiate_recall also denied (high-risk)
    assert not user_has_explicit_scoped_permission(
        adminish, "recall.initiate_recall", organization_id=org.id
    )
    with pytest.raises(PermissionDenied):
        initiate_recall_case(actor=adminish, organization=org, case_id=draft.id)

    # Cross-org
    with pytest.raises(PermissionDenied):
        add_affected_batch(
            actor=outsider,
            organization=org,
            case_id=case.id,
            batch_reference=f"X-{uuid.uuid4().hex[:4]}",
        )

    closed = close_recall_case(
        actor=actor,
        organization=org,
        case_id=case.id,
        closure_notes="Synthetic closure — evidence TBC",
    )
    assert closed.status == RecallCaseStatus.CLOSED
    assert closed.closed_by_id == actor.id

    timeline = get_recall_timeline(actor=actor, organization=org, case_id=case.id)
    assert len(timeline) >= 4
    assert all(row["immutable"] is True for row in timeline)

    payload = serialize_recall_case(RecallCase.objects.get(pk=case.id))
    assert payload["no_invented_regulatory_class"] is True
    assert any(q["no_invented_variance"] for q in payload["quantity_lines"])

    assert SecurityAuditEvent.objects.filter(event_type="RECALL_CASE_INITIATED").exists()
    assert SecurityAuditEvent.objects.filter(event_type="RECALL_GENEALOGY_EXPANDED").exists()
    assert SoftRetentionAdmin(RecallCase, admin.site).has_delete_permission(None) is False


@pytest.mark.django_db
def test_policy_gates_and_helpers() -> None:
    org = make_org(code=f"P{uuid.uuid4().hex[:5].upper()}")
    actor = _recall_user(org=org)

    upsert_recall_policy(
        actor=actor,
        organization=org,
        external_notification_enabled=True,
        erp_distribution_pull_enabled=True,
        procedure_reference="PROC-RECALL-TBC",
    )
    with override_settings(
        RECALL_EXTERNAL_NOTIFICATION_APPROVED=False,
        RECALL_ERP_DISTRIBUTION_PULL_APPROVED=False,
    ):
        assert evaluate_recall_external_notification(organization_id=org.id).allowed is False
        assert (
            evaluate_recall_erp_distribution_pull(organization_id=org.id).reason_code
            == "SETTINGS_APPROVAL_MISSING"
        )
    with override_settings(
        RECALL_EXTERNAL_NOTIFICATION_APPROVED=True,
        RECALL_ERP_DISTRIBUTION_PULL_APPROVED=True,
    ):
        assert evaluate_recall_external_notification(organization_id=org.id).allowed is True
        case = create_recall_case(
            actor=actor,
            organization=org,
            code=f"RP-{uuid.uuid4().hex[:6].upper()}",
            reason="Gate probe",
            initiate=True,
        )
        add_affected_batch(
            actor=actor,
            organization=org,
            case_id=case.id,
            batch_reference=f"FG-{uuid.uuid4().hex[:6]}",
        )
        prepared = attempt_external_notification(actor=actor, organization=org, case_id=case.id)
        assert prepared["allowed"] is True
        assert prepared["message_not_sent"] is True
        erp = attempt_erp_distribution_pull(actor=actor, organization=org, case_id=case.id)
        assert erp["allowed"] is True
        assert "LIVE_ERP_ADAPTER_NOT_APPROVED" in erp["missing_erp_links"]
        assert "NO_ERP_SHIPMENT_CUSTOMER_LINKS" in erp["missing_erp_links"]

    policy = RecallPolicy.objects.get(organization=org)
    assert "recall policy" in str(policy)
    assert "OPEN" in str(case) or case.status == RecallCaseStatus.IN_PROGRESS

    with pytest.raises(ValidationError):
        create_recall_case(
            actor=actor,
            organization=org,
            code="  ",
            reason="x",
        )
    with pytest.raises(ValidationError):
        expand_genealogy_for_recall(
            actor=actor,
            organization=org,
            case_id=case.id,
            root_kind=GenealogyNodeKind.FG_BATCH,
            root_external_key="MISSING-BATCH",
            direction="sideways",
        )
