"""Authentication UI polish — template and asset regression tests."""

from __future__ import annotations

from pathlib import Path

import pytest
from django.test import Client
from django.urls import reverse
from tests.factories import make_user

REPO_ROOT = Path(__file__).resolve().parents[3]


@pytest.mark.django_db
def test_login_page_renders_brand_and_labels(client: Client) -> None:
    response = client.get(reverse("accounts:login"))
    assert response.status_code == 200
    content = response.content.decode()
    assert "Sign in" in content
    assert "Employee code" in content
    assert "Password" in content
    assert "FG Digital Recording System" in content
    assert "Secure employee access" in content
    assert 'name="csrfmiddlewaretoken"' in content
    assert 'autocomplete="username"' in content
    assert 'autocomplete="current-password"' in content
    assert "forgot" not in content.lower()
    assert "register" not in content.lower()
    assert "cdn.jsdelivr" not in content
    assert "fonts.googleapis" not in content


@pytest.mark.django_db
def test_login_generic_error_and_password_toggle_markup(client: Client) -> None:
    make_user(employee_code="UI001")
    response = client.post(
        reverse("accounts:login"),
        {"employee_code": "UI001", "password": "wrong-password"},
    )
    assert response.status_code == 200
    content = response.content.decode()
    assert "Unable to sign in with the provided credentials." in content
    assert "Account locked" not in content
    assert "data-password-toggle" in content
    assert "aria-controls=" in content
    assert reverse("accounts:account_locked") not in (response.get("Location") or "")


@pytest.mark.django_db
def test_change_password_page_shows_requirements(client: Client) -> None:
    user = make_user(employee_code="UI002")
    client.force_login(user)
    response = client.get(reverse("accounts:change_password"))
    assert response.status_code == 200
    content = response.content.decode()
    assert "Password requirements" in content
    assert "Current password" in content
    assert 'autocomplete="current-password"' in content
    assert 'autocomplete="new-password"' in content
    assert "data-password-toggle" in content


@pytest.mark.django_db
def test_force_password_change_page_renders(client: Client) -> None:
    user = make_user(employee_code="UI003", must_change_password=True)
    client.force_login(user)
    response = client.get(reverse("accounts:force_password_change"))
    assert response.status_code == 200
    content = response.content.decode()
    assert "Password change required" in content
    assert "Password requirements" in content
    assert "Current password" not in content
    assert 'autocomplete="new-password"' in content


@pytest.mark.django_db
def test_landing_page_authenticated_and_logout_post(client: Client) -> None:
    user = make_user(employee_code="UI004")
    client.force_login(user)
    response = client.get(reverse("accounts:landing"))
    assert response.status_code == 200
    content = response.content.decode()
    assert "Welcome" in content
    assert "UI004" in content
    assert "Production use remains gated" in content
    assert "No production master data or forms are seeded" in content
    assert "Checklist Definitions" not in content  # no view permission yet
    assert 'method="post"' in content
    assert reverse("accounts:logout") in content
    assert client.get(reverse("accounts:logout")).status_code == 405


@pytest.mark.django_db
def test_landing_requires_authentication(client: Client) -> None:
    response = client.get(reverse("accounts:landing"))
    assert response.status_code == 302
    assert reverse("accounts:login") in response["Location"]


@pytest.mark.django_db
def test_403_template_authenticated_and_anonymous() -> None:
    from django.contrib.auth.models import AnonymousUser
    from django.template.loader import render_to_string

    anonymous_html = render_to_string("errors/403.html", {"user": AnonymousUser()})
    assert "403 — Forbidden" in anonymous_html
    assert "Sign in" in anonymous_html

    user = make_user(employee_code="UI005")
    authed_html = render_to_string("errors/403.html", {"user": user})
    assert "Return to landing" in authed_html


@pytest.mark.django_db
def test_account_locked_page_is_non_enumerating(client: Client) -> None:
    response = client.get(reverse("accounts:account_locked"))
    assert response.status_code == 200
    content = response.content.decode().lower()
    assert "does not confirm whether a specific employee code exists" in content
    assert "return to sign in" in content


def test_auth_assets_are_local_and_have_no_cdn() -> None:
    app_js = (REPO_ROOT / "static" / "src" / "js" / "app.js").read_text(encoding="utf-8")
    assert "data-password-toggle" in app_js
    assert "password" in app_js.lower()
    assert "fetch(" not in app_js
    assert "localStorage" not in app_js
    css = (REPO_ROOT / "static" / "src" / "css" / "app.css").read_text(encoding="utf-8")
    assert ".auth-card" in css
    assert "cdn.jsdelivr" not in css
    assert "@import url(" not in css


def test_no_font_binaries_committed() -> None:
    forbidden = {".ttf", ".otf", ".woff", ".woff2", ".eot"}
    for path in (REPO_ROOT / "static").rglob("*"):
        if path.is_file():
            assert path.suffix.lower() not in forbidden
