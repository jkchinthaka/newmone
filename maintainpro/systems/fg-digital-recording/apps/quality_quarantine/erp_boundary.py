"""Fail-closed ERP boundary for quality quarantine state."""

from __future__ import annotations

from dataclasses import dataclass

from apps.accounts.models import User
from apps.integrations.errors import IntegrationError, IntegrationErrorClass
from apps.integrations.security import redact_mapping
from apps.quality_quarantine.models import QualityQuarantineRecord
from apps.security_audit.services import record_event


@dataclass(frozen=True, slots=True)
class QuarantineErpSyncCommand:
    organization_id: str
    quarantine_id: str
    quarantine_code: str
    batch_reference: str
    source: str
    source_reference: str
    correlation_id: str = ""


def prepare_quarantine_erp_sync(
    *, record: QualityQuarantineRecord, correlation_id: str = ""
) -> QuarantineErpSyncCommand:
    return QuarantineErpSyncCommand(
        organization_id=str(record.organization_id),
        quarantine_id=str(record.id),
        quarantine_code=record.code,
        batch_reference=record.batch_reference,
        source=record.source,
        source_reference=record.source_reference,
        correlation_id=correlation_id or "",
    )


def send_quarantine_erp_sync(
    *,
    command: QuarantineErpSyncCommand,
    actor: User | None,
    reason_code: str = "OUTBOUND_NOT_APPROVED",
) -> None:
    """Prepare an opaque command but refuse transmission pending approved evidence."""
    safe = redact_mapping(
        {
            "organization_id": command.organization_id,
            "quarantine_id": command.quarantine_id,
            "quarantine_code": command.quarantine_code,
            "batch_reference": command.batch_reference,
            "source": command.source,
            "source_reference": command.source_reference,
            "correlation_id": command.correlation_id,
            "reason_code": reason_code,
        }
    )
    record_event(
        event_type="QUARANTINE_ERP_SYNC_BLOCKED",
        actor=actor,
        metadata={**safe, "inventory_ledger_unchanged": True},
    )
    raise IntegrationError(
        "Quality quarantine ERP outbound is not approved or has no approved live adapter "
        "(APR-066 EVIDENCE REQUIRED). Command prepared but not transmitted.",
        error_class=IntegrationErrorClass.OUTBOUND_NOT_APPROVED,
        retryable=False,
        correlation_id=command.correlation_id,
        details={key: str(value) for key, value in safe.items()},
    )
