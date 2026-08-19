"""Asset reference helpers."""

from __future__ import annotations

from apps.integrations.maintainpro.dto import AssetRef
from apps.integrations.maintainpro.reference_service import MaintainProReferenceService


def search_assets(
    *,
    tenant_id: str,
    query: str,
    limit: int = 15,
    service: MaintainProReferenceService | None = None,
) -> list[AssetRef]:
    svc = service or MaintainProReferenceService()
    return svc.search_assets(tenant_id=tenant_id, query=query, limit=limit)
