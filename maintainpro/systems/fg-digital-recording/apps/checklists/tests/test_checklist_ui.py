"""Checklist definition UI coverage — synthetic codes only."""

from __future__ import annotations

import uuid

import pytest
from django.contrib.auth.models import Permission
from django.contrib.contenttypes.models import ContentType
from django.test import Client
from django.urls import reverse
from tests.factories import grant_role, make_org, make_role_with_permission, make_user

from apps.accounts.models import User
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
    user = make_user(employee_code=f"CKU{suffix}", is_staff=True)
    role = make_role_with_permission(
        code=f"CKUM{suffix}",
        name=f"CK UI Manager {suffix}",
        permission=_perm("manage_checklist"),
    )
    role.permissions.add(_perm("view_checklisttemplate"))
    grant_role(user, role, organization=org)
    return user


@pytest.mark.django_db
def test_template_lifecycle_and_filters(client: Client) -> None:
    org = make_org(code="ORG-CKUI1")
    manager = _manager(org=org)
    client.force_login(manager)
    assert client.get(reverse("checklists:template_list")).status_code == 200
    assert client.get(reverse("checklists:template_create")).status_code == 200
    assert (
        client.post(
            reverse("checklists:template_create"),
            {
                "organization": str(org.id),
                "code": "CHK-LIFE",
                "name": "Lifecycle",
                "description": "desc",
                "is_active": "on",
            },
        ).status_code
        == 302
    )
    template = ChecklistTemplate.objects.get(code="CHK-LIFE")
    assert client.get(reverse("checklists:template_detail", args=[template.id])).status_code == 200
    assert client.get(reverse("checklists:template_edit", args=[template.id])).status_code == 200
    assert (
        client.post(
            reverse("checklists:template_edit", args=[template.id]),
            {
                "organization": str(org.id),
                "code": "CHK-LIFE",
                "name": "Lifecycle Updated",
                "description": "d2",
            },
        ).status_code
        == 302
    )
    template.refresh_from_db()
    assert template.name == "Lifecycle Updated"
    assert not template.is_active
    assert (
        client.post(reverse("checklists:template_activate", args=[template.id])).status_code == 302
    )
    template.refresh_from_db()
    assert template.is_active
    assert (
        client.post(reverse("checklists:template_deactivate", args=[template.id])).status_code
        == 302
    )
    assert (
        client.get(
            reverse("checklists:template_list"),
            {"q": "LIFE", "status": "inactive", "organization": str(org.id)},
        ).status_code
        == 200
    )
    assert client.get(reverse("checklists:template_list"), {"q": "no-match"}).status_code == 200


@pytest.mark.django_db
def test_draft_editor_reorder_publish_retire_clone(client: Client) -> None:
    org = make_org(code="ORG-CKUI2")
    manager = _manager(org=org)
    client.force_login(manager)
    template = create_checklist_template(
        actor=manager, organization=org, code="CHK-EDIT", name="Editor"
    )
    assert client.get(reverse("checklists:version_create", args=[template.id])).status_code == 200
    assert (
        client.post(
            reverse("checklists:version_create", args=[template.id]),
            {"source_version": ""},
        ).status_code
        == 302
    )
    version = ChecklistVersion.objects.get(template=template, version_number=1)
    assert client.get(reverse("checklists:version_detail", args=[version.id])).status_code == 200

    client.post(
        reverse("checklists:section_add", args=[version.id]),
        {"title": "Section A", "description": "a"},
    )
    client.post(
        reverse("checklists:section_add", args=[version.id]),
        {"title": "Section B", "description": "b"},
    )
    sections = list(ChecklistSection.objects.filter(version=version).order_by("position"))
    assert len(sections) == 2
    client.post(reverse("checklists:section_move", args=[sections[1].id]), {"direction": "up"})
    client.post(
        reverse("checklists:section_edit", args=[sections[0].id]),
        {"title": "Section A2", "description": "a2"},
    )
    assert client.get(reverse("checklists:section_edit", args=[sections[0].id])).status_code == 200

    section = ChecklistSection.objects.filter(version=version).order_by("position").first()
    assert section is not None
    client.post(
        reverse("checklists:item_add", args=[section.id]),
        {
            "code": "ITEM-A",
            "label": "Label A",
            "help_text": "help",
            "is_required": "on",
            "response_type": "YES_NO",
        },
    )
    client.post(
        reverse("checklists:item_add", args=[section.id]),
        {"code": "ITEM-B", "label": "Label B", "response_type": "TEXT"},
    )
    items = list(ChecklistItem.objects.filter(section=section).order_by("position"))
    assert len(items) == 2
    client.post(reverse("checklists:item_move", args=[items[1].id]), {"direction": "up"})
    assert client.get(reverse("checklists:item_edit", args=[items[0].id])).status_code == 200
    client.post(
        reverse("checklists:item_edit", args=[items[0].id]),
        {
            "code": "ITEM-A",
            "label": "Label A2",
            "help_text": "",
            "is_required": "on",
            "response_type": "YES_NO",
        },
    )
    client.post(reverse("checklists:item_delete", args=[items[1].id]))
    assert ChecklistItem.objects.filter(section=section).count() == 1

    # Ensure at least one item remains for publish
    client.post(reverse("checklists:version_publish", args=[version.id]))
    version.refresh_from_db()
    assert version.status == ChecklistVersionStatus.PUBLISHED
    body = client.get(reverse("checklists:version_detail", args=[version.id])).content.decode()
    assert "read-only" in body.lower() or "Published" in body

    # Published mutations denied (HTTP 403 — not a soft redirect)
    assert (
        client.post(
            reverse("checklists:section_add", args=[version.id]),
            {"title": "Nope"},
        ).status_code
        == 403
    )
    assert ChecklistSection.objects.filter(version=version, title="Nope").count() == 0

    client.post(reverse("checklists:version_retire", args=[version.id]))
    version.refresh_from_db()
    assert version.status == ChecklistVersionStatus.RETIRED

    # Clone from retired/published source
    assert (
        client.post(
            reverse("checklists:version_create", args=[template.id]),
            {"source_version": str(version.id)},
        ).status_code
        == 302
    )
    assert ChecklistVersion.objects.filter(template=template).count() == 2


@pytest.mark.django_db
def test_section_delete_and_unauthorized(client: Client) -> None:
    org_a = make_org(code="ORG-CKUI3")
    org_b = make_org(code="ORG-CKUI4")
    manager_a = _manager(org=org_a)
    manager_b = _manager(org=org_b)
    template = create_checklist_template(
        actor=manager_a, organization=org_a, code="CHK-DEL", name="Delete"
    )
    version = create_checklist_version(actor=manager_a, template_id=template.id)
    section = add_checklist_section(actor=manager_a, version_id=version.id, title="To Delete")
    add_checklist_item(actor=manager_a, section_id=section.id, code="ITEM-X", label="X")
    client.force_login(manager_a)
    client.post(reverse("checklists:section_delete", args=[section.id]))
    assert not ChecklistSection.objects.filter(pk=section.id).exists()

    foreign = create_checklist_template(
        actor=manager_b, organization=org_b, code="CHK-FOR", name="Foreign"
    )
    assert client.get(reverse("checklists:template_detail", args=[foreign.id])).status_code in {
        403,
        404,
    }
    assert client.get(reverse("checklists:template_edit", args=[foreign.id])).status_code in {
        403,
        404,
    }
    forged = uuid.uuid4()
    assert client.get(reverse("checklists:template_detail", args=[forged])).status_code == 404
    assert client.get(reverse("checklists:version_detail", args=[forged])).status_code == 404
