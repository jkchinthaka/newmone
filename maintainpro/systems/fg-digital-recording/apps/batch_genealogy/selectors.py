"""Genealogy read selectors — Phase 36."""

from __future__ import annotations

import uuid

from django.db.models import QuerySet

from apps.batch_genealogy.models import GenealogyEdge, GenealogyNode


def nodes_for_organization(organization_id: uuid.UUID) -> QuerySet[GenealogyNode]:
    return GenealogyNode.objects.filter(organization_id=organization_id)


def get_node_by_key(
    *,
    organization_id: uuid.UUID,
    kind: str,
    external_key: str,
) -> GenealogyNode | None:
    key = (external_key or "").strip()
    if not key:
        return None
    return GenealogyNode.objects.filter(
        organization_id=organization_id,
        kind=kind,
        external_key__iexact=key,
    ).first()


def edges_from_node(*, organization_id: uuid.UUID, node_id: uuid.UUID) -> QuerySet[GenealogyEdge]:
    return (
        GenealogyEdge.objects.filter(organization_id=organization_id, from_node_id=node_id)
        .select_related("from_node", "to_node")
        .order_by("created_at")
    )


def edges_to_node(*, organization_id: uuid.UUID, node_id: uuid.UUID) -> QuerySet[GenealogyEdge]:
    return (
        GenealogyEdge.objects.filter(organization_id=organization_id, to_node_id=node_id)
        .select_related("from_node", "to_node")
        .order_by("created_at")
    )


def edges_for_organization(organization_id: uuid.UUID) -> QuerySet[GenealogyEdge]:
    return GenealogyEdge.objects.filter(organization_id=organization_id).select_related(
        "from_node", "to_node"
    )
