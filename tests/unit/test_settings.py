"""Settings and environment tests."""

from __future__ import annotations

import importlib
import os
import subprocess
import sys
from pathlib import Path

import pytest
from django.conf import settings

ROOT = Path(__file__).resolve().parents[2]


@pytest.mark.django_db
def test_auth_user_model_is_accounts_user() -> None:
    assert settings.AUTH_USER_MODEL == "accounts.User"


def test_database_engine_is_postgresql() -> None:
    from apps.core.persistence.backend import is_mongodb

    if is_mongodb():
        pytest.skip("Active settings use MongoDB; PostgreSQL engine asserted on PG test settings")
    assert settings.DATABASES["default"]["ENGINE"] == "django.db.backends.postgresql"


def test_no_sqlite_engine() -> None:
    engines = [db["ENGINE"] for db in settings.DATABASES.values()]
    assert all("sqlite" not in engine for engine in engines)


def test_csrf_and_session_cookies_are_httponly() -> None:
    assert settings.SESSION_COOKIE_HTTPONLY is True
    assert settings.CSRF_COOKIE_HTTPONLY is True
    assert settings.CSRF_COOKIE_SAMESITE == "Lax"
    assert settings.SESSION_COOKIE_SAMESITE == "Lax"


def test_local_settings_module_importable() -> None:
    module = importlib.import_module("config.settings.local")
    assert isinstance(module.DEBUG, bool)


def test_test_settings_eager_celery() -> None:
    assert settings.CELERY_TASK_ALWAYS_EAGER is True


def test_production_settings_reject_missing_secrets() -> None:
    env = {
        "PATH": os.environ.get("PATH", ""),
        "SYSTEMROOT": os.environ.get("SYSTEMROOT", ""),
        "PYTHONPATH": str(ROOT),
    }
    # Preserve virtualenv interpreter resolution
    result = subprocess.run(
        [sys.executable, "-c", "import config.settings.production"],
        cwd=ROOT,
        env=env,
        capture_output=True,
        text=True,
        check=False,
    )
    assert result.returncode != 0
    combined = (result.stderr + result.stdout).lower()
    assert "improperlyconfigured" in combined or "required" in combined


def test_production_settings_load_with_placeholders() -> None:
    env = os.environ.copy()
    env.update(
        {
            "DJANGO_SECRET_KEY": "ci-prod-fake-secret-key-with-sufficient-length-32",
            "DJANGO_ALLOWED_HOSTS": "app.example.invalid",
            "DJANGO_CSRF_TRUSTED_ORIGINS": "https://app.example.invalid",
            "POSTGRES_DB": "nelna_fg",
            "POSTGRES_USER": "nelna_fg",
            "POSTGRES_PASSWORD": "not-a-real-password",
            "POSTGRES_HOST": "127.0.0.1",
            "POSTGRES_PORT": "5432",
            "REDIS_URL": "redis://127.0.0.1:6379/0",
            "PYTHONPATH": str(ROOT),
        }
    )
    result = subprocess.run(
        [
            sys.executable,
            "-c",
            (
                "import config.settings.production as p; "
                "assert p.DEBUG is False; "
                "assert '*' not in p.ALLOWED_HOSTS"
            ),
        ],
        cwd=ROOT,
        env=env,
        capture_output=True,
        text=True,
        check=False,
    )
    assert result.returncode == 0, result.stderr
