"""Phase 19 — health/readiness and security headers."""

from __future__ import annotations

import pytest
from django.test import Client, override_settings
from django.urls import reverse


@pytest.mark.django_db
def test_liveness_independent_of_dependencies(client: Client) -> None:
    response = client.get(reverse("core:health-live"))
    assert response.status_code == 200
    payload = response.json()
    assert payload["status"] == "alive"
    assert "version" in payload


@pytest.mark.django_db
def test_readiness_reports_required_and_optional_checks(client: Client) -> None:
    from apps.core.persistence.backend import is_mongodb

    response = client.get(reverse("core:health-ready"))
    assert response.status_code in {200, 503}
    payload = response.json()
    names = {c["name"] for c in payload["checks"]}
    assert {"redis", "celery_broker", "evidence_storage"}.issubset(names)
    assert "mongodb" in names
    assert "bileeta_integration" in names
    if is_mongodb():
        assert "postgresql" not in names
    else:
        assert "postgresql" in names


@override_settings(
    CONTENT_SECURITY_POLICY="default-src 'self'",
    PERMISSIONS_POLICY="camera=()",
)
def test_security_headers_present(client: Client) -> None:
    response = client.get(reverse("core:health-live"))
    assert response["Content-Security-Policy"] == "default-src 'self'"
    assert response["Permissions-Policy"] == "camera=()"
    assert response["X-Content-Type-Options"] == "nosniff"
    assert "Referrer-Policy" in response


def test_log_redaction_helper() -> None:
    from apps.core.middleware import redact_mapping

    out = redact_mapping({"password": "secret", "user": "ok", "token": "abc"})
    assert out["password"] == "[REDACTED]"
    assert out["token"] == "[REDACTED]"
    assert out["user"] == "ok"
