"""Outbound disposition command interface — prepare only; do not send to ERP."""

from __future__ import annotations

from apps.integrations.contracts import OutboundDispositionCommand
from apps.integrations.errors import IntegrationError, IntegrationErrorClass
from apps.integrations.security import redact_mapping


def prepare_disposition_command(
    *,
    organization_id: str,
    checklist_submission_id: str,
    qa_review_id: str,
    disposition: str,
    correlation_id: str = "",
    batch_reference: str = "",
    external_batch_id: str = "",
) -> OutboundDispositionCommand:
    """Build a command object for future outbound adapters (APR-017 gated)."""
    return OutboundDispositionCommand(
        organization_id=organization_id,
        checklist_submission_id=checklist_submission_id,
        qa_review_id=qa_review_id,
        disposition=(disposition or "").strip().upper(),
        correlation_id=correlation_id,
        batch_reference=batch_reference,
        external_batch_id=external_batch_id,
    )


def send_disposition_to_erp(command: OutboundDispositionCommand) -> None:
    """
    Explicitly refuse outbound RELEASE/HOLD/REJECT until policy is approved.

    Architecture prepares the command interface only.
    """
    from apps.security_audit.services import record_event

    safe = redact_mapping(
        {
            "organization_id": command.organization_id,
            "qa_review_id": command.qa_review_id,
            "disposition": command.disposition,
            "correlation_id": command.correlation_id,
        }
    )
    record_event(
        event_type="INTEGRATION_OUTBOUND_BLOCKED",
        actor=None,
        metadata=safe,
    )
    raise IntegrationError(
        "Outbound QA disposition to ERP/Bileeta is not approved "
        "(APR-017 EVIDENCE REQUIRED). Command prepared but not transmitted.",
        error_class=IntegrationErrorClass.OUTBOUND_NOT_APPROVED,
        retryable=False,
        correlation_id=command.correlation_id,
        details={k: str(v) for k, v in safe.items()},
    )
