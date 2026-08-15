"""Allergen / changeover production-block policy — default OFF (APR-056)."""

from __future__ import annotations

from dataclasses import dataclass
from uuid import UUID

from django.conf import settings

from apps.changeover.models import AllergenRiskPolicy


@dataclass(frozen=True, slots=True)
class AllergenBlockDecision:
    """Deterministic gate result — never invents allergen matrix rules."""

    block_production: bool
    reason_code: str
    procedure_reference: str = ""
    advisory_only: bool = True

    def as_dict(self) -> dict[str, object]:
        return {
            "block_production": self.block_production,
            "reason_code": self.reason_code,
            "procedure_reference": self.procedure_reference,
            "advisory_only": self.advisory_only,
            "not_qa_disposition": True,
            "evidence_gate": "APR-056 / company allergen changeover policy",
        }


def allergen_block_approved() -> bool:
    return bool(getattr(settings, "CHANGEOVER_ALLERGEN_BLOCK_APPROVED", False))


def evaluate_allergen_changeover_block(
    *,
    organization_id: UUID,
    matrix_conflict_asserted: bool,
) -> AllergenBlockDecision:
    """
    Do not automatically block/start production from an allergen matrix unless:

    1. matrix_conflict_asserted is True (caller-supplied — not invented), AND
    2. org AllergenRiskPolicy.policy_enabled is True, AND
    3. CHANGEOVER_ALLERGEN_BLOCK_APPROVED settings flag is True.

    Default path: advisory only (block_production=False) / POLICY_DISABLED.
    """
    if not matrix_conflict_asserted:
        return AllergenBlockDecision(
            block_production=False,
            reason_code="NO_MATRIX_CONFLICT_ASSERTED",
            advisory_only=True,
        )
    policy = AllergenRiskPolicy.objects.filter(organization_id=organization_id).first()
    if policy is None or not policy.policy_enabled:
        return AllergenBlockDecision(
            block_production=False,
            reason_code="POLICY_DISABLED",
            procedure_reference=(policy.procedure_reference if policy else ""),
            advisory_only=True,
        )
    if not allergen_block_approved():
        return AllergenBlockDecision(
            block_production=False,
            reason_code="SETTINGS_APPROVAL_MISSING",
            procedure_reference=policy.procedure_reference,
            advisory_only=True,
        )
    return AllergenBlockDecision(
        block_production=True,
        reason_code="BLOCK_PRODUCTION_ENABLED",
        procedure_reference=policy.procedure_reference,
        # Signal only — wiring to line start remains future integration.
        advisory_only=False,
    )
