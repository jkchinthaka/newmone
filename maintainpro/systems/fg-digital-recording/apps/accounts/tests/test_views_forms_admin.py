"""Accounts views, forms, selectors, admin, middleware coverage."""

from __future__ import annotations

from datetime import timedelta
from unittest.mock import MagicMock

import pytest
from django.contrib.admin.sites import AdminSite
from django.contrib.auth.models import AnonymousUser
from django.contrib.messages.middleware import MessageMiddleware
from django.contrib.sessions.middleware import SessionMiddleware
from django.http import HttpResponse
from django.test import Client, RequestFactory
from django.urls import reverse
from django.utils import timezone
from tests.factories import make_user

from apps.accounts.admin import UserAdmin
from apps.accounts.forms import ChangePasswordForm, ForcePasswordChangeForm, LoginForm
from apps.accounts.middleware import ForcedPasswordChangeMiddleware
from apps.accounts.models import User
from apps.accounts.selectors import (
    get_user_by_employee_code,
    get_user_by_id,
    list_active_users,
    list_locked_users,
)
from apps.accounts.services import (
    admin_reset_password,
    set_must_change_password,
)
from apps.accounts.views import login_redirect_target
from apps.security_audit.models import SecurityAuditEvent


@pytest.mark.django_db
def test_login_csrf_rejected() -> None:
    make_user(employee_code="TST040")
    client = Client(enforce_csrf_checks=True)
    response = client.post(
        reverse("accounts:login"),
        {"employee_code": "TST040", "password": "Complex-Test-Pass-123!"},
    )
    assert response.status_code == 403


@pytest.mark.django_db
def test_login_ignores_open_redirect_next(client: Client) -> None:
    make_user(employee_code="TST041")
    response = client.post(
        reverse("accounts:login") + "?next=https://evil.example/",
        {"employee_code": "TST041", "password": "Complex-Test-Pass-123!"},
    )
    assert response.status_code == 302
    assert response["Location"] == reverse("accounts:landing")
    assert "evil" not in response["Location"]


@pytest.mark.django_db
def test_authenticated_login_redirects_to_landing(client: Client) -> None:
    user = make_user(employee_code="TST042")
    client.force_login(user)
    response = client.get(reverse("accounts:login"))
    assert response.status_code == 302
    assert reverse("accounts:landing") in response["Location"]


@pytest.mark.django_db
def test_login_locked_returns_generic_response(client: Client) -> None:
    user = make_user(employee_code="TST043")
    user.locked_until = timezone.now() + timedelta(minutes=15)
    user.save(update_fields=["locked_until"])
    response = client.post(
        reverse("accounts:login"),
        {"employee_code": "TST043", "password": "Complex-Test-Pass-123!"},
    )
    assert response.status_code == 200
    assert reverse("accounts:account_locked") not in (response.get("Location") or "")
    content = response.content.decode()
    assert "Unable to sign in with the provided credentials." in content
    assert "Account locked" not in content
    assert "accounts/login.html" in [t.name for t in response.templates]


@pytest.mark.django_db
def test_login_must_change_password_redirect(client: Client) -> None:
    make_user(employee_code="TST044", must_change_password=True)
    response = client.post(
        reverse("accounts:login"),
        {"employee_code": "TST044", "password": "Complex-Test-Pass-123!"},
    )
    assert response.status_code == 302
    assert reverse("accounts:force_password_change") in response["Location"]


@pytest.mark.django_db
def test_logout_post_and_csrf(client: Client) -> None:
    user = make_user(employee_code="TST045")
    client.force_login(user)
    assert client.get(reverse("accounts:logout")).status_code == 405
    response = client.post(reverse("accounts:logout"))
    assert response.status_code == 302
    assert reverse("accounts:login") in response["Location"]
    assert SecurityAuditEvent.objects.filter(event_type="LOGOUT").exists()

    csrf_client = Client(enforce_csrf_checks=True)
    csrf_client.force_login(user)
    assert csrf_client.post(reverse("accounts:logout")).status_code == 403


@pytest.mark.django_db
def test_change_password_get_and_post(client: Client) -> None:
    user = make_user(employee_code="TST046")
    client.force_login(user)
    assert client.get(reverse("accounts:change_password")).status_code == 200
    response = client.post(
        reverse("accounts:change_password"),
        {
            "current_password": "Complex-Test-Pass-123!",
            "new_password": "Brand-New-Complex-Pass-999!",
            "confirm_password": "Brand-New-Complex-Pass-999!",
        },
    )
    assert response.status_code == 302
    user.refresh_from_db()
    assert user.check_password("Brand-New-Complex-Pass-999!")


@pytest.mark.django_db
def test_change_password_wrong_current(client: Client) -> None:
    user = make_user(employee_code="TST047")
    client.force_login(user)
    response = client.post(
        reverse("accounts:change_password"),
        {
            "current_password": "wrong-password",
            "new_password": "Brand-New-Complex-Pass-999!",
            "confirm_password": "Brand-New-Complex-Pass-999!",
        },
    )
    assert response.status_code == 200
    assert b"Current password is incorrect" in response.content


@pytest.mark.django_db
def test_force_password_change_get_when_not_required(client: Client) -> None:
    user = make_user(employee_code="TST048")
    client.force_login(user)
    response = client.get(reverse("accounts:force_password_change"))
    assert response.status_code == 302
    assert reverse("accounts:landing") in response["Location"]


@pytest.mark.django_db
def test_force_password_change_get_when_required(client: Client) -> None:
    user = make_user(employee_code="TST049", must_change_password=True)
    client.force_login(user)
    response = client.get(reverse("accounts:force_password_change"))
    assert response.status_code == 200


@pytest.mark.django_db
def test_account_locked_and_landing_pages(client: Client) -> None:
    assert client.get(reverse("accounts:account_locked")).status_code == 200
    user = make_user(employee_code="TST050")
    client.force_login(user)
    response = client.get(reverse("accounts:landing"))
    assert response.status_code == 200
    assert b"Welcome" in response.content
    assert b"Dashboard" in response.content


@pytest.mark.django_db
def test_login_redirect_target_helper() -> None:
    user = make_user(employee_code="TST051", must_change_password=True)
    assert login_redirect_target(user) == reverse("accounts:force_password_change")
    user.must_change_password = False
    assert login_redirect_target(user) == reverse("accounts:landing")


@pytest.mark.django_db
def test_forms_validation() -> None:
    user = make_user(employee_code="TST052")
    login = LoginForm(data={"employee_code": "  tst052  ", "password": "x"})
    assert login.is_valid()
    assert login.cleaned_data["employee_code"] == "TST052"

    mismatch = ChangePasswordForm(
        user,
        data={
            "current_password": "Complex-Test-Pass-123!",
            "new_password": "Brand-New-Complex-Pass-111!",
            "confirm_password": "Brand-New-Complex-Pass-222!",
        },
    )
    assert mismatch.is_valid() is False
    assert "confirm_password" in mismatch.errors

    force_mismatch = ForcePasswordChangeForm(
        user,
        data={
            "new_password": "Brand-New-Complex-Pass-111!",
            "confirm_password": "Brand-New-Complex-Pass-222!",
        },
    )
    assert force_mismatch.is_valid() is False

    weak = ChangePasswordForm(
        user,
        data={
            "current_password": "Complex-Test-Pass-123!",
            "new_password": "short",
            "confirm_password": "short",
        },
    )
    assert weak.is_valid() is False


@pytest.mark.django_db
def test_account_selectors() -> None:
    user = make_user(employee_code="TST053")
    locked = make_user(employee_code="TST054")
    locked.locked_until = timezone.now() + timedelta(minutes=10)
    locked.save(update_fields=["locked_until"])

    assert get_user_by_id(user.id) == user
    assert get_user_by_employee_code(" tst053 ") == user
    assert get_user_by_employee_code("   ") is None
    assert user in list_active_users()
    assert locked in list_locked_users()


@pytest.mark.django_db
def test_admin_unlock_and_save_model_paths() -> None:
    site = AdminSite()
    admin = UserAdmin(User, site)
    actor = make_user(employee_code="TSTADMIN4", is_superuser=True, is_staff=True)
    target = make_user(employee_code="TST055")
    target.failed_login_count = 5
    target.locked_until = timezone.now() + timedelta(minutes=15)
    target.save(update_fields=["failed_login_count", "locked_until"])

    request = RequestFactory().post("/admin/")
    request.user = actor
    request.correlation_id = "test-req-1"  # type: ignore[attr-defined]
    SessionMiddleware(lambda r: HttpResponse()).process_request(request)
    request.session.save()
    MessageMiddleware(lambda r: HttpResponse()).process_request(request)

    admin.unlock_selected_accounts(request, User.objects.filter(pk=target.pk))
    target.refresh_from_db()
    assert target.locked_until is None
    assert SecurityAuditEvent.objects.filter(event_type="ACCOUNT_UNLOCKED").exists()

    # Deactivate via save_model
    form = MagicMock()
    form.changed_data = ["is_active"]
    target.is_active = False
    admin.save_model(request, target, form, change=True)
    assert SecurityAuditEvent.objects.filter(event_type="USER_DEACTIVATED").exists()

    form.changed_data = ["is_active"]
    target.is_active = True
    admin.save_model(request, target, form, change=True)
    assert SecurityAuditEvent.objects.filter(event_type="USER_ACTIVATED").exists()

    form.changed_data = ["password"]
    admin.save_model(request, target, form, change=True)
    target.refresh_from_db()
    assert target.must_change_password is True
    assert target.password_changed_at is not None


@pytest.mark.django_db
def test_forced_password_middleware_exemptions() -> None:
    user = make_user(employee_code="TST056", must_change_password=True)
    captured: list[str] = []

    def get_response(request: object) -> HttpResponse:
        captured.append("passed")
        return HttpResponse("ok")

    middleware = ForcedPasswordChangeMiddleware(get_response)
    rf = RequestFactory()

    # Non-auth user
    request = rf.get("/accounts/landing/")
    request.user = AnonymousUser()
    assert middleware(request).content == b"ok"

    # Must change — landing redirects
    request = rf.get("/accounts/landing/")
    request.user = user
    response = middleware(request)
    assert response.status_code == 302
    assert reverse("accounts:force_password_change") in response["Location"]

    # Exempt prefixes
    for path in ("/static/x.css", "/media/x.png", "/health/live/", "/admin/logout/"):
        request = rf.get(path)
        request.user = user
        assert middleware(request).content == b"ok"

    # Exempt named routes
    for name in (
        "accounts:login",
        "accounts:logout",
        "accounts:force_password_change",
        "accounts:account_locked",
        "core:health-live",
        "core:health-ready",
    ):
        request = rf.get(reverse(name))
        request.user = user
        assert middleware(request).content == b"ok"

    # User without must_change
    ok_user = make_user(employee_code="TST057")
    request = rf.get("/accounts/landing/")
    request.user = ok_user
    assert middleware(request).content == b"ok"


@pytest.mark.django_db
def test_middleware_fallback_paths_when_reverse_fails(monkeypatch: pytest.MonkeyPatch) -> None:
    from django.urls import NoReverseMatch

    user = make_user(employee_code="TST058", must_change_password=True)

    def boom(name: str) -> str:
        raise NoReverseMatch(f"resolver down for {name}")

    monkeypatch.setattr("apps.accounts.middleware.reverse", boom)
    middleware = ForcedPasswordChangeMiddleware(lambda r: HttpResponse("ok"))
    rf = RequestFactory()

    for path in (
        "/accounts/login/",
        "/accounts/logout/",
        "/accounts/force-change-password/",
        "/accounts/locked/",
    ):
        request = rf.get(path)
        request.user = user
        assert middleware(request).content == b"ok"

    request = rf.get("/accounts/landing/")
    request.user = user
    assert middleware(request).status_code == 302


@pytest.mark.django_db
def test_admin_reset_and_set_must_change_password() -> None:
    actor = make_user(employee_code="TSTADMIN5", is_superuser=True)
    user = make_user(employee_code="TST059")
    admin_reset_password(user, new_password="Admin-Reset-Pass-333!", actor=actor)
    user.refresh_from_db()
    assert user.must_change_password is True
    assert user.check_password("Admin-Reset-Pass-333!")
    assert SecurityAuditEvent.objects.filter(event_type="PASSWORD_RESET_BY_ADMIN").exists()

    set_must_change_password(user, enabled=False)
    user.refresh_from_db()
    assert user.must_change_password is False


@pytest.mark.django_db
def test_user_str_and_is_locked_property() -> None:
    user = make_user(employee_code="TST060")
    assert str(user) == "TST060"
    # Migration-compatible path: direct ORM construction may omit employee_code.
    bare = User(username="no_code_user")
    bare.set_password("Complex-Test-Pass-123!")
    bare.save()
    assert str(bare) == "no_code_user"
    user.locked_until = timezone.now() + timedelta(minutes=5)
    assert user.is_locked is True


@pytest.mark.django_db
def test_backends_edge_cases() -> None:
    from apps.accounts.backends import EmployeeCodeBackend

    backend = EmployeeCodeBackend()
    assert backend.authenticate(None, employee_code=None, password="x") is None
    assert backend.authenticate(None, employee_code="  ", password="x") is None
