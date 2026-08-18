"""Positive-release policy evaluation — default non-blocking (Phase 22).

Do NOT enable HOLD/RELEASE blocking without formal company QA approval.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Any
from uuid import UUID

from django.conf import settings

from apps.laboratory.models import LabPositiveReleasePolicy, LabResult, LabResultStatus, LabSample
from apps.organizations.models import Organization


@dataclass(frozen=True, slots=True)
class PositiveReleaseGateResult:
    """Advisory gate result — never invents a disposition."""

    blocking: bool
    reason_code: str
    policy_enabled: bool
    company_blocking_approved: bool
    pending_sample_ids: tuple[str, ...]
    message: str

    def as_dict(self) -> dict[str, Any]:
        return {
            "blocking": self.blocking,
            "reason_code": self.reason_code,
            "policy_enabled": self.policy_enabled,
            "company_blocking_approved": self.company_blocking_approved,
            "pending_sample_ids": list(self.pending_sample_ids),
            "message": self.message,
        }


def company_blocking_approved() -> bool:
    """Hard env gate — default False until APR / QA evidence exists."""
    return bool(getattr(settings, "LAB_POSITIVE_RELEASE_BLOCKING_APPROVED", False))


def get_or_init_policy(organization: Organization) -> LabPositiveReleasePolicy:
    policy, _ = LabPositiveReleasePolicy.objects.get_or_create(
        organization=organization,
        defaults={"policy_enabled": False, "require_finalized_results": True},
    )
    return policy


def evaluate_batch_positive_release_gate(
    *,
    organization: Organization,
    batch_reference: str,
) -> PositiveReleaseGateResult:
    """
    Evaluate whether FG quality release should wait for lab finalization.

    Default: non-blocking. Blocking requires policy_enabled AND company approval flag.
    """
    batch = (batch_reference or "").strip()
    policy = get_or_init_policy(organization)
    approved = company_blocking_approved()

    if not policy.policy_enabled:
        return PositiveReleaseGateResult(
            blocking=False,
            reason_code="POLICY_DISABLED",
            policy_enabled=False,
            company_blocking_approved=approved,
            pending_sample_ids=(),
            message=(
                "Positive-release lab blocking is disabled. "
                "Company QA policy evidence is required before enablement."
            ),
        )

    if not approved:
        return PositiveReleaseGateResult(
            blocking=False,
            reason_code="BLOCKING_NOT_APPROVED",
            policy_enabled=True,
            company_blocking_approved=False,
            pending_sample_ids=(),
            message=(
                "Policy definition may be recorded, but runtime blocking remains OFF "
                "until LAB_POSITIVE_RELEASE_BLOCKING_APPROVED is explicitly approved."
            ),
        )

    if not batch:
        return PositiveReleaseGateResult(
            blocking=False,
            reason_code="NO_BATCH_REFERENCE",
            policy_enabled=True,
            company_blocking_approved=True,
            pending_sample_ids=(),
            message="No batch reference supplied — gate not applied.",
        )

    samples = list(
        LabSample.objects.filter(
            organization_id=organization.id,
            batch_reference__iexact=batch,
        ).exclude(status="CANCELLED")
    )
    pending: list[str] = []
    for sample in samples:
        results = LabResult.objects.filter(
            organization_id=organization.id,
            lab_test__sample_id=sample.id,
        ).exclude(status__in=[LabResultStatus.CANCELLED, LabResultStatus.SUPERSEDED])
        latest_ids: dict[UUID, LabResult] = {}
        for row in results.order_by("parameter_id", "-revision_number"):
            if row.parameter_id not in latest_ids:
                latest_ids[row.parameter_id] = row
        if not latest_ids:
            pending.append(str(sample.id))
            continue
        if policy.require_finalized_results and any(
            r.status != LabResultStatus.FINALIZED for r in latest_ids.values()
        ):
            pending.append(str(sample.id))

    if pending:
        return PositiveReleaseGateResult(
            blocking=True,
            reason_code="PENDING_LAB_RESULTS",
            policy_enabled=True,
            company_blocking_approved=True,
            pending_sample_ids=tuple(pending),
            message="Required laboratory results are not finalized for this batch.",
        )

    return PositiveReleaseGateResult(
        blocking=False,
        reason_code="LAB_REQUIREMENTS_MET",
        policy_enabled=True,
        company_blocking_approved=True,
        pending_sample_ids=(),
        message="No pending finalized lab requirements for this batch reference.",
    )
