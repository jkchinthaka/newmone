"""Migration and integration smoke tests."""

from __future__ import annotations

import pytest
from django.core.management import call_command
from django.db import connection


@pytest.mark.django_db
@pytest.mark.integration
def test_migrations_applied_on_postgresql() -> None:
    if connection.vendor != "postgresql":
        pytest.skip("PostgreSQL-only migration smoke; active vendor is " + connection.vendor)
    call_command("showmigrations", verbosity=0)


@pytest.mark.django_db
@pytest.mark.integration
def test_redis_cache_roundtrip() -> None:
    from django.core.cache import cache

    cache.set("foundation:test", "ok", timeout=30)
    assert cache.get("foundation:test") == "ok"
