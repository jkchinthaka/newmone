"""Limit evaluation for environmental readings — no invented thresholds."""

from __future__ import annotations

from dataclasses import dataclass
from decimal import Decimal
from typing import Any

from apps.environmental.models import (
    MonitoringEvaluationOutcome,
    MonitoringLimitRule,
)


@dataclass(frozen=True, slots=True)
class LimitEvaluationResult:
    outcome: str
    reason_code: str
    limit_rule: MonitoringLimitRule | None = None
    message: str = ""
    hold_recommended: bool = False

    def as_dict(self) -> dict[str, Any]:
        return {
            "outcome": self.outcome,
            "reason_code": self.reason_code,
            "limit_rule_id": str(self.limit_rule.id) if self.limit_rule else None,
            "message": self.message,
            "hold_recommended": self.hold_recommended,
            "not_qa_disposition": True,
        }


def freeze_limit_context(rule: MonitoringLimitRule | None) -> dict[str, Any]:
    if rule is None:
        return {
            "limits_configured": False,
            "not_qa_disposition": True,
            "evidence_gate": "APR-054 / company environmental limits required",
        }
    return {
        "limits_configured": True,
        "limit_rule_id": str(rule.id),
        "spec_version_id": str(rule.spec_version_id),
        "spec_version_number": rule.spec_version.version_number,
        "spec_code": rule.spec_version.spec.code,
        "monitoring_point_id": str(rule.monitoring_point_id),
        "parameter_id": str(rule.parameter_id),
        "bound_min": format(rule.bound_min, "f") if rule.bound_min is not None else None,
        "bound_max": format(rule.bound_max, "f") if rule.bound_max is not None else None,
        "warn_min": format(rule.warn_min, "f") if rule.warn_min is not None else None,
        "warn_max": format(rule.warn_max, "f") if rule.warn_max is not None else None,
        "not_qa_disposition": True,
        "evidence_gate": "APR-054 / company environmental limits required",
    }


def evaluate_against_limit_rule(
    *,
    value: Decimal,
    rule: MonitoringLimitRule | None,
) -> LimitEvaluationResult:
    """
    Deterministic comparison against configured bounds.

    Missing min/max → NOT_EVALUATED (do not invent limits).
    """
    if rule is None:
        return LimitEvaluationResult(
            outcome=MonitoringEvaluationOutcome.NOT_EVALUATED,
            reason_code="NO_LIMIT_RULE",
            message="No approved limit rule for this point/parameter.",
        )
    if rule.bound_min is None and rule.bound_max is None:
        return LimitEvaluationResult(
            outcome=MonitoringEvaluationOutcome.NOT_EVALUATED,
            reason_code="LIMITS_PENDING",
            limit_rule=rule,
            message="Limit rule exists but bounds are not yet configured.",
        )

    outside = False
    if rule.bound_min is not None and value < rule.bound_min:
        outside = True
    if rule.bound_max is not None and value > rule.bound_max:
        outside = True
    if outside:
        return LimitEvaluationResult(
            outcome=MonitoringEvaluationOutcome.EXCURSION,
            reason_code="OUTSIDE_BOUNDS",
            limit_rule=rule,
            message="Reading outside configured hard bounds.",
            hold_recommended=True,
        )

    warn = False
    if rule.warn_min is not None and value < rule.warn_min:
        warn = True
    if rule.warn_max is not None and value > rule.warn_max:
        warn = True
    if warn:
        return LimitEvaluationResult(
            outcome=MonitoringEvaluationOutcome.WARN,
            reason_code="WARNING_BAND",
            limit_rule=rule,
            message="Reading in configured warning band.",
            hold_recommended=False,
        )

    return LimitEvaluationResult(
        outcome=MonitoringEvaluationOutcome.IN_RANGE,
        reason_code="IN_RANGE",
        limit_rule=rule,
        message="Reading within configured bounds.",
    )
