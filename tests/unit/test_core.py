"""Core foundation tests."""

from __future__ import annotations

from unittest.mock import patch

import pytest
from django.test import Client
from django.urls import reverse


@pytest.mark.django_db
def test_home_page_renders() -> None:
    client = Client()
    response = client.get(reverse("core:home"))
    assert response.status_code == 200
    content = response.content.decode()
    assert "Nelna FG Digital Recording System" in content
    assert 'href="#main-content"' in content
    assert 'id="main-content"' in content
    assert "cdn.jsdelivr" not in content
    assert "unpkg.com" not in content


def test_liveness_does_not_need_db_or_redis() -> None:
    client = Client()
    with (
        patch("apps.core.health.check_postgres") as pg,
        patch("apps.core.health.check_redis") as rd,
    ):
        response = client.get(reverse("core:health-live"))
    assert response.status_code == 200
    assert response.json()["status"] == "alive"
    pg.assert_not_called()
    rd.assert_not_called()


@pytest.mark.django_db
@pytest.mark.integration
def test_readiness_ok_with_dependencies() -> None:
    client = Client()
    response = client.get(reverse("core:health-ready"))
    assert response.status_code == 200
    payload = response.json()
    assert payload["status"] == "ready"
    body = response.content.decode().lower()
    assert "password" not in body
    assert "redis://" not in body
    assert "postgres://" not in body


@pytest.mark.django_db
def test_readiness_503_when_postgres_fails() -> None:
    client = Client()
    with (
        patch(
            "apps.core.health.check_postgres",
            return_value={"name": "postgresql", "status": "unavailable"},
        ),
        patch("apps.core.health.check_redis", return_value={"name": "redis", "status": "ok"}),
        patch(
            "apps.core.health.check_celery_broker",
            return_value={"name": "celery_broker", "status": "ok"},
        ),
        patch(
            "apps.core.health.check_evidence_storage",
            return_value={"name": "evidence_storage", "status": "ok"},
        ),
    ):
        response = client.get(reverse("core:health-ready"))
    assert response.status_code == 503
    assert "redis://" not in response.content.decode()


@pytest.mark.django_db
def test_readiness_503_when_redis_fails() -> None:
    client = Client()
    with (
        patch(
            "apps.core.health.check_postgres", return_value={"name": "postgresql", "status": "ok"}
        ),
        patch(
            "apps.core.health.check_redis", return_value={"name": "redis", "status": "unavailable"}
        ),
        patch(
            "apps.core.health.check_celery_broker",
            return_value={"name": "celery_broker", "status": "ok"},
        ),
        patch(
            "apps.core.health.check_evidence_storage",
            return_value={"name": "evidence_storage", "status": "ok"},
        ),
    ):
        response = client.get(reverse("core:health-ready"))
    assert response.status_code == 503


def test_correlation_id_generated() -> None:
    client = Client()
    response = client.get(reverse("core:health-live"))
    assert "X-Request-ID" in response
    assert len(response["X-Request-ID"]) >= 8


def test_valid_incoming_request_id_accepted() -> None:
    client = Client()
    response = client.get(reverse("core:health-live"), HTTP_X_REQUEST_ID="abcDEF12-valid")
    assert response["X-Request-ID"] == "abcDEF12-valid"


def test_invalid_incoming_request_id_replaced() -> None:
    client = Client()
    response = client.get(reverse("core:health-live"), HTTP_X_REQUEST_ID="bad id")
    assert response["X-Request-ID"] != "bad id"


def test_error_templates_render() -> None:
    client = Client()
    assert client.get("/this-route-does-not-exist/").status_code == 404


def test_htmx_middleware_configured() -> None:
    from django.conf import settings

    assert "django_htmx.middleware.HtmxMiddleware" in settings.MIDDLEWARE


@pytest.mark.django_db
def test_csrf_foundation_on_home() -> None:
    client = Client(enforce_csrf_checks=True)
    response = client.get(reverse("core:home"))
    assert response.status_code == 200
    assert (
        "csrfmiddlewaretoken" in response.content.decode()
        or "csrf-token" in response.content.decode()
    )


def test_redact_mapping() -> None:
    from apps.core.middleware import redact_mapping

    result = redact_mapping({"username": "a", "password": "secret"})
    assert result["password"] == "[REDACTED]"
    assert result["username"] == "a"
