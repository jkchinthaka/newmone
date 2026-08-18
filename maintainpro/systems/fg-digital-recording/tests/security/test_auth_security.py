"""Cross-cutting security tests for Phase 03 auth foundation."""

from __future__ import annotations

import pytest
from apps.security_audit.models import SecurityAuditEvent
from django.test import Client
from django.urls import reverse

from tests.factories import make_user


@pytest.mark.django_db
def test_login_page_accessible(client: Client) -> None:
    response = client.get(reverse("accounts:login"))
    assert response.status_code == 200
    assert b"Employee code" in response.content


@pytest.mark.django_db
def test_generic_failure_message_does_not_reveal_user(client: Client) -> None:
    make_user(employee_code="TST001")
    response = client.post(
        reverse("accounts:login"),
        {"employee_code": "TST001", "password": "wrong"},
    )
    assert response.status_code == 200
    assert b"Unable to sign in with the provided credentials." in response.content
    assert b"does not exist" not in response.content.lower()
    assert b"Account locked" not in response.content


@pytest.mark.django_db
def test_successful_login_redirects_to_landing(client: Client) -> None:
    make_user(employee_code="TST001")
    response = client.post(
        reverse("accounts:login"),
        {"employee_code": "TST001", "password": "Complex-Test-Pass-123!"},
    )
    assert response.status_code == 302
    assert reverse("accounts:landing") in response["Location"]
    assert SecurityAuditEvent.objects.filter(event_type="LOGIN_SUCCESS").exists()


@pytest.mark.django_db
def test_landing_requires_authentication(client: Client) -> None:
    response = client.get(reverse("accounts:landing"))
    assert response.status_code == 302
    assert reverse("accounts:login") in response["Location"]


@pytest.mark.django_db
def test_home_redirects_authenticated_users(client: Client) -> None:
    user = make_user(employee_code="TST001")
    client.force_login(user)
    response = client.get(reverse("core:home"))
    assert response.status_code == 302
    assert reverse("accounts:landing") in response["Location"]


@pytest.mark.django_db
def test_password_not_in_audit_on_login_failure(client: Client) -> None:
    make_user(employee_code="TST001")
    client.post(
        reverse("accounts:login"),
        {"employee_code": "TST001", "password": "secret-should-never-audit"},
    )
    for event in SecurityAuditEvent.objects.all():
        blob = str(event.metadata).lower()
        assert "secret-should-never-audit" not in blob
        assert "password" not in event.metadata
