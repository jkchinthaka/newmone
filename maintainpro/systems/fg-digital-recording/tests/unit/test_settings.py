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
            "FG_DATABASE_BACKEND": "mongodb",
            "MONGODB_URI": "mongodb://127.0.0.1:27017/?replicaSet=rs0",
            "MONGODB_DATABASE": "maintainpro_prod",
            "MONGODB_PRODUCTION_TARGET_DATABASE": "maintainpro_prod",
            "REDIS_URL": "redis://127.0.0.1:6379/1",
            "ALLOW_INSECURE_HTTP": "false",
            "PYTHONPATH": str(ROOT),
        }
    )
    # Clear inherited module cache pollution from other tests.
    for key in list(sys.modules):
        if key.startswith("config.settings.production") or key == "config.settings.production":
            del sys.modules[key]
    result = subprocess.run(
        [
            sys.executable,
            "-c",
            (
                "import config.settings.production as p; "
                "assert p.DEBUG is False; "
                "assert '*' not in p.ALLOWED_HOSTS; "
                "assert p.MONGODB_DATABASE == 'maintainpro_prod'; "
                "assert p.SESSION_COOKIE_SECURE is True; "
                "assert p.CSRF_COOKIE_SECURE is True; "
                "assert p.SECURE_SSL_REDIRECT is True; "
                "assert p.ALLOW_INSECURE_HTTP is False; "
                "assert p.FG_COLLECTION_PREFIX == 'fg_'"
            ),
        ],
        cwd=ROOT,
        env=env,
        capture_output=True,
        text=True,
        check=False,
    )
    assert result.returncode == 0, result.stderr


def test_production_settings_reject_non_maintainpro_prod_database() -> None:
    env = os.environ.copy()
    env.update(
        {
            "DJANGO_SECRET_KEY": "ci-prod-fake-secret-key-with-sufficient-length-32",
            "DJANGO_ALLOWED_HOSTS": "app.example.invalid",
            "DJANGO_CSRF_TRUSTED_ORIGINS": "https://app.example.invalid",
            "FG_DATABASE_BACKEND": "mongodb",
            "MONGODB_URI": "mongodb://127.0.0.1:27017/?replicaSet=rs0",
            "MONGODB_DATABASE": "nelna",
            "MONGODB_PRODUCTION_TARGET_DATABASE": "maintainpro_prod",
            "REDIS_URL": "redis://127.0.0.1:6379/1",
            "PYTHONPATH": str(ROOT),
        }
    )
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
    assert "maintainpro_prod" in combined


def test_production_settings_explicit_http_opt_in() -> None:
    env = os.environ.copy()
    env.update(
        {
            "DJANGO_SECRET_KEY": "ci-prod-fake-secret-key-with-sufficient-length-32",
            "DJANGO_ALLOWED_HOSTS": "app.example.invalid",
            "DJANGO_CSRF_TRUSTED_ORIGINS": "http://app.example.invalid",
            "FG_DATABASE_BACKEND": "mongodb",
            "MONGODB_URI": "mongodb://127.0.0.1:27017/?replicaSet=rs0",
            "MONGODB_DATABASE": "maintainpro_prod",
            "MONGODB_PRODUCTION_TARGET_DATABASE": "maintainpro_prod",
            "REDIS_URL": "redis://127.0.0.1:6379/1",
            "ALLOW_INSECURE_HTTP": "true",
            "PYTHONPATH": str(ROOT),
        }
    )
    result = subprocess.run(
        [
            sys.executable,
            "-c",
            (
                "import config.settings.production as p; "
                "assert p.ALLOW_INSECURE_HTTP is True; "
                "assert p.SESSION_COOKIE_SECURE is False; "
                "assert p.CSRF_COOKIE_SECURE is False; "
                "assert p.SECURE_SSL_REDIRECT is False"
            ),
        ],
        cwd=ROOT,
        env=env,
        capture_output=True,
        text=True,
        check=False,
    )
    assert result.returncode == 0, result.stderr


def test_release_build_force_script_static_prefix() -> None:
    env = os.environ.copy()
    env.update(
        {
            "FORCE_SCRIPT_NAME": "/fg",
            "PYTHONPATH": str(ROOT),
        }
    )
    result = subprocess.run(
        [
            sys.executable,
            "-c",
            (
                "import config.settings.release_build as p; "
                "assert p.FORCE_SCRIPT_NAME == '/fg'; "
                "assert p.STATIC_URL == '/fg/static/'; "
                "assert str(p.STATIC_ROOT).endswith('staticfiles')"
            ),
        ],
        cwd=ROOT,
        env=env,
        capture_output=True,
        text=True,
        check=False,
    )
    assert result.returncode == 0, result.stderr

