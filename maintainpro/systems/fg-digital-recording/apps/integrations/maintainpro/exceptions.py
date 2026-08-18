"""Safe business exceptions for MaintainPro reference lookups."""

from __future__ import annotations


class MaintainProReferenceError(Exception):
    """Base reference-layer error (never includes credentials)."""

    code = "REFERENCE_ERROR"

    def __init__(self, message: str, *, code: str | None = None) -> None:
        super().__init__(message)
        if code:
            self.code = code


class ReferenceUnavailableError(MaintainProReferenceError):
    code = "REFERENCE_VERIFICATION_REQUIRED"


class InvalidVehicleReferenceError(MaintainProReferenceError):
    code = "INVALID_VEHICLE_REFERENCE"


class VehicleNotFoundError(MaintainProReferenceError):
    code = "VEHICLE_NOT_FOUND"


class CrossTenantReferenceError(MaintainProReferenceError):
    code = "CROSS_TENANT_REFERENCE"


class InvalidAssetReferenceError(MaintainProReferenceError):
    code = "INVALID_ASSET_REFERENCE"


class InvalidDepartmentReferenceError(MaintainProReferenceError):
    code = "INVALID_DEPARTMENT_REFERENCE"


class InvalidFacilityReferenceError(MaintainProReferenceError):
    code = "INVALID_FACILITY_REFERENCE"
