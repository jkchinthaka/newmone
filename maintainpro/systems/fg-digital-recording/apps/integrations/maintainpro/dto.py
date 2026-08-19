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
    vehicle_type: str = ""
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
        """Selectable for NEW FG records — MaintainPro VehicleStatus, not a fake ACTIVE."""
        selectable, _reason = self.eligibility_for_new_record()
        return selectable

    def eligibility_for_new_record(
        self,
        *,
        allowed_types: frozenset[str] | None = None,
    ) -> tuple[bool, str | None]:
        if self.decommissioned_at:
            return False, "DECOMMISSIONED"
        status = (self.status or "").upper()
        if status in {"DISPOSED", "RETIRED", "DECOMMISSIONED"}:
            return False, "DISPOSED"
        if status == "OUT_OF_SERVICE":
            return False, "OUT_OF_SERVICE"
        if status == "UNDER_MAINTENANCE":
            return False, "UNDER_MAINTENANCE"
        if status and status not in {"AVAILABLE", "IN_USE"}:
            return False, status
        if allowed_types:
            vtype = (self.vehicle_type or "").upper()
            if vtype not in {t.upper() for t in allowed_types}:
                return False, "TYPE_NOT_ALLOWED_FOR_FORM"
        return True, None


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
