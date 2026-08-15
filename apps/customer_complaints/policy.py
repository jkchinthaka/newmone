"""Complaint customer-response dual-gate — default OFF (APR-064)."""

from __future__ import annotations

import uuid
from dataclasses import dataclass

from django.conf import settings

from apps.customer_complaints.models import CustomerComplaintPolicy


def complaint_customer_response_auto_send_approved() -> bool:
    return bool(getattr(settings, "COMPLAINT_CUSTOMER_RESPONSE_AUTO_SEND_APPROVED", False))


@dataclass(frozen=True, slots=True)
class ComplaintGateDecision:
    allowed: bool
    reason_code: str
    procedure_reference: str = ""

    def as_dict(self) -> dict[str, object]:
        return {
            "allowed": self.allowed,
            "reason_code": self.reason_code,
            "procedure_reference": self.procedure_reference,
            "evidence_gate": "APR-064 / company complaint response policy",
            "no_auto_customer_send": True,
            "no_invented_category_taxonomy": True,
        }


def evaluate_complaint_customer_response(*, organization_id: uuid.UUID) -> ComplaintGateDecision:
    policy = CustomerComplaintPolicy.objects.filter(organization_id=organization_id).first()
    procedure = policy.procedure_reference if policy else ""
    if policy is None or not policy.customer_response_auto_send_enabled:
        return ComplaintGateDecision(
            allowed=False,
            reason_code="POLICY_DISABLED",
            procedure_reference=procedure,
        )
    if not complaint_customer_response_auto_send_approved():
        return ComplaintGateDecision(
            allowed=False,
            reason_code="SETTINGS_APPROVAL_MISSING",
            procedure_reference=procedure,
        )
    return ComplaintGateDecision(
        allowed=True,
        reason_code="CUSTOMER_RESPONSE_PREPARE_ONLY",
        procedure_reference=procedure,
    )


# Compatibility aliases used by tests / callers.
evaluate_complaint_customer_response_auto_send = evaluate_complaint_customer_response
