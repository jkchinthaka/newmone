"""Extended RBAC service coverage — synthetic scopes only."""

from __future__ import annotations

from datetime import timedelta

import pytest
from django.core.exceptions import PermissionDenied, ValidationError
from django.utils import timezone
from tests.factories import (
    grant_role,
    make_department,
    make_org,
    make_permission,
    make_role_with_permission,
    make_site,
    make_user,
)

from apps.access_control.models import Role, ScopedRoleAssignment
from apps.access_control.selectors import (
    get_role_by_code,
    get_role_by_id,
    list_active_assignments_for_user,
    list_active_roles,
)
from apps.access_control.services import (
    Scope,
    assign_role,
    get_accessible_departments,
    get_accessible_organizations,
    get_accessible_sites,
    get_effective_permissions,
    require_permission,
    revoke_role_assignment,
    user_has_permission,
)


@pytest.mark.django_db
def test_require_permission_passes_and_fails() -> None:
    role = make_role_with_permission(code="ROLETEST1")
    user = make_user(employee_code="TST020")
    grant_role(user, role)
    require_permission(user, "accounts.test_permission")
    with pytest.raises(PermissionDenied):
        require_permission(user, "accounts.missing_permission")


@pytest.mark.django_db
def test_global_assignment_grants_everywhere() -> None:
    org = make_org(code="ORGTEST1")
    site = make_site(org, code="SITETEST1")
    dept = make_department(org, code="DEPTTEST1", site=site)
    role = make_role_with_permission(code="ROLETEST1")
    user = make_user(employee_code="TST021")
    grant_role(user, role)  # system-wide

    assert user_has_permission(user, "accounts.test_permission") is True
    assert user_has_permission(
        user,
        "accounts.test_permission",
        scope=Scope(organization_id=org.id, site_id=site.id, department_id=dept.id),
    )
    assert org in get_accessible_organizations(user)
    assert site in get_accessible_sites(user)
    assert dept in get_accessible_departments(user)


@pytest.mark.django_db
def test_expired_and_future_assignments_denied() -> None:
    role = make_role_with_permission(code="ROLETEST1")
    user = make_user(employee_code="TST022")
    now = timezone.now()

    past = assign_role(
        user=user,
        role=role,
        valid_from=now - timedelta(days=10),
        valid_until=now - timedelta(days=1),
    )
    assert user_has_permission(user, "accounts.test_permission") is False
    revoke_role_assignment(past)

    future = assign_role(
        user=user,
        role=role,
        valid_from=now + timedelta(days=1),
        valid_until=now + timedelta(days=10),
    )
    assert user_has_permission(user, "accounts.test_permission") is False
    assert future.is_currently_valid() is False


@pytest.mark.django_db
def test_inactive_role_or_assignment_denied() -> None:
    role = make_role_with_permission(code="ROLETEST1")
    user = make_user(employee_code="TST023")
    assignment = grant_role(user, role)
    role.is_active = False
    role.save(update_fields=["is_active"])
    assert user_has_permission(user, "accounts.test_permission") is False

    role.is_active = True
    role.save(update_fields=["is_active"])
    assignment.is_active = False  # type: ignore[attr-defined]
    assignment.save(update_fields=["is_active", "updated_at"])  # type: ignore[attr-defined]
    assert user_has_permission(user, "accounts.test_permission") is False


@pytest.mark.django_db
def test_department_and_site_scope_coverage() -> None:
    org = make_org(code="ORGTEST1")
    site = make_site(org, code="SITETEST1")
    dept = make_department(org, code="DEPTTEST1", site=site)
    other_dept = make_department(org, code="DEPTTEST2", site=site)
    role = make_role_with_permission(code="ROLETEST1")
    user = make_user(employee_code="TST024")

    grant_role(user, role, organization=org, site=site, department=dept)
    assert user_has_permission(
        user,
        "accounts.test_permission",
        scope=Scope(department_id=dept.id),
    )
    assert not user_has_permission(
        user,
        "accounts.test_permission",
        scope=Scope(department_id=other_dept.id),
    )

    # Site-level assignment covers departments on that site
    user2 = make_user(employee_code="TST025")
    perm2 = make_permission(codename="perm2")
    role2 = make_role_with_permission(code="ROLETEST2", permission=perm2)
    grant_role(user2, role2, organization=org, site=site)
    assert user_has_permission(
        user2,
        "accounts.perm2",
        scope=Scope(department_id=dept.id),
    )
    assert user_has_permission(
        user2,
        "accounts.perm2",
        scope=Scope(site_id=site.id),
    )
    # Site assignment does not cover org-only scope without site/dept
    assert not user_has_permission(
        user2,
        "accounts.perm2",
        scope=Scope(organization_id=org.id),
    )


@pytest.mark.django_db
def test_org_assignment_covers_site_and_department_by_lookup() -> None:
    org = make_org(code="ORGTEST1")
    site = make_site(org, code="SITETEST1")
    dept = make_department(org, code="DEPTTEST1", site=site)
    role = make_role_with_permission(code="ROLETEST1")
    user = make_user(employee_code="TST026")
    grant_role(user, role, organization=org)

    assert user_has_permission(
        user,
        "test_permission",  # bare codename
        scope=Scope(site_id=site.id),
    )
    assert user_has_permission(
        user,
        "accounts.test_permission",
        scope=Scope(department_id=dept.id),
    )


@pytest.mark.django_db
def test_get_accessible_filters_and_superuser() -> None:
    org = make_org(code="ORGTEST1")
    other = make_org(code="ORGTEST2")
    site = make_site(org, code="SITETEST1")
    other_site = make_site(other, code="SITETEST2")
    dept = make_department(org, code="DEPTTEST1", site=site)
    make_department(other, code="DEPTTEST2", site=other_site)

    admin = make_user(employee_code="TSTADMIN3", is_superuser=True)
    assert org in get_accessible_organizations(admin)
    assert other in get_accessible_organizations(admin)
    assert site in get_accessible_sites(admin, organization_id=org.id)
    assert other_site not in get_accessible_sites(admin, organization_id=org.id)
    assert dept in get_accessible_departments(admin, organization_id=org.id, site_id=site.id)

    user = make_user(employee_code="TST027")
    role = make_role_with_permission(code="ROLETEST1")
    grant_role(user, role, organization=org, site=site)
    sites = list(get_accessible_sites(user, organization_id=org.id))
    assert site in sites
    assert other_site not in sites
    depts = list(get_accessible_departments(user, site_id=site.id))
    assert dept in depts


@pytest.mark.django_db
def test_get_effective_permissions_scoped() -> None:
    org = make_org(code="ORGTEST1")
    other = make_org(code="ORGTEST2")
    role = make_role_with_permission(code="ROLETEST1")
    user = make_user(employee_code="TST028")
    grant_role(user, role, organization=org)

    perms = get_effective_permissions(user, scope=Scope(organization_id=org.id))
    assert "accounts.test_permission" in perms
    assert get_effective_permissions(user, scope=Scope(organization_id=other.id)) == set()
    assert get_effective_permissions(None) == set()


@pytest.mark.django_db
def test_assignment_hierarchy_validation_errors() -> None:
    org = make_org(code="ORGTEST1")
    other = make_org(code="ORGTEST2")
    site = make_site(org, code="SITETEST1")
    dept = make_department(org, code="DEPTTEST1", site=site)
    org_level_dept = make_department(org, code="DEPTTEST3", site=None)
    role = make_role_with_permission(code="ROLETEST1")
    user = make_user(employee_code="TST029")

    with pytest.raises(ValidationError):
        assign_role(user=user, role=role, site=site)  # missing organization

    with pytest.raises(ValidationError):
        assign_role(user=user, role=role, department=dept)  # missing organization

    with pytest.raises(ValidationError):
        assign_role(
            user=user,
            role=role,
            organization=other,
            department=dept,
        )

    with pytest.raises(ValidationError):
        assign_role(
            user=user,
            role=role,
            organization=org,
            site=site,
            department=org_level_dept,
        )

    now = timezone.now()
    with pytest.raises(ValidationError):
        assign_role(
            user=user,
            role=role,
            organization=org,
            valid_from=now + timedelta(days=5),
            valid_until=now + timedelta(days=1),
        )


@pytest.mark.django_db
def test_selectors_and_role_str() -> None:
    role = make_role_with_permission(code="ROLETEST1", name="Test Role")
    user = make_user(employee_code="TST030")
    grant_role(user, role)

    assert get_role_by_code("roletest1") == role
    assert get_role_by_id(role.id) == role
    assert role in list_active_roles()
    assert list_active_assignments_for_user(user).count() == 1
    assert str(role).startswith("ROLETEST1")
    assert "ROLETEST1" in str(list_active_assignments_for_user(user).first())


@pytest.mark.django_db
def test_is_currently_valid_edges() -> None:
    role = make_role_with_permission(code="ROLETEST1")
    user = make_user(employee_code="TST031")
    assignment = grant_role(user, role)
    assert isinstance(assignment, ScopedRoleAssignment)
    assert assignment.is_currently_valid() is True
    assignment.is_active = False
    assert assignment.is_currently_valid() is False


@pytest.mark.django_db
def test_create_role_without_permissions() -> None:
    from apps.access_control.services import create_role

    role = create_role(code="ROLEEMPTY", name="Empty Role")
    assert isinstance(role, Role)
    assert role.permissions.count() == 0
