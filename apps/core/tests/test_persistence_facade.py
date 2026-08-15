"""Tests for backend-neutral persistence facade."""

from __future__ import annotations

import pytest
from django.test import override_settings

from apps.core.persistence import (
    DatabaseVendor,
    atomic,
    detect_database_vendor,
    is_mongodb,
    lock_queryset,
    locked_get,
)


def test_detect_postgresql_default() -> None:
    from apps.core.persistence.backend import is_mongodb

    if is_mongodb():
        pytest.skip("Active Django database engine is MongoDB in this settings module")
    assert detect_database_vendor() is DatabaseVendor.POSTGRESQL
    assert is_mongodb() is False


@override_settings(
    DATABASES={
        "default": {
            "ENGINE": "django_mongodb_backend",
            "HOST": "mongodb://127.0.0.1:27027",
            "NAME": "fg_same_db_poc",
        }
    }
)
def test_detect_mongodb_engine() -> None:
    assert detect_database_vendor() is DatabaseVendor.MONGODB
    assert is_mongodb() is True


@pytest.mark.django_db
def test_lock_queryset_is_noop_identity_on_postgresql() -> None:
    from apps.organizations.models import Organization

    qs = Organization.objects.all()
    locked = lock_queryset(qs)
    assert locked.model is Organization


@pytest.mark.django_db
def test_locked_get_returns_row() -> None:
    from tests.factories import make_org

    from apps.organizations.models import Organization

    org = make_org(code="LOCKGET1", name="Locked get")
    found = locked_get(Organization, pk=org.pk)
    assert found is not None
    assert found.pk == org.pk
    assert locked_get(Organization, pk=org.pk, extra_filters={"code": "NOPE"}) is None


@pytest.mark.django_db
def test_atomic_facade_commits_on_postgresql() -> None:
    from tests.factories import make_org

    with atomic():
        org = make_org(code="PERSIST01", name="Persistence Org")
    from apps.organizations.models import Organization

    assert Organization.objects.filter(pk=org.pk).exists()
