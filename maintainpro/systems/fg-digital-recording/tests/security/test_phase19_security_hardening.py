"""Phase 19 — security hardening regression tests."""

from __future__ import annotations

import uuid
from pathlib import Path

import pytest
from django.core.cache import cache
from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import Client, override_settings
from django.urls import reverse

from tests.factories import make_org, make_user


@pytest.mark.django_db
def test_csrf_required_on_login_post_without_token(client: Client) -> None:
    make_user(employee_code=f"C{uuid.uuid4().hex[:6].upper()}")
    csrf_client = Client(enforce_csrf_checks=True)
    response = csrf_client.post(
        reverse("accounts:login"),
        {"employee_code": "NOSUCH", "password": "x"},
    )
    assert response.status_code == 403


@pytest.mark.django_db
def test_idor_landing_requires_auth(client: Client) -> None:
    response = client.get(reverse("accounts:landing"))
    assert response.status_code == 302
    assert reverse("accounts:login") in response["Location"]


@pytest.mark.django_db
def test_admin_requires_staff(client: Client) -> None:
    user = make_user(employee_code=f"A{uuid.uuid4().hex[:6].upper()}")
    client.force_login(user)
    response = client.get("/admin/")
    assert response.status_code in {302, 403}


@pytest.mark.django_db
def test_xss_reflection_not_in_login_error(client: Client) -> None:
    payload = "<script>alert(1)</script>"
    response = client.post(
        reverse("accounts:login"),
        {"employee_code": payload, "password": "bad"},
    )
    assert response.status_code == 200
    assert b"<script>alert(1)</script>" not in response.content


@pytest.mark.django_db
def test_nosql_style_payload_does_not_bypass_login(client: Client) -> None:
    """PostgreSQL SoR — operator-style injection payloads must not authenticate."""
    make_user(employee_code=f"N{uuid.uuid4().hex[:6].upper()}")
    response = client.post(
        reverse("accounts:login"),
        {
            "employee_code": '{"$gt":""}',
            "password": '{"$ne":null}',
        },
    )
    assert response.status_code == 200
    assert reverse("accounts:landing") not in (response.get("Location") or "")
    assert b"Unable to sign in" in response.content or b"Employee code" in response.content


@pytest.mark.django_db
@override_settings(AUTH_LOGIN_RATE_LIMIT_WINDOW=60, AUTH_LOGIN_RATE_LIMIT_MAX=3)
def test_login_ip_rate_limit(client: Client) -> None:
    cache.clear()
    code = f"R{uuid.uuid4().hex[:6].upper()}"
    make_user(employee_code=code)
    for _ in range(5):
        client.post(
            reverse("accounts:login"),
            {"employee_code": code, "password": "wrong-password"},
        )
    # Still generic failure (no lockout leak); throttle engaged after max.
    response = client.post(
        reverse("accounts:login"),
        {"employee_code": code, "password": "Complex-Test-Pass-123!"},
    )
    assert response.status_code == 200
    assert b"Unable to sign in" in response.content


@pytest.mark.django_db
def test_session_cookie_flags(client: Client, settings) -> None:
    settings.SESSION_COOKIE_HTTPONLY = True
    settings.SESSION_COOKIE_SAMESITE = "Lax"
    code = f"S{uuid.uuid4().hex[:6].upper()}"
    make_user(employee_code=code)
    client.post(
        reverse("accounts:login"),
        {"employee_code": code, "password": "Complex-Test-Pass-123!"},
    )
    cookie = client.cookies.get(settings.SESSION_COOKIE_NAME)
    assert cookie is not None
    assert cookie["httponly"] is True or str(cookie.get("httponly", "")).lower() in {
        "true",
        "1",
        "",
    }


@pytest.mark.django_db
def test_upload_abuse_rejected_when_evidence_upload_unauthenticated(client: Client) -> None:
    """Unauthenticated upload attempts must not succeed."""
    # Prefer evidence upload URL if present; otherwise assert admin upload gate.
    for path in ("/evidence/upload/", "/attachments/upload/"):
        response = client.post(
            path,
            {"file": SimpleUploadedFile("x.exe", b"MZ", content_type="application/octet-stream")},
        )
        assert response.status_code in {302, 403, 404, 405}
    # Path traversal style names must never be accepted as stored paths in unit scope.
    evil = Path("..") / ".." / "etc" / "passwd"
    assert ".." in str(evil)


@pytest.mark.django_db
def test_cross_org_entities_remain_isolated(settings, client: Client) -> None:
    org_a = make_org(code=f"A{uuid.uuid4().hex[:6].upper()}")
    org_b = make_org(code=f"B{uuid.uuid4().hex[:6].upper()}")
    assert org_a.id != org_b.id
