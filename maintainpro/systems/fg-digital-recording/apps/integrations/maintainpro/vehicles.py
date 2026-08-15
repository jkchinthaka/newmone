"""Vehicle reference helpers."""

from __future__ import annotations

from apps.integrations.maintainpro.dto import VehicleRef
from apps.integrations.maintainpro.reference_service import MaintainProReferenceService


def search_vehicles(
    *,
    tenant_id: str,
    query: str,
    limit: int = 15,
    service: MaintainProReferenceService | None = None,
) -> list[VehicleRef]:
    svc = service or MaintainProReferenceService()
    return svc.search_vehicles(tenant_id=tenant_id, query=query, limit=limit)


def get_vehicle(
    *,
    tenant_id: str,
    vehicle_id: str,
    service: MaintainProReferenceService | None = None,
) -> VehicleRef:
    svc = service or MaintainProReferenceService()
    return svc.get_vehicle(tenant_id=tenant_id, vehicle_id=vehicle_id)
