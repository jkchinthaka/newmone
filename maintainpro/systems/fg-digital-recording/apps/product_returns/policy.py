"""Dual-gate policy for returned-product ERP stock movement (APR-065)."""

from __future__ import annotations

from dataclasses import dataclass
from uuid import UUID

from django.conf import settings

from apps.product_returns.models import ReturnQualityPolicy


def product_returns_erp_stock_movement_approved() -> bool:
    return bool(getattr(settings, "PRODUCT_RETURNS_ERP_STOCK_MOVEMENT_APPROVED", False))


@dataclass(frozen=True, slots=True)
class ReturnErpStockMovementDecision:
    allowed: bool
    reason_code: str
    procedure_reference: str = ""

    def as_dict(self) -> dict[str, object]:
        return {
            "allowed": self.allowed,
            "reason_code": self.reason_code,
            "procedure_reference": self.procedure_reference,
            "erp_stock_not_moved": True,
            "evidence_gate": "APR-065",
        }


def evaluate_return_erp_stock_movement(*, organization_id: UUID) -> ReturnErpStockMovementDecision:
    policy = ReturnQualityPolicy.objects.filter(organization_id=organization_id).first()
    if policy is None or not policy.erp_stock_movement_enabled:
        return ReturnErpStockMovementDecision(
            allowed=False,
            reason_code="POLICY_DISABLED",
            procedure_reference=policy.procedure_reference if policy else "",
        )
    if not product_returns_erp_stock_movement_approved():
        return ReturnErpStockMovementDecision(
            allowed=False,
            reason_code="SETTINGS_APPROVAL_MISSING",
            procedure_reference=policy.procedure_reference,
        )
    return ReturnErpStockMovementDecision(
        allowed=True,
        reason_code="DUAL_GATE_APPROVED_ADAPTER_REQUIRED",
        procedure_reference=policy.procedure_reference,
    )
