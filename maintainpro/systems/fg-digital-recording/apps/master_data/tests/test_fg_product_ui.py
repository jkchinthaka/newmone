"""FG Product management UI tests — synthetic codes only."""

from __future__ import annotations

import uuid

import pytest
from django.contrib.auth.models import Permission
from django.contrib.contenttypes.models import ContentType
from django.test import Client
from django.urls import reverse
from tests.factories import grant_role, make_org, make_role_with_permission, make_user

from apps.accounts.models import User
from apps.master_data.models import FGProduct
from apps.master_data.services import create_fg_product
from apps.organizations.models import Organization
from apps.security_audit.models import SecurityAuditEvent


def _product_permission(codename: str) -> Permission:
    ct = ContentType.objects.get_for_model(FGProduct)
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
        name=f"UI FG Manager {suffix}",
        permission=_product_permission("manage_fgproduct"),
    )
    role.permissions.add(_product_permission("view_fgproduct"))
    grant_role(user, role, organization=org)
    return user


def _viewer(*, org: Organization | None = None) -> User:
    suffix = uuid.uuid4().hex[:8].upper()
    user = make_user(employee_code=f"UIV{suffix}")
    role = make_role_with_permission(
        code=f"UIVIEW{suffix}",
        name=f"UI FG Viewer {suffix}",
        permission=_product_permission("view_fgproduct"),
    )
    grant_role(user, role, organization=org)
    return user


@pytest.mark.django_db
def test_product_list_requires_permission(client: Client) -> None:
    user = make_user(employee_code="UINONEP1")
    client.force_login(user)
    assert client.get(reverse("master_data:product_list")).status_code == 403


@pytest.mark.django_db
def test_product_list_scoped_search_and_empty(client: Client) -> None:
    org_a = make_org(code="ORG-UA")
    org_b = make_org(code="ORG-UB")
    manager_a = _manager(org=org_a)
    manager_b = _manager(org=org_b)
    create_fg_product(actor=manager_a, organization=org_a, code="PROD-ALPHA", name="Alpha Line")
    create_fg_product(actor=manager_b, organization=org_b, code="PROD-BETA", name="Beta Line")
    viewer = _viewer(org=org_a)
    client.force_login(viewer)
    response = client.get(reverse("master_data:product_list"))
    body = response.content.decode()
    assert response.status_code == 200
    assert "PROD-ALPHA" in body
    assert "PROD-BETA" not in body
    assert (
        b"No FG products match the current filters."
        in client.get(reverse("master_data:product_list"), {"q": "no-match"}).content
    )
    client.force_login(_manager(org=make_org(code="ORG-EMPTY")))
    assert (
        b"No FG products have been configured yet."
        in client.get(reverse("master_data:product_list")).content
    )


@pytest.mark.django_db
def test_product_filters_and_status(client: Client) -> None:
    org = make_org(code="ORG-UF")
    manager = _manager(org=org)
    active = create_fg_product(actor=manager, organization=org, code="PROD-ON", name="On")
    inactive = create_fg_product(
        actor=manager,
        organization=org,
        code="PROD-OFF",
        name="Off",
        is_active=False,
    )
    client.force_login(manager)
    body = client.get(
        reverse("master_data:product_list"),
        {"status": "active", "organization": str(org.id)},
    ).content.decode()
    assert active.code in body
    assert inactive.code not in body


@pytest.mark.django_db
def test_create_edit_lifecycle_ui(client: Client) -> None:
    org = make_org(code="ORG-UC")
    manager = _manager(org=org)
    client.force_login(manager)
    assert client.get(reverse("master_data:product_create")).status_code == 200
    created = client.post(
        reverse("master_data:product_create"),
        {
            "organization": str(org.id),
            "code": "prod-new",
            "name": " New Product ",
            "description": "Note",
            "is_active": "on",
        },
    )
    assert created.status_code == 302
    product = FGProduct.objects.get(code="PROD-NEW")
    assert product.name == "New Product"
    assert SecurityAuditEvent.objects.filter(event_type="FG_PRODUCT_CREATED").exists()

    detail = client.get(reverse("master_data:product_detail", args=[product.id]))
    assert detail.status_code == 200
    assert b"csrfmiddlewaretoken" in detail.content
    assert client.get(reverse("master_data:product_activate", args=[product.id])).status_code == 405
    assert (
        client.post(reverse("master_data:product_deactivate", args=[product.id])).status_code == 302
    )
    product.refresh_from_db()
    assert product.is_active is False

    edit = client.post(
        reverse("master_data:product_edit", args=[product.id]),
        {
            "organization": str(org.id),
            "code": "PROD-NEW",
            "name": "Renamed",
            "description": "Note",
            "is_active": "on",
        },
    )
    assert edit.status_code == 302
    product.refresh_from_db()
    assert product.name == "Renamed"
    assert product.is_active is True


@pytest.mark.django_db
def test_create_validation_and_csrf(client: Client) -> None:
    org = make_org(code="ORG-UV")
    manager = _manager(org=org)
    create_fg_product(actor=manager, organization=org, code="PROD-DUP", name="Existing")
    client.force_login(manager)
    dup = client.post(
        reverse("master_data:product_create"),
        {
            "organization": str(org.id),
            "code": "prod-dup",
            "name": "Dup",
            "is_active": "on",
        },
    )
    assert dup.status_code == 200
    assert b"already exists" in dup.content

    csrf_client = Client(enforce_csrf_checks=True)
    csrf_client.force_login(manager)
    denied = csrf_client.post(
        reverse("master_data:product_create"),
        {
            "organization": str(org.id),
            "code": "PROD-CSRF",
            "name": "CSRF",
            "is_active": "on",
        },
    )
    assert denied.status_code == 403


@pytest.mark.django_db
def test_cross_org_and_viewer_denied(client: Client) -> None:
    org_a = make_org(code="ORG-UXA")
    org_b = make_org(code="ORG-UXB")
    manager_a = _manager(org=org_a)
    manager_b = _manager(org=org_b)
    product_b = create_fg_product(actor=manager_b, organization=org_b, code="PROD-B", name="B")
    client.force_login(manager_a)
    assert client.get(reverse("master_data:product_detail", args=[product_b.id])).status_code == 403
    assert (
        client.post(reverse("master_data:product_deactivate", args=[product_b.id])).status_code
        == 403
    )
    forged = client.post(
        reverse("master_data:product_create"),
        {
            "organization": str(org_b.id),
            "code": "PROD-X",
            "name": "X",
            "is_active": "on",
        },
    )
    assert forged.status_code in {200, 403}
    assert not FGProduct.objects.filter(code="PROD-X").exists()

    product_a = create_fg_product(actor=manager_a, organization=org_a, code="PROD-V", name="View")
    viewer = _viewer(org=org_a)
    client.force_login(viewer)
    detail = client.get(reverse("master_data:product_detail", args=[product_a.id]))
    assert detail.status_code == 200
    assert b"Deactivate Product" not in detail.content
    assert client.get(reverse("master_data:product_edit", args=[product_a.id])).status_code == 403
    assert client.get(reverse("master_data:product_create")).status_code == 403


@pytest.mark.django_db
def test_landing_shows_product_link(client: Client) -> None:
    org = make_org(code="ORG-UL")
    viewer = _viewer(org=org)
    client.force_login(viewer)
    response = client.get(reverse("accounts:landing"))
    assert reverse("master_data:product_list") in response.content.decode()
