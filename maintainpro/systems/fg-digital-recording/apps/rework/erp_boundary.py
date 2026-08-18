"""Fail-closed ERP boundary for rework quantity/status updates — Phase 42."""

from __future__ import annotations

from dataclasses import dataclass

from apps.accounts.models import User
from apps.integrations.errors import IntegrationError, IntegrationErrorClass
from apps.integrations.security import redact_mapping
from apps.rework.models import ReworkCase
from apps.security_audit.services import record_event


@dataclass(frozen=True, slots=True)
class ReworkErpStockCommand:
    organization_id: str
    case_id: str
    execution_key: str
    source_batch_reference: str
    resulting_batch_reference: str
    correlation_id: str = ""


def prepare_rework_erp_stock_movement(
    *, case: ReworkCase, correlation_id: str = ""
) -> ReworkErpStockCommand:
    return ReworkErpStockCommand(
        organization_id=str(case.organization_id),
        case_id=str(case.id),
        execution_key=case.execution_key,
        source_batch_reference=case.source_batch_reference,
        resulting_batch_reference=case.resulting_batch_reference,
        correlation_id=correlation_id or "",
    )


def send_rework_erp_stock_movement(
    *,
    command: ReworkErpStockCommand,
    actor: User | None,
    reason_code: str = "OUTBOUND_NOT_APPROVED",
) -> None:
    safe = redact_mapping(
        {
            "organization_id": command.organization_id,
            "case_id": command.case_id,
            "execution_key": command.execution_key,
            "source_batch_reference": command.source_batch_reference,
            "resulting_batch_reference": command.resulting_batch_reference,
            "correlation_id": command.correlation_id,
            "reason_code": reason_code,
        }
    )
    record_event(
        event_type="REWORK_ERP_STOCK_MOVEMENT_BLOCKED",
        actor=actor,
        metadata={**safe, "inventory_ledger_unchanged": True},
    )
    raise IntegrationError(
        "Rework ERP quantity/status updates are not approved or have no approved live adapter "
        "(APR-067 EVIDENCE REQUIRED). Command prepared but not transmitted.",
        error_class=IntegrationErrorClass.OUTBOUND_NOT_APPROVED,
        retryable=False,
        correlation_id=command.correlation_id,
        details={key: str(value) for key, value in safe.items()},
    )
