"""IQC ERP outbound gate — default OFF (APR-058)."""

from __future__ import annotations

from dataclasses import dataclass
from uuid import UUID

from django.conf import settings

from apps.integrations.errors import IntegrationError, IntegrationErrorClass
from apps.integrations.security import redact_mapping
from apps.iqc.models import IqcInspectionCase, IqcWorkflowPolicy
from apps.receiving.erp_boundary import (
    OutboundReceiptQualityCommand,
    prepare_receipt_quality_outbound,
)


def iqc_erp_outbound_approved() -> bool:
    return bool(getattr(settings, "IQC_ERP_OUTBOUND_APPROVED", False))


@dataclass(frozen=True, slots=True)
class IqcErpOutboundDecision:
    allowed: bool
    reason_code: str
    procedure_reference: str = ""

    def as_dict(self) -> dict[str, object]:
        return {
            "allowed": self.allowed,
            "reason_code": self.reason_code,
            "procedure_reference": self.procedure_reference,
            "erp_inventory_not_updated": not self.allowed,
            "evidence_gate": "APR-058 / Phase 17 ERP contract",
        }


def evaluate_iqc_erp_outbound(*, organization_id: UUID) -> IqcErpOutboundDecision:
    policy = IqcWorkflowPolicy.objects.filter(organization_id=organization_id).first()
    if policy is None or not policy.erp_outbound_enabled:
        return IqcErpOutboundDecision(
            allowed=False,
            reason_code="POLICY_DISABLED",
            procedure_reference=(policy.procedure_reference if policy else ""),
        )
    if not iqc_erp_outbound_approved():
        return IqcErpOutboundDecision(
            allowed=False,
            reason_code="SETTINGS_APPROVAL_MISSING",
            procedure_reference=policy.procedure_reference,
        )
    return IqcErpOutboundDecision(
        allowed=True,
        reason_code="ERP_OUTBOUND_ENABLED",
        procedure_reference=policy.procedure_reference,
    )


def attempt_iqc_erp_outbound(*, case: IqcInspectionCase) -> OutboundReceiptQualityCommand:
    """
    Prepare receipt quality outbound command; transmit only if dual-gated ON.

    Default path raises IntegrationError (ERP stock not updated).
    """
    command = prepare_receipt_quality_outbound(receipt=case.receipt)
    decision = evaluate_iqc_erp_outbound(organization_id=case.organization_id)
    if decision.allowed:
        # Transmission still requires live Phase 17 adapter — not implemented.
        from apps.security_audit.services import record_event

        record_event(
            event_type="IQC_ERP_OUTBOUND_PREPARED",
            actor=None,
            metadata={
                **decision.as_dict(),
                "receipt_quality_id": str(case.receipt_id),
                "live_adapter_not_implemented": True,
            },
        )
        raise IntegrationError(
            "IQC ERP outbound policy enabled but live Phase 17 adapter is not implemented "
            "(APR-011/017 EVIDENCE REQUIRED). Command prepared only.",
            error_class=IntegrationErrorClass.OUTBOUND_NOT_APPROVED,
            retryable=False,
            correlation_id=command.correlation_id,
            details={"receipt_quality_id": str(case.receipt_id)},
        )

    from apps.security_audit.services import record_event

    safe = redact_mapping(
        {
            "organization_id": command.organization_id,
            "receipt_quality_id": command.receipt_quality_id,
            "quality_state": command.quality_state,
            "reason_code": decision.reason_code,
        }
    )
    record_event(
        event_type="IQC_ERP_OUTBOUND_BLOCKED",
        actor=None,
        metadata={**safe, "erp_inventory_not_updated": True},
    )
    raise IntegrationError(
        "IQC ERP outbound is not approved "
        f"({decision.reason_code}). Local quality decision preserved; ERP stock unchanged.",
        error_class=IntegrationErrorClass.OUTBOUND_NOT_APPROVED,
        retryable=False,
        correlation_id=command.correlation_id,
        details={k: str(v) for k, v in safe.items()},
    )
