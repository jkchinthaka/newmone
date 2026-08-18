"""Organization selectors and lifecycle service coverage."""

from __future__ import annotations

import pytest
from django.core.exceptions import ValidationError
from tests.factories import make_department, make_org, make_site

from apps.organizations.selectors import (
    get_department_by_id,
    get_organization_by_code,
    get_organization_by_id,
    get_site_by_id,
    list_active_organizations,
    list_departments_for_organization,
    list_departments_for_site,
    list_sites_for_organization,
)
from apps.organizations.services import (
    deactivate_department,
    deactivate_organization,
    deactivate_site,
    reactivate_department,
    reactivate_organization,
    reactivate_site,
)


@pytest.mark.django_db
def test_organization_selectors() -> None:
    org = make_org(code="ORGTEST1")
    inactive = make_org(code="ORGTEST2")
    deactivate_organization(inactive)

    site = make_site(org, code="SITETEST1")
    inactive_site = make_site(org, code="SITETEST2")
    deactivate_site(inactive_site)

    dept = make_department(org, code="DEPTTEST1", site=site)
    inactive_dept = make_department(org, code="DEPTTEST2", site=site)
    deactivate_department(inactive_dept)
    org_dept = make_department(org, code="DEPTTEST3", site=None)

    assert get_organization_by_id(org.id) == org
    assert get_organization_by_code("orgtest1") == org
    assert org in list_active_organizations()
    assert inactive not in list_active_organizations()

    assert get_site_by_id(site.id) == site
    active_sites = list(list_sites_for_organization(org, active_only=True))
    assert site in active_sites
    assert inactive_site not in active_sites
    all_sites = list(list_sites_for_organization(org, active_only=False))
    assert inactive_site in all_sites

    assert get_department_by_id(dept.id) == dept
    active_depts = list(list_departments_for_organization(org, active_only=True))
    assert dept in active_depts
    assert org_dept in active_depts
    assert inactive_dept not in active_depts
    assert dept in list(list_departments_for_site(site, active_only=True))
    assert inactive_dept not in list(list_departments_for_site(site, active_only=True))
    assert inactive_dept in list(list_departments_for_site(site, active_only=False))


@pytest.mark.django_db
def test_reactivate_lifecycle() -> None:
    org = make_org(code="ORGTEST3")
    site = make_site(org, code="SITETEST3")
    dept = make_department(org, code="DEPTTEST4", site=site)

    deactivate_department(dept)
    deactivate_site(site)
    deactivate_organization(org)

    reactivate_organization(org)
    org.refresh_from_db()
    assert org.is_active is True

    reactivate_site(site)
    site.refresh_from_db()
    assert site.is_active is True

    reactivate_department(dept)
    dept.refresh_from_db()
    assert dept.is_active is True


@pytest.mark.django_db
def test_cannot_reactivate_department_when_org_inactive() -> None:
    org = make_org(code="ORGTEST4")
    dept = make_department(org, code="DEPTTEST5", site=None)
    deactivate_department(dept)
    deactivate_organization(org)
    with pytest.raises(ValidationError):
        reactivate_department(dept)


@pytest.mark.django_db
def test_model_str_methods() -> None:
    org = make_org(code="ORGTEST5")
    site = make_site(org, code="SITETEST5")
    dept = make_department(org, code="DEPTTEST6", site=site)
    org_dept = make_department(org, code="DEPTTEST7", site=None)
    assert "ORGTEST5" in str(org)
    assert "SITETEST5" in str(site)
    assert "DEPTTEST6" in str(dept)
    assert "DEPTTEST7" in str(org_dept)
    dept.full_clean()
    org_dept.full_clean()
