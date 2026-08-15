"""Batch genealogy services — Phase 36.

Backward/forward product genealogy from ERP/integration-sourced edges only.
Cycle prevention on ingest. Partner (supplier/customer) fields restricted.
"""

from __future__ import annotations

import time
import uuid
from collections import deque
from dataclasses import dataclass, field
from typing import Any, Literal

from django.core.exceptions import PermissionDenied, ValidationError
from django.db import IntegrityError, transaction

from apps.access_control.services import Scope, require_permission, user_has_permission
from apps.accounts.models import User
from apps.batch_genealogy.models import (
    GenealogyEdge,
    GenealogyNode,
    GenealogyNodeKind,
    GenealogyPolicy,
    GenealogyRelationKind,
)
from apps.batch_genealogy.mongo_graph import (
    InMemoryMongoGraphStore,
    get_default_mongo_graph_store,
    project_edge_to_mongo,
    project_node_to_mongo,
)
from apps.batch_genealogy.policy import (
    evaluate_genealogy_mongo_projection,
    resolve_max_trace_depth,
)
from apps.batch_genealogy.selectors import (
    edges_from_node,
    edges_to_node,
    get_node_by_key,
)
from apps.core.persistence import lock_queryset
from apps.organizations.models import Organization
from apps.security_audit.services import record_event

VIEW = "batch_genealogy.view_batchgenealogy"
INGEST = "batch_genealogy.ingest_batchgenealogy"
VIEW_PARTNER = "batch_genealogy.view_genealogy_partner"
MANAGE_POLICY = "batch_genealogy.manage_batchgenealogypolicy"

TraceDirection = Literal["backward", "forward"]


def _require_actor(actor: User | None) -> User:
    if actor is None or not getattr(actor, "is_authenticated", False) or not actor.is_active:
        raise PermissionDenied("Authentication required.")
    return actor


def _org_scope(organization_id: uuid.UUID) -> Scope:
    return Scope(organization_id=organization_id)


def _can_view_partner(user: User, organization_id: uuid.UUID) -> bool:
    return user_has_permission(user, VIEW_PARTNER, scope=_org_scope(organization_id))


def _serialize_node(node: GenealogyNode, *, include_partner: bool) -> dict[str, Any]:
    payload: dict[str, Any] = {
        "id": str(node.id),
        "kind": node.kind,
        "external_key": node.external_key,
        "display_label": node.display_label,
        "product_reference": node.product_reference,
        "receipt_reference": node.receipt_reference if include_partner else "",
        "partner_fields_redacted": not include_partner,
        "source": "batch_genealogy.GenealogyNode",
        "reference_only": True,
    }
    if include_partner:
        payload["supplier_reference"] = node.supplier_reference
        payload["customer_reference"] = node.customer_reference
        payload["receipt_reference"] = node.receipt_reference
    else:
        payload["supplier_reference"] = ""
        payload["customer_reference"] = ""
    return payload


def _serialize_edge(edge: GenealogyEdge) -> dict[str, Any]:
    return {
        "id": str(edge.id),
        "from_node_id": str(edge.from_node_id),
        "to_node_id": str(edge.to_node_id),
        "relation": edge.relation,
        "is_rework": edge.is_rework,
        "source_system": edge.source_system,
        "source_event_id": edge.source_event_id,
        "quantity_reference": edge.quantity_reference,
        "source": "batch_genealogy.GenealogyEdge",
        "erp_sourced": True,
        "not_invented": True,
    }


@dataclass(frozen=True, slots=True)
class GenealogyTraceResult:
    direction: TraceDirection
    root_node_id: str
    root_external_key: str
    nodes: tuple[dict[str, Any], ...]
    edges: tuple[dict[str, Any], ...]
    depth_reached: int
    max_depth: int
    missing_links: tuple[str, ...]
    truncated: bool
    performance: dict[str, Any] = field(default_factory=dict)
    mongo_projection: dict[str, Any] = field(default_factory=dict)

    def as_dict(self) -> dict[str, Any]:
        return {
            "direction": self.direction,
            "root_node_id": self.root_node_id,
            "root_external_key": self.root_external_key,
            "nodes": list(self.nodes),
            "edges": list(self.edges),
            "depth_reached": self.depth_reached,
            "max_depth": self.max_depth,
            "missing_links": list(self.missing_links),
            "truncated": self.truncated,
            "performance": dict(self.performance),
            "mongo_projection": dict(self.mongo_projection),
            "genealogy_not_invented": True,
            "embedded_graphs_forbidden": True,
            "evidence_gate": "APR-061 / company genealogy / ERP mapping policy",
        }


@transaction.atomic
def upsert_genealogy_policy(
    *,
    actor: User | None,
    organization: Organization,
    mongo_projection_enabled: bool = False,
    max_trace_depth: int = 25,
    procedure_reference: str = "",
    notes: str = "",
) -> GenealogyPolicy:
    user = _require_actor(actor)
    require_permission(user, MANAGE_POLICY, scope=_org_scope(organization.id))
    policy, _ = lock_queryset(GenealogyPolicy.objects.all()).get_or_create(
        organization=organization,
        defaults={
            "mongo_projection_enabled": False,
            "max_trace_depth": 25,
            "procedure_reference": (procedure_reference or "").strip()[:255],
            "notes": (notes or "").strip(),
            "updated_by": user,
        },
    )
    policy.mongo_projection_enabled = bool(mongo_projection_enabled)
    policy.max_trace_depth = max(1, min(int(max_trace_depth), 100))
    policy.procedure_reference = (procedure_reference or "").strip()[:255]
    policy.notes = (notes or "").strip()
    policy.updated_by = user
    policy.save()
    record_event(
        event_type="BATCH_GENEALOGY_POLICY_UPDATED",
        actor=user,
        metadata={
            "organization_id": str(organization.id),
            "mongo_projection_enabled": policy.mongo_projection_enabled,
            "max_trace_depth": policy.max_trace_depth,
        },
    )
    return policy


@transaction.atomic
def upsert_genealogy_node(
    *,
    actor: User | None,
    organization: Organization,
    kind: str,
    external_key: str,
    display_label: str = "",
    supplier_reference: str = "",
    customer_reference: str = "",
    receipt_reference: str = "",
    product_reference: str = "",
    metadata: dict[str, Any] | None = None,
) -> GenealogyNode:
    user = _require_actor(actor)
    require_permission(user, INGEST, scope=_org_scope(organization.id))
    if kind not in GenealogyNodeKind.values:
        raise ValidationError({"kind": "Unknown genealogy node kind."})
    key = (external_key or "").strip()
    if not key:
        raise ValidationError({"external_key": "External key is required."})

    existing = get_node_by_key(organization_id=organization.id, kind=kind, external_key=key)
    if existing is not None:
        existing.display_label = (display_label or existing.display_label or "").strip()[:255]
        existing.supplier_reference = (supplier_reference or existing.supplier_reference).strip()[
            :128
        ]
        existing.customer_reference = (customer_reference or existing.customer_reference).strip()[
            :128
        ]
        existing.receipt_reference = (receipt_reference or existing.receipt_reference).strip()[:128]
        existing.product_reference = (product_reference or existing.product_reference).strip()[:128]
        if metadata:
            existing.metadata = {**(existing.metadata or {}), **metadata}
        existing.full_clean()
        existing.save()
        return existing

    node = GenealogyNode(
        organization=organization,
        kind=kind,
        external_key=key,
        display_label=(display_label or "").strip()[:255],
        supplier_reference=(supplier_reference or "").strip()[:128],
        customer_reference=(customer_reference or "").strip()[:128],
        receipt_reference=(receipt_reference or "").strip()[:128],
        product_reference=(product_reference or "").strip()[:128],
        metadata=dict(metadata or {}),
    )
    node.full_clean()
    node.save()
    return node


def _would_create_cycle(
    *,
    organization_id: uuid.UUID,
    from_node_id: uuid.UUID,
    to_node_id: uuid.UUID,
) -> bool:
    """
    True if adding from→to would create a directed cycle.

    Walk forward from to_node; if from_node is reachable, edge closes a cycle.
    """
    if from_node_id == to_node_id:
        return True
    seen: set[uuid.UUID] = set()
    queue: deque[uuid.UUID] = deque([to_node_id])
    while queue:
        current = queue.popleft()
        if current == from_node_id:
            return True
        if current in seen:
            continue
        seen.add(current)
        for edge in edges_from_node(organization_id=organization_id, node_id=current):
            if edge.to_node_id not in seen:
                queue.append(edge.to_node_id)
    return False


def ingest_erp_genealogy_edge(
    *,
    actor: User | None,
    organization: Organization,
    from_node: GenealogyNode,
    to_node: GenealogyNode,
    relation: str,
    source_system: str,
    source_event_id: str,
    quantity_reference: str = "",
    is_rework: bool = False,
    integration_attempt_id: uuid.UUID | None = None,
    external_batch_event_id: uuid.UUID | None = None,
    metadata: dict[str, Any] | None = None,
    mongo_store: InMemoryMongoGraphStore | None = None,
) -> tuple[GenealogyEdge, bool]:
    """
    Ingest one ERP/integration genealogy edge.

    Returns (edge, created). Idempotent on (org, source_system, source_event_id).
    Rejects cycles. Does not invent genealogy without ERP source ids.
    """
    user = _require_actor(actor)
    require_permission(user, INGEST, scope=_org_scope(organization.id))

    if relation not in GenealogyRelationKind.values:
        raise ValidationError({"relation": "Unknown genealogy relation."})
    src = (source_system or "").strip()
    evt = (source_event_id or "").strip()
    if not src or not evt:
        raise ValidationError(
            {
                "source_system": "ERP source_system and source_event_id are required.",
                "source_event_id": "ERP source_system and source_event_id are required.",
            }
        )
    if from_node.organization_id != organization.id or to_node.organization_id != organization.id:
        raise ValidationError({"organization": "Nodes must belong to the organization."})

    existing = GenealogyEdge.objects.filter(
        organization=organization,
        source_system__iexact=src,
        source_event_id=evt,
    ).first()
    if existing is not None:
        record_event(
            event_type="BATCH_GENEALOGY_EDGE_DUPLICATE",
            actor=user,
            metadata={
                "organization_id": str(organization.id),
                "edge_id": str(existing.id),
                "source_system": src,
                "source_event_id": evt,
            },
        )
        return existing, False

    if _would_create_cycle(
        organization_id=organization.id,
        from_node_id=from_node.id,
        to_node_id=to_node.id,
    ):
        # Record outside the write atomic so the audit survives the ValidationError.
        record_event(
            event_type="BATCH_GENEALOGY_CYCLE_REJECTED",
            actor=user,
            metadata={
                "organization_id": str(organization.id),
                "from_node_id": str(from_node.id),
                "to_node_id": str(to_node.id),
                "source_system": src,
                "source_event_id": evt,
            },
        )
        raise ValidationError({"edge": "Cycle prevention rejected this genealogy edge."})

    with transaction.atomic():
        rework = bool(is_rework) or relation == GenealogyRelationKind.REWORKED_FROM
        edge = GenealogyEdge(
            organization=organization,
            from_node=from_node,
            to_node=to_node,
            relation=relation,
            source_system=src,
            source_event_id=evt,
            integration_attempt_id=integration_attempt_id,
            external_batch_event_id=external_batch_event_id,
            quantity_reference=(quantity_reference or "").strip()[:128],
            is_rework=rework,
            metadata=dict(metadata or {}),
            ingested_by=user,
        )
        try:
            edge.full_clean()
            edge.save()
        except IntegrityError:
            existing = GenealogyEdge.objects.get(
                organization=organization,
                source_system__iexact=src,
                source_event_id=evt,
            )
            return existing, False

        decision = evaluate_genealogy_mongo_projection(organization_id=organization.id)
        store = mongo_store or get_default_mongo_graph_store()
        if decision.allowed:
            include_partner = False
            project_node_to_mongo(
                organization_id=organization.id,
                node_id=from_node.id,
                kind=from_node.kind,
                external_key=from_node.external_key,
                display_label=from_node.display_label,
                product_reference=from_node.product_reference,
                include_partner_fields=include_partner,
                store=store,
            )
            project_node_to_mongo(
                organization_id=organization.id,
                node_id=to_node.id,
                kind=to_node.kind,
                external_key=to_node.external_key,
                display_label=to_node.display_label,
                product_reference=to_node.product_reference,
                include_partner_fields=include_partner,
                store=store,
            )
            project_edge_to_mongo(
                organization_id=organization.id,
                edge_id=edge.id,
                from_node_id=from_node.id,
                to_node_id=to_node.id,
                relation=edge.relation,
                source_system=edge.source_system,
                source_event_id=edge.source_event_id,
                is_rework=edge.is_rework,
                store=store,
            )

        record_event(
            event_type="BATCH_GENEALOGY_EDGE_INGESTED",
            actor=user,
            metadata={
                "organization_id": str(organization.id),
                "edge_id": str(edge.id),
                "from_node_id": str(from_node.id),
                "to_node_id": str(to_node.id),
                "relation": edge.relation,
                "is_rework": edge.is_rework,
                "source_system": src,
                "source_event_id": evt,
                "mongo_projected": decision.allowed,
            },
        )
        return edge, True


def ingest_erp_genealogy_link(
    *,
    actor: User | None,
    organization: Organization,
    from_kind: str,
    from_external_key: str,
    to_kind: str,
    to_external_key: str,
    relation: str,
    source_system: str,
    source_event_id: str,
    from_supplier_reference: str = "",
    to_customer_reference: str = "",
    from_product_reference: str = "",
    to_product_reference: str = "",
    quantity_reference: str = "",
    is_rework: bool = False,
    integration_attempt_id: uuid.UUID | None = None,
    external_batch_event_id: uuid.UUID | None = None,
    metadata: dict[str, Any] | None = None,
    mongo_store: InMemoryMongoGraphStore | None = None,
) -> tuple[GenealogyEdge, bool]:
    """
    ERP adapter convenience: upsert opaque nodes then ingest the edge.

    Does not invent genealogy — requires source_system + source_event_id.
    Not fully atomic across upsert+edge so cycle-rejection audits can commit.
    """
    user = _require_actor(actor)
    require_permission(user, INGEST, scope=_org_scope(organization.id))
    from_node = upsert_genealogy_node(
        actor=user,
        organization=organization,
        kind=from_kind,
        external_key=from_external_key,
        supplier_reference=from_supplier_reference,
        product_reference=from_product_reference,
    )
    to_node = upsert_genealogy_node(
        actor=user,
        organization=organization,
        kind=to_kind,
        external_key=to_external_key,
        customer_reference=to_customer_reference,
        product_reference=to_product_reference,
    )
    return ingest_erp_genealogy_edge(
        actor=user,
        organization=organization,
        from_node=from_node,
        to_node=to_node,
        relation=relation,
        source_system=source_system,
        source_event_id=source_event_id,
        quantity_reference=quantity_reference,
        is_rework=is_rework,
        integration_attempt_id=integration_attempt_id,
        external_batch_event_id=external_batch_event_id,
        metadata=metadata,
        mongo_store=mongo_store,
    )


MAX_TRACE_NODES = 500


def _trace(
    *,
    actor: User,
    organization: Organization,
    root: GenealogyNode,
    direction: TraceDirection,
    max_depth: int | None = None,
) -> GenealogyTraceResult:
    require_permission(actor, VIEW, scope=_org_scope(organization.id))
    include_partner = _can_view_partner(actor, organization.id)
    depth_cap = max_depth or resolve_max_trace_depth(organization_id=organization.id)
    depth_cap = max(1, min(int(depth_cap), 100))

    started = time.perf_counter()
    nodes_out: dict[uuid.UUID, dict[str, Any]] = {
        root.id: _serialize_node(root, include_partner=include_partner)
    }
    edges_out: list[dict[str, Any]] = []
    missing: list[str] = []
    truncated = False
    depth_reached = 0

    # Batched BFS by depth frontier — avoids per-node N+1 queries.
    frontier: set[uuid.UUID] = {root.id}
    visited_nodes: set[uuid.UUID] = {root.id}
    visited_edges: set[uuid.UUID] = set()
    depth = 0

    while frontier and depth < depth_cap:
        if direction == "backward":
            edge_qs = (
                GenealogyEdge.objects.filter(
                    organization_id=organization.id, to_node_id__in=frontier
                )
                .select_related("from_node", "to_node")
                .order_by("created_at")
            )
            next_attr = "from_node"
        else:
            edge_qs = (
                GenealogyEdge.objects.filter(
                    organization_id=organization.id, from_node_id__in=frontier
                )
                .select_related("from_node", "to_node")
                .order_by("created_at")
            )
            next_attr = "to_node"

        edge_list = list(edge_qs)
        if depth == 0 and not edge_list:
            missing.append("no_links_from_root")

        next_frontier: set[uuid.UUID] = set()
        for edge in edge_list:
            if edge.id in visited_edges:
                continue
            visited_edges.add(edge.id)
            edges_out.append(_serialize_edge(edge))
            nxt: GenealogyNode = getattr(edge, next_attr)
            if nxt.id not in nodes_out:
                nodes_out[nxt.id] = _serialize_node(nxt, include_partner=include_partner)
            if nxt.id not in visited_nodes:
                visited_nodes.add(nxt.id)
                next_frontier.add(nxt.id)
            if len(visited_nodes) >= MAX_TRACE_NODES:
                truncated = True
                next_frontier.clear()
                break

        depth += 1
        depth_reached = depth
        frontier = next_frontier
        if truncated:
            break

    if frontier and depth >= depth_cap:
        if direction == "backward":
            more = GenealogyEdge.objects.filter(
                organization_id=organization.id, to_node_id__in=frontier
            ).exists()
        else:
            more = GenealogyEdge.objects.filter(
                organization_id=organization.id, from_node_id__in=frontier
            ).exists()
        if more:
            truncated = True
            missing.append("depth_cap_reached")

    mongo_decision = evaluate_genealogy_mongo_projection(organization_id=organization.id)
    elapsed_ms = int((time.perf_counter() - started) * 1000)

    result = GenealogyTraceResult(
        direction=direction,
        root_node_id=str(root.id),
        root_external_key=root.external_key,
        nodes=tuple(nodes_out.values()),
        edges=tuple(edges_out),
        depth_reached=depth_reached,
        max_depth=depth_cap,
        missing_links=tuple(missing),
        truncated=truncated,
        performance={
            "elapsed_ms": elapsed_ms,
            "node_count": len(nodes_out),
            "edge_count": len(edges_out),
            "n_plus_one_avoided": True,
            "unbounded_retrieval_avoided": True,
            "batched_frontier_bfs": True,
        },
        mongo_projection=mongo_decision.as_dict(),
    )
    record_event(
        event_type=(
            "BATCH_GENEALOGY_BACKWARD_TRACE"
            if direction == "backward"
            else "BATCH_GENEALOGY_FORWARD_TRACE"
        ),
        actor=actor,
        metadata={
            "organization_id": str(organization.id),
            "root_node_id": str(root.id),
            "root_external_key": root.external_key,
            "direction": direction,
            "node_count": len(nodes_out),
            "edge_count": len(edges_out),
            "truncated": truncated,
            "partner_fields_included": include_partner,
        },
    )
    return result


def trace_backward(
    *,
    actor: User | None,
    organization: Organization,
    kind: str,
    external_key: str,
    max_depth: int | None = None,
) -> GenealogyTraceResult:
    """FG/production batch → component/material lots → supplier/receipt refs."""
    user = _require_actor(actor)
    require_permission(user, VIEW, scope=_org_scope(organization.id))
    root = get_node_by_key(organization_id=organization.id, kind=kind, external_key=external_key)
    if root is None:
        raise ValidationError({"external_key": "Genealogy node not found for organization."})
    return _trace(
        actor=user,
        organization=organization,
        root=root,
        direction="backward",
        max_depth=max_depth,
    )


def trace_forward(
    *,
    actor: User | None,
    organization: Organization,
    kind: str,
    external_key: str,
    max_depth: int | None = None,
) -> GenealogyTraceResult:
    """Source material lot → produced batches → shipments/customer destinations."""
    user = _require_actor(actor)
    require_permission(user, VIEW, scope=_org_scope(organization.id))
    root = get_node_by_key(organization_id=organization.id, kind=kind, external_key=external_key)
    if root is None:
        raise ValidationError({"external_key": "Genealogy node not found for organization."})
    return _trace(
        actor=user,
        organization=organization,
        root=root,
        direction="forward",
        max_depth=max_depth,
    )


def project_flat_mongo_documents(
    *,
    actor: User | None,
    organization: Organization,
    kind: str,
    external_key: str,
    store: InMemoryMongoGraphStore | None = None,
) -> dict[str, Any]:
    """
    Build flat Mongo node + adjacent edge documents (no embedded trees).

    Does not require live Mongo — uses optional in-memory store shape.
    """
    user = _require_actor(actor)
    require_permission(user, VIEW, scope=_org_scope(organization.id))
    root = get_node_by_key(organization_id=organization.id, kind=kind, external_key=external_key)
    if root is None:
        raise ValidationError({"external_key": "Genealogy node not found for organization."})
    include_partner = False  # Mongo projection keeps partner fields redacted by default
    node_doc = project_node_to_mongo(
        organization_id=organization.id,
        node_id=root.id,
        kind=root.kind,
        external_key=root.external_key,
        display_label=root.display_label,
        product_reference=root.product_reference,
        include_partner_fields=include_partner,
        store=store,
    )
    edges = list(edges_from_node(organization_id=organization.id, node_id=root.id)) + list(
        edges_to_node(organization_id=organization.id, node_id=root.id)
    )
    edge_docs = [
        project_edge_to_mongo(
            organization_id=organization.id,
            edge_id=e.id,
            from_node_id=e.from_node_id,
            to_node_id=e.to_node_id,
            relation=e.relation,
            source_system=e.source_system,
            source_event_id=e.source_event_id,
            is_rework=e.is_rework,
            store=store,
        )
        for e in edges
    ]
    return {
        "node": node_doc,
        "edges": edge_docs,
        "embedded_graphs_forbidden": True,
        "source_of_truth": "postgresql",
        "projection_only": True,
        "partner_fields_redacted": True,
    }
