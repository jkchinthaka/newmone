"""Historical safety — closed/cancelled QMS audits stay immutable."""

from __future__ import annotations

from apps.quality_audits.models import TERMINAL_AUDIT_STATUSES


def audit_is_historically_locked(status: str) -> bool:
    return status in TERMINAL_AUDIT_STATUSES
