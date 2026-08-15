"""Phase 36 — Batch genealogy traceability tests."""

from __future__ import annotations

import time
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
from apps.batch_genealogy.admin import SoftRetentionAdmin
from apps.batch_genealogy.models import (
    GenealogyEdge,
    GenealogyNode,
    GenealogyNodeKind,
    GenealogyPolicy,
    GenealogyRelationKind,
)
from apps.batch_genealogy.mongo_graph import (
    InMemoryMongoGraphStore,
    MongoEdgeDocument,
    MongoNodeDocument,
    reset_default_mongo_graph_store,
)
from apps.batch_genealogy.policy import (
    batch_genealogy_mongo_projection_approved,
    evaluate_genealogy_mongo_projection,
)
from apps.batch_genealogy.selectors import (
    edges_for_organization,
    edges_from_node,
    edges_to_node,
    get_node_by_key,
    nodes_for_organization,
)
from apps.batch_genealogy.services import (
    ingest_erp_genealogy_link,
    project_flat_mongo_documents,
    trace_backward,
    trace_forward,
    upsert_genealogy_node,
    upsert_genealogy_policy,
)
from apps.organizations.models import Organization
from apps.security_audit.models import SecurityAuditEvent


def _perm(model: type[Any], codename: str) -> Permission:
    ct = ContentType.objects.get_for_model(model)
    permission, _ = Permission.objects.get_or_create(
        content_type=ct,
        codename=codename,
        defaults={"name": f"Can {codename.replace('_', ' ')}"},
    )
    return permission


def _genealogy_user(*, org: Organization, partner: bool = False) -> User:
    suffix = uuid.uuid4().hex[:6].upper()
    user = make_user(employee_code=f"BG{suffix}", is_staff=True)
    role = make_role_with_permission(
        code=f"BG{suffix}",
        name=f"Batch genealogy {suffix}",
        permission=_perm(GenealogyNode, "view_batchgenealogy"),
    )
    role.permissions.add(_perm(GenealogyNode, "ingest_batchgenealogy"))
    role.permissions.add(_perm(GenealogyNode, "manage_batchgenealogypolicy"))
    if partner:
        role.permissions.add(_perm(GenealogyNode, "view_genealogy_partner"))
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
    event: str | None = None,
    is_rework: bool = False,
    from_supplier: str = "",
    to_customer: str = "",
    mongo_store: InMemoryMongoGraphStore | None = None,
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
        source_event_id=event or f"EVT-{uuid.uuid4().hex}",
        is_rework=is_rework,
        from_supplier_reference=from_supplier,
        to_customer_reference=to_customer,
        mongo_store=mongo_store,
    )


@pytest.mark.django_db
def test_backward_forward_multiple_parents_rework_missing_cross_org() -> None:
    org = make_org(code=f"G{uuid.uuid4().hex[:5].upper()}")
    org_b = make_org(code=f"H{uuid.uuid4().hex[:5].upper()}")
    actor = _genealogy_user(org=org, partner=True)
    outsider = _genealogy_user(org=org_b)

    fg = f"FG-{uuid.uuid4().hex[:8].upper()}"
    mat_a = f"MAT-A-{uuid.uuid4().hex[:6].upper()}"
    mat_b = f"MAT-B-{uuid.uuid4().hex[:6].upper()}"
    supplier_lot = f"SUP-{uuid.uuid4().hex[:6].upper()}"
    ship = f"SHIP-{uuid.uuid4().hex[:6].upper()}"
    rework = f"RW-{uuid.uuid4().hex[:6].upper()}"

    # Multiple parents into FG (ERP-sourced)
    _link(
        actor,
        org,
        from_kind=GenealogyNodeKind.RAW_MATERIAL_LOT,
        from_key=mat_a,
        to_kind=GenealogyNodeKind.FG_BATCH,
        to_key=fg,
        from_supplier=supplier_lot,
    )
    _link(
        actor,
        org,
        from_kind=GenealogyNodeKind.SUPPLIER_LOT,
        from_key=supplier_lot,
        to_kind=GenealogyNodeKind.RAW_MATERIAL_LOT,
        to_key=mat_a,
        relation=GenealogyRelationKind.PRODUCED_AS,
    )
    _link(
        actor,
        org,
        from_kind=GenealogyNodeKind.RAW_MATERIAL_LOT,
        from_key=mat_b,
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
        to_customer="CUST-TBC",
    )
    _link(
        actor,
        org,
        from_kind=GenealogyNodeKind.FG_BATCH,
        from_key=fg,
        to_kind=GenealogyNodeKind.REWORK_BATCH,
        to_key=rework,
        relation=GenealogyRelationKind.REWORKED_FROM,
        is_rework=True,
    )

    back = trace_backward(
        actor=actor,
        organization=org,
        kind=GenealogyNodeKind.FG_BATCH,
        external_key=fg,
    )
    assert back.direction == "backward"
    assert back.as_dict()["genealogy_not_invented"] is True
    assert back.as_dict()["embedded_graphs_forbidden"] is True
    from_keys = {e["from_node_id"] for e in back.edges}
    assert len(back.edges) >= 3
    node_keys = {n["external_key"] for n in back.nodes}
    assert mat_a in node_keys and mat_b in node_keys
    assert supplier_lot in node_keys
    assert any(n.get("supplier_reference") == supplier_lot for n in back.nodes)

    fwd = trace_forward(
        actor=actor,
        organization=org,
        kind=GenealogyNodeKind.RAW_MATERIAL_LOT,
        external_key=mat_a,
    )
    assert fwd.direction == "forward"
    fwd_keys = {n["external_key"] for n in fwd.nodes}
    assert fg in fwd_keys

    fwd_fg = trace_forward(
        actor=actor,
        organization=org,
        kind=GenealogyNodeKind.FG_BATCH,
        external_key=fg,
    )
    kinds = {n["kind"] for n in fwd_fg.nodes}
    assert GenealogyNodeKind.SHIPMENT_CUSTOMER in kinds
    assert GenealogyNodeKind.REWORK_BATCH in kinds
    assert any(e["is_rework"] for e in fwd_fg.edges)

    lonely = f"LONELY-{uuid.uuid4().hex[:6].upper()}"
    upsert_genealogy_node(
        actor=actor,
        organization=org,
        kind=GenealogyNodeKind.FG_BATCH,
        external_key=lonely,
    )
    missing = trace_backward(
        actor=actor,
        organization=org,
        kind=GenealogyNodeKind.FG_BATCH,
        external_key=lonely,
    )
    assert "no_links_from_root" in missing.missing_links

    with pytest.raises(PermissionDenied):
        trace_backward(
            actor=outsider,
            organization=org,
            kind=GenealogyNodeKind.FG_BATCH,
            external_key=fg,
        )

    evt = f"DUP-{uuid.uuid4().hex}"
    e1, created1 = _link(
        actor,
        org,
        from_kind=GenealogyNodeKind.PRODUCTION_BATCH,
        from_key=f"PB-{uuid.uuid4().hex[:6]}",
        to_kind=GenealogyNodeKind.SUB_LOT_PALLET,
        to_key=f"PAL-{uuid.uuid4().hex[:6]}",
        relation=GenealogyRelationKind.PACKED_AS,
        event=evt,
    )
    e2, created2 = ingest_erp_genealogy_link(
        actor=actor,
        organization=org,
        from_kind=GenealogyNodeKind.PRODUCTION_BATCH,
        from_external_key=e1.from_node.external_key,
        to_kind=GenealogyNodeKind.SUB_LOT_PALLET,
        to_external_key=e1.to_node.external_key,
        relation=GenealogyRelationKind.PACKED_AS,
        source_system="ERP-TEST",
        source_event_id=evt,
    )
    assert created1 is True
    assert created2 is False
    assert e2.id == e1.id
    assert SecurityAuditEvent.objects.filter(event_type="BATCH_GENEALOGY_EDGE_INGESTED").exists()
    assert from_keys  # used above for coverage of edge payloads


@pytest.mark.django_db(transaction=True)
def test_cycle_prevention_partner_security_mongo_performance() -> None:
    reset_default_mongo_graph_store()
    org = make_org(code=f"C{uuid.uuid4().hex[:5].upper()}")
    actor = _genealogy_user(org=org, partner=False)
    partner_actor = _genealogy_user(org=org, partner=True)
    store = InMemoryMongoGraphStore()

    a = f"A-{uuid.uuid4().hex[:6].upper()}"
    b = f"B-{uuid.uuid4().hex[:6].upper()}"
    c = f"C-{uuid.uuid4().hex[:6].upper()}"

    _link(
        actor,
        org,
        from_kind=GenealogyNodeKind.RAW_MATERIAL_LOT,
        from_key=a,
        to_kind=GenealogyNodeKind.PRODUCTION_BATCH,
        to_key=b,
        from_supplier="SUP-SECRET",
        mongo_store=store,
    )
    _link(
        actor,
        org,
        from_kind=GenealogyNodeKind.PRODUCTION_BATCH,
        from_key=b,
        to_kind=GenealogyNodeKind.FG_BATCH,
        to_key=c,
        mongo_store=store,
    )

    with pytest.raises(ValidationError) as cycle_exc:
        _link(
            actor,
            org,
            from_kind=GenealogyNodeKind.FG_BATCH,
            from_key=c,
            to_kind=GenealogyNodeKind.RAW_MATERIAL_LOT,
            to_key=a,
        )
    assert "Cycle" in str(cycle_exc.value)
    assert SecurityAuditEvent.objects.filter(event_type="BATCH_GENEALOGY_CYCLE_REJECTED").exists()

    back = trace_backward(
        actor=actor,
        organization=org,
        kind=GenealogyNodeKind.FG_BATCH,
        external_key=c,
    )
    for node in back.nodes:
        if node["external_key"] == a:
            assert node.get("supplier_reference") == ""
            assert node.get("partner_fields_redacted") is True

    revealed = trace_backward(
        actor=partner_actor,
        organization=org,
        kind=GenealogyNodeKind.FG_BATCH,
        external_key=c,
    )
    assert any(n.get("supplier_reference") == "SUP-SECRET" for n in revealed.nodes)

    upsert_genealogy_policy(
        actor=partner_actor,
        organization=org,
        mongo_projection_enabled=True,
        procedure_reference="PROC-TBC",
        max_trace_depth=10,
    )
    with override_settings(BATCH_GENEALOGY_MONGO_PROJECTION_APPROVED=False):
        decision = evaluate_genealogy_mongo_projection(organization_id=org.id)
        assert decision.allowed is False
        assert decision.reason_code == "SETTINGS_APPROVAL_MISSING"
    with override_settings(BATCH_GENEALOGY_MONGO_PROJECTION_APPROVED=True):
        decision_on = evaluate_genealogy_mongo_projection(organization_id=org.id)
        assert decision_on.allowed is True
        edge, _ = _link(
            partner_actor,
            org,
            from_kind=GenealogyNodeKind.FG_BATCH,
            from_key=c,
            to_kind=GenealogyNodeKind.SHIPMENT_CUSTOMER,
            to_key=f"SH-{uuid.uuid4().hex[:5]}",
            relation=GenealogyRelationKind.SHIPPED_AS,
            to_customer="CUST-TBC",
            mongo_store=store,
        )
        assert edge.id
        assert store.document_count()["edges"] >= 1

    proj = project_flat_mongo_documents(
        actor=actor,
        organization=org,
        kind=GenealogyNodeKind.PRODUCTION_BATCH,
        external_key=b,
        store=store,
    )
    assert proj["embedded_graphs_forbidden"] is True
    assert proj["source_of_truth"] == "postgresql"
    assert proj["node"]["embedded_graph_forbidden"] is True
    assert "ancestors" not in proj["node"]
    assert "descendants" not in proj["node"]

    root = f"PERF-{uuid.uuid4().hex[:6].upper()}"
    for i in range(30):
        _link(
            actor,
            org,
            from_kind=GenealogyNodeKind.RAW_MATERIAL_LOT,
            from_key=f"M{i}-{uuid.uuid4().hex[:4]}",
            to_kind=GenealogyNodeKind.FG_BATCH,
            to_key=root,
        )
    started = time.perf_counter()
    snap = trace_backward(
        actor=actor,
        organization=org,
        kind=GenealogyNodeKind.FG_BATCH,
        external_key=root,
        max_depth=5,
    )
    elapsed = time.perf_counter() - started
    assert snap.performance["batched_frontier_bfs"] is True
    assert snap.performance["n_plus_one_avoided"] is True
    assert len(snap.edges) >= 30
    assert elapsed < 5.0

    fg_node = get_node_by_key(
        organization_id=org.id, kind=GenealogyNodeKind.FG_BATCH, external_key=root
    )
    assert fg_node is not None
    assert edges_to_node(organization_id=org.id, node_id=fg_node.id).count() >= 30
    prod = get_node_by_key(
        organization_id=org.id, kind=GenealogyNodeKind.PRODUCTION_BATCH, external_key=b
    )
    assert prod is not None
    assert edges_from_node(organization_id=org.id, node_id=prod.id).count() >= 1

    policy = GenealogyPolicy.objects.get(organization=org)
    assert "genealogy policy" in str(policy)
    assert "FG_BATCH" in str(GenealogyNode.objects.get(organization=org, external_key__iexact=c))
    assert SoftRetentionAdmin(GenealogyEdge, admin.site).has_delete_permission(None) is False

    with pytest.raises(ValidationError):
        ingest_erp_genealogy_link(
            actor=actor,
            organization=org,
            from_kind=GenealogyNodeKind.FG_BATCH,
            from_external_key=c,
            to_kind=GenealogyNodeKind.FG_BATCH,
            to_external_key=c,
            relation=GenealogyRelationKind.CONSUMED_INTO,
            source_system="ERP-TEST",
            source_event_id=f"SELF-{uuid.uuid4().hex}",
        )

    with pytest.raises(ValidationError):
        ingest_erp_genealogy_link(
            actor=actor,
            organization=org,
            from_kind=GenealogyNodeKind.FG_BATCH,
            from_external_key=c,
            to_kind=GenealogyNodeKind.RAW_MATERIAL_LOT,
            to_external_key=a,
            relation=GenealogyRelationKind.CONSUMED_INTO,
            source_system="",
            source_event_id="",
        )

    assert nodes_for_organization(org.id).count() >= 3
    assert edges_for_organization(org.id).count() >= 2
    assert get_node_by_key(organization_id=org.id, kind="FG_BATCH", external_key="") is None
    assert batch_genealogy_mongo_projection_approved() is False
    node_doc = MongoNodeDocument(
        organization_id=str(org.id),
        node_id=str(uuid.uuid4()),
        kind=GenealogyNodeKind.FG_BATCH,
        external_key="DOC-1",
    ).as_dict()
    assert node_doc["embedded_graph_forbidden"] is True
    edge_doc = MongoEdgeDocument(
        organization_id=str(org.id),
        edge_id=str(uuid.uuid4()),
        from_node_id=str(uuid.uuid4()),
        to_node_id=str(uuid.uuid4()),
        relation=GenealogyRelationKind.CONSUMED_INTO,
        source_system="ERP-TEST",
        source_event_id="EVT-DOC",
    ).as_dict()
    assert edge_doc["embedded_graph_forbidden"] is True
    store2 = InMemoryMongoGraphStore()
    store2.upsert_node(
        MongoNodeDocument(
            organization_id=str(org.id),
            node_id=str(uuid.uuid4()),
            kind=GenealogyNodeKind.FG_BATCH,
            external_key="DOC-2",
        )
    )
    assert store2.edges_from(organization_id=str(org.id), node_id="x") == []
    assert store2.edges_to(organization_id=str(org.id), node_id="x") == []
    assert SoftRetentionAdmin(GenealogyPolicy, admin.site).has_delete_permission(None) is False
