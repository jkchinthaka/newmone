"""Access control / RBAC tests — fail closed; synthetic roles only."""

from __future__ import annotations

import pytest
from django.core.exceptions import PermissionDenied, ValidationError
from tests.factories import (
    grant_role,
    make_org,
    make_permission,
    make_role_with_permission,
    make_site,
    make_user,
)

from apps.access_control.services import (
    Scope,
    assign_role,
    get_accessible_organizations,
    get_accessible_sites,
    get_effective_permissions,
    require_permission,
    revoke_role_assignment,
    user_has_permission,
)


@pytest.mark.django_db
def test_deny_by_default_without_assignment() -> None:
    user = make_user(employee_code="TST001")
    make_permission(codename="view_test_resource")
    assert user_has_permission(user, "accounts.view_test_resource") is False
    with pytest.raises(PermissionDenied):
        require_permission(user, "accounts.view_test_resource")


@pytest.mark.django_db
def test_superuser_has_all_permissions() -> None:
    admin = make_user(employee_code="TSTADMIN", is_superuser=True)
    assert user_has_permission(admin, "accounts.view_test_resource") is True
    perms = get_effective_permissions(admin)
    assert len(perms) > 0


@pytest.mark.django_db
def test_inactive_user_denied() -> None:
    user = make_user(employee_code="TST001", is_active=False)
    role = make_role_with_permission(code="ROLETEST1")
    # Assignment may exist but inactive user must fail closed.
    grant_role(user, role)
    assert user_has_permission(user, "accounts.test_permission") is False


@pytest.mark.django_db
def test_scoped_assignment_covers_org() -> None:
    user = make_user(employee_code="TST001")
    org = make_org(code="ORGTEST1")
    other = make_org(code="ORGTEST2")
    role = make_role_with_permission(code="ROLETEST1")
    grant_role(user, role, organization=org)

    assert (
        user_has_permission(
            user,
            "accounts.test_permission",
            scope=Scope(organization_id=org.id),
        )
        is True
    )
    assert (
        user_has_permission(
            user,
            "accounts.test_permission",
            scope=Scope(organization_id=other.id),
        )
        is False
    )


@pytest.mark.django_db
def test_site_scope_does_not_leak_across_orgs() -> None:
    user = make_user(employee_code="TST001")
    org_a = make_org(code="ORGTEST1")
    org_b = make_org(code="ORGTEST2")
    site_a = make_site(org_a, code="SITETEST1")
    site_b = make_site(org_b, code="SITETEST1")
    role = make_role_with_permission(code="ROLETEST1")
    grant_role(user, role, organization=org_a, site=site_a)

    assert user_has_permission(
        user,
        "accounts.test_permission",
        scope=Scope(organization_id=org_a.id, site_id=site_a.id),
    )
    assert not user_has_permission(
        user,
        "accounts.test_permission",
        scope=Scope(organization_id=org_b.id, site_id=site_b.id),
    )


@pytest.mark.django_db
def test_hierarchy_validation_rejects_mismatched_site() -> None:
    user = make_user(employee_code="TST001")
    org_a = make_org(code="ORGTEST1")
    org_b = make_org(code="ORGTEST2")
    site_b = make_site(org_b, code="SITETEST1")
    role = make_role_with_permission(code="ROLETEST1")
    with pytest.raises(ValidationError):
        assign_role(user=user, role=role, organization=org_a, site=site_b)


@pytest.mark.django_db
def test_duplicate_active_assignment_rejected() -> None:
    user = make_user(employee_code="TST001")
    org = make_org()
    role = make_role_with_permission(code="ROLETEST1")
    grant_role(user, role, organization=org)
    with pytest.raises(ValidationError):
        assign_role(user=user, role=role, organization=org)


@pytest.mark.django_db
def test_revoke_removes_permission() -> None:
    user = make_user(employee_code="TST001")
    role = make_role_with_permission(code="ROLETEST1")
    assignment = grant_role(user, role)
    assert user_has_permission(user, "accounts.test_permission") is True
    revoke_role_assignment(assignment)  # type: ignore[arg-type]
    assert user_has_permission(user, "accounts.test_permission") is False


@pytest.mark.django_db
def test_accessible_organizations_and_sites() -> None:
    user = make_user(employee_code="TST001")
    org = make_org(code="ORGTEST1")
    other = make_org(code="ORGTEST2")
    site = make_site(org, code="SITETEST1")
    make_site(other, code="SITETEST2")
    role = make_role_with_permission(code="ROLETEST1")
    grant_role(user, role, organization=org)

    orgs = list(get_accessible_organizations(user))
    assert org in orgs
    assert other not in orgs
    sites = list(get_accessible_sites(user))
    assert site in sites


@pytest.mark.django_db
def test_anonymous_denied() -> None:
    assert user_has_permission(None, "accounts.test_permission") is False
    assert list(get_accessible_organizations(None)) == []
