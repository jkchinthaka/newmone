"""Phase 06C — checklist response definition schema tests."""

from __future__ import annotations

import uuid
from decimal import Decimal

import pytest
from django.contrib import admin
from django.contrib.auth.models import Permission
from django.contrib.contenttypes.models import ContentType
from django.core.exceptions import ValidationError
from django.db import connection
from django.test import Client
from django.test.utils import CaptureQueriesContext
from django.urls import reverse
from tests.factories import grant_role, make_org, make_role_with_permission, make_user

from apps.accounts.models import User
from apps.checklists.admin import ChecklistItemAdmin, ChecklistItemOptionAdmin
from apps.checklists.models import (
    ChecklistItem,
    ChecklistItemOption,
    ChecklistResponseType,
    ChecklistSection,
    ChecklistTemplate,
    ChecklistVersion,
    ChecklistVersionStatus,
)
from apps.checklists.services import (
    add_checklist_item,
    add_checklist_item_option,
    add_checklist_section,
    create_checklist_template,
    create_checklist_version,
    move_checklist_item_option,
    publish_checklist_version,
    remove_checklist_item_option,
    update_checklist_item,
    update_checklist_item_option,
)
from apps.organizations.models import Organization


def _perm(codename: str) -> Permission:
    ct = ContentType.objects.get_for_model(ChecklistTemplate)
    permission, _ = Permission.objects.get_or_create(
        content_type=ct,
        codename=codename,
        defaults={"name": f"Can {codename.replace('_', ' ')}"},
    )
    return permission


def _manager(*, org: Organization) -> User:
    suffix = uuid.uuid4().hex[:8].upper()
    user = make_user(employee_code=f"CKR{suffix}", is_staff=True)
    role = make_role_with_permission(
        code=f"CKRM{suffix}",
        name=f"CK Response Manager {suffix}",
        permission=_perm("manage_checklist"),
    )
    role.permissions.add(_perm("view_checklisttemplate"))
    grant_role(user, role, organization=org)
    return user


def _draft_section(
    actor: User, org: Organization, *, code: str = "CHK-RSP"
) -> tuple[ChecklistVersion, ChecklistSection]:
    template = create_checklist_template(
        actor=actor, organization=org, code=code, name="Response Schema Test"
    )
    version = create_checklist_version(actor=actor, template_id=template.id)
    section = add_checklist_section(actor=actor, version_id=version.id, title="Section Test")
    return version, section


@pytest.mark.django_db
def test_valid_response_types_and_number_limits() -> None:
    org = make_org(code="ORG-RS1")
    manager = _manager(org=org)
    _, section = _draft_section(manager, org, code="CHK-VT")
    for response_type in ChecklistResponseType.values:
        item = add_checklist_item(
            actor=manager,
            section_id=section.id,
            code=f"I-{response_type}",
            label=f"Item {response_type}",
            response_type=response_type,
            unit="°C" if response_type == ChecklistResponseType.NUMBER else "",
            minimum_value=Decimal("1") if response_type == ChecklistResponseType.NUMBER else None,
            maximum_value=Decimal("10") if response_type == ChecklistResponseType.NUMBER else None,
        )
        assert item.response_type == response_type
    with pytest.raises(ValidationError):
        add_checklist_item(
            actor=manager,
            section_id=section.id,
            code="BAD-TYPE",
            label="Bad",
            response_type="PHOTO",
        )
    with pytest.raises(ValidationError):
        add_checklist_item(
            actor=manager,
            section_id=section.id,
            code="BAD-RANGE",
            label="Bad range",
            response_type=ChecklistResponseType.NUMBER,
            minimum_value=Decimal("10"),
            maximum_value=Decimal("1"),
        )
    with pytest.raises(ValidationError):
        add_checklist_item(
            actor=manager,
            section_id=section.id,
            code="BAD-LIMIT",
            label="Bad limit",
            response_type=ChecklistResponseType.YES_NO,
            minimum_value=Decimal("1"),
        )


@pytest.mark.django_db
def test_select_options_and_publish_rules(client: Client) -> None:
    org = make_org(code="ORG-RS2")
    manager = _manager(org=org)
    version, section = _draft_section(manager, org, code="CHK-PUB")
    bare = add_checklist_item(
        actor=manager, section_id=section.id, code="NO-TYPE", label="No type yet"
    )
    with pytest.raises(ValidationError):
        publish_checklist_version(actor=manager, version_id=version.id)
    update_checklist_item(
        actor=manager, item_id=bare.id, response_type=ChecklistResponseType.SELECT
    )
    with pytest.raises(ValidationError):
        publish_checklist_version(actor=manager, version_id=version.id)
    add_checklist_item_option(actor=manager, item_id=bare.id, value="release", label="Release")
    add_checklist_item_option(actor=manager, item_id=bare.id, value="hold", label="Hold")
    with pytest.raises(ValidationError):
        add_checklist_item_option(actor=manager, item_id=bare.id, value="RELEASE", label="Dup")
    number_item = add_checklist_item(
        actor=manager,
        section_id=section.id,
        code="NUM-1",
        label="Weight",
        response_type=ChecklistResponseType.NUMBER,
    )
    assert number_item.minimum_value is None
    published = publish_checklist_version(actor=manager, version_id=version.id)
    assert published.status == ChecklistVersionStatus.PUBLISHED

    with pytest.raises(ValidationError):
        update_checklist_item(
            actor=manager, item_id=bare.id, response_type=ChecklistResponseType.TEXT
        )
    with pytest.raises(ValidationError):
        add_checklist_item_option(actor=manager, item_id=bare.id, value="reject", label="Reject")

    client.force_login(manager)
    assert (
        client.post(
            reverse("checklists:option_add", args=[bare.id]),
            {"value": "X", "label": "X"},
        ).status_code
        == 403
    )


@pytest.mark.django_db
def test_clone_copies_response_schema_and_independent_options() -> None:
    org = make_org(code="ORG-RS3")
    manager = _manager(org=org)
    version, section = _draft_section(manager, org, code="CHK-CLN")
    item = add_checklist_item(
        actor=manager,
        section_id=section.id,
        code="DISP",
        label="Disposition",
        response_type=ChecklistResponseType.SELECT,
    )
    add_checklist_item_option(actor=manager, item_id=item.id, value="RELEASE", label="Release")
    add_checklist_item_option(actor=manager, item_id=item.id, value="HOLD", label="Hold")
    number = add_checklist_item(
        actor=manager,
        section_id=section.id,
        code="TEMP",
        label="Temperature",
        response_type=ChecklistResponseType.NUMBER,
        unit="°C",
        minimum_value=None,
        maximum_value=None,
    )
    cloned = create_checklist_version(
        actor=manager, template_id=version.template_id, source_version_id=version.id
    )
    cloned_select = cloned.sections.get().items.get(code="DISP")
    assert cloned_select.id != item.id
    assert cloned_select.response_type == ChecklistResponseType.SELECT
    cloned_opts = list(cloned_select.options.order_by("position").values_list("value", flat=True))
    assert cloned_opts == ["RELEASE", "HOLD"]
    assert set(cloned_select.options.values_list("id", flat=True)).isdisjoint(
        set(item.options.values_list("id", flat=True))
    )
    cloned_number = cloned.sections.get().items.get(code="TEMP")
    assert cloned_number.unit == "C"
    assert cloned_number.id != number.id
    version.refresh_from_db()
    assert version.status == ChecklistVersionStatus.DRAFT
    assert item.options.count() == 2


@pytest.mark.django_db
def test_option_reorder_authz_and_idor(client: Client) -> None:
    org_a = make_org(code="ORG-RS4A")
    org_b = make_org(code="ORG-RS4B")
    manager_a = _manager(org=org_a)
    manager_b = _manager(org=org_b)
    _, section_a = _draft_section(manager_a, org_a, code="CHK-A")
    item_a = add_checklist_item(
        actor=manager_a,
        section_id=section_a.id,
        code="SEL-A",
        label="Select A",
        response_type=ChecklistResponseType.SELECT,
    )
    opt1 = add_checklist_item_option(actor=manager_a, item_id=item_a.id, value="ONE", label="One")
    opt2 = add_checklist_item_option(actor=manager_a, item_id=item_a.id, value="TWO", label="Two")
    move_checklist_item_option(actor=manager_a, option_id=opt2.id, direction="up")
    opt1.refresh_from_db()
    opt2.refresh_from_db()
    assert opt2.position == 1
    assert opt1.position == 2
    update_checklist_item_option(
        actor=manager_a, option_id=opt1.id, value="ONE", label="One Updated"
    )
    remove_checklist_item_option(actor=manager_a, option_id=opt1.id)
    assert item_a.options.count() == 1

    _, section_b = _draft_section(manager_b, org_b, code="CHK-B")
    item_b = add_checklist_item(
        actor=manager_b,
        section_id=section_b.id,
        code="SEL-B",
        label="Select B",
        response_type=ChecklistResponseType.SELECT,
    )
    opt_b = add_checklist_item_option(
        actor=manager_b, item_id=item_b.id, value="FOREIGN", label="Foreign"
    )
    client.force_login(manager_a)
    assert client.post(reverse("checklists:option_delete", args=[opt_b.id])).status_code in {
        403,
        404,
    }
    assert client.get(reverse("checklists:option_edit", args=[opt_b.id])).status_code in {
        403,
        404,
    }


@pytest.mark.django_db
def test_ui_response_fields_and_option_editor(client: Client) -> None:
    org = make_org(code="ORG-RS5")
    manager = _manager(org=org)
    version, section = _draft_section(manager, org, code="CHK-UI")
    client.force_login(manager)
    assert (
        client.post(
            reverse("checklists:item_add", args=[section.id]),
            {
                "code": "SEL-1",
                "label": "Disposition",
                "is_required": "on",
                "response_type": "SELECT",
            },
        ).status_code
        == 302
    )
    item = ChecklistItem.objects.get(code="SEL-1")
    body = client.get(reverse("checklists:item_edit", args=[item.id])).content.decode()
    assert "Response type" in body
    assert "Select options" in body
    assert (
        client.post(
            reverse("checklists:option_add", args=[item.id]),
            {"value": "release", "label": "Release"},
        ).status_code
        == 302
    )
    option = ChecklistItemOption.objects.get(item=item)
    assert client.get(reverse("checklists:option_edit", args=[option.id])).status_code == 200
    csrf_client = Client(enforce_csrf_checks=True)
    csrf_client.force_login(manager)
    assert (
        csrf_client.post(
            reverse("checklists:option_add", args=[item.id]),
            {"value": "HOLD", "label": "Hold"},
        ).status_code
        == 403
    )
    detail = client.get(reverse("checklists:version_detail", args=[version.id])).content.decode()
    assert "Select" in detail or "SELECT" in detail


@pytest.mark.django_db
def test_admin_and_query_bounds_with_options(client: Client) -> None:
    org = make_org(code="ORG-RS6")
    manager = _manager(org=org)
    version, section = _draft_section(manager, org, code="CHK-ADM")
    item = add_checklist_item(
        actor=manager,
        section_id=section.id,
        code="SEL",
        label="Select",
        response_type=ChecklistResponseType.SELECT,
    )
    add_checklist_item_option(actor=manager, item_id=item.id, value="A", label="A")
    publish_checklist_version(actor=manager, version_id=version.id)
    item.refresh_from_db()
    option = item.options.select_related("item__section__version").get()
    item_admin = ChecklistItemAdmin(ChecklistItem, admin.site)
    option_admin = ChecklistItemOptionAdmin(ChecklistItemOption, admin.site)
    assert item_admin.has_change_permission(request=None, obj=item) is False  # type: ignore[arg-type]
    assert option_admin.has_delete_permission(request=None, obj=option) is False  # type: ignore[arg-type]

    for i in range(8):
        template = create_checklist_template(
            actor=manager, organization=org, code=f"CHK-Q{i}", name=f"Q{i}"
        )
        ver = create_checklist_version(actor=manager, template_id=template.id)
        sec = add_checklist_section(actor=manager, version_id=ver.id, title="S")
        it = add_checklist_item(
            actor=manager,
            section_id=sec.id,
            code="I1",
            label="Item",
            response_type=ChecklistResponseType.SELECT,
        )
        for j in range(3):
            add_checklist_item_option(actor=manager, item_id=it.id, value=f"V{j}", label=f"L{j}")
    client.force_login(manager)
    sample = (
        ChecklistVersion.objects.filter(template__organization=org).exclude(pk=version.id).first()
    )
    assert sample is not None
    with CaptureQueriesContext(connection) as ctx:
        assert client.get(reverse("checklists:version_detail", args=[sample.id])).status_code == 200
    assert len(ctx) < 110
