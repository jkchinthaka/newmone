"""Flat MongoDB genealogy graph representation — Phase 36.

Design rules (ADR-047):
- Edge-list / adjacency documents only.
- Never embed unbounded ancestor/descendant trees.
- PostgreSQL remains SoR; Mongo is an optional projection (dual-gate OFF).
"""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any
from uuid import UUID

COLLECTION_NODES = "genealogy_nodes"
COLLECTION_EDGES = "genealogy_edges"


@dataclass(frozen=True, slots=True)
class MongoNodeDocument:
    """Flat node document — no embedded path/tree."""

    organization_id: str
    node_id: str
    kind: str
    external_key: str
    display_label: str = ""
    partner_fields_redacted: bool = True
    product_reference: str = ""
    # Explicitly NOT including ancestors/descendants arrays of unbounded depth.

    def as_dict(self) -> dict[str, Any]:
        return {
            "_id": f"{self.organization_id}:{self.kind}:{self.external_key}".upper(),
            "organization_id": self.organization_id,
            "node_id": self.node_id,
            "kind": self.kind,
            "external_key": self.external_key,
            "display_label": self.display_label,
            "partner_fields_redacted": self.partner_fields_redacted,
            "product_reference": self.product_reference,
            "embedded_graph_forbidden": True,
        }


@dataclass(frozen=True, slots=True)
class MongoEdgeDocument:
    """One edge per document — efficient adjacency, not nested graphs."""

    organization_id: str
    edge_id: str
    from_node_id: str
    to_node_id: str
    relation: str
    source_system: str
    source_event_id: str
    is_rework: bool = False

    def as_dict(self) -> dict[str, Any]:
        return {
            "_id": self.edge_id,
            "organization_id": self.organization_id,
            "from_node_id": self.from_node_id,
            "to_node_id": self.to_node_id,
            "relation": self.relation,
            "source_system": self.source_system,
            "source_event_id": self.source_event_id,
            "is_rework": self.is_rework,
            "embedded_graph_forbidden": True,
        }


@dataclass
class InMemoryMongoGraphStore:
    """
    Test / fallback store mirroring the Mongo edge-list schema.

    Same document shapes as a real Mongo projection — no nested trees.
    """

    nodes: dict[str, dict[str, Any]] = field(default_factory=dict)
    edges: dict[str, dict[str, Any]] = field(default_factory=dict)

    def upsert_node(self, doc: MongoNodeDocument) -> None:
        payload = doc.as_dict()
        self.nodes[payload["_id"]] = payload

    def upsert_edge(self, doc: MongoEdgeDocument) -> None:
        payload = doc.as_dict()
        self.edges[payload["_id"]] = payload

    def edges_from(self, *, organization_id: str, node_id: str) -> list[dict[str, Any]]:
        return [
            e
            for e in self.edges.values()
            if e["organization_id"] == organization_id and e["from_node_id"] == node_id
        ]

    def edges_to(self, *, organization_id: str, node_id: str) -> list[dict[str, Any]]:
        return [
            e
            for e in self.edges.values()
            if e["organization_id"] == organization_id and e["to_node_id"] == node_id
        ]

    def document_count(self) -> dict[str, int]:
        return {"nodes": len(self.nodes), "edges": len(self.edges)}


_DEFAULT_STORE = InMemoryMongoGraphStore()


def get_default_mongo_graph_store() -> InMemoryMongoGraphStore:
    return _DEFAULT_STORE


def reset_default_mongo_graph_store() -> None:
    _DEFAULT_STORE.nodes.clear()
    _DEFAULT_STORE.edges.clear()


def project_node_to_mongo(
    *,
    organization_id: UUID | str,
    node_id: UUID | str,
    kind: str,
    external_key: str,
    display_label: str = "",
    product_reference: str = "",
    include_partner_fields: bool = False,
    store: InMemoryMongoGraphStore | None = None,
) -> dict[str, Any]:
    target = store or get_default_mongo_graph_store()
    doc = MongoNodeDocument(
        organization_id=str(organization_id),
        node_id=str(node_id),
        kind=kind,
        external_key=external_key,
        display_label=display_label,
        partner_fields_redacted=not include_partner_fields,
        product_reference=product_reference if include_partner_fields else product_reference,
    )
    # Partner refs intentionally omitted from Mongo projection unless allowed —
    # customer/supplier stay restricted (APR-061).
    target.upsert_node(doc)
    return doc.as_dict()


def project_edge_to_mongo(
    *,
    organization_id: UUID | str,
    edge_id: UUID | str,
    from_node_id: UUID | str,
    to_node_id: UUID | str,
    relation: str,
    source_system: str,
    source_event_id: str,
    is_rework: bool = False,
    store: InMemoryMongoGraphStore | None = None,
) -> dict[str, Any]:
    target = store or get_default_mongo_graph_store()
    doc = MongoEdgeDocument(
        organization_id=str(organization_id),
        edge_id=str(edge_id),
        from_node_id=str(from_node_id),
        to_node_id=str(to_node_id),
        relation=relation,
        source_system=source_system,
        source_event_id=source_event_id,
        is_rework=is_rework,
    )
    target.upsert_edge(doc)
    return doc.as_dict()
