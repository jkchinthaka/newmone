"""Skip Mongo POC test collection unless mongo_poc settings are active.

Importing ``apps.mongo_poc.models`` under PostgreSQL settings fails because the
app is intentionally absent from production ``INSTALLED_APPS``.
"""

from __future__ import annotations

from pathlib import Path

import pytest


def _using_mongo_backend() -> bool:
    try:
        from django.conf import settings

        if not settings.configured:
            return False
        return settings.DATABASES.get("default", {}).get("ENGINE") == ("django_mongodb_backend")
    except Exception:  # noqa: BLE001 — collection-time best effort
        return False


def pytest_ignore_collect(collection_path: Path, config: pytest.Config) -> bool | None:
    if _using_mongo_backend():
        return None
    text = str(collection_path).replace("\\", "/")
    if "/mongo_poc/" in text and (
        collection_path.name.startswith("test_") or collection_path.name == "test_poc_guarantees.py"
    ):
        return True
    return None


def pytest_collection_modifyitems(config: pytest.Config, items: list[pytest.Item]) -> None:
    if _using_mongo_backend():
        return
    skip = pytest.mark.skip(
        reason=(
            "Mongo POC tests require "
            "DJANGO_SETTINGS_MODULE=config.settings.mongo_poc "
            "and a replica-set MongoDB (see compose.mongo-poc.yaml)"
        )
    )
    for item in items:
        if "mongo_poc" in str(item.fspath):
            item.add_marker(skip)
