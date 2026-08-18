"""Historical safety — closed change requests stay immutable."""

from __future__ import annotations

from apps.change_control.models import TERMINAL_STATUSES


def change_is_historically_locked(status: str) -> bool:
    return status in TERMINAL_STATUSES
