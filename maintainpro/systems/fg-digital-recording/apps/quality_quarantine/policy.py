"""Dual-gate decisions for quality quarantine release and ERP sync."""

from __future__ import annotations

from dataclasses import dataclass
from uuid import UUID

from django.conf import settings

from apps.quality_quarantine.models import QualityQuarantinePolicy


def quality_quarantine_release_approved() -> bool:
    return bool(getattr(settings, "QUALITY_QUARANTINE_RELEASE_APPROVED", False))


def quality_quarantine_erp_sync_approved() -> bool:
    return bool(getattr(settings, "QUALITY_QUARANTINE_ERP_SYNC_APPROVED", False))


@dataclass(frozen=True, slots=True)
class QuarantineGateDecision:
    allowed: bool
    reason_code: str
    procedure_reference: str = ""

    def as_dict(self) -> dict[str, object]:
        return {
            "allowed": self.allowed,
            "reason_code": self.reason_code,
            "procedure_reference": self.procedure_reference,
            "inventory_ledger_unchanged": True,
            "evidence_gate": "APR-066",
        }


def evaluate_quarantine_release(*, organization_id: UUID) -> QuarantineGateDecision:
    policy = QualityQuarantinePolicy.objects.filter(organization_id=organization_id).first()
    procedure_reference = policy.procedure_reference if policy else ""
    if not quality_quarantine_release_approved():
        return QuarantineGateDecision(False, "SETTINGS_APPROVAL_MISSING", procedure_reference)
    return QuarantineGateDecision(True, "SETTINGS_APPROVED", procedure_reference)


def evaluate_quarantine_erp_sync(*, organization_id: UUID) -> QuarantineGateDecision:
    policy = QualityQuarantinePolicy.objects.filter(organization_id=organization_id).first()
    if policy is None or not policy.erp_sync_enabled:
        return QuarantineGateDecision(
            False,
            "POLICY_DISABLED",
            policy.procedure_reference if policy else "",
        )
    if not quality_quarantine_erp_sync_approved():
        return QuarantineGateDecision(
            False, "SETTINGS_APPROVAL_MISSING", policy.procedure_reference
        )
    return QuarantineGateDecision(
        True,
        "DUAL_GATE_APPROVED_ADAPTER_REQUIRED",
        policy.procedure_reference,
    )
