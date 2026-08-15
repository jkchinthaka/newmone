"""Historical safety — approved/superseded/withdrawn FMEA versions stay immutable."""

from __future__ import annotations

from apps.process_fmea.models import LOCKED_FMEA_VERSION_STATUSES


def version_is_historically_locked(status: str) -> bool:
    return status in LOCKED_FMEA_VERSION_STATUSES
