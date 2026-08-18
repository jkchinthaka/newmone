"""Central MaintainPro reference service — do not query Mongo from views/forms."""

from __future__ import annotations

import re
from typing import Any

from django.conf import settings

from apps.integrations.maintainpro.client import (
    ASSET_PROJECTION,
    DEPARTMENT_PROJECTION,
    VEHICLE_PROJECTION,
    ReferenceClient,
    as_object_id_filter,
    get_default_client,
)
from apps.integrations.maintainpro.dto import (
    AssetRef,
    DepartmentRef,
    FacilityLocationRef,
    VehicleRef,
)
from apps.integrations.maintainpro.exceptions import (
    CrossTenantReferenceError,
    InvalidAssetReferenceError,
    InvalidDepartmentReferenceError,
    InvalidFacilityReferenceError,
    InvalidVehicleReferenceError,
    ReferenceUnavailableError,
    VehicleNotFoundError,
)

_OBJECT_ID_RE = re.compile(r"^[a-fA-F0-9]{24}$")


def resolve_maintainpro_tenant_id(*, organization: Any | None = None, explicit: str = "") -> str:
    """Derive tenant scope from server state — never trust browser tenantId alone."""
    candidate = (explicit or "").strip()
    if not candidate and organization is not None:
        candidate = str(getattr(organization, "maintainpro_tenant_id", "") or "").strip()
    if not candidate:
        candidate = str(getattr(settings, "MAINTAINPRO_TENANT_ID", "") or "").strip()
    if not candidate:
        raise ReferenceUnavailableError(
            "MaintainPro tenant mapping is not configured for this organization.",
            code="REFERENCE_VERIFICATION_REQUIRED",
        )
    return candidate


def _oid_str(value: Any) -> str:
    return str(value)


class MaintainProReferenceService:
    def __init__(self, client: ReferenceClient | None = None) -> None:
        self._client = client or get_default_client()

    def search_vehicles(
        self,
        *,
        tenant_id: str,
        query: str,
        limit: int = 15,
    ) -> list[VehicleRef]:
        tenant = (tenant_id or "").strip()
        if not tenant:
            raise CrossTenantReferenceError("Tenant scope is required.")
        q = (query or "").strip()
        if len(q) < 1:
            return []
        pattern = {"$regex": re.escape(q), "$options": "i"}
        filter_doc: dict[str, Any] = {
            "tenantId": tenant,
            "$or": [
                {"registrationNo": pattern},
                {"make": pattern},
                {"vehicleModel": pattern},
                {"assetTag": pattern},
            ],
        }
        rows = self._client.find(
            "Vehicle",
            filter_doc,
            projection=VEHICLE_PROJECTION,
            limit=limit,
        )
        return [self._vehicle_from_doc(row, expected_tenant=tenant) for row in rows]

    def get_vehicle(
        self,
        *,
        tenant_id: str,
        vehicle_id: str,
    ) -> VehicleRef:
        tenant = (tenant_id or "").strip()
        vid = (vehicle_id or "").strip()
        if not tenant:
            raise CrossTenantReferenceError("Tenant scope is required.")
        if not vid or not _OBJECT_ID_RE.match(vid):
            raise InvalidVehicleReferenceError(
                "Please select a valid vehicle from MaintainPro.",
            )
        doc = self._client.find_one(
            "Vehicle",
            {"_id": as_object_id_filter(vid), "tenantId": tenant},
            projection=VEHICLE_PROJECTION,
        )
        if doc is None:
            raise VehicleNotFoundError("Please select a valid vehicle from MaintainPro.")
        return self._vehicle_from_doc(doc, expected_tenant=tenant)

    def validate_vehicle_for_write(
        self,
        *,
        tenant_id: str,
        vehicle_id: str,
        require_active: bool = True,
    ) -> VehicleRef:
        vehicle = self.get_vehicle(tenant_id=tenant_id, vehicle_id=vehicle_id)
        if require_active and not vehicle.is_active_for_dispatch:
            raise InvalidVehicleReferenceError(
                "Selected vehicle is not available for this workflow.",
            )
        return vehicle

    def search_assets(
        self,
        *,
        tenant_id: str,
        query: str,
        limit: int = 15,
    ) -> list[AssetRef]:
        tenant = (tenant_id or "").strip()
        if not tenant:
            raise CrossTenantReferenceError("Tenant scope is required.")
        q = (query or "").strip()
        if len(q) < 1:
            return []
        pattern = {"$regex": re.escape(q), "$options": "i"}
        filter_doc: dict[str, Any] = {
            "tenantId": tenant,
            "$or": [
                {"assetTag": pattern},
                {"name": pattern},
                {"manufacturer": pattern},
                {"model": pattern},
                {"location": pattern},
            ],
        }
        rows = self._client.find(
            "Asset",
            filter_doc,
            projection=ASSET_PROJECTION,
            limit=limit,
        )
        return [self._asset_from_doc(row, expected_tenant=tenant) for row in rows]

    def get_asset(self, *, tenant_id: str, asset_id: str) -> AssetRef:
        tenant = (tenant_id or "").strip()
        aid = (asset_id or "").strip()
        if not tenant:
            raise CrossTenantReferenceError("Tenant scope is required.")
        if not aid or not _OBJECT_ID_RE.match(aid):
            raise InvalidAssetReferenceError("Please select a valid asset from MaintainPro.")
        doc = self._client.find_one(
            "Asset",
            {"_id": as_object_id_filter(aid), "tenantId": tenant},
            projection=ASSET_PROJECTION,
        )
        if doc is None:
            raise InvalidAssetReferenceError("Please select a valid asset from MaintainPro.")
        return self._asset_from_doc(doc, expected_tenant=tenant)

    def search_departments(
        self,
        *,
        tenant_id: str,
        query: str,
        limit: int = 15,
    ) -> list[DepartmentRef]:
        tenant = (tenant_id or "").strip()
        if not tenant:
            raise CrossTenantReferenceError("Tenant scope is required.")
        q = (query or "").strip()
        if len(q) < 1:
            return []
        pattern = {"$regex": re.escape(q), "$options": "i"}
        filter_doc: dict[str, Any] = {
            "tenantId": tenant,
            "$or": [{"code": pattern}, {"name": pattern}],
        }
        rows = self._client.find(
            "Department",
            filter_doc,
            projection=DEPARTMENT_PROJECTION,
            limit=limit,
        )
        return [self._department_from_doc(row, expected_tenant=tenant) for row in rows]

    def get_department(self, *, tenant_id: str, department_id: str) -> DepartmentRef:
        tenant = (tenant_id or "").strip()
        did = (department_id or "").strip()
        if not tenant:
            raise CrossTenantReferenceError("Tenant scope is required.")
        if not did or not _OBJECT_ID_RE.match(did):
            raise InvalidDepartmentReferenceError(
                "Please select a valid department from MaintainPro.",
            )
        doc = self._client.find_one(
            "Department",
            {"_id": as_object_id_filter(did), "tenantId": tenant},
            projection=DEPARTMENT_PROJECTION,
        )
        if doc is None:
            raise InvalidDepartmentReferenceError(
                "Please select a valid department from MaintainPro.",
            )
        return self._department_from_doc(doc, expected_tenant=tenant)

    def search_facilities(
        self,
        *,
        tenant_id: str,
        query: str,
        limit: int = 15,
    ) -> list[FacilityLocationRef]:
        """Search distinct Asset.location values — no FG facility master collection."""
        assets = self.search_assets(tenant_id=tenant_id, query=query, limit=limit * 2)
        seen: set[str] = set()
        out: list[FacilityLocationRef] = []
        for asset in assets:
            loc = (asset.location or "").strip()
            if not loc or loc.lower() in seen:
                continue
            if query.strip().lower() not in loc.lower() and query.strip().lower() not in (
                asset.asset_tag or ""
            ).lower():
                # still allow when asset matched by other fields with a location
                if query.strip().lower() not in loc.lower():
                    continue
            seen.add(loc.lower())
            out.append(
                FacilityLocationRef(
                    id=f"loc:{asset.id}",
                    tenant_id=tenant_id,
                    name=loc,
                )
            )
            if len(out) >= limit:
                break
        return out

    def get_facility_location(
        self,
        *,
        tenant_id: str,
        facility_id: str,
    ) -> FacilityLocationRef:
        fid = (facility_id or "").strip()
        if fid.startswith("loc:"):
            asset = self.get_asset(tenant_id=tenant_id, asset_id=fid[4:])
            if not asset.location:
                raise InvalidFacilityReferenceError(
                    "Please select a valid location from MaintainPro.",
                )
            return FacilityLocationRef(
                id=fid,
                tenant_id=tenant_id,
                name=asset.location,
            )
        raise InvalidFacilityReferenceError(
            "Please select a valid location from MaintainPro.",
        )

    def _vehicle_from_doc(self, doc: dict[str, Any], *, expected_tenant: str) -> VehicleRef:
        tenant = str(doc.get("tenantId") or "")
        if tenant != expected_tenant:
            raise CrossTenantReferenceError("Vehicle does not belong to this tenant.")
        decommissioned = doc.get("decommissionedAt")
        return VehicleRef(
            id=_oid_str(doc.get("_id")),
            tenant_id=tenant,
            registration_no=str(doc.get("registrationNo") or ""),
            make=str(doc.get("make") or ""),
            vehicle_model=str(doc.get("vehicleModel") or ""),
            status=str(doc.get("status") or ""),
            asset_tag=str(doc.get("assetTag") or ""),
            decommissioned_at=str(decommissioned) if decommissioned else None,
        )

    def _asset_from_doc(self, doc: dict[str, Any], *, expected_tenant: str) -> AssetRef:
        tenant = str(doc.get("tenantId") or "")
        if tenant != expected_tenant:
            raise CrossTenantReferenceError("Asset does not belong to this tenant.")
        return AssetRef(
            id=_oid_str(doc.get("_id")),
            tenant_id=tenant,
            asset_tag=str(doc.get("assetTag") or ""),
            name=str(doc.get("name") or ""),
            status=str(doc.get("status") or ""),
            location=str(doc.get("location") or ""),
            manufacturer=str(doc.get("manufacturer") or ""),
            model=str(doc.get("model") or ""),
        )

    def _department_from_doc(
        self, doc: dict[str, Any], *, expected_tenant: str
    ) -> DepartmentRef:
        tenant = str(doc.get("tenantId") or "")
        if tenant != expected_tenant:
            raise CrossTenantReferenceError("Department does not belong to this tenant.")
        return DepartmentRef(
            id=_oid_str(doc.get("_id")),
            tenant_id=tenant,
            code=str(doc.get("code") or ""),
            name=str(doc.get("name") or ""),
            is_active=bool(doc.get("isActive", True)),
        )
