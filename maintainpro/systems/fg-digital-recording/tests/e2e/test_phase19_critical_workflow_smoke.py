"""Phase 19 — browser-equivalent critical workflow smoke via Django test client."""

from __future__ import annotations

import uuid

import pytest
from django.test import Client
from django.urls import reverse

from tests.factories import make_user


@pytest.mark.django_db
def test_login_to_landing_critical_path(client: Client) -> None:
    code = f"E{uuid.uuid4().hex[:6].upper()}"
    make_user(employee_code=code)
    login = client.post(
        reverse("accounts:login"),
        {"employee_code": code, "password": "Complex-Test-Pass-123!"},
    )
    assert login.status_code == 302
    landing = client.get(reverse("accounts:landing"))
    assert landing.status_code == 200
    live = client.get(reverse("core:health-live"))
    assert live.status_code == 200


@pytest.mark.django_db
def test_logout_ends_session(client: Client) -> None:
    code = f"L{uuid.uuid4().hex[:6].upper()}"
    make_user(employee_code=code)
    client.post(
        reverse("accounts:login"),
        {"employee_code": code, "password": "Complex-Test-Pass-123!"},
    )
    response = client.post(reverse("accounts:logout"))
    assert response.status_code in {200, 302}
    landing = client.get(reverse("accounts:landing"))
    assert landing.status_code == 302


@pytest.mark.django_db
def test_correction_path_requires_authentication(client: Client) -> None:
    """Critical review/QA/recording workflow entry points deny anonymous browsers."""
    for name in ("recording:task_list", "reviews:queue", "quality:queue"):
        response = client.get(reverse(name))
        assert response.status_code in {302, 403}
        if response.status_code == 302:
            assert reverse("accounts:login") in response["Location"]

    fake_id = uuid.uuid4()
    response = client.get(reverse("recording:start_correction", kwargs={"submission_id": fake_id}))
    assert response.status_code in {302, 403, 404}
    if response.status_code == 302:
        assert reverse("accounts:login") in response["Location"]
