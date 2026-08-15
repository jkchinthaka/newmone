"""Phase 06B — checklist governance hardening tests."""

from __future__ import annotations

import uuid
from concurrent.futures import ThreadPoolExecutor

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
from apps.checklists.admin import (
    ChecklistItemAdmin,
    ChecklistSectionAdmin,
    ChecklistVersionAdmin,
)
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
    assert_version_transition_allowed,
    create_checklist_template,
    create_checklist_version,
    move_checklist_item,
    move_checklist_section,
    publish_checklist_version,
    remove_checklist_item,
    remove_checklist_section,
    retire_checklist_version,
    update_checklist_item,
    update_checklist_section,
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
    user = make_user(employee_code=f"CKG{suffix}", is_staff=True)
    role = make_role_with_permission(
        code=f"CKGM{suffix}",
        name=f"CK Gov Manager {suffix}",
        permission=_perm("manage_checklist"),
    )
    role.permissions.add(_perm("view_checklisttemplate"))
    grant_role(user, role, organization=org)
    return user


def _seed_version(actor: User, org: Organization, *, code: str = "CHK-GOV") -> ChecklistVersion:
    template = create_checklist_template(
        actor=actor, organization=org, code=code, name="Governance Test"
    )
    version = create_checklist_version(actor=actor, template_id=template.id)
    section = add_checklist_section(actor=actor, version_id=version.id, title="Section Test")
    add_checklist_item(
        actor=actor,
        section_id=section.id,
        code="ITEM-1",
        label="Item Test One",
        response_type="YES_NO",
    )
    add_checklist_item(
        actor=actor,
        section_id=section.id,
        code="ITEM-2",
        label="Item Test Two",
        response_type="TEXT",
    )
    return version


@pytest.mark.django_db
def test_allowed_and_prohibited_transitions() -> None:
    assert_version_transition_allowed(
        current=ChecklistVersionStatus.DRAFT,
        target=ChecklistVersionStatus.PUBLISHED,
    )
    assert_version_transition_allowed(
        current=ChecklistVersionStatus.PUBLISHED,
        target=ChecklistVersionStatus.RETIRED,
    )
    for current, target in (
        (ChecklistVersionStatus.RETIRED, ChecklistVersionStatus.DRAFT),
        (ChecklistVersionStatus.RETIRED, ChecklistVersionStatus.PUBLISHED),
        (ChecklistVersionStatus.PUBLISHED, ChecklistVersionStatus.DRAFT),
        (ChecklistVersionStatus.DRAFT, ChecklistVersionStatus.RETIRED),
        (ChecklistVersionStatus.PUBLISHED, ChecklistVersionStatus.PUBLISHED),
    ):
        with pytest.raises(ValidationError):
            assert_version_transition_allowed(current=current, target=target)


@pytest.mark.django_db
def test_duplicate_publish_and_illegal_retire_rejected() -> None:
    org = make_org(code="ORG-CG1")
    manager = _manager(org=org)
    version = _seed_version(manager, org, code="CHK-DUP")
    publish_checklist_version(actor=manager, version_id=version.id)
    with pytest.raises(ValidationError):
        publish_checklist_version(actor=manager, version_id=version.id)
    retired = retire_checklist_version(actor=manager, version_id=version.id)
    assert retired.status == ChecklistVersionStatus.RETIRED
    with pytest.raises(ValidationError):
        retire_checklist_version(actor=manager, version_id=version.id)
    with pytest.raises(ValidationError):
        publish_checklist_version(actor=manager, version_id=version.id)


@pytest.mark.django_db
def test_published_and_retired_structural_immutability(client: Client) -> None:
    org = make_org(code="ORG-CG2")
    manager = _manager(org=org)
    version = _seed_version(manager, org, code="CHK-IMM")
    section = version.sections.get()
    item = section.items.order_by("position").first()
    assert item is not None
    publish_checklist_version(actor=manager, version_id=version.id)

    with pytest.raises(ValidationError):
        add_checklist_section(actor=manager, version_id=version.id, title="No")
    with pytest.raises(ValidationError):
        update_checklist_section(actor=manager, section_id=section.id, title="No")
    with pytest.raises(ValidationError):
        remove_checklist_section(actor=manager, section_id=section.id)
    with pytest.raises(ValidationError):
        move_checklist_section(actor=manager, section_id=section.id, direction="down")
    with pytest.raises(ValidationError):
        add_checklist_item(actor=manager, section_id=section.id, code="ITEM-X", label="No")
    with pytest.raises(ValidationError):
        update_checklist_item(actor=manager, item_id=item.id, label="No")
    with pytest.raises(ValidationError):
        remove_checklist_item(actor=manager, item_id=item.id)
    with pytest.raises(ValidationError):
        move_checklist_item(actor=manager, item_id=item.id, direction="down")

    client.force_login(manager)
    assert (
        client.post(
            reverse("checklists:section_add", args=[version.id]),
            {"title": "HTTP No"},
        ).status_code
        == 403
    )
    assert client.post(reverse("checklists:item_delete", args=[item.id])).status_code == 403

    retire_checklist_version(actor=manager, version_id=version.id)
    with pytest.raises(ValidationError):
        update_checklist_section(actor=manager, section_id=section.id, title="Still no")
    assert (
        client.post(
            reverse("checklists:item_add", args=[section.id]),
            {"code": "ITEM-Z", "label": "Z"},
        ).status_code
        == 403
    )


@pytest.mark.django_db
def test_clone_from_draft_published_retired_preserves_order() -> None:
    org = make_org(code="ORG-CG3")
    manager = _manager(org=org)

    for index, source_status in enumerate(
        (
            ChecklistVersionStatus.DRAFT,
            ChecklistVersionStatus.PUBLISHED,
            ChecklistVersionStatus.RETIRED,
        )
    ):
        version = _seed_version(manager, org, code=f"CHK-CL{index}")
        source_section = version.sections.get()
        source_codes = list(
            source_section.items.order_by("position").values_list("code", flat=True)
        )
        if source_status in {
            ChecklistVersionStatus.PUBLISHED,
            ChecklistVersionStatus.RETIRED,
        }:
            publish_checklist_version(actor=manager, version_id=version.id)
        if source_status == ChecklistVersionStatus.RETIRED:
            retire_checklist_version(actor=manager, version_id=version.id)
        version.refresh_from_db()
        assert version.status == source_status

        cloned = create_checklist_version(
            actor=manager,
            template_id=version.template_id,
            source_version_id=version.id,
        )
        assert cloned.status == ChecklistVersionStatus.DRAFT
        assert cloned.id != version.id
        cloned_section = cloned.sections.get()
        assert cloned_section.id != source_section.id
        cloned_codes = list(
            cloned_section.items.order_by("position").values_list("code", flat=True)
        )
        assert cloned_codes == source_codes
        assert set(cloned_section.items.values_list("id", flat=True)).isdisjoint(
            set(source_section.items.values_list("id", flat=True))
        )
        version.refresh_from_db()
        assert version.status == source_status


@pytest.mark.django_db(transaction=True)
def test_concurrent_version_number_allocation() -> None:
    org = make_org(code="ORG-CG4")
    manager = _manager(org=org)
    template = create_checklist_template(
        actor=manager, organization=org, code="CHK-RACE", name="Race"
    )

    def _create() -> int:
        from django.db import close_old_connections, connection

        close_old_connections()
        try:
            version = create_checklist_version(actor=manager, template_id=template.id)
            return version.version_number
        finally:
            connection.close()
            close_old_connections()

    with ThreadPoolExecutor(max_workers=4) as pool:
        numbers = list(pool.map(lambda _: _create(), range(4)))
    assert sorted(numbers) == [1, 2, 3, 4]
    assert ChecklistVersion.objects.filter(template=template).count() == 4


@pytest.mark.django_db
def test_reorder_edges_and_removal_compaction() -> None:
    org = make_org(code="ORG-CG5")
    manager = _manager(org=org)
    version = _seed_version(manager, org, code="CHK-ORD")
    section = version.sections.get()
    items = list(section.items.order_by("position"))
    # First item move up is no-op
    move_checklist_item(actor=manager, item_id=items[0].id, direction="up")
    items[0].refresh_from_db()
    assert items[0].position == 1
    # Last item move down is no-op
    move_checklist_item(actor=manager, item_id=items[-1].id, direction="down")
    items[-1].refresh_from_db()
    assert items[-1].position == 2
    remove_checklist_item(actor=manager, item_id=items[0].id)
    remaining = list(section.items.order_by("position"))
    assert len(remaining) == 1
    assert remaining[0].position == 1


@pytest.mark.django_db
def test_object_aware_actions_and_child_idor(client: Client) -> None:
    org_a = make_org(code="ORG-CG6A")
    org_b = make_org(code="ORG-CG6B")
    manager_a = _manager(org=org_a)
    manager_b = _manager(org=org_b)
    dual = make_user(employee_code="CKGDUAL1", is_staff=True)
    role_manage = make_role_with_permission(
        code="CKGMA", name="CKG Manage A", permission=_perm("manage_checklist")
    )
    role_manage.permissions.add(_perm("view_checklisttemplate"))
    grant_role(dual, role_manage, organization=org_a)
    role_view = make_role_with_permission(
        code="CKGVB", name="CKG View B", permission=_perm("view_checklisttemplate")
    )
    grant_role(dual, role_view, organization=org_b)

    t_a = create_checklist_template(actor=manager_a, organization=org_a, code="CHK-A", name="A")
    t_b = create_checklist_template(actor=manager_b, organization=org_b, code="CHK-B", name="B")
    v_b = create_checklist_version(actor=manager_b, template_id=t_b.id)
    s_b = add_checklist_section(actor=manager_b, version_id=v_b.id, title="Foreign Sec")
    i_b = add_checklist_item(actor=manager_b, section_id=s_b.id, code="ITEM-F", label="Foreign")

    client.force_login(dual)
    body = client.get(reverse("checklists:template_list")).content.decode()
    assert reverse("checklists:template_edit", args=[t_a.id]) in body
    assert reverse("checklists:template_edit", args=[t_b.id]) not in body
    assert reverse("checklists:template_create") in body
    assert client.get(reverse("checklists:version_create", args=[t_b.id])).status_code == 403
    assert client.post(
        reverse("checklists:section_add", args=[v_b.id]), {"title": "X"}
    ).status_code in {403, 404}
    assert client.get(reverse("checklists:section_edit", args=[s_b.id])).status_code in {
        403,
        404,
    }
    assert client.post(reverse("checklists:item_delete", args=[i_b.id])).status_code in {
        403,
        404,
    }
    # Search/count leakage
    response = client.get(reverse("checklists:template_list"), {"q": "CHK"})
    assert response.context["total_count"] == 2
    org_ids = {str(o.id) for o in response.context["organizations"]}
    assert str(org_a.id) in org_ids and str(org_b.id) in org_ids


@pytest.mark.django_db
def test_template_list_and_version_editor_query_bounds(client: Client) -> None:
    org = make_org(code="ORG-CG7")
    manager = _manager(org=org)
    for i in range(12):
        template = create_checklist_template(
            actor=manager,
            organization=org,
            code=f"CHK-Q{i:02d}",
            name=f"Query {i}",
        )
        version = create_checklist_version(actor=manager, template_id=template.id)
        section = add_checklist_section(actor=manager, version_id=version.id, title="Section")
        for j in range(5):
            add_checklist_item(
                actor=manager,
                section_id=section.id,
                code=f"I{j}",
                label=f"Item {j}",
            )
    client.force_login(manager)
    with CaptureQueriesContext(connection) as list_ctx:
        assert client.get(reverse("checklists:template_list")).status_code == 200
    assert len(list_ctx) < 95

    editor_version = ChecklistVersion.objects.filter(template__organization=org).first()
    assert editor_version is not None
    with CaptureQueriesContext(connection) as editor_ctx:
        response = client.get(reverse("checklists:version_detail", args=[editor_version.id]))
        assert response.status_code == 200
    assert len(editor_ctx) < 110


@pytest.mark.django_db
def test_admin_blocks_immutable_mutations() -> None:
    org = make_org(code="ORG-CG8")
    manager = _manager(org=org)
    version = _seed_version(manager, org, code="CHK-ADM")
    publish_checklist_version(actor=manager, version_id=version.id)
    version.refresh_from_db()
    section = version.sections.select_related("version").get()
    item = section.items.select_related("section__version").first()
    assert item is not None
    assert version.status == ChecklistVersionStatus.PUBLISHED
    version_admin = ChecklistVersionAdmin(ChecklistVersion, admin.site)
    assert version_admin.has_delete_permission(request=None) is False  # type: ignore[arg-type]
    section_admin = ChecklistSectionAdmin(ChecklistSection, admin.site)
    assert section_admin.has_change_permission(request=None, obj=section) is False  # type: ignore[arg-type]
    assert section_admin.has_delete_permission(request=None, obj=section) is False  # type: ignore[arg-type]
    item_admin = ChecklistItemAdmin(ChecklistItem, admin.site)
    assert item_admin.has_change_permission(request=None, obj=item) is False  # type: ignore[arg-type]
    with pytest.raises(ValidationError):
        assert_version_transition_allowed(
            current=ChecklistVersionStatus.PUBLISHED,
            target=ChecklistVersionStatus.DRAFT,
        )
