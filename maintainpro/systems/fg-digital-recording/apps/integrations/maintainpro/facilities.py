"""Facility / location reference helpers (Asset.location — no FG facility master)."""

from __future__ import annotations

from apps.integrations.maintainpro.dto import FacilityLocationRef
from apps.integrations.maintainpro.reference_service import MaintainProReferenceService


def search_facilities(
    *,
    tenant_id: str,
    query: str,
    limit: int = 15,
    service: MaintainProReferenceService | None = None,
) -> list[FacilityLocationRef]:
    svc = service or MaintainProReferenceService()
    return svc.search_facilities(tenant_id=tenant_id, query=query, limit=limit)
