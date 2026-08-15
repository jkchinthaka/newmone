"""Accounts authentication and lockout tests — synthetic employee codes only."""

from __future__ import annotations

import uuid
from datetime import timedelta

import pytest
from django.contrib.auth import get_user_model
from django.contrib.sessions.backends.db import SessionStore
from django.contrib.sessions.middleware import SessionMiddleware
from django.db import IntegrityError
from django.http import HttpRequest
from django.test import Client, RequestFactory
from django.urls import reverse
from django.utils import timezone
from tests.factories import make_user

from apps.accounts.backends import EmployeeCodeBackend
from apps.accounts.services import (
    authenticate_login,
    change_password,
    unlock_account,
)
from apps.accounts.validators import normalize_employee_code
from apps.security_audit.models import SecurityAuditEvent

User = get_user_model()


def _request_with_session(factory: RequestFactory, path: str = "/accounts/login/") -> HttpRequest:
    request = factory.post(path)
    middleware = SessionMiddleware(lambda _r: None)  # type: ignore[arg-type]
    middleware.process_request(request)
    request.session = SessionStore()
    request.session.save()
    return request


@pytest.mark.django_db
def test_normalize_employee_code() -> None:
    assert normalize_employee_code("  tst001  ") == "TST001"


@pytest.mark.django_db
def test_employee_code_case_insensitive_unique() -> None:
    make_user(employee_code="TST001")
    with pytest.raises(IntegrityError):
        User.objects.create_user(
            username="other",
            password="Complex-Test-Pass-123!",
            employee_code="tst001",
        )


@pytest.mark.django_db
def test_employee_code_backend_authenticates() -> None:
    make_user(employee_code="TST001", password="Complex-Test-Pass-123!")
    backend = EmployeeCodeBackend()
    user = backend.authenticate(
        None,
        employee_code="tst001",
        password="Complex-Test-Pass-123!",
    )
    assert user is not None
    assert isinstance(user, User)
    assert user.employee_code == "TST001"


@pytest.mark.django_db
def test_backend_rejects_inactive_and_locked() -> None:
    inactive = make_user(employee_code="TST002", is_active=False)
    backend = EmployeeCodeBackend()
    assert (
        backend.authenticate(None, employee_code="TST002", password="Complex-Test-Pass-123!")
        is None
    )

    locked = make_user(employee_code="TST003")
    locked.locked_until = timezone.now() + timedelta(minutes=15)
    locked.save(update_fields=["locked_until"])
    assert (
        backend.authenticate(None, employee_code="TST003", password="Complex-Test-Pass-123!")
        is None
    )
    assert inactive.employee_code == "TST002"


@pytest.mark.django_db
def test_login_lockout_after_max_failures(client: Client, settings: object) -> None:
    settings.AUTH_MAX_FAILED_ATTEMPTS = 5  # type: ignore[attr-defined]
    settings.AUTH_LOCKOUT_MINUTES = 15  # type: ignore[attr-defined]
    make_user(employee_code="TST001")

    for _ in range(5):
        response = client.post(
            reverse("accounts:login"),
            {"employee_code": "TST001", "password": "wrong-password"},
        )

    user = User.objects.get(employee_code="TST001")
    assert user.failed_login_count >= 5
    assert user.locked_until is not None
    assert response.status_code in {200, 302}
    assert SecurityAuditEvent.objects.filter(event_type="ACCOUNT_LOCKED").exists()


@pytest.mark.django_db
def test_successful_login_resets_counters(rf: RequestFactory) -> None:
    user = make_user(employee_code="TST001")
    user.failed_login_count = 3
    user.save(update_fields=["failed_login_count"])
    request = _request_with_session(rf)

    result = authenticate_login(
        request,
        employee_code="TST001",
        password="Complex-Test-Pass-123!",
    )
    assert result.success is True
    user.refresh_from_db()
    assert user.failed_login_count == 0
    assert user.last_successful_login_at is not None
    assert SecurityAuditEvent.objects.filter(event_type="LOGIN_SUCCESS").exists()


@pytest.mark.django_db
def test_unknown_login_masks_identifier(rf: RequestFactory) -> None:
    request = _request_with_session(rf)
    result = authenticate_login(request, employee_code="UNKNOWN99", password="x")
    assert result.success is False
    event = SecurityAuditEvent.objects.filter(event_type="LOGIN_FAILURE").latest("created_at")
    assert "identifier" in event.metadata
    assert event.metadata["identifier"].startswith("unknown:")
    assert "UNKNOWN99" not in str(event.metadata)


@pytest.mark.django_db
def test_logout_requires_post(client: Client) -> None:
    user = make_user(employee_code="TST001")
    client.force_login(user)
    response = client.get(reverse("accounts:logout"))
    assert response.status_code == 405


@pytest.mark.django_db
def test_change_password_and_force_flow(client: Client) -> None:
    user = make_user(employee_code="TST001", must_change_password=True)
    client.force_login(user)
    response = client.get(reverse("accounts:landing"))
    assert response.status_code == 302
    assert reverse("accounts:force_password_change") in response["Location"]

    response = client.post(
        reverse("accounts:force_password_change"),
        {
            "new_password": "Even-More-Complex-Pass-456!",
            "confirm_password": "Even-More-Complex-Pass-456!",
        },
    )
    assert response.status_code == 302
    user.refresh_from_db()
    assert user.must_change_password is False
    assert user.check_password("Even-More-Complex-Pass-456!")


@pytest.mark.django_db
def test_change_password_requires_current(client: Client) -> None:
    user = make_user(employee_code="TST001")
    client.force_login(user)
    change_password(
        user,
        current_password="Complex-Test-Pass-123!",
        new_password="Another-Complex-Pass-789!",
    )
    user.refresh_from_db()
    assert user.check_password("Another-Complex-Pass-789!")


@pytest.mark.django_db
def test_unlock_account_clears_lockout() -> None:
    user = make_user(employee_code="TST001")
    user.failed_login_count = 5
    user.locked_until = timezone.now() + timedelta(minutes=15)
    user.save(update_fields=["failed_login_count", "locked_until"])
    unlock_account(user)
    user.refresh_from_db()
    assert user.failed_login_count == 0
    assert user.locked_until is None
    assert SecurityAuditEvent.objects.filter(event_type="ACCOUNT_UNLOCKED").exists()


@pytest.mark.django_db
def test_user_primary_key_is_uuid() -> None:
    user = make_user(employee_code="TST099")
    assert isinstance(user.pk, uuid.UUID)


@pytest.mark.django_db
def test_no_default_users_seeded() -> None:
    assert User.objects.count() == 0
