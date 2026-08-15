"""Phase 05B — object-aware FG Product authorization and query bounds."""

from __future__ import annotations

import uuid

import pytest
from django.contrib.auth.models import Permission
from django.contrib.contenttypes.models import ContentType
from django.db import connection
from django.test import Client
from django.test.utils import CaptureQueriesContext
from django.urls import reverse
from tests.factories import (
    grant_role,
    make_org,
    make_role_with_permission,
    make_site,
    make_user,
)

from apps.accounts.models import User
from apps.master_data.models import FGProduct
from apps.master_data.services import create_fg_product
from apps.organizations.models import Organization, Site


def _product_permission(codename: str) -> Permission:
    ct = ContentType.objects.get_for_model(FGProduct)
    permission, _ = Permission.objects.get_or_create(
        content_type=ct,
        codename=codename,
        defaults={"name": f"Can {codename.replace('_', ' ')}"},
    )
    return permission


def _grant_product_perms(
    user: User,
    *,
    org: Organization | None = None,
    site: Site | None = None,
    manage: bool = False,
) -> None:
    suffix = uuid.uuid4().hex[:8].upper()
    view_perm = _product_permission("view_fgproduct")
    role = make_role_with_permission(
        code=f"FG{suffix}",
        name=f"FG Role {suffix}",
        permission=view_perm,
    )
    if manage:
        role.permissions.add(_product_permission("manage_fgproduct"))
    grant_role(user, role, organization=org, site=site)


@pytest.mark.django_db
def test_list_edit_visible_only_for_manageable_org(client: Client) -> None:
    org_a = make_org(code="ORG-HA")
    org_b = make_org(code="ORG-HB")
    manager_a = make_user(employee_code="FGHA1", is_staff=True)
    manager_b = make_user(employee_code="FGHB1", is_staff=True)
    _grant_product_perms(manager_a, org=org_a, manage=True)
    _grant_product_perms(manager_b, org=org_b, manage=True)
    # Viewer of both orgs, manager of A only
    dual = make_user(employee_code="FGHD1", is_staff=True)
    _grant_product_perms(dual, org=org_a, manage=True)
    _grant_product_perms(dual, org=org_b, manage=False)

    prod_a = create_fg_product(actor=manager_a, organization=org_a, code="PROD-A", name="A")
    prod_b = create_fg_product(actor=manager_b, organization=org_b, code="PROD-B", name="B")

    client.force_login(dual)
    body = client.get(reverse("master_data:product_list")).content.decode()
    assert "PROD-A" in body and "PROD-B" in body
    assert reverse("master_data:product_edit", args=[prod_a.id]) in body
    assert reverse("master_data:product_edit", args=[prod_b.id]) not in body
    assert reverse("master_data:product_create") in body

    assert client.get(reverse("master_data:product_edit", args=[prod_b.id])).status_code == 403
    assert (
        client.post(
            reverse("master_data:product_edit", args=[prod_b.id]),
            {
                "organization": str(org_b.id),
                "code": "PROD-B",
                "name": "Hacked",
                "is_active": "on",
            },
        ).status_code
        == 403
    )
    assert (
        client.post(reverse("master_data:product_deactivate", args=[prod_b.id])).status_code == 403
    )


@pytest.mark.django_db
def test_viewer_has_no_create_or_edit(client: Client) -> None:
    org = make_org(code="ORG-HV")
    manager = make_user(employee_code="FGHV1", is_staff=True)
    _grant_product_perms(manager, org=org, manage=True)
    product = create_fg_product(actor=manager, organization=org, code="PROD-V", name="View")
    viewer = make_user(employee_code="FGHV2")
    _grant_product_perms(viewer, org=org, manage=False)
    client.force_login(viewer)
    body = client.get(reverse("master_data:product_list")).content.decode()
    assert reverse("master_data:product_create") not in body
    assert reverse("master_data:product_edit", args=[product.id]) not in body
    assert client.get(reverse("master_data:product_create")).status_code == 403


@pytest.mark.django_db
def test_create_org_choices_manage_only(client: Client) -> None:
    org_a = make_org(code="ORG-HC1")
    org_b = make_org(code="ORG-HC2")
    user = make_user(employee_code="FGHC1", is_staff=True)
    _grant_product_perms(user, org=org_a, manage=True)
    _grant_product_perms(user, org=org_b, manage=False)
    client.force_login(user)
    response = client.get(reverse("master_data:product_create"))
    assert response.status_code == 200
    form = response.context["form"]
    choice_ids = {str(obj.id) for obj in form.fields["organization"].queryset}
    assert str(org_a.id) in choice_ids
    assert str(org_b.id) not in choice_ids

    list_response = client.get(reverse("master_data:product_list"))
    filter_ids = {str(o.id) for o in list_response.context["organizations"]}
    assert str(org_a.id) in filter_ids
    assert str(org_b.id) in filter_ids  # viewable org appears in filters


@pytest.mark.django_db
def test_site_only_manage_does_not_escalate(client: Client) -> None:
    org = make_org(code="ORG-HS")
    site = make_site(org, code="SITE-HS")
    org_manager = make_user(employee_code="FGHS1", is_staff=True)
    _grant_product_perms(org_manager, org=org, manage=True)
    product = create_fg_product(actor=org_manager, organization=org, code="PROD-S", name="Site")

    site_user = make_user(employee_code="FGHS2", is_staff=True)
    _grant_product_perms(site_user, org=org, site=site, manage=True)
    client.force_login(site_user)
    # Site-only assignment does not grant org-level Product view/manage.
    assert client.get(reverse("master_data:product_list")).status_code == 403
    assert client.get(reverse("master_data:product_detail", args=[product.id])).status_code == 403
    assert client.get(reverse("master_data:product_create")).status_code == 403
    assert (
        client.post(reverse("master_data:product_deactivate", args=[product.id])).status_code == 403
    )


@pytest.mark.django_db
def test_search_and_counts_do_not_leak_foreign_org(client: Client) -> None:
    org_a = make_org(code="ORG-HL1")
    org_b = make_org(code="ORG-HL2")
    manager_a = make_user(employee_code="FGHL1", is_staff=True)
    manager_b = make_user(employee_code="FGHL2", is_staff=True)
    _grant_product_perms(manager_a, org=org_a, manage=True)
    _grant_product_perms(manager_b, org=org_b, manage=True)
    create_fg_product(actor=manager_a, organization=org_a, code="PROD-SECRET", name="Secret")
    create_fg_product(actor=manager_b, organization=org_b, code="PROD-VISIBLE", name="Visible")
    client.force_login(manager_a)
    response = client.get(reverse("master_data:product_list"), {"q": "PROD"})
    body = response.content.decode()
    assert "PROD-SECRET" in body
    assert "PROD-VISIBLE" not in body
    assert response.context["total_count"] == 1


@pytest.mark.django_db
def test_forged_organization_uuid_rejected_on_create(client: Client) -> None:
    org = make_org(code="ORG-HF")
    user = make_user(employee_code="FGHF1", is_staff=True)
    _grant_product_perms(user, org=org, manage=True)
    client.force_login(user)
    forged = uuid.uuid4()
    response = client.post(
        reverse("master_data:product_create"),
        {
            "organization": str(forged),
            "code": "PROD-FORGE",
            "name": "Forged",
            "is_active": "on",
        },
    )
    assert response.status_code == 200
    assert not FGProduct.objects.filter(code="PROD-FORGE").exists()


@pytest.mark.django_db
def test_detail_actions_object_aware(client: Client) -> None:
    org_a = make_org(code="ORG-HD1")
    org_b = make_org(code="ORG-HD2")
    manager_a = make_user(employee_code="FGHD2", is_staff=True)
    manager_b = make_user(employee_code="FGHD3", is_staff=True)
    dual = make_user(employee_code="FGHD4", is_staff=True)
    _grant_product_perms(manager_a, org=org_a, manage=True)
    _grant_product_perms(manager_b, org=org_b, manage=True)
    _grant_product_perms(dual, org=org_a, manage=True)
    _grant_product_perms(dual, org=org_b, manage=False)
    prod_a = create_fg_product(actor=manager_a, organization=org_a, code="PROD-DA", name="DA")
    prod_b = create_fg_product(actor=manager_b, organization=org_b, code="PROD-DB", name="DB")
    client.force_login(dual)
    body_a = client.get(reverse("master_data:product_detail", args=[prod_a.id])).content.decode()
    body_b = client.get(reverse("master_data:product_detail", args=[prod_b.id])).content.decode()
    assert reverse("master_data:product_edit", args=[prod_a.id]) in body_a
    assert "Deactivate Product" in body_a
    assert reverse("master_data:product_edit", args=[prod_b.id]) not in body_b
    assert "Deactivate Product" not in body_b
    assert "Activate Product" not in body_b


@pytest.mark.django_db
def test_product_list_authz_query_count_bounded(client: Client) -> None:
    """Authorization must not scale one permission check per Product row."""
    org_a = make_org(code="ORG-HQ1")
    org_b = make_org(code="ORG-HQ2")
    manager_a = make_user(employee_code="FGHQ1", is_staff=True)
    manager_b = make_user(employee_code="FGHQ2", is_staff=True)
    dual = make_user(employee_code="FGHQ3", is_staff=True)
    _grant_product_perms(manager_a, org=org_a, manage=True)
    _grant_product_perms(manager_b, org=org_b, manage=True)
    _grant_product_perms(dual, org=org_a, manage=True)
    _grant_product_perms(dual, org=org_b, manage=False)

    for i in range(25):
        create_fg_product(
            actor=manager_a,
            organization=org_a,
            code=f"PROD-A{i:02d}",
            name=f"A{i}",
        )
    for i in range(25):
        create_fg_product(
            actor=manager_b,
            organization=org_b,
            code=f"PROD-B{i:02d}",
            name=f"B{i}",
        )

    client.force_login(dual)
    with CaptureQueriesContext(connection) as ctx25:
        response = client.get(reverse("master_data:product_list"))
    assert response.status_code == 200
    assert response.context["total_count"] == 50
    queries_25 = len(ctx25)

    for i in range(25, 50):
        create_fg_product(
            actor=manager_a,
            organization=org_a,
            code=f"PROD-A{i:02d}",
            name=f"A{i}",
        )

    with CaptureQueriesContext(connection) as ctx50:
        response = client.get(reverse("master_data:product_list"))
    assert response.status_code == 200
    # Page size is 25; total grows but authz must not add ~1 query per extra row.
    assert response.context["total_count"] == 75
    queries_50 = len(ctx50)
    # Bound: doubling rows on the same page size must not roughly double query count.
    assert queries_50 <= queries_25 + 5, (queries_25, queries_50)
