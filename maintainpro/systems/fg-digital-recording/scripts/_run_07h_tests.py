"""Run Phase 07H tests on an isolated test database name."""

from __future__ import annotations

import os
import sys

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "config.settings.test")
os.environ.setdefault("POSTGRES_DB", "nelna_fg")

import django

django.setup()

from django.conf import settings
from django.db import connection

ISO_DB = "test_nelna_07h_iso"
settings.DATABASES["default"]["TEST"] = {
    "NAME": ISO_DB,
    "MIRROR": None,
    "CHARSET": None,
    "COLLATION": None,
    "MIGRATE": True,
}

with connection.cursor() as c:
    c.execute(
        "SELECT pg_terminate_backend(pid) FROM pg_stat_activity "
        "WHERE datname = %s AND pid <> pg_backend_pid()",
        [ISO_DB],
    )
    c.execute(f'DROP DATABASE IF EXISTS "{ISO_DB}"')

import pytest

sys.exit(
    pytest.main(
        [
            "apps/scheduling/tests/test_phase07h_due_management.py",
            "-q",
            "--tb=short",
            "--create-db",
        ]
    )
)
