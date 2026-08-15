"""Org-scoped rework policy stubs — Phase 42."""

from __future__ import annotations

from dataclasses import dataclass
from uuid import UUID

from django.conf import settings

from apps.accounts.models import User
from apps.organizations.models import Organization
from apps.rework.models import ReworkPolicyStub


def rework_erp_stock_movement_approved() -> bool:
    return bool(getattr(settings, "REWORK_ERP_STOCK_MOVEMENT_APPROVED", False))


@dataclass(frozen=True, slots=True)
class ReworkErpDecision:
    allowed: bool
    reason_code: str

    def as_dict(self) -> dict[str, object]:
        return {"allowed": self.allowed, "reason_code": self.reason_code}


def evaluate_rework_erp_stock_movement(*, organization_id: UUID) -> ReworkErpDecision:
    if not rework_erp_stock_movement_approved():
        return ReworkErpDecision(allowed=False, reason_code="SETTINGS_APPROVAL_MISSING")
    stub = (
        ReworkPolicyStub.objects.filter(
            organization_id=organization_id,
            erp_stock_movement_enabled=True,
        )
        .order_by("-updated_at")
        .first()
    )
    if stub is None:
        return ReworkErpDecision(allowed=False, reason_code="ORG_POLICY_DISABLED")
    return ReworkErpDecision(allowed=True, reason_code="APPROVED")


def get_policy_value(*, organization_id: UUID, policy_key: str) -> str | None:
    return (
        ReworkPolicyStub.objects.filter(
            organization_id=organization_id,
            policy_key=policy_key,
        )
        .values_list("policy_value_reference", flat=True)
        .first()
    )


def upsert_policy_stub(
    *,
    organization: Organization,
    policy_key: str,
    policy_value_reference: str,
    actor: User,
) -> ReworkPolicyStub:
    stub, _created = ReworkPolicyStub.objects.update_or_create(
        organization=organization,
        policy_key=policy_key,
        defaults={
            "policy_value_reference": policy_value_reference,
            "updated_by": actor,
        },
    )
    return stub
