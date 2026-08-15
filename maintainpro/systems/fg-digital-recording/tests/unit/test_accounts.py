"""Accounts user model tests."""

from __future__ import annotations

import uuid

import pytest
from django.contrib.auth import get_user_model

from tests.factories import make_user

User = get_user_model()


@pytest.mark.django_db
def test_user_primary_key_is_uuid() -> None:
    user = make_user(employee_code="TST010")
    assert isinstance(user.pk, uuid.UUID)


@pytest.mark.django_db
def test_password_is_hashed() -> None:
    user = make_user(employee_code="TST011", password="complex-pass-123")
    user.refresh_from_db()
    assert user.password != "complex-pass-123"
    assert user.check_password("complex-pass-123")


@pytest.mark.django_db
def test_superuser_flags() -> None:
    admin = make_user(employee_code="TSTADMIN2", is_superuser=True)
    assert admin.is_staff is True
    assert admin.is_superuser is True


@pytest.mark.django_db
def test_no_default_users_seeded() -> None:
    assert User.objects.count() == 0


@pytest.mark.django_db
def test_phase03_identity_fields_present() -> None:
    field_names = {f.name for f in User._meta.get_fields()}
    required = {
        "employee_code",
        "must_change_password",
        "password_changed_at",
        "failed_login_count",
        "locked_until",
        "last_failed_login_at",
        "last_successful_login_at",
    }
    assert required.issubset(field_names)
    forbidden = {"site", "department", "business_role", "profile_image"}
    assert forbidden.isdisjoint(field_names)
