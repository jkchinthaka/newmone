"""Historical safety — closed/cancelled risks and assessments stay immutable."""

from __future__ import annotations

from apps.quality_risks.models import TERMINAL_RISK_STATUSES


def risk_is_historically_locked(status: str) -> bool:
    return status in TERMINAL_RISK_STATUSES
