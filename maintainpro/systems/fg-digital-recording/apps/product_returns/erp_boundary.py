"""Prepare-only ERP boundary for returned-product stock movement."""

from __future__ import annotations

from dataclasses import dataclass

from apps.accounts.models import User
from apps.integrations.errors import IntegrationError, IntegrationErrorClass
from apps.integrations.security import redact_mapping
from apps.product_returns.models import ReturnQualityRecord
from apps.security_audit.services import record_event


@dataclass(frozen=True, slots=True)
class ReturnErpStockMovementCommand:
    organization_id: str
    return_quality_record_id: str
    erp_return_reference: str
    erp_return_line_reference: str
    disposition: str
    correlation_id: str = ""


def prepare_return_erp_stock_movement(
    *, record: ReturnQualityRecord, correlation_id: str = ""
) -> ReturnErpStockMovementCommand:
    return ReturnErpStockMovementCommand(
        organization_id=str(record.organization_id),
        return_quality_record_id=str(record.id),
        erp_return_reference=record.erp_return_reference,
        erp_return_line_reference=record.erp_return_line_reference,
        disposition=record.disposition,
        correlation_id=correlation_id or "",
    )


def send_return_erp_stock_movement(
    *,
    command: ReturnErpStockMovementCommand,
    actor: User | None,
    reason_code: str = "OUTBOUND_NOT_APPROVED",
) -> None:
    """Refuse transmission until approved ERP contract and adapter evidence exist."""
    safe = redact_mapping(
        {
            "organization_id": command.organization_id,
            "return_quality_record_id": command.return_quality_record_id,
            "erp_return_reference": command.erp_return_reference,
            "erp_return_line_reference": command.erp_return_line_reference,
            "disposition": command.disposition,
            "correlation_id": command.correlation_id,
            "reason_code": reason_code,
        }
    )
    record_event(
        event_type="RETURN_ERP_STOCK_MOVEMENT_BLOCKED",
        actor=actor,
        metadata={**safe, "erp_stock_not_moved": True},
    )
    raise IntegrationError(
        "Returned-product ERP stock movement is not approved or has no approved live adapter "
        "(APR-065 EVIDENCE REQUIRED). Command prepared but not transmitted.",
        error_class=IntegrationErrorClass.OUTBOUND_NOT_APPROVED,
        retryable=False,
        correlation_id=command.correlation_id,
        details={key: str(value) for key, value in safe.items()},
    )
