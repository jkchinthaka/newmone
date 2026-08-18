"""Environmental excursion policy — auto-HOLD default OFF (APR-054)."""

from __future__ import annotations

from dataclasses import dataclass
from typing import Any
from uuid import UUID

from django.conf import settings

from apps.environmental.models import (
    EnvironmentalExcursionPolicy,
    MonitoringEvaluationOutcome,
)


@dataclass(frozen=True, slots=True)
class ExcursionHoldDecision:
    create_hold: bool
    reason_code: str
    procedure_reference: str = ""
    advisory_only: bool = True

    def as_dict(self) -> dict[str, Any]:
        return {
            "create_hold": self.create_hold,
            "reason_code": self.reason_code,
            "procedure_reference": self.procedure_reference,
            "advisory_only": self.advisory_only,
            "not_qa_disposition": True,
            "evidence_gate": "APR-054 / company environmental excursion HOLD policy",
        }


def environmental_auto_hold_approved() -> bool:
    return bool(getattr(settings, "ENVIRONMENTAL_AUTO_HOLD_APPROVED", False))


def evaluate_excursion_hold_policy(
    *,
    organization_id: UUID,
    evaluation_outcome: str,
) -> ExcursionHoldDecision:
    """
    Auto-HOLD only when:

    1. outcome is EXCURSION, AND
    2. org EnvironmentalExcursionPolicy.auto_hold_enabled, AND
    3. ENVIRONMENTAL_AUTO_HOLD_APPROVED settings flag.

    Default: advisory only (create_hold=False).
    """
    if evaluation_outcome != MonitoringEvaluationOutcome.EXCURSION:
        return ExcursionHoldDecision(
            create_hold=False,
            reason_code="NOT_EXCURSION",
            advisory_only=True,
        )
    policy = EnvironmentalExcursionPolicy.objects.filter(organization_id=organization_id).first()
    if policy is None or not policy.auto_hold_enabled:
        return ExcursionHoldDecision(
            create_hold=False,
            reason_code="POLICY_DISABLED",
            procedure_reference=(policy.procedure_reference if policy else ""),
            advisory_only=True,
        )
    if not environmental_auto_hold_approved():
        return ExcursionHoldDecision(
            create_hold=False,
            reason_code="SETTINGS_APPROVAL_MISSING",
            procedure_reference=policy.procedure_reference,
            advisory_only=True,
        )
    return ExcursionHoldDecision(
        create_hold=True,
        reason_code="AUTO_HOLD_ENABLED",
        procedure_reference=policy.procedure_reference,
        advisory_only=False,
    )
