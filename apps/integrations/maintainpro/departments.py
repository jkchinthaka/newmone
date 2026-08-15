"""Department reference helpers."""

from __future__ import annotations

from apps.integrations.maintainpro.dto import DepartmentRef
from apps.integrations.maintainpro.reference_service import MaintainProReferenceService


def search_departments(
    *,
    tenant_id: str,
    query: str,
    limit: int = 15,
    service: MaintainProReferenceService | None = None,
) -> list[DepartmentRef]:
    svc = service or MaintainProReferenceService()
    return svc.search_departments(tenant_id=tenant_id, query=query, limit=limit)
