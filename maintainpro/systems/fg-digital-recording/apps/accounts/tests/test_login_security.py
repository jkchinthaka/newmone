"""Login security: generic denials, session rotation, concurrency, creation paths."""

from __future__ import annotations

import threading
from concurrent.futures import ThreadPoolExecutor
from datetime import timedelta

import pytest
from django.contrib.auth import get_user_model
from django.core.exceptions import ValidationError
from django.db import connection, connections
from django.test import Client, TransactionTestCase
from django.urls import reverse
from django.utils import timezone
from tests.factories import make_user

from apps.accounts.admin import EmployeeUserCreationForm
from apps.accounts.backends import EmployeeCodeBackend
from apps.accounts.services import (
    GENERIC_LOGIN_ERROR,
    create_application_user,
    record_failed_login,
)
from apps.security_audit.models import SecurityAuditEvent

User = get_user_model()


def _denied_login_snapshot(client: Client, employee_code: str, password: str) -> dict[str, object]:
    response = client.post(
        reverse("accounts:login"),
        {"employee_code": employee_code, "password": password},
        follow=False,
    )
    body = response.content.decode()
    templates = [t.name for t in response.templates]
    return {
        "status_code": response.status_code,
        "location": response.get("Location"),
        "templates": templates,
        "has_generic_error": GENERIC_LOGIN_ERROR in body,
        "has_locked_phrase": ("Account locked" in body) or ("account locked" in body.lower()),
    }


@pytest.mark.django_db
def test_denied_login_responses_are_externally_equivalent(client: Client) -> None:
    make_user(employee_code="EQ001", password="Complex-Test-Pass-123!")
    inactive = make_user(employee_code="EQ002", password="Complex-Test-Pass-123!", is_active=False)
    locked = make_user(employee_code="EQ003", password="Complex-Test-Pass-123!")
    locked.locked_until = timezone.now() + timedelta(minutes=15)
    locked.save(update_fields=["locked_until"])
    assert inactive.employee_code == "EQ002"

    snapshots = [
        _denied_login_snapshot(client, "UNKNOWN99", "Complex-Test-Pass-123!"),
        _denied_login_snapshot(client, "EQ001", "wrong-password"),
        _denied_login_snapshot(client, "EQ002", "Complex-Test-Pass-123!"),
        _denied_login_snapshot(client, "EQ003", "Complex-Test-Pass-123!"),
        _denied_login_snapshot(client, "EQ003", "wrong-password"),
    ]
    baseline = snapshots[0]
    for snap in snapshots[1:]:
        assert snap["status_code"] == baseline["status_code"] == 200
        assert snap["location"] is None
        assert baseline["location"] is None
        assert snap["templates"] == baseline["templates"]
        assert snap["has_generic_error"] is True
        assert snap["has_locked_phrase"] is False
        assert "accounts/login.html" in snap["templates"]  # type: ignore[operator]


@pytest.mark.django_db
def test_locked_account_does_not_extend_failure_counter(client: Client) -> None:
    user = make_user(employee_code="EQ004")
    user.failed_login_count = 5
    user.locked_until = timezone.now() + timedelta(minutes=15)
    user.save(update_fields=["failed_login_count", "locked_until"])
    response = client.post(
        reverse("accounts:login"),
        {"employee_code": "EQ004", "password": "wrong-password"},
    )
    assert response.status_code == 200
    user.refresh_from_db()
    assert user.failed_login_count == 5
    assert user.is_locked is True


@pytest.mark.django_db
def test_successful_login_rotates_session_key(client: Client) -> None:
    make_user(employee_code="SESS001", password="Complex-Test-Pass-123!")
    client.get(reverse("accounts:login"))
    before = client.session.session_key
    assert before
    response = client.post(
        reverse("accounts:login"),
        {"employee_code": "SESS001", "password": "Complex-Test-Pass-123!"},
    )
    assert response.status_code == 302
    after = client.session.session_key
    assert after
    assert after != before
    assert "_auth_user_id" in client.session


@pytest.mark.django_db
def test_password_change_rotates_session_and_keeps_auth(client: Client) -> None:
    user = make_user(employee_code="SESS002", password="Complex-Test-Pass-123!")
    client.force_login(user)
    before = client.session.session_key
    assert before
    response = client.post(
        reverse("accounts:change_password"),
        {
            "current_password": "Complex-Test-Pass-123!",
            "new_password": "Even-More-Complex-Pass-456!",
            "confirm_password": "Even-More-Complex-Pass-456!",
        },
    )
    assert response.status_code == 302
    after = client.session.session_key
    assert after
    assert after != before
    assert "_auth_user_id" in client.session
    user.refresh_from_db()
    assert user.check_password("Even-More-Complex-Pass-456!")
    assert not user.check_password("Complex-Test-Pass-123!")


@pytest.mark.django_db
def test_create_user_requires_employee_code() -> None:
    with pytest.raises(ValueError, match="employee_code is required"):
        User.objects.create_user(username="missing_code", password="Complex-Test-Pass-123!")


@pytest.mark.django_db
def test_create_application_user_requires_employee_code() -> None:
    with pytest.raises(ValidationError):
        create_application_user(employee_code="  ", password="Complex-Test-Pass-123!")
    user = create_application_user(
        employee_code="APP001",
        password="Complex-Test-Pass-123!",
    )
    assert user.employee_code == "APP001"


@pytest.mark.django_db
def test_admin_creation_form_requires_employee_code() -> None:
    form = EmployeeUserCreationForm(
        data={
            "username": "admincreate1",
            "employee_code": "",
            "password1": "Complex-Test-Pass-123!",
            "password2": "Complex-Test-Pass-123!",
        }
    )
    assert form.is_valid() is False
    assert "employee_code" in form.errors


@pytest.mark.django_db
def test_migration_compatible_null_employee_code_orm_path() -> None:
    """Direct ORM construction may omit employee_code for Phase 02 migration only."""
    user = User(username="migrate_only")
    user.set_password("Complex-Test-Pass-123!")
    user.save()
    assert user.employee_code is None
    backend = EmployeeCodeBackend()
    assert (
        backend.authenticate(
            None,
            employee_code="MIGRATE_ONLY",
            password="Complex-Test-Pass-123!",
        )
        is None
    )
    assert (
        backend.authenticate(
            None,
            employee_code=None,
            password="Complex-Test-Pass-123!",
        )
        is None
    )


class ConcurrentLockoutTests(TransactionTestCase):
    def test_concurrent_failed_logins_respect_threshold(self) -> None:
        if connection.vendor != "postgresql":
            self.skipTest("Concurrent lockout threshold race test requires PostgreSQL")
        from django.conf import settings

        settings.AUTH_MAX_FAILED_ATTEMPTS = 5
        user = make_user(employee_code="LOCKCON1", password="Complex-Test-Pass-123!")
        barrier = threading.Barrier(5)
        errors: list[BaseException] = []

        def worker() -> None:
            try:
                barrier.wait(timeout=10)
                record_failed_login(user)
            except BaseException as exc:  # noqa: BLE001 — collect for assertion
                errors.append(exc)
            finally:
                connections.close_all()

        with ThreadPoolExecutor(max_workers=5) as pool:
            list(pool.map(lambda _: worker(), range(5)))

        assert errors == []
        user.refresh_from_db()
        assert user.failed_login_count == 5
        assert user.locked_until is not None
        assert SecurityAuditEvent.objects.filter(
            event_type="ACCOUNT_LOCKED",
            subject_user=user,
        ).exists()
