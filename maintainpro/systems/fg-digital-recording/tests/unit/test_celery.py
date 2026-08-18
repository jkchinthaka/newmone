"""Celery foundation tests."""

from __future__ import annotations

from apps.core.tasks import health_echo
from config.celery import app
from django.conf import settings


def test_celery_app_loads() -> None:
    assert app.main == "nelna_fg"


def test_celery_json_serializers() -> None:
    assert settings.CELERY_TASK_SERIALIZER == "json"
    assert settings.CELERY_RESULT_SERIALIZER == "json"
    assert settings.CELERY_ACCEPT_CONTENT == ["json"]


def test_health_echo_eager() -> None:
    assert settings.CELERY_TASK_ALWAYS_EAGER is True
    result = health_echo.delay("ping").get()
    assert result == {"echo": "ping", "status": "ok"}
    assert "password" not in str(result).lower()
    assert "redis://" not in str(result)
