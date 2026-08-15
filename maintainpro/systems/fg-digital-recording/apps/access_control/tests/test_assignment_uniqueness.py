"""ScopedRoleAssignment uniqueness — PostgreSQL NULLS NOT DISTINCT."""

from __future__ import annotations

import threading
from concurrent.futures import ThreadPoolExecutor

import pytest
from django.core.exceptions import ValidationError
from django.db import IntegrityError, connection, connections
from django.test import TransactionTestCase
from tests.factories import (
    make_department,
    make_org,
    make_role_with_permission,
    make_site,
    make_user,
)

from apps.access_control.models import ScopedRoleAssignment
from apps.access_control.services import assign_role


@pytest.mark.django_db
def test_db_rejects_duplicate_active_global_assignment() -> None:
    user = make_user(employee_code="UNIQ001")
    role = make_role_with_permission(code="UNIQROLE1")
    ScopedRoleAssignment.objects.create(user=user, role=role, is_active=True)
    with pytest.raises(IntegrityError):
        ScopedRoleAssignment.objects.create(user=user, role=role, is_active=True)


@pytest.mark.django_db
def test_db_rejects_duplicate_active_organization_assignment() -> None:
    user = make_user(employee_code="UNIQ002")
    org = make_org(code="UNIQORG1")
    role = make_role_with_permission(code="UNIQROLE2")
    ScopedRoleAssignment.objects.create(user=user, role=role, organization=org, is_active=True)
    with pytest.raises(IntegrityError):
        ScopedRoleAssignment.objects.create(user=user, role=role, organization=org, is_active=True)


@pytest.mark.django_db
def test_db_rejects_duplicate_active_site_assignment() -> None:
    user = make_user(employee_code="UNIQ003")
    org = make_org(code="UNIQORG2")
    site = make_site(org, code="UNIQSITE1")
    role = make_role_with_permission(code="UNIQROLE3")
    ScopedRoleAssignment.objects.create(
        user=user, role=role, organization=org, site=site, is_active=True
    )
    with pytest.raises(IntegrityError):
        ScopedRoleAssignment.objects.create(
            user=user, role=role, organization=org, site=site, is_active=True
        )


@pytest.mark.django_db
def test_db_rejects_duplicate_active_department_assignment() -> None:
    user = make_user(employee_code="UNIQ004")
    org = make_org(code="UNIQORG3")
    site = make_site(org, code="UNIQSITE2")
    dept = make_department(org, code="UNIQDEPT1", site=site)
    role = make_role_with_permission(code="UNIQROLE4")
    ScopedRoleAssignment.objects.create(
        user=user,
        role=role,
        organization=org,
        site=site,
        department=dept,
        is_active=True,
    )
    with pytest.raises(IntegrityError):
        ScopedRoleAssignment.objects.create(
            user=user,
            role=role,
            organization=org,
            site=site,
            department=dept,
            is_active=True,
        )


@pytest.mark.django_db
def test_same_role_allowed_across_different_organizations_sites_departments() -> None:
    user = make_user(employee_code="UNIQ005")
    org_a = make_org(code="UNIQORG4")
    org_b = make_org(code="UNIQORG5")
    site_a = make_site(org_a, code="UNIQSITE3")
    site_b = make_site(org_b, code="UNIQSITE4")
    dept_a = make_department(org_a, code="UNIQDEPT2", site=site_a)
    dept_b = make_department(org_b, code="UNIQDEPT3", site=site_b)
    role = make_role_with_permission(code="UNIQROLE5")

    ScopedRoleAssignment.objects.create(user=user, role=role, organization=org_a, is_active=True)
    ScopedRoleAssignment.objects.create(user=user, role=role, organization=org_b, is_active=True)
    ScopedRoleAssignment.objects.create(
        user=user, role=role, organization=org_a, site=site_a, is_active=True
    )
    ScopedRoleAssignment.objects.create(
        user=user, role=role, organization=org_b, site=site_b, is_active=True
    )
    ScopedRoleAssignment.objects.create(
        user=user,
        role=role,
        organization=org_a,
        site=site_a,
        department=dept_a,
        is_active=True,
    )
    ScopedRoleAssignment.objects.create(
        user=user,
        role=role,
        organization=org_b,
        site=site_b,
        department=dept_b,
        is_active=True,
    )
    assert ScopedRoleAssignment.objects.filter(user=user, role=role, is_active=True).count() == 6


@pytest.mark.django_db
def test_inactive_historical_duplicate_allowed() -> None:
    user = make_user(employee_code="UNIQ006")
    role = make_role_with_permission(code="UNIQROLE6")
    ScopedRoleAssignment.objects.create(user=user, role=role, is_active=False)
    ScopedRoleAssignment.objects.create(user=user, role=role, is_active=False)
    active = ScopedRoleAssignment.objects.create(user=user, role=role, is_active=True)
    assert active.is_active is True


@pytest.mark.django_db
def test_reactivating_duplicate_assignment_rejected() -> None:
    user = make_user(employee_code="UNIQ007")
    role = make_role_with_permission(code="UNIQROLE7")
    ScopedRoleAssignment.objects.create(user=user, role=role, is_active=True)
    inactive = ScopedRoleAssignment.objects.create(user=user, role=role, is_active=False)
    inactive.is_active = True
    with pytest.raises(IntegrityError):
        inactive.save()


@pytest.mark.django_db
def test_service_duplicate_raises_validation_error() -> None:
    user = make_user(employee_code="UNIQ008")
    role = make_role_with_permission(code="UNIQROLE8")
    assign_role(user=user, role=role)
    with pytest.raises(ValidationError, match="already exists"):
        assign_role(user=user, role=role)


@pytest.mark.django_db
def test_nulls_not_distinct_constraint_present() -> None:
    assert connection.vendor == "postgresql"
    with connection.cursor() as cursor:
        cursor.execute(
            """
            SELECT indexdef
            FROM pg_indexes
            WHERE tablename = 'access_control_scopedroleassignment'
              AND indexname = 'ac_active_assignment_uniq'
            """
        )
        row = cursor.fetchone()
    assert row is not None
    indexdef = row[0].upper()
    assert "UNIQUE INDEX" in indexdef
    assert "NULLS NOT DISTINCT" in indexdef
    assert "WHERE" in indexdef and "IS_ACTIVE" in indexdef.replace(" ", "")


class ConcurrentAssignmentTests(TransactionTestCase):
    def test_concurrent_duplicate_global_assignment_one_succeeds(self) -> None:
        assert connection.vendor == "postgresql"
        user = make_user(employee_code="UNIQCON1")
        role = make_role_with_permission(code="UNIQROLEC1")
        barrier = threading.Barrier(2)
        outcomes: list[str] = []
        lock = threading.Lock()

        def worker() -> None:
            try:
                barrier.wait(timeout=10)
                assign_role(user=user, role=role)
                with lock:
                    outcomes.append("ok")
            except ValidationError:
                with lock:
                    outcomes.append("validation")
            except IntegrityError:
                with lock:
                    outcomes.append("integrity")
            finally:
                connections.close_all()

        with ThreadPoolExecutor(max_workers=2) as pool:
            list(pool.map(lambda _: worker(), range(2)))

        assert outcomes.count("ok") == 1
        assert outcomes.count("validation") + outcomes.count("integrity") == 1
        assert (
            ScopedRoleAssignment.objects.filter(user=user, role=role, is_active=True).count() == 1
        )
