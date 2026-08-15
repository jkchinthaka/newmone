"""Measurement device eligibility, calibration policy, and historical snapshots.

Phase 25 — links quality measurements to the exact device and calibration state.
Default enforcement is OFF (do not invent company blocking policy).
Device fitness never implies a QA RELEASE/HOLD/REJECT disposition.
"""

from __future__ import annotations

import uuid
from dataclasses import dataclass
from datetime import date, datetime
from typing import Any

from django.conf import settings
from django.core.exceptions import PermissionDenied, ValidationError
from django.utils import timezone

from apps.access_control.services import Scope, require_permission
from apps.accounts.models import User
from apps.instruments.models import (
    CalibrationFitness,
    CalibrationRecord,
    CalibrationRecordStatus,
    Equipment,
    EquipmentOperationalStatus,
    evaluate_calibration_fitness,
)
from apps.security_audit.services import record_event

OVERRIDE_PERMISSION = "instruments.override_calibration_gate"

ENFORCEMENT_OFF = "OFF"
ENFORCEMENT_WARN = "WARN"
ENFORCEMENT_BLOCK = "BLOCK"
_VALID_ENFORCEMENT = {ENFORCEMENT_OFF, ENFORCEMENT_WARN, ENFORCEMENT_BLOCK}


@dataclass(frozen=True, slots=True)
class DeviceEligibilityDecision:
    eligible: bool
    reason_code: str
    equipment: Equipment | None = None
    calibration_record: CalibrationRecord | None = None
    fitness: str = CalibrationFitness.UNKNOWN
    advisory: str = ""

    def as_dict(self) -> dict[str, Any]:
        return {
            "eligible": self.eligible,
            "reason_code": self.reason_code,
            "equipment_id": str(self.equipment.id) if self.equipment else None,
            "calibration_record_id": (
                str(self.calibration_record.id) if self.calibration_record else None
            ),
            "fitness": self.fitness,
            "advisory": self.advisory,
            "not_qa_disposition": True,
        }


@dataclass(frozen=True, slots=True)
class DevicePolicyDecision:
    allowed: bool
    enforcement: str
    outcome: str  # ALLOW | WARN | BLOCK | OVERRIDE
    reason_code: str
    fitness: str
    override_used: bool = False

    def as_dict(self) -> dict[str, Any]:
        return {
            "allowed": self.allowed,
            "enforcement": self.enforcement,
            "outcome": self.outcome,
            "reason_code": self.reason_code,
            "fitness": self.fitness,
            "override_used": self.override_used,
            "not_qa_disposition": True,
        }


def get_calibration_enforcement() -> str:
    """Company policy switch — default OFF until APR-051 evidence."""
    raw = str(getattr(settings, "INSTRUMENTS_CALIBRATION_ENFORCEMENT", ENFORCEMENT_OFF) or "")
    value = raw.strip().upper() or ENFORCEMENT_OFF
    if value not in _VALID_ENFORCEMENT:
        return ENFORCEMENT_OFF
    return value


def calibration_override_approved() -> bool:
    return bool(getattr(settings, "INSTRUMENTS_CALIBRATION_OVERRIDE_APPROVED", False))


def latest_recorded_calibration(equipment: Equipment) -> CalibrationRecord | None:
    return (
        CalibrationRecord.objects.filter(
            equipment=equipment,
            status=CalibrationRecordStatus.RECORDED,
        )
        .order_by("-calibrated_on", "-created_at")
        .first()
    )


def assess_device_eligibility(
    *,
    equipment: Equipment | None,
    organization_id: uuid.UUID,
    site_id: uuid.UUID | None = None,
    required_equipment_type: str = "",
    require_active: bool = True,
    as_of: date | None = None,
) -> DeviceEligibilityDecision:
    """
    Validate org, optional site, active/in-service, and optional type compatibility.

    Does not invent blocking — callers apply enforcement separately.
    """
    if equipment is None:
        return DeviceEligibilityDecision(
            eligible=False,
            reason_code="EQUIPMENT_REQUIRED",
            fitness=CalibrationFitness.UNKNOWN,
        )
    if equipment.organization_id != organization_id:
        return DeviceEligibilityDecision(
            eligible=False,
            reason_code="WRONG_ORGANIZATION",
            equipment=equipment,
            fitness=CalibrationFitness.UNKNOWN,
        )
    if site_id is not None and equipment.site_id is not None and equipment.site_id != site_id:
        return DeviceEligibilityDecision(
            eligible=False,
            reason_code="WRONG_SITE",
            equipment=equipment,
            fitness=evaluate_calibration_fitness(equipment, as_of=as_of),
        )
    if require_active and not equipment.is_active:
        return DeviceEligibilityDecision(
            eligible=False,
            reason_code="INACTIVE_DEVICE",
            equipment=equipment,
            fitness=CalibrationFitness.OUT_OF_SERVICE,
        )
    if equipment.operational_status == EquipmentOperationalStatus.OUT_OF_SERVICE:
        return DeviceEligibilityDecision(
            eligible=False,
            reason_code="OUT_OF_SERVICE",
            equipment=equipment,
            fitness=CalibrationFitness.OUT_OF_SERVICE,
        )
    required = (required_equipment_type or "").strip().upper()
    if required and equipment.equipment_type != required:
        return DeviceEligibilityDecision(
            eligible=False,
            reason_code="WRONG_EQUIPMENT_TYPE",
            equipment=equipment,
            fitness=evaluate_calibration_fitness(equipment, as_of=as_of),
            advisory=(f"Item requires type {required}; device is {equipment.equipment_type}."),
        )
    record = latest_recorded_calibration(equipment)
    fitness = evaluate_calibration_fitness(equipment, as_of=as_of, latest_record=record)
    return DeviceEligibilityDecision(
        eligible=True,
        reason_code="ELIGIBLE",
        equipment=equipment,
        calibration_record=record,
        fitness=fitness,
    )


def apply_calibration_policy(
    *,
    eligibility: DeviceEligibilityDecision,
    actor: User | None = None,
    organization_id: uuid.UUID | None = None,
    override: bool = False,
    override_reason: str = "",
) -> DevicePolicyDecision:
    """
    Map fitness + eligibility through OFF/WARN/BLOCK.

    BLOCK only applies when settings enable it. Override requires both
    INSTRUMENTS_CALIBRATION_OVERRIDE_APPROVED and scoped permission.
    """
    enforcement = get_calibration_enforcement()
    fitness = eligibility.fitness

    if not eligibility.eligible:
        # Structural eligibility failures always block (wrong org/type/inactive).
        return DevicePolicyDecision(
            allowed=False,
            enforcement=enforcement,
            outcome="BLOCK",
            reason_code=eligibility.reason_code,
            fitness=fitness,
        )

    problematic = fitness in {
        CalibrationFitness.OVERDUE,
        CalibrationFitness.OUT_OF_SERVICE,
        CalibrationFitness.UNKNOWN,
        CalibrationFitness.DUE,
    }
    blockable = fitness in {
        CalibrationFitness.OVERDUE,
        CalibrationFitness.OUT_OF_SERVICE,
        CalibrationFitness.UNKNOWN,
    }

    if enforcement == ENFORCEMENT_OFF or not problematic:
        return DevicePolicyDecision(
            allowed=True,
            enforcement=enforcement,
            outcome="ALLOW",
            reason_code=("POLICY_OFF_OR_FIT" if enforcement == ENFORCEMENT_OFF else "FIT_OK"),
            fitness=fitness,
        )

    if enforcement == ENFORCEMENT_WARN:
        return DevicePolicyDecision(
            allowed=True,
            enforcement=enforcement,
            outcome="WARN",
            reason_code=f"WARN_{fitness}",
            fitness=fitness,
        )

    # BLOCK mode — DUE remains advisory (no invented lead-time hard stop).
    if not blockable:
        return DevicePolicyDecision(
            allowed=True,
            enforcement=enforcement,
            outcome="WARN",
            reason_code="DUE_ADVISORY_UNDER_BLOCK",
            fitness=fitness,
        )

    if override:
        if not calibration_override_approved():
            raise ValidationError(
                {
                    "equipment": (
                        "Calibration override is not approved "
                        "(INSTRUMENTS_CALIBRATION_OVERRIDE_APPROVED=false)."
                    )
                }
            )
        if actor is None or organization_id is None:
            raise PermissionDenied("Override requires an authenticated actor and organization.")
        require_permission(
            actor,
            OVERRIDE_PERMISSION,
            scope=Scope(organization_id=organization_id),
        )
        if not (override_reason or "").strip():
            raise ValidationError({"override_reason": "Override reason is required."})
        record_event(
            event_type="DEVICE_CALIBRATION_OVERRIDE",
            actor=actor,
            metadata={
                "organization_id": str(organization_id),
                "equipment_id": (str(eligibility.equipment.id) if eligibility.equipment else None),
                "fitness": fitness,
                "reason_code": eligibility.reason_code,
                "override_reason": (override_reason or "").strip()[:255],
            },
        )
        return DevicePolicyDecision(
            allowed=True,
            enforcement=enforcement,
            outcome="OVERRIDE",
            reason_code="OVERRIDE_GRANTED",
            fitness=fitness,
            override_used=True,
        )

    return DevicePolicyDecision(
        allowed=False,
        enforcement=enforcement,
        outcome="BLOCK",
        reason_code=f"BLOCK_{fitness}",
        fitness=fitness,
    )


def build_device_trace_snapshot(
    *,
    equipment: Equipment,
    calibration_record: CalibrationRecord | None,
    fitness: str,
    policy: DevicePolicyDecision,
    measurement_at: datetime | None = None,
) -> dict[str, Any]:
    """Frozen device/calibration identity for historical submissions."""
    moment = measurement_at or timezone.now()
    return {
        "equipment_id": str(equipment.id),
        "equipment_code": equipment.code,
        "equipment_name": equipment.name,
        "equipment_type": equipment.equipment_type,
        "equipment_serial_number": equipment.serial_number or "",
        "operational_status": equipment.operational_status,
        "is_active": equipment.is_active,
        "site_id": str(equipment.site_id) if equipment.site_id else None,
        "calibration_record_id": (str(calibration_record.id) if calibration_record else None),
        "calibration_status": calibration_record.status if calibration_record else None,
        "calibrated_on": (
            calibration_record.calibrated_on.isoformat() if calibration_record else None
        ),
        "next_due_on": (
            calibration_record.next_due_on.isoformat()
            if calibration_record and calibration_record.next_due_on
            else None
        ),
        "certificate_reference": (
            (calibration_record.certificate_reference or "") if calibration_record else ""
        ),
        "provider_reference": (
            (calibration_record.provider_reference or "") if calibration_record else ""
        ),
        "fitness_at_measurement": fitness,
        "measurement_recorded_at": moment.isoformat(),
        "policy": policy.as_dict(),
        "not_qa_disposition": True,
        "evidence_gate": "APR-051 / company calibration enforcement policy",
    }


def equipment_choice_label(equipment: Equipment) -> str:
    """Compact operator label: code, name, fitness, optional next-due date."""
    record = latest_recorded_calibration(equipment)
    fitness = evaluate_calibration_fitness(equipment, latest_record=record)
    due = ""
    if record is not None and record.next_due_on is not None:
        due = f"; due {record.next_due_on.isoformat()}"
    return f"{equipment.code} — {equipment.name} [{fitness}{due}]"
