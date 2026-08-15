"""ERP outbound boundary for receipt quality — prepare only; never update ERP stock."""

from __future__ import annotations

from dataclasses import dataclass

from apps.integrations.errors import IntegrationError, IntegrationErrorClass
from apps.integrations.security import redact_mapping
from apps.receiving.models import ReceiptQualityRecord


@dataclass(frozen=True, slots=True)
class OutboundReceiptQualityCommand:
    organization_id: str
    receipt_quality_id: str
    erp_receipt_reference: str
    quality_state: str
    correlation_id: str = ""


def prepare_receipt_quality_outbound(
    *,
    receipt: ReceiptQualityRecord,
    correlation_id: str = "",
) -> OutboundReceiptQualityCommand:
    """Build a command shell for future ERP adapters (APR-011/017 gated)."""
    return OutboundReceiptQualityCommand(
        organization_id=str(receipt.organization_id),
        receipt_quality_id=str(receipt.id),
        erp_receipt_reference=receipt.erp_receipt_reference,
        quality_state=receipt.quality_state,
        correlation_id=correlation_id or "",
    )


def send_receipt_quality_to_erp(command: OutboundReceiptQualityCommand) -> None:
    """
    Explicitly refuse ERP stock/quality updates until Phase 17 contract is approved.

    Architecture prepares the command interface only.
    """
    from apps.security_audit.services import record_event

    safe = redact_mapping(
        {
            "organization_id": command.organization_id,
            "receipt_quality_id": command.receipt_quality_id,
            "erp_receipt_reference": command.erp_receipt_reference,
            "quality_state": command.quality_state,
            "correlation_id": command.correlation_id,
        }
    )
    record_event(
        event_type="RECEIVING_ERP_OUTBOUND_BLOCKED",
        actor=None,
        metadata={**safe, "erp_inventory_not_updated": True},
    )
    raise IntegrationError(
        "Outbound receipt quality / stock state to ERP is not approved "
        "(Phase 17 / APR-011/017 EVIDENCE REQUIRED). Command prepared but not transmitted.",
        error_class=IntegrationErrorClass.OUTBOUND_NOT_APPROVED,
        retryable=False,
        correlation_id=command.correlation_id,
        details={k: str(v) for k, v in safe.items()},
    )
