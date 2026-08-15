"""Foreign-body containment policy — auto-HOLD default OFF."""

from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime
from typing import Any

from django.conf import settings

from apps.accounts.models import User
from apps.foreign_body.models import MetalDetectorChallengeTest
from apps.nonconformance.models import HoldCase
from apps.organizations.models import Organization


@dataclass(frozen=True, slots=True)
class ContainmentInterval:
    interval_start: datetime | None
    interval_end: datetime | None
    previous_pass_test_id: str | None
    affected_batch_references: tuple[str, ...]
    hold_recommended: bool
    auto_hold_approved: bool
    hold_will_create: bool
    reason_code: str
    message: str

    def as_dict(self) -> dict[str, Any]:
        return {
            "interval_start": (self.interval_start.isoformat() if self.interval_start else None),
            "interval_end": self.interval_end.isoformat() if self.interval_end else None,
            "previous_pass_test_id": self.previous_pass_test_id,
            "affected_batch_references": list(self.affected_batch_references),
            "hold_recommended": self.hold_recommended,
            "auto_hold_approved": self.auto_hold_approved,
            "hold_will_create": self.hold_will_create,
            "reason_code": self.reason_code,
            "message": self.message,
            "not_qa_disposition": True,
            "evidence_gate": "APR-052 / company foreign-body HACCP containment policy",
        }


def auto_hold_approved() -> bool:
    """Hard gate — default False until company HACCP evidence (APR-052)."""
    return bool(getattr(settings, "FOREIGN_BODY_AUTO_HOLD_APPROVED", False))


def compute_affected_interval(
    *,
    failed_test: MetalDetectorChallengeTest,
) -> ContainmentInterval:
    """
    Architecture for last-known-good → fail interval.

    Does not invent which batches are contaminated beyond explicit references
    already recorded on challenge tests for the same equipment.
    """
    approved = auto_hold_approved()
    previous = (
        MetalDetectorChallengeTest.objects.filter(
            organization_id=failed_test.organization_id,
            equipment_id=failed_test.equipment_id,
            result="PASS",
            status__in={"RECORDED", "VERIFIED"},
            performed_at__lt=failed_test.performed_at,
        )
        .order_by("-performed_at", "-created_at")
        .first()
    )
    interval_start = previous.performed_at if previous else None
    interval_end = failed_test.performed_at

    batch_refs: list[str] = []
    qs = MetalDetectorChallengeTest.objects.filter(
        organization_id=failed_test.organization_id,
        equipment_id=failed_test.equipment_id,
        performed_at__lte=failed_test.performed_at,
        status__in={"RECORDED", "VERIFIED", "DRAFT"},
    ).exclude(status="VOID")
    if interval_start is not None:
        qs = qs.filter(performed_at__gte=interval_start)
    for row in qs.order_by("performed_at"):
        ref = (row.batch_reference or "").strip()
        if ref and ref not in batch_refs:
            batch_refs.append(ref)
    fail_batch = (failed_test.batch_reference or "").strip()
    if fail_batch and fail_batch not in batch_refs:
        batch_refs.append(fail_batch)

    return ContainmentInterval(
        interval_start=interval_start,
        interval_end=interval_end,
        previous_pass_test_id=str(previous.id) if previous else None,
        affected_batch_references=tuple(batch_refs),
        hold_recommended=True,
        auto_hold_approved=approved,
        hold_will_create=False,  # caller decides; default path never auto-creates
        reason_code="INTERVAL_COMPUTED" if previous else "NO_PRIOR_PASS",
        message=(
            "Affected interval computed for HACCP review. Automatic HOLD remains OFF "
            "until FOREIGN_BODY_AUTO_HOLD_APPROVED and company policy evidence."
            if not approved
            else (
                "Auto-HOLD flag is approved in settings, but HOLD creation still requires "
                "an explicit service call — not invented corrective action."
            )
        ),
    )


def maybe_create_hold_case(
    *,
    actor: User | None,
    organization: Organization,
    failed_test: MetalDetectorChallengeTest,
    interval: ContainmentInterval,
) -> HoldCase | None:
    """
    Create HoldCase only when FOREIGN_BODY_AUTO_HOLD_APPROVED is true.

    Still does not invent corrective actions or retrospective scope beyond the
    advisory interval payload.
    """
    if not auto_hold_approved():
        return None
    from apps.nonconformance.services import create_hold_case

    code = f"FB-{str(failed_test.id).replace('-', '')[:12].upper()}"
    reason = (
        "Foreign-body challenge FAIL containment (advisory architecture). "
        f"Equipment={failed_test.equipment.code}; "
        f"interval_start={interval.interval_start}; interval_end={interval.interval_end}; "
        f"batches={list(interval.affected_batch_references)}. "
        "Company HACCP must confirm disposition — no invented corrective action."
    )
    return create_hold_case(
        actor=actor,
        organization=organization,
        code=code,
        reason_reference=reason[:2000],
        scope=(failed_test.production_line_code or "")[:255],
        batch_reference=(failed_test.batch_reference or "")[:128],
    )
