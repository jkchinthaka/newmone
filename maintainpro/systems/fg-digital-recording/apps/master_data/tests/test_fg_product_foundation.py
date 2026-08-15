"""FG Product foundation tests — synthetic codes only, no Nelna operational values."""

from __future__ import annotations

import uuid

import pytest
from django.contrib import admin
from django.contrib.auth.models import Permission
from django.contrib.contenttypes.models import ContentType
from django.core.exceptions import PermissionDenied, ValidationError
from django.db import IntegrityError
from django.test import Client
from tests.factories import grant_role, make_org, make_role_with_permission, make_user

from apps.accounts.models import User
from apps.master_data.admin import FGProductAdmin
from apps.master_data.models import FGProduct
from apps.master_data.selectors import get_fg_product, list_active_fg_products, list_fg_products
from apps.master_data.services import (
    activate_fg_product,
    create_fg_product,
    deactivate_fg_product,
    update_fg_product,
)
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
    user = make_user(employee_code=f"FGM{suffix}", is_staff=True)
    role = make_role_with_permission(
        code=f"FGMGR{suffix}",
        name=f"FG Product Manager {suffix}",
        permission=_product_permission("manage_fgproduct"),
    )
    role.permissions.add(_product_permission("view_fgproduct"))
    grant_role(user, role, organization=org)
    return user


def _viewer(*, org: Organization | None = None) -> User:
    suffix = uuid.uuid4().hex[:8].upper()
    user = make_user(employee_code=f"FGV{suffix}")
    role = make_role_with_permission(
        code=f"FGVIEW{suffix}",
        name=f"FG Product Viewer {suffix}",
        permission=_product_permission("view_fgproduct"),
    )
    grant_role(user, role, organization=org)
    return user


@pytest.mark.django_db
def test_create_normalizes_and_audits() -> None:
    org = make_org(code="ORG-P1")
    manager = _manager(org=org)
    product = create_fg_product(
        actor=manager,
        organization=org,
        code=" prod-a ",
        name=" Sample Product ",
        description="  Desc  ",
    )
    assert product.code == "PROD-A"
    assert product.name == "Sample Product"
    assert product.description == "Desc"
    assert product.is_active is True
    assert SecurityAuditEvent.objects.filter(event_type="FG_PRODUCT_CREATED").exists()


@pytest.mark.django_db
def test_blank_code_and_name_rejected() -> None:
    org = make_org(code="ORG-P2")
    manager = _manager(org=org)
    with pytest.raises(ValidationError):
        create_fg_product(actor=manager, organization=org, code="  ", name="X")
    with pytest.raises(ValidationError):
        create_fg_product(actor=manager, organization=org, code="X", name="  ")


@pytest.mark.django_db
def test_duplicate_code_same_org_rejected_case_insensitive() -> None:
    org = make_org(code="ORG-P3")
    manager = _manager(org=org)
    create_fg_product(actor=manager, organization=org, code="PROD-1", name="One")
    with pytest.raises(ValidationError) as exc:
        create_fg_product(actor=manager, organization=org, code="prod-1", name="Two")
    assert "already exists" in str(exc.value)


@pytest.mark.django_db
def test_same_code_different_org_allowed() -> None:
    org_a = make_org(code="ORG-PA")
    org_b = make_org(code="ORG-PB")
    manager_a = _manager(org=org_a)
    manager_b = _manager(org=org_b)
    create_fg_product(actor=manager_a, organization=org_a, code="PROD-X", name="A")
    other = create_fg_product(actor=manager_b, organization=org_b, code="PROD-X", name="B")
    assert other.code == "PROD-X"


@pytest.mark.django_db
def test_db_unique_constraint() -> None:
    org = make_org(code="ORG-P4")
    manager = _manager(org=org)
    create_fg_product(actor=manager, organization=org, code="PROD-DB", name="One")
    with pytest.raises(IntegrityError):
        FGProduct.objects.create(organization=org, code="PROD-DB", name="Two")


@pytest.mark.django_db
def test_unauthorized_and_cross_org_denied() -> None:
    org_a = make_org(code="ORG-P5A")
    org_b = make_org(code="ORG-P5B")
    outsider = make_user(employee_code="FGNONE1")
    manager_a = _manager(org=org_a)
    with pytest.raises(PermissionDenied):
        create_fg_product(actor=outsider, organization=org_a, code="P", name="P")
    with pytest.raises(PermissionDenied):
        create_fg_product(actor=manager_a, organization=org_b, code="P", name="P")


@pytest.mark.django_db
def test_update_activate_deactivate() -> None:
    org = make_org(code="ORG-P6")
    manager = _manager(org=org)
    product = create_fg_product(actor=manager, organization=org, code="PROD-L", name="Life")
    updated = update_fg_product(
        actor=manager,
        product_id=product.id,
        name="Lifecycle",
        description="Updated",
    )
    assert updated.name == "Lifecycle"
    assert SecurityAuditEvent.objects.filter(event_type="FG_PRODUCT_UPDATED").exists()
    deactivate_fg_product(actor=manager, product_id=product.id)
    product.refresh_from_db()
    assert product.is_active is False
    assert SecurityAuditEvent.objects.filter(event_type="FG_PRODUCT_DEACTIVATED").exists()
    activate_fg_product(actor=manager, product_id=product.id)
    product.refresh_from_db()
    assert product.is_active is True


@pytest.mark.django_db
def test_selectors_scoped() -> None:
    org_a = make_org(code="ORG-P7A")
    org_b = make_org(code="ORG-P7B")
    manager_a = _manager(org=org_a)
    manager_b = _manager(org=org_b)
    a = create_fg_product(actor=manager_a, organization=org_a, code="PROD-A", name="Alpha")
    create_fg_product(actor=manager_b, organization=org_b, code="PROD-B", name="Beta")
    viewer = _viewer(org=org_a)
    codes = set(list_fg_products(viewer).values_list("code", flat=True))
    assert codes == {"PROD-A"}
    assert get_fg_product(viewer, a.id) is not None
    with pytest.raises(PermissionDenied):
        get_fg_product(viewer, FGProduct.objects.get(code="PROD-B").id)
    create_fg_product(
        actor=manager_a,
        organization=org_a,
        code="PROD-OFF",
        name="Off",
        is_active=False,
    )
    assert set(list_active_fg_products(viewer).values_list("code", flat=True)) == {"PROD-A"}
    assert "PROD-OFF" in set(
        list_fg_products(viewer, status="inactive").values_list("code", flat=True)
    )
    assert "PROD-A" in set(list_fg_products(viewer, search="alpha").values_list("code", flat=True))


@pytest.mark.django_db
def test_admin_registration() -> None:
    assert admin.site.is_registered(FGProduct)
    model_admin = FGProductAdmin(FGProduct, admin.site)
    request = Client().request().wsgi_request
    assert model_admin.has_delete_permission(request) is False
