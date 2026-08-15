"""Checklist definition foundation tests — synthetic codes only."""

from __future__ import annotations

import uuid

import pytest
from django.contrib import admin
from django.contrib.auth.models import Permission
from django.contrib.contenttypes.models import ContentType
from django.core.exceptions import PermissionDenied, ValidationError
from django.db import connection
from django.test import Client
from django.test.utils import CaptureQueriesContext
from django.urls import reverse
from tests.factories import grant_role, make_org, make_role_with_permission, make_user

from apps.accounts.models import User
from apps.checklists.admin import ChecklistTemplateAdmin, ChecklistVersionAdmin
from apps.checklists.models import (
    ChecklistItem,
    ChecklistSection,
    ChecklistTemplate,
    ChecklistVersion,
    ChecklistVersionStatus,
)
from apps.checklists.services import (
    add_checklist_item,
    add_checklist_section,
    create_checklist_template,
    create_checklist_version,
    publish_checklist_version,
    retire_checklist_version,
    update_checklist_item,
    update_checklist_section,
)
from apps.master_data.services import create_fg_product
from apps.organizations.models import Organization
from apps.security_audit.models import SecurityAuditEvent


def _perm(codename: str) -> Permission:
    ct = ContentType.objects.get_for_model(ChecklistTemplate)
    permission, _ = Permission.objects.get_or_create(
        content_type=ct,
        codename=codename,
        defaults={"name": f"Can {codename.replace('_', ' ')}"},
    )
    return permission


def _manager(*, org: Organization | None = None) -> User:
    suffix = uuid.uuid4().hex[:8].upper()
    user = make_user(employee_code=f"CKM{suffix}", is_staff=True)
    role = make_role_with_permission(
        code=f"CKMGR{suffix}",
        name=f"Checklist Manager {suffix}",
        permission=_perm("manage_checklist"),
    )
    role.permissions.add(_perm("view_checklisttemplate"))
    grant_role(user, role, organization=org)
    return user


def _viewer(*, org: Organization | None = None) -> User:
    suffix = uuid.uuid4().hex[:8].upper()
    user = make_user(employee_code=f"CKV{suffix}")
    role = make_role_with_permission(
        code=f"CKVIEW{suffix}",
        name=f"Checklist Viewer {suffix}",
        permission=_perm("view_checklisttemplate"),
    )
    grant_role(user, role, organization=org)
    return user


def _seed_publishable(actor: User, org: Organization) -> ChecklistVersion:
    template = create_checklist_template(
        actor=actor, organization=org, code="CHK-TEST", name="Checklist Test"
    )
    version = create_checklist_version(actor=actor, template_id=template.id)
    section = add_checklist_section(actor=actor, version_id=version.id, title="Section Test")
    add_checklist_item(
        actor=actor,
        section_id=section.id,
        code="ITEM-TEST",
        label="Item Test",
        response_type="YES_NO",
    )
    return version


@pytest.mark.django_db
def test_template_code_normalization_and_uniqueness() -> None:
    org_a = make_org(code="ORG-CK1")
    org_b = make_org(code="ORG-CK2")
    manager_a = _manager(org=org_a)
    manager_b = _manager(org=org_b)
    create_checklist_template(
        actor=manager_a, organization=org_a, code="  chk-alpha  ", name=" Alpha "
    )
    assert ChecklistTemplate.objects.get(organization=org_a).code == "CHK-ALPHA"
    assert ChecklistTemplate.objects.get(organization=org_a).name == "Alpha"
    with pytest.raises(ValidationError):
        create_checklist_template(actor=manager_a, organization=org_a, code="chk-alpha", name="Dup")
    create_checklist_template(
        actor=manager_b, organization=org_b, code="CHK-ALPHA", name="Other Org"
    )


@pytest.mark.django_db
def test_optional_product_same_org_only() -> None:
    from apps.master_data.models import FGProduct

    org_a = make_org(code="ORG-CKP1")
    org_b = make_org(code="ORG-CKP2")
    manager_a = _manager(org=org_a)
    manager_b = _manager(org=org_b)
    product_ct = ContentType.objects.get_for_model(FGProduct)
    fg_manage, _ = Permission.objects.get_or_create(
        content_type=product_ct,
        codename="manage_fgproduct",
        defaults={"name": "Can manage FG product"},
    )
    fg_view, _ = Permission.objects.get_or_create(
        content_type=product_ct,
        codename="view_fgproduct",
        defaults={"name": "Can view FG product"},
    )
    role = make_role_with_permission(code="CKFG1", name="CK FG", permission=fg_manage)
    role.permissions.add(fg_view)
    grant_role(manager_a, role, organization=org_a)
    grant_role(manager_b, role, organization=org_b)
    product_a = create_fg_product(
        actor=manager_a, organization=org_a, code="PROD-CKA", name="Product A"
    )
    product_b = create_fg_product(
        actor=manager_b, organization=org_b, code="PROD-CKB", name="Product B"
    )
    create_checklist_template(
        actor=manager_a,
        organization=org_a,
        code="CHK-PROD",
        name="With Product",
        product=product_a,
    )
    with pytest.raises(ValidationError):
        create_checklist_template(
            actor=manager_a,
            organization=org_a,
            code="CHK-BAD",
            name="Bad Product",
            product=product_b,
        )


@pytest.mark.django_db
def test_version_clone_publish_immutable_and_retire() -> None:
    org = make_org(code="ORG-CKV")
    manager = _manager(org=org)
    version = _seed_publishable(manager, org)
    cloned = create_checklist_version(
        actor=manager,
        template_id=version.template_id,
        source_version_id=version.id,
    )
    assert cloned.version_number == 2
    assert cloned.status == ChecklistVersionStatus.DRAFT
    assert cloned.sections.count() == 1
    assert ChecklistItem.objects.filter(section__version=cloned).count() == 1
    # Distinct rows
    assert list(cloned.sections.values_list("id", flat=True)) != list(
        version.sections.values_list("id", flat=True)
    )

    published = publish_checklist_version(actor=manager, version_id=version.id)
    assert published.status == ChecklistVersionStatus.PUBLISHED
    assert published.published_at is not None
    section = version.sections.get()
    with pytest.raises(ValidationError):
        update_checklist_section(actor=manager, section_id=section.id, title="Hacked")
    item = section.items.get()
    with pytest.raises(ValidationError):
        update_checklist_item(actor=manager, item_id=item.id, label="Hacked")
    with pytest.raises(ValidationError):
        add_checklist_section(actor=manager, version_id=version.id, title="No")

    retired = retire_checklist_version(actor=manager, version_id=version.id)
    assert retired.status == ChecklistVersionStatus.RETIRED
    with pytest.raises(ValidationError):
        update_checklist_section(actor=manager, section_id=section.id, title="Still no")

    assert SecurityAuditEvent.objects.filter(event_type="CHECKLIST_VERSION_PUBLISHED").exists()
    assert SecurityAuditEvent.objects.filter(event_type="CHECKLIST_VERSION_RETIRED").exists()
    assert SecurityAuditEvent.objects.filter(event_type="CHECKLIST_VERSION_CLONED").exists()


@pytest.mark.django_db
def test_version_number_allocation_is_sequential_under_lock() -> None:
    org = make_org(code="ORG-CKR")
    manager = _manager(org=org)
    template = create_checklist_template(
        actor=manager, organization=org, code="CHK-RACE", name="Race Test"
    )
    v1 = create_checklist_version(actor=manager, template_id=template.id)
    v2 = create_checklist_version(actor=manager, template_id=template.id)
    assert v1.version_number == 1
    assert v2.version_number == 2
    assert ChecklistVersion.objects.filter(template=template).count() == 2


@pytest.mark.django_db
def test_cross_org_and_viewer_denied(client: Client) -> None:
    org_a = make_org(code="ORG-CKX1")
    org_b = make_org(code="ORG-CKX2")
    manager_a = _manager(org=org_a)
    manager_b = _manager(org=org_b)
    template_b = create_checklist_template(
        actor=manager_b, organization=org_b, code="CHK-B", name="B"
    )
    viewer = _viewer(org=org_a)
    client.force_login(viewer)
    assert client.get(reverse("checklists:template_list")).status_code == 200
    body = client.get(reverse("checklists:template_list")).content.decode()
    assert "CHK-B" not in body
    assert client.get(reverse("checklists:template_detail", args=[template_b.id])).status_code in {
        403,
        404,
    }
    assert client.get(reverse("checklists:template_create")).status_code == 403
    with pytest.raises(PermissionDenied):
        create_checklist_template(actor=viewer, organization=org_a, code="CHK-NO", name="No")
    with pytest.raises(PermissionDenied):
        create_checklist_template(actor=manager_a, organization=org_b, code="CHK-X", name="X")


@pytest.mark.django_db
def test_ui_create_publish_flow_and_csrf(client: Client) -> None:
    org = make_org(code="ORG-CKU")
    manager = _manager(org=org)
    client.force_login(manager)
    assert (
        client.post(
            reverse("checklists:template_create"),
            {"organization": str(org.id), "code": "CHK-UI", "name": "UI Test", "is_active": "on"},
        ).status_code
        == 302
    )
    template = ChecklistTemplate.objects.get(code="CHK-UI")
    assert (
        client.post(reverse("checklists:version_create", args=[template.id]), {}).status_code == 302
    )
    version = ChecklistVersion.objects.get(template=template)
    client.post(
        reverse("checklists:section_add", args=[version.id]),
        {"title": "Section Test", "description": ""},
    )
    section = ChecklistSection.objects.get(version=version)
    client.post(
        reverse("checklists:item_add", args=[section.id]),
        {
            "code": "ITEM-1",
            "label": "Item Test",
            "is_required": "on",
            "response_type": "YES_NO",
        },
    )
    assert client.get(reverse("checklists:version_publish", args=[version.id])).status_code == 405
    client.post(reverse("checklists:version_publish", args=[version.id]))
    version.refresh_from_db()
    assert version.status == ChecklistVersionStatus.PUBLISHED
    # CSRF rejection
    csrf_client = Client(enforce_csrf_checks=True)
    csrf_client.force_login(manager)
    assert (
        csrf_client.post(reverse("checklists:version_retire", args=[version.id])).status_code == 403
    )


@pytest.mark.django_db
def test_list_edit_object_aware_and_query_bound(client: Client) -> None:
    org_a = make_org(code="ORG-CKL1")
    org_b = make_org(code="ORG-CKL2")
    manager_a = _manager(org=org_a)
    manager_b = _manager(org=org_b)
    dual = make_user(employee_code="CKDUAL1", is_staff=True)
    role_a = make_role_with_permission(
        code="CKDA", name="CK Dual A", permission=_perm("manage_checklist")
    )
    role_a.permissions.add(_perm("view_checklisttemplate"))
    grant_role(dual, role_a, organization=org_a)
    role_b = make_role_with_permission(
        code="CKDB", name="CK Dual B", permission=_perm("view_checklisttemplate")
    )
    grant_role(dual, role_b, organization=org_b)
    t_a = create_checklist_template(actor=manager_a, organization=org_a, code="CHK-A", name="A")
    t_b = create_checklist_template(actor=manager_b, organization=org_b, code="CHK-B", name="B")
    client.force_login(dual)
    with CaptureQueriesContext(connection) as ctx:
        response = client.get(reverse("checklists:template_list"))
    assert response.status_code == 200
    body = response.content.decode()
    assert reverse("checklists:template_edit", args=[t_a.id]) in body
    assert reverse("checklists:template_edit", args=[t_b.id]) not in body
    # Bound includes primary nav permission tags, unread badge, and reports gate.
    assert len(ctx) < 130


@pytest.mark.django_db
def test_admin_registered_no_delete() -> None:
    assert admin.site.is_registered(ChecklistTemplate)
    assert admin.site.is_registered(ChecklistVersion)
    model_admin = ChecklistTemplateAdmin(ChecklistTemplate, admin.site)
    assert model_admin.has_delete_permission(request=None) is False  # type: ignore[arg-type]
    version_admin = ChecklistVersionAdmin(ChecklistVersion, admin.site)
    assert version_admin.has_delete_permission(request=None) is False  # type: ignore[arg-type]


@pytest.mark.django_db
def test_publish_requires_structure() -> None:
    org = make_org(code="ORG-CKE")
    manager = _manager(org=org)
    template = create_checklist_template(
        actor=manager, organization=org, code="CHK-EMPTY", name="Empty"
    )
    version = create_checklist_version(actor=manager, template_id=template.id)
    with pytest.raises(ValidationError):
        publish_checklist_version(actor=manager, version_id=version.id)
    add_checklist_section(actor=manager, version_id=version.id, title="Only Section")
    with pytest.raises(ValidationError):
        publish_checklist_version(actor=manager, version_id=version.id)
