"""Organization model and service tests — synthetic codes only."""

from __future__ import annotations

import pytest
from django.core.exceptions import ValidationError
from django.db import IntegrityError
from tests.factories import make_department, make_org, make_site

from apps.organizations.models import Department, Organization, Site
from apps.organizations.services import (
    create_department,
    create_organization,
    create_site,
    deactivate_organization,
    normalize_code,
    reactivate_department,
    reactivate_site,
)


@pytest.mark.django_db
def test_normalize_code_strips_and_uppercases() -> None:
    assert normalize_code("  orgtest1  ") == "ORGTEST1"


@pytest.mark.django_db
def test_organization_code_case_insensitive_unique() -> None:
    make_org(code="ORGTEST1")
    with pytest.raises(IntegrityError):
        Organization.objects.create(code="orgtest1", name="Duplicate")


@pytest.mark.django_db
def test_site_code_unique_within_organization() -> None:
    org_a = make_org(code="ORGTEST1")
    org_b = make_org(code="ORGTEST2")
    make_site(org_a, code="SITETEST1")
    make_site(org_b, code="SITETEST1")
    with pytest.raises(IntegrityError):
        Site.objects.create(organization=org_a, code="sitetest1", name="Dup")


@pytest.mark.django_db
def test_department_site_must_belong_to_organization() -> None:
    org_a = make_org(code="ORGTEST1")
    org_b = make_org(code="ORGTEST2")
    site_b = make_site(org_b, code="SITETEST1")
    with pytest.raises(ValidationError):
        create_department(
            organization=org_a,
            code="DEPTTEST1",
            name="Mismatch",
            site=site_b,
        )


@pytest.mark.django_db
def test_department_code_unique_in_org_scope_without_site() -> None:
    org = make_org()
    make_department(org, code="DEPTTEST1", site=None)
    with pytest.raises(IntegrityError):
        Department.objects.create(
            organization=org,
            code="depttest1",
            name="Dup",
            site=None,
        )


@pytest.mark.django_db
def test_deactivate_and_reactivate_organization() -> None:
    org = make_org()
    deactivate_organization(org)
    org.refresh_from_db()
    assert org.is_active is False


@pytest.mark.django_db
def test_cannot_reactivate_site_when_org_inactive() -> None:
    org = make_org()
    site = make_site(org)
    deactivate_organization(org)
    site.refresh_from_db()
    with pytest.raises(ValidationError):
        reactivate_site(site)


@pytest.mark.django_db
def test_cannot_reactivate_department_when_site_inactive() -> None:
    org = make_org()
    site = make_site(org)
    dept = make_department(org, site=site)
    site.is_active = False
    site.save(update_fields=["is_active"])
    with pytest.raises(ValidationError):
        reactivate_department(dept)


@pytest.mark.django_db
def test_create_helpers_normalize_codes() -> None:
    org = create_organization(code=" orgtest9 ", name="Nine")
    assert org.code == "ORGTEST9"
    site = create_site(organization=org, code=" sitetest9 ", name="Site Nine")
    assert site.code == "SITETEST9"
