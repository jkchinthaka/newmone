"""Typed DTOs for MaintainPro reference lookups."""

from __future__ import annotations

from dataclasses import dataclass


@dataclass(frozen=True, slots=True)
class VehicleRef:
    id: str
    tenant_id: str
    registration_no: str
    make: str
    vehicle_model: str
    status: str
    asset_tag: str = ""
    decommissioned_at: str | None = None

    @property
    def label(self) -> str:
        bits = [self.registration_no]
        detail = " ".join(x for x in (self.make, self.vehicle_model) if x).strip()
        if detail:
            bits.append(detail)
        return " — ".join(bits)

    @property
    def is_active_for_dispatch(self) -> bool:
        if self.decommissioned_at:
            return False
        return self.status not in {"DECOMMISSIONED", "DISPOSED", "RETIRED"}


@dataclass(frozen=True, slots=True)
class AssetRef:
    id: str
    tenant_id: str
    asset_tag: str
    name: str
    status: str
    location: str = ""
    manufacturer: str = ""
    model: str = ""


@dataclass(frozen=True, slots=True)
class DepartmentRef:
    id: str
    tenant_id: str
    code: str
    name: str
    is_active: bool = True


@dataclass(frozen=True, slots=True)
class FacilityLocationRef:
    """Location-style reference derived from MaintainPro Asset.location values.

    MaintainPro has no separate Facility master collection; FG must not invent one.
    """

    id: str
    tenant_id: str
    name: str
    source: str = "Asset.location"
