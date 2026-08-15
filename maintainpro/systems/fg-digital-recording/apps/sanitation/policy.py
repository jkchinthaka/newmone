"""Sanitation FAIL policy — production stop remains OFF by default (APR-053)."""

from __future__ import annotations

from dataclasses import dataclass
from uuid import UUID

from django.conf import settings

from apps.sanitation.models import SanitationFailPolicy


@dataclass(frozen=True, slots=True)
class SanitationFailDecision:
    """Advisory/deterministic gate result — never invents company SOP steps."""

    stop_production: bool
    reason_code: str
    procedure_reference: str = ""
    advisory_only: bool = True

    def as_dict(self) -> dict[str, object]:
        return {
            "stop_production": self.stop_production,
            "reason_code": self.reason_code,
            "procedure_reference": self.procedure_reference,
            "advisory_only": self.advisory_only,
            "not_qa_disposition": True,
        }


def sanitation_fail_stop_approved() -> bool:
    return bool(getattr(settings, "SANITATION_FAIL_STOP_PRODUCTION_APPROVED", False))


def evaluate_sanitation_fail_policy(
    *,
    organization_id: UUID,
    checklist_evaluation_failed: bool,
) -> SanitationFailDecision:
    """
    FAIL on a sanitation checklist does not stop production unless:

    1. checklist_evaluation_failed is True, AND
    2. org SanitationFailPolicy.policy_enabled is True, AND
    3. SANITATION_FAIL_STOP_PRODUCTION_APPROVED settings flag is True.

    Default path: advisory only (stop_production=False).
    """
    if not checklist_evaluation_failed:
        return SanitationFailDecision(
            stop_production=False,
            reason_code="NO_FAIL",
            advisory_only=True,
        )
    policy = SanitationFailPolicy.objects.filter(organization_id=organization_id).first()
    if policy is None or not policy.policy_enabled:
        return SanitationFailDecision(
            stop_production=False,
            reason_code="POLICY_DISABLED",
            procedure_reference=(policy.procedure_reference if policy else ""),
            advisory_only=True,
        )
    if not sanitation_fail_stop_approved():
        return SanitationFailDecision(
            stop_production=False,
            reason_code="SETTINGS_APPROVAL_MISSING",
            procedure_reference=policy.procedure_reference,
            advisory_only=True,
        )
    return SanitationFailDecision(
        stop_production=True,
        reason_code="STOP_PRODUCTION_ENABLED",
        procedure_reference=policy.procedure_reference,
        # Even when enabled, this only signals the gate — wiring to line stop
        # remains a future integration with approved SOP (not invented here).
        advisory_only=False,
    )
