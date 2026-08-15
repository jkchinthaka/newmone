"""Challenge result evaluation and device eligibility — Phase 26."""

from __future__ import annotations

from dataclasses import dataclass
from typing import Any
from uuid import UUID

from apps.instruments.models import (
    CalibrationFitness,
    Equipment,
    EquipmentOperationalStatus,
    EquipmentType,
    evaluate_calibration_fitness,
)


@dataclass(frozen=True, slots=True)
class ChallengeDeviceDecision:
    eligible: bool
    reason_code: str
    fitness: str = CalibrationFitness.UNKNOWN
    advisory: str = ""

    def as_dict(self) -> dict[str, Any]:
        return {
            "eligible": self.eligible,
            "reason_code": self.reason_code,
            "fitness": self.fitness,
            "advisory": self.advisory,
            "not_qa_disposition": True,
        }


def evaluate_challenge_result(
    *,
    expected_detected: bool,
    observed_detected: bool | None,
) -> str:
    """PASS when observed matches configured expectation; else FAIL / NOT_EVALUATED."""
    from apps.foreign_body.models import ChallengeTestResult

    if observed_detected is None:
        return ChallengeTestResult.NOT_EVALUATED
    if bool(observed_detected) == bool(expected_detected):
        return ChallengeTestResult.PASS
    return ChallengeTestResult.FAIL


def assess_challenge_device(
    *,
    equipment: Equipment | None,
    organization_id: UUID,
    require_metal_detector_type: bool = True,
) -> ChallengeDeviceDecision:
    """Validate device for challenge recording — no invented calibration limits."""
    if equipment is None:
        return ChallengeDeviceDecision(
            eligible=False,
            reason_code="DEVICE_REQUIRED",
        )
    if equipment.organization_id != organization_id:
        return ChallengeDeviceDecision(
            eligible=False,
            reason_code="WRONG_ORGANIZATION",
        )
    if not equipment.is_active:
        return ChallengeDeviceDecision(
            eligible=False,
            reason_code="DEVICE_INACTIVE",
            fitness=CalibrationFitness.OUT_OF_SERVICE,
        )
    if equipment.operational_status == EquipmentOperationalStatus.OUT_OF_SERVICE:
        return ChallengeDeviceDecision(
            eligible=False,
            reason_code="DEVICE_OUT_OF_SERVICE",
            fitness=CalibrationFitness.OUT_OF_SERVICE,
        )
    if require_metal_detector_type and equipment.equipment_type != EquipmentType.METAL_DETECTOR:
        return ChallengeDeviceDecision(
            eligible=False,
            reason_code="DEVICE_TYPE_INVALID",
            fitness=evaluate_calibration_fitness(equipment),
            advisory=(
                f"Challenge device type must be METAL_DETECTOR; got {equipment.equipment_type}."
            ),
        )
    fitness = evaluate_calibration_fitness(equipment)
    if fitness in {CalibrationFitness.OVERDUE, CalibrationFitness.UNKNOWN}:
        return ChallengeDeviceDecision(
            eligible=True,
            reason_code="CALIBRATION_INVALID_ADVISORY",
            fitness=fitness,
            advisory="Calibration fitness is not VALID — company policy may later block.",
        )
    return ChallengeDeviceDecision(
        eligible=True,
        reason_code="DEVICE_OK",
        fitness=fitness,
    )
