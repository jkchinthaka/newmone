"""Server-side vehicle binding for FG write paths."""

from __future__ import annotations

from dataclasses import dataclass
from typing import Any

from django.core.exceptions import ValidationError

from apps.integrations.maintainpro.exceptions import (
    InvalidVehicleReferenceError,
    MaintainProReferenceError,
    ReferenceUnavailableError,
    VehicleNotFoundError,
)
from apps.integrations.maintainpro.reference_service import (
    MaintainProReferenceService,
    resolve_maintainpro_tenant_id,
)

VEHICLE_SELECT_REQUIRED_MESSAGE = "Please select a valid vehicle from MaintainPro."


@dataclass(frozen=True, slots=True)
class VehicleBinding:
    maintainpro_vehicle_id: str
    vehicle_registration_snapshot: str
    vehicle_make_snapshot: str
    vehicle_model_snapshot: str
    vehicle_reference: str
    reference_verification_status: str  # VERIFIED | PENDING | NONE


def bind_vehicle_from_post(
    *,
    organization: Any,
    maintainpro_vehicle_id: str = "",
    typed_vehicle_text: str = "",
    allow_empty: bool = True,
    allow_pending_on_unavailable: bool = False,
    service: MaintainProReferenceService | None = None,
) -> VehicleBinding | None:
    """Resolve MaintainPro vehicle for a form POST.

    - Empty id + empty text → None (when allow_empty)
    - Typed text without id → ValidationError (never free-text-only)
    - Valid id → verified snapshots
    - Lookup unavailable → PENDING only when allow_pending_on_unavailable (drafts)
    """
    vehicle_id = (maintainpro_vehicle_id or "").strip()
    typed = (typed_vehicle_text or "").strip()

    if not vehicle_id and not typed:
        if allow_empty:
            return None
        raise ValidationError({"maintainpro_vehicle_id": VEHICLE_SELECT_REQUIRED_MESSAGE})

    if not vehicle_id and typed:
        raise ValidationError({"maintainpro_vehicle_id": VEHICLE_SELECT_REQUIRED_MESSAGE})

    svc = service or MaintainProReferenceService()
    try:
        tenant_id = resolve_maintainpro_tenant_id(organization=organization)
        vehicle = svc.validate_vehicle_for_write(
            tenant_id=tenant_id,
            vehicle_id=vehicle_id,
            require_active=True,
        )
    except ReferenceUnavailableError:
        if allow_pending_on_unavailable:
            return VehicleBinding(
                maintainpro_vehicle_id=vehicle_id,
                vehicle_registration_snapshot=typed,
                vehicle_make_snapshot="",
                vehicle_model_snapshot="",
                vehicle_reference=typed or vehicle_id,
                reference_verification_status="PENDING",
            )
        raise ValidationError(
            {
                "maintainpro_vehicle_id": (
                    "Vehicle verification is temporarily unavailable. "
                    "Save as draft later, or retry when MaintainPro is reachable."
                )
            }
        ) from None
    except (InvalidVehicleReferenceError, VehicleNotFoundError, MaintainProReferenceError) as exc:
        raise ValidationError({"maintainpro_vehicle_id": str(exc) or VEHICLE_SELECT_REQUIRED_MESSAGE}) from exc

    return VehicleBinding(
        maintainpro_vehicle_id=vehicle.id,
        vehicle_registration_snapshot=vehicle.registration_no,
        vehicle_make_snapshot=vehicle.make,
        vehicle_model_snapshot=vehicle.vehicle_model,
        vehicle_reference=vehicle.registration_no,
        reference_verification_status="VERIFIED",
    )
