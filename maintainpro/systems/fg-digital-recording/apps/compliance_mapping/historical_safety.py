"""Historical safety — superseded/withdrawn source editions stay immutable."""

from __future__ import annotations

from apps.compliance_mapping.models import LOCKED_EDITION_STATUSES


def edition_is_historically_locked(register_status: str) -> bool:
    return register_status in LOCKED_EDITION_STATUSES
