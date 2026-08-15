"""Historical safety — approved/effective/retired versions stay immutable."""

from __future__ import annotations

from apps.document_control.models import IMMUTABLE_VERSION_STATUSES


def version_is_immutable(status: str) -> bool:
    return status in IMMUTABLE_VERSION_STATUSES
