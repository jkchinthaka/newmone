"""Shift management UI tests — synthetic codes only, no Nelna operational values."""

from __future__ import annotations

import datetime
import uuid

import pytest
from django.contrib.auth.models import Permission
from django.contrib.contenttypes.models import ContentType
from django.test import Client
from django.urls import reverse
from tests.factories import (
    grant_role,
    make_department,
    make_org,
    make_role_with_permission,
    make_site,
    make_user,
)

from apps.accounts.models import User
from apps.organizations.models import Organization, Shift
from apps.organizations.services import create_shift
from apps.security_audit.models import SecurityAuditEvent


def _shift_permission(codename: str) -> Permission:
    ct = ContentType.objects.get_for_model(Shift)
    permission, _ = Permission.objects.get_or_create(
        content_type=ct,
        codename=codename,
        defaults={"name": f"Can {codename.replace('_', ' ')}"},
    )
    return permission


def _manager(*, org: Organization | None = None) -> User:
    suffix = uuid.uuid4().hex[:8].upper()
    user = make_user(employee_code=f"UIM{suffix}", is_staff=True)
    role = make_role_with_permission(
        code=f"UIMGR{suffix}",
        name=f"UI Shift Manager {suffix}",
        permission=_shift_permission("manage_shift"),
    )
    role.permissions.add(_shift_permission("view_shift"))
    grant_role(user, role, organization=org)
    return user


def _viewer(*, org: Organization | None = None) -> User:
    suffix = uuid.uuid4().hex[:8].upper()
    user = make_user(employee_code=f"UIV{suffix}")
    role = make_role_with_permission(
        code=f"UIVIEW{suffix}",
        name=f"UI Shift Viewer {suffix}",
        permission=_shift_permission("view_shift"),
    )
    grant_role(user, role, organization=org)
    return user


@pytest.mark.django_db
def test_shift_list_requires_permission(client: Client) -> None:
    user = make_user(employee_code="UINONE1")
    client.force_login(user)
    response = client.get(reverse("organizations:shift_list"))
    assert response.status_code == 403


@pytest.mark.django_db
def test_shift_list_scoped_and_search(client: Client) -> None:
    org_a = make_org(code="ORG-A")
    org_b = make_org(code="ORG-B")
    manager_a = _manager(org=org_a)
    manager_b = _manager(org=org_b)
    create_shift(
        actor=manager_a,
        organization=org_a,
        code="SHIFT-ALPHA",
        name="Alpha Line",
        start_time=datetime.time(8, 0),
        end_time=datetime.time(16, 0),
        effective_from=datetime.date(2026, 1, 1),
    )
    create_shift(
        actor=manager_b,
        organization=org_b,
        code="SHIFT-BETA",
        name="Beta Line",
        start_time=datetime.time(22, 0),
        end_time=datetime.time(6, 0),
        effective_from=datetime.date(2026, 1, 1),
    )
    viewer = _viewer(org=org_a)
    client.force_login(viewer)
    response = client.get(reverse("organizations:shift_list"))
    assert response.status_code == 200
    content = response.content.decode()
    assert "SHIFT-ALPHA" in content
    assert "SHIFT-BETA" not in content
    assert "Shift Management" in content

    response = client.get(reverse("organizations:shift_list"), {"q": "alpha"})
    assert b"SHIFT-ALPHA" in response.content
    response = client.get(reverse("organizations:shift_list"), {"q": "no-match"})
    assert b"No shifts match the current filters." in response.content


@pytest.mark.django_db
def test_shift_list_empty_state(client: Client) -> None:
    org = make_org(code="ORG-EMPTY")
    manager = _manager(org=org)
    client.force_login(manager)
    response = client.get(reverse("organizations:shift_list"))
    assert b"No shifts have been configured yet." in response.content
    assert b"Create Shift" in response.content


@pytest.mark.django_db
def test_shift_list_status_filter(client: Client) -> None:
    org = make_org(code="ORG-STAT")
    manager = _manager(org=org)
    active = create_shift(
        actor=manager,
        organization=org,
        code="SHIFT-ON",
        name="On",
        start_time=datetime.time(8, 0),
        end_time=datetime.time(16, 0),
        effective_from=datetime.date(2026, 1, 1),
    )
    inactive = create_shift(
        actor=manager,
        organization=org,
        code="SHIFT-OFF",
        name="Off",
        start_time=datetime.time(8, 0),
        end_time=datetime.time(16, 0),
        effective_from=datetime.date(2026, 1, 1),
        is_active=False,
    )
    client.force_login(manager)
    response = client.get(reverse("organizations:shift_list"), {"status": "active"})
    body = response.content.decode()
    assert active.code in body
    assert inactive.code not in body
    response = client.get(reverse("organizations:shift_list"), {"status": "inactive"})
    body = response.content.decode()
    assert inactive.code in body
    assert active.code not in body


@pytest.mark.django_db
def test_create_shift_authorized_and_csrf(client: Client) -> None:
    org = make_org(code="ORG-CREATE")
    manager = _manager(org=org)
    client.force_login(manager)
    assert client.get(reverse("organizations:shift_create")).status_code == 200
    response = client.post(
        reverse("organizations:shift_create"),
        {
            "organization": str(org.id),
            "code": "shift-new",
            "name": " New Shift ",
            "start_time": "08:00",
            "end_time": "16:00",
            "effective_from": "2026-01-01",
            "is_active": "on",
        },
    )
    assert response.status_code == 302
    shift = Shift.objects.get(code="SHIFT-NEW")
    assert shift.name == "New Shift"
    assert SecurityAuditEvent.objects.filter(event_type="SHIFT_CREATED").exists()


@pytest.mark.django_db
def test_create_shift_unauthorized(client: Client) -> None:
    org = make_org(code="ORG-DENY")
    viewer = _viewer(org=org)
    client.force_login(viewer)
    assert client.get(reverse("organizations:shift_create")).status_code == 403
    assert (
        client.post(
            reverse("organizations:shift_create"),
            {
                "organization": str(org.id),
                "code": "SHIFT-X",
                "name": "X",
                "start_time": "08:00",
                "end_time": "16:00",
                "effective_from": "2026-01-01",
            },
        ).status_code
        == 403
    )


@pytest.mark.django_db
def test_create_cross_organization_denied(client: Client) -> None:
    org_a = make_org(code="ORG-A2")
    org_b = make_org(code="ORG-B2")
    manager = _manager(org=org_a)
    client.force_login(manager)
    response = client.post(
        reverse("organizations:shift_create"),
        {
            "organization": str(org_b.id),
            "code": "SHIFT-X",
            "name": "X",
            "start_time": "08:00",
            "end_time": "16:00",
            "effective_from": "2026-01-01",
        },
    )
    # Out-of-scope org is not in choices → form invalid, or permission denied
    assert response.status_code in {200, 403}
    assert not Shift.objects.filter(code="SHIFT-X").exists()


@pytest.mark.django_db
def test_detail_edit_activate_deactivate(client: Client) -> None:
    org = make_org(code="ORG-LIFE")
    manager = _manager(org=org)
    shift = create_shift(
        actor=manager,
        organization=org,
        code="SHIFT-LIFE",
        name="Lifecycle",
        start_time=datetime.time(22, 0),
        end_time=datetime.time(6, 0),
        effective_from=datetime.date(2026, 1, 1),
    )
    client.force_login(manager)
    detail = client.get(reverse("organizations:shift_detail", args=[shift.id]))
    assert detail.status_code == 200
    assert b"Overnight" in detail.content
    assert b"csrfmiddlewaretoken" in detail.content

    assert client.get(reverse("organizations:shift_activate", args=[shift.id])).status_code == 405
    assert (
        client.post(reverse("organizations:shift_deactivate", args=[shift.id])).status_code == 302
    )
    shift.refresh_from_db()
    assert shift.is_active is False
    assert SecurityAuditEvent.objects.filter(event_type="SHIFT_DEACTIVATED").exists()
    assert client.post(reverse("organizations:shift_activate", args=[shift.id])).status_code == 302
    shift.refresh_from_db()
    assert shift.is_active is True

    edit_get = client.get(reverse("organizations:shift_edit", args=[shift.id]))
    assert edit_get.status_code == 200
    response = client.post(
        reverse("organizations:shift_edit", args=[shift.id]),
        {
            "organization": str(org.id),
            "code": "SHIFT-LIFE",
            "name": "Lifecycle Updated",
            "start_time": "22:00",
            "end_time": "06:00",
            "effective_from": "2026-01-01",
            "is_active": "on",
        },
    )
    assert response.status_code == 302
    shift.refresh_from_db()
    assert shift.name == "Lifecycle Updated"


@pytest.mark.django_db
def test_cross_org_detail_denied(client: Client) -> None:
    org_a = make_org(code="ORG-A3")
    org_b = make_org(code="ORG-B3")
    manager_a = _manager(org=org_a)
    manager_b = _manager(org=org_b)
    shift_b = create_shift(
        actor=manager_b,
        organization=org_b,
        code="SHIFT-B",
        name="B",
        start_time=datetime.time(8, 0),
        end_time=datetime.time(16, 0),
        effective_from=datetime.date(2026, 1, 1),
    )
    client.force_login(manager_a)
    assert client.get(reverse("organizations:shift_detail", args=[shift_b.id])).status_code == 403
    assert (
        client.post(reverse("organizations:shift_deactivate", args=[shift_b.id])).status_code == 403
    )


@pytest.mark.django_db
def test_viewer_cannot_edit_controls_post(client: Client) -> None:
    org = make_org(code="ORG-VIEW")
    manager = _manager(org=org)
    viewer = _viewer(org=org)
    shift = create_shift(
        actor=manager,
        organization=org,
        code="SHIFT-VIEW",
        name="View Only",
        start_time=datetime.time(8, 0),
        end_time=datetime.time(16, 0),
        effective_from=datetime.date(2026, 1, 1),
    )
    client.force_login(viewer)
    detail = client.get(reverse("organizations:shift_detail", args=[shift.id]))
    assert detail.status_code == 200
    assert b"Deactivate Shift" not in detail.content
    assert client.get(reverse("organizations:shift_edit", args=[shift.id])).status_code == 403


@pytest.mark.django_db
def test_dependent_select_options_scoped(client: Client) -> None:
    org_a = make_org(code="ORG-OPT")
    org_b = make_org(code="ORG-OPTB")
    site_a = make_site(org_a, code="SITE-A")
    make_site(org_b, code="SITE-B")
    make_department(org_a, code="DEPT-A", site=site_a)
    manager = _manager(org=org_a)
    client.force_login(manager)
    sites = client.get(
        reverse("organizations:shift_sites_options"),
        {"organization": str(org_a.id)},
    )
    assert sites.status_code == 200
    assert b"SITE-A" in sites.content
    assert b"SITE-B" not in sites.content
    depts = client.get(
        reverse("organizations:shift_departments_options"),
        {"organization": str(org_a.id), "site": str(site_a.id)},
    )
    assert b"DEPT-A" in depts.content
    bad = client.get(
        reverse("organizations:shift_sites_options"),
        {"organization": "not-a-uuid"},
    )
    assert bad.status_code == 200


@pytest.mark.django_db
def test_shift_list_hierarchy_filters(client: Client) -> None:
    org = make_org(code="ORG-FILT")
    site = make_site(org, code="SITE-FILT")
    dept = make_department(org, code="DEPT-FILT", site=site)
    manager = _manager(org=org)
    org_wide = create_shift(
        actor=manager,
        organization=org,
        code="SHIFT-ORG",
        name="Org Wide",
        start_time=datetime.time(8, 0),
        end_time=datetime.time(16, 0),
        effective_from=datetime.date(2026, 1, 1),
    )
    site_wide = create_shift(
        actor=manager,
        organization=org,
        site=site,
        code="SHIFT-SITE",
        name="Site Wide",
        start_time=datetime.time(8, 0),
        end_time=datetime.time(16, 0),
        effective_from=datetime.date(2026, 1, 1),
    )
    dept_shift = create_shift(
        actor=manager,
        organization=org,
        site=site,
        department=dept,
        code="SHIFT-DEPT",
        name="Dept Shift",
        start_time=datetime.time(8, 0),
        end_time=datetime.time(16, 0),
        effective_from=datetime.date(2026, 1, 1),
    )
    client.force_login(manager)
    body = client.get(
        reverse("organizations:shift_list"),
        {"organization": str(org.id)},
    ).content.decode()
    assert org_wide.code in body
    assert site_wide.code in body
    assert dept_shift.code in body
    body = client.get(
        reverse("organizations:shift_list"),
        {"organization": str(org.id), "site": str(site.id)},
    ).content.decode()
    assert site_wide.code in body
    assert dept_shift.code in body
    assert org_wide.code not in body
    body = client.get(
        reverse("organizations:shift_list"),
        {
            "organization": str(org.id),
            "site": str(site.id),
            "department": str(dept.id),
        },
    ).content.decode()
    assert dept_shift.code in body
    assert site_wide.code not in body


@pytest.mark.django_db
def test_create_validation_feedback(client: Client) -> None:
    org = make_org(code="ORG-VAL")
    manager = _manager(org=org)
    create_shift(
        actor=manager,
        organization=org,
        code="SHIFT-DUP",
        name="Existing",
        start_time=datetime.time(8, 0),
        end_time=datetime.time(16, 0),
        effective_from=datetime.date(2026, 1, 1),
    )
    client.force_login(manager)
    invalid_dates = client.post(
        reverse("organizations:shift_create"),
        {
            "organization": str(org.id),
            "code": "SHIFT-BAD",
            "name": "Bad Dates",
            "start_time": "08:00",
            "end_time": "16:00",
            "effective_from": "2026-02-01",
            "effective_to": "2026-01-01",
            "is_active": "on",
        },
    )
    assert invalid_dates.status_code == 200
    assert b"effective_to cannot be earlier" in invalid_dates.content
    duplicate = client.post(
        reverse("organizations:shift_create"),
        {
            "organization": str(org.id),
            "code": "shift-dup",
            "name": "Dup",
            "start_time": "08:00",
            "end_time": "16:00",
            "effective_from": "2026-01-01",
            "is_active": "on",
        },
    )
    assert duplicate.status_code == 200
    assert Shift.objects.filter(code="SHIFT-DUP").count() == 1
    assert b"already exists" in duplicate.content


@pytest.mark.django_db
def test_create_requires_csrf_token() -> None:
    from django.test import Client

    org = make_org(code="ORG-CSRF")
    manager = _manager(org=org)
    csrf_client = Client(enforce_csrf_checks=True)
    csrf_client.force_login(manager)
    denied = csrf_client.post(
        reverse("organizations:shift_create"),
        {
            "organization": str(org.id),
            "code": "SHIFT-CSRF",
            "name": "CSRF",
            "start_time": "08:00",
            "end_time": "16:00",
            "effective_from": "2026-01-01",
            "is_active": "on",
        },
    )
    assert denied.status_code == 403
    assert not Shift.objects.filter(code="SHIFT-CSRF").exists()


@pytest.mark.django_db
def test_dependent_select_unauthorized(client: Client) -> None:
    org = make_org(code="ORG-OPT2")
    viewer = _viewer(org=org)
    client.force_login(viewer)
    assert (
        client.get(
            reverse("organizations:shift_sites_options"),
            {"organization": str(org.id)},
        ).status_code
        == 403
    )


@pytest.mark.django_db
def test_landing_shows_shift_link_for_authorized(client: Client) -> None:
    org = make_org(code="ORG-LAND")
    viewer = _viewer(org=org)
    client.force_login(viewer)
    response = client.get(reverse("accounts:landing"))
    assert reverse("organizations:shift_list") in response.content.decode()
