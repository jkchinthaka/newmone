"""Recall dual-gates — default OFF (APR-062)."""

from __future__ import annotations

from dataclasses import dataclass
from uuid import UUID

from django.conf import settings

from apps.recall.models import RecallPolicy


def recall_external_notification_approved() -> bool:
    return bool(getattr(settings, "RECALL_EXTERNAL_NOTIFICATION_APPROVED", False))


def recall_erp_distribution_pull_approved() -> bool:
    return bool(getattr(settings, "RECALL_ERP_DISTRIBUTION_PULL_APPROVED", False))


@dataclass(frozen=True, slots=True)
class RecallGateDecision:
    allowed: bool
    reason_code: str
    procedure_reference: str = ""

    def as_dict(self) -> dict[str, object]:
        return {
            "allowed": self.allowed,
            "reason_code": self.reason_code,
            "procedure_reference": self.procedure_reference,
            "evidence_gate": "APR-062 / company recall / withdrawal policy",
            "no_auto_authority_contact": True,
            "no_invented_regulatory_class": True,
        }


def evaluate_recall_external_notification(*, organization_id: UUID) -> RecallGateDecision:
    policy = RecallPolicy.objects.filter(organization_id=organization_id).first()
    if policy is None or not policy.external_notification_enabled:
        return RecallGateDecision(
            allowed=False,
            reason_code="POLICY_DISABLED",
            procedure_reference=(policy.procedure_reference if policy else ""),
        )
    if not recall_external_notification_approved():
        return RecallGateDecision(
            allowed=False,
            reason_code="SETTINGS_APPROVAL_MISSING",
            procedure_reference=policy.procedure_reference,
        )
    return RecallGateDecision(
        allowed=True,
        reason_code="EXTERNAL_NOTIFICATION_ENABLED",
        procedure_reference=policy.procedure_reference,
    )


def evaluate_recall_erp_distribution_pull(*, organization_id: UUID) -> RecallGateDecision:
    policy = RecallPolicy.objects.filter(organization_id=organization_id).first()
    if policy is None or not policy.erp_distribution_pull_enabled:
        return RecallGateDecision(
            allowed=False,
            reason_code="POLICY_DISABLED",
            procedure_reference=(policy.procedure_reference if policy else ""),
        )
    if not recall_erp_distribution_pull_approved():
        return RecallGateDecision(
            allowed=False,
            reason_code="SETTINGS_APPROVAL_MISSING",
            procedure_reference=policy.procedure_reference,
        )
    return RecallGateDecision(
        allowed=True,
        reason_code="ERP_DISTRIBUTION_PULL_ENABLED",
        procedure_reference=policy.procedure_reference,
    )
