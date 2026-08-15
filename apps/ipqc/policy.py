"""IPQC failure → production-stop gate — default OFF (APR-059)."""

from __future__ import annotations

from dataclasses import dataclass
from uuid import UUID

from django.conf import settings

from apps.ipqc.models import IpqcWorkflowPolicy


def ipqc_stop_production_on_fail_approved() -> bool:
    return bool(getattr(settings, "IPQC_STOP_PRODUCTION_ON_FAIL_APPROVED", False))


@dataclass(frozen=True, slots=True)
class IpqcFailStopDecision:
    """
    Deterministic gate result.

    stop_production=True only signals policy; line-stop integration remains
    EVIDENCE REQUIRED and is not invented here.
    """

    stop_production: bool
    reason_code: str
    procedure_reference: str = ""
    advisory_only: bool = True

    def as_dict(self) -> dict[str, object]:
        return {
            "stop_production": self.stop_production,
            "reason_code": self.reason_code,
            "procedure_reference": self.procedure_reference,
            "advisory_only": self.advisory_only,
            "not_qa_disposition": True,
            "not_fg_release": True,
            "evidence_gate": "APR-059 / company IPQC stop-line policy",
        }


def evaluate_ipqc_fail_stop_policy(
    *,
    organization_id: UUID,
    failure_detected: bool,
) -> IpqcFailStopDecision:
    """
    Failed IPQC item does not stop the line unless:

    1. failure_detected is True, AND
    2. org IpqcWorkflowPolicy.stop_production_on_fail_enabled is True, AND
    3. IPQC_STOP_PRODUCTION_ON_FAIL_APPROVED settings flag is True.
    """
    if not failure_detected:
        return IpqcFailStopDecision(
            stop_production=False,
            reason_code="NO_FAIL",
            advisory_only=True,
        )
    policy = IpqcWorkflowPolicy.objects.filter(organization_id=organization_id).first()
    if policy is None or not policy.stop_production_on_fail_enabled:
        return IpqcFailStopDecision(
            stop_production=False,
            reason_code="POLICY_DISABLED",
            procedure_reference=(policy.procedure_reference if policy else ""),
            advisory_only=True,
        )
    if not ipqc_stop_production_on_fail_approved():
        return IpqcFailStopDecision(
            stop_production=False,
            reason_code="SETTINGS_APPROVAL_MISSING",
            procedure_reference=policy.procedure_reference,
            advisory_only=True,
        )
    return IpqcFailStopDecision(
        stop_production=True,
        reason_code="STOP_PRODUCTION_ENABLED",
        procedure_reference=policy.procedure_reference,
        advisory_only=False,
    )
