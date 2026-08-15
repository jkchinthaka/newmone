"""Database vendor detection for backend-aware persistence helpers."""

from __future__ import annotations

from enum import StrEnum

from django.conf import settings
from django.db import connection


class DatabaseVendor(StrEnum):
    POSTGRESQL = "postgresql"
    MONGODB = "mongodb"
    OTHER = "other"


def detect_database_vendor(*, alias: str = "default") -> DatabaseVendor:
    """Return the configured vendor for ``alias`` (default connection)."""
    engine = ""
    databases = getattr(settings, "DATABASES", {}) or {}
    configured = databases.get(alias) or {}
    engine = str(configured.get("ENGINE", "")).lower()

    if not engine:
        try:
            engine = str(connection.settings_dict.get("ENGINE", "")).lower()
        except Exception:  # noqa: BLE001 — connection may be unavailable in early boot
            engine = ""

    if "mongodb" in engine:
        return DatabaseVendor.MONGODB
    if "postgresql" in engine or "psycopg" in engine:
        return DatabaseVendor.POSTGRESQL
    return DatabaseVendor.OTHER


def is_mongodb(*, alias: str = "default") -> bool:
    return detect_database_vendor(alias=alias) is DatabaseVendor.MONGODB
