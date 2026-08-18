"""Historical safety — closed/cancelled RCA records stay immutable."""

from __future__ import annotations

from apps.rca.models import TERMINAL_RCA_STATUSES


def rca_is_historically_locked(status: str) -> bool:
    return status in TERMINAL_RCA_STATUSES
