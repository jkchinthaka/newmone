"""Phase 07A — batch checklist task foundation tests."""

from __future__ import annotations

import uuid
from concurrent.futures import ThreadPoolExecutor
from typing import Any

import pytest
from django.contrib.auth.models import Permission
from django.contrib.contenttypes.models import ContentType
from django.core.exceptions import PermissionDenied, ValidationError
from django.db import connection, transaction
from django.test import Client, TransactionTestCase
from django.urls import reverse
from tests.factories import grant_role, make_org, make_role_with_permission, make_user

from apps.accounts.models import User
from apps.checklists.models import ChecklistVersionStatus
from apps.checklists.services import (
    add_checklist_item,
    add_checklist_section,
    create_checklist_template,
    create_checklist_version,
    publish_checklist_version,
    retire_checklist_version,
)
from apps.organizations.models import Organization
from apps.scheduling.models import ChecklistTask, ChecklistTaskStatus
from apps.scheduling.selectors import (
    get_checklist_task,
    list_checklist_tasks,
    list_pending_checklist_tasks,
)
from apps.scheduling.services import cancel_checklist_task, create_batch_checklist_task
from apps.security_audit.models import SecurityAuditEvent


def _perm(codename: str) -> Permission:
    ct = ContentType.objects.get_for_model(ChecklistTask)
    permission, _ = Permission.objects.get_or_create(
        content_type=ct,
        codename=codename,
        defaults={"name": f"Can {codename.replace('_', ' ')}"},
    )
    return permission


def _manager(*, org: Organization) -> User:
    suffix = uuid.uuid4().hex[:8].upper()
    user = make_user(employee_code=f"TSK{suffix}", is_staff=True)
    role = make_role_with_permission(
        code=f"TSKM{suffix}",
        name=f"Task Manager {suffix}",
        permission=_perm("manage_checklisttask"),
    )
    role.permissions.add(_perm("view_checklisttask"))
    grant_role(user, role, organization=org)
    return user


def _viewer(*, org: Organization) -> User:
    suffix = uuid.uuid4().hex[:8].upper()
    user = make_user(employee_code=f"TSV{suffix}")
    role = make_role_with_permission(
        code=f"TSKV{suffix}",
        name=f"Task Viewer {suffix}",
        permission=_perm("view_checklisttask"),
    )
    grant_role(user, role, organization=org)
    return user


def _grant_checklist_manage(user: User, org: Organization) -> None:
    from apps.checklists.models import ChecklistTemplate

    ct = ContentType.objects.get_for_model(ChecklistTemplate)
    manage, _ = Permission.objects.get_or_create(
        content_type=ct,
        codename="manage_checklist",
        defaults={"name": "Can manage checklist definitions"},
    )
    view, _ = Permission.objects.get_or_create(
        content_type=ct,
        codename="view_checklisttemplate",
        defaults={"name": "Can view checklist template"},
    )
    suffix = uuid.uuid4().hex[:8].upper()
    role = make_role_with_permission(
        code=f"CHKM{suffix}",
        name=f"Checklist Manager {suffix}",
        permission=manage,
    )
    role.permissions.add(view)
    grant_role(user, role, organization=org)


def _make_published(*, actor: User, org: Organization, code: str = "CHK-PUB") -> tuple[Any, Any]:
    from apps.checklists.models import ChecklistTemplate, ChecklistVersion

    _grant_checklist_manage(actor, org)
    template = create_checklist_template(
        actor=actor, organization=org, code=code, name=f"{code} Name"
    )
    version = create_checklist_version(actor=actor, template_id=template.id)
    section = add_checklist_section(actor=actor, version_id=version.id, title="Section")
    add_checklist_item(
        actor=actor,
        section_id=section.id,
        code="I1",
        label="Item",
        response_type="YES_NO",
    )
    published = publish_checklist_version(actor=actor, version_id=version.id)
    assert isinstance(template, ChecklistTemplate)
    assert isinstance(published, ChecklistVersion)
    return template, published


@pytest.mark.django_db
def test_create_task_published_only_and_idempotent() -> None:
    org = make_org(code="ORG-TSK1")
    manager = _manager(org=org)
    template, published = _make_published(actor=manager, org=org, code="CHK-A")

    task = create_batch_checklist_task(
        actor=manager,
        organization_id=org.id,
        checklist_template_id=template.id,
        checklist_version_id=published.id,
        batch_reference="  BATCH-001  ",
    )
    assert task.batch_reference == "BATCH-001"
    assert task.status == ChecklistTaskStatus.PENDING
    assert task.checklist_version_id == published.id
    assert SecurityAuditEvent.objects.filter(event_type="CHECKLIST_TASK_CREATED").exists()

    again = create_batch_checklist_task(
        actor=manager,
        organization_id=org.id,
        checklist_template_id=template.id,
        checklist_version_id=published.id,
        batch_reference="BATCH-001",
    )
    assert again.id == task.id
    assert ChecklistTask.objects.filter(organization=org).count() == 1

    draft = create_checklist_version(actor=manager, template_id=template.id)
    with pytest.raises(ValidationError):
        create_batch_checklist_task(
            actor=manager,
            organization_id=org.id,
            checklist_template_id=template.id,
            checklist_version_id=draft.id,
            batch_reference="BATCH-DRAFT",
        )

    other = create_checklist_version(actor=manager, template_id=template.id)
    section = add_checklist_section(actor=manager, version_id=other.id, title="S")
    add_checklist_item(
        actor=manager,
        section_id=section.id,
        code="I2",
        label="Item 2",
        response_type="YES_NO",
    )
    published2 = publish_checklist_version(actor=manager, version_id=other.id)
    retire_checklist_version(actor=manager, version_id=published.id)
    published.refresh_from_db()
    assert published.status == ChecklistVersionStatus.RETIRED
    with pytest.raises(ValidationError):
        create_batch_checklist_task(
            actor=manager,
            organization_id=org.id,
            checklist_template_id=template.id,
            checklist_version_id=published.id,
            batch_reference="BATCH-RETIRED",
        )

    with pytest.raises(ValidationError):
        create_batch_checklist_task(
            actor=manager,
            organization_id=org.id,
            checklist_template_id=template.id,
            checklist_version_id=published2.id,
            batch_reference="BATCH-001",
        )


@pytest.mark.django_db
def test_blank_batch_and_org_mismatch_rejected() -> None:
    org_a = make_org(code="ORG-TSK2A")
    org_b = make_org(code="ORG-TSK2B")
    manager = _manager(org=org_a)
    grant_role(
        manager,
        make_role_with_permission(
            code=f"TSKM{uuid.uuid4().hex[:6].upper()}",
            name="Extra",
            permission=_perm("manage_checklisttask"),
        ),
        organization=org_b,
    )
    # Also need view on org_b for manage role already has manage
    role_view = make_role_with_permission(
        code=f"TSKV{uuid.uuid4().hex[:6].upper()}",
        name="View B",
        permission=_perm("view_checklisttask"),
    )
    grant_role(manager, role_view, organization=org_b)

    template, published = _make_published(actor=manager, org=org_a, code="CHK-B")
    with pytest.raises(ValidationError):
        create_batch_checklist_task(
            actor=manager,
            organization_id=org_a.id,
            checklist_template_id=template.id,
            checklist_version_id=published.id,
            batch_reference="   ",
        )
    with pytest.raises(ValidationError):
        create_batch_checklist_task(
            actor=manager,
            organization_id=org_b.id,
            checklist_template_id=template.id,
            checklist_version_id=published.id,
            batch_reference="BATCH-X",
        )


@pytest.mark.django_db
def test_cancel_and_selectors_and_authz() -> None:
    org_a = make_org(code="ORG-TSK3A")
    org_b = make_org(code="ORG-TSK3B")
    manager_a = _manager(org=org_a)
    manager_b = _manager(org=org_b)
    viewer = _viewer(org=org_a)
    template, published = _make_published(actor=manager_a, org=org_a, code="CHK-C")
    other_t, other_p = _make_published(actor=manager_a, org=org_a, code="CHK-D")

    task = create_batch_checklist_task(
        actor=manager_a,
        organization_id=org_a.id,
        checklist_template_id=template.id,
        checklist_version_id=published.id,
        batch_reference="BATCH-A",
    )
    create_batch_checklist_task(
        actor=manager_a,
        organization_id=org_a.id,
        checklist_template_id=other_t.id,
        checklist_version_id=other_p.id,
        batch_reference="BATCH-A",
    )

    with pytest.raises(PermissionDenied):
        create_batch_checklist_task(
            actor=viewer,
            organization_id=org_a.id,
            checklist_template_id=template.id,
            checklist_version_id=published.id,
            batch_reference="BATCH-VIEW",
        )
    with pytest.raises(PermissionDenied):
        create_batch_checklist_task(
            actor=manager_b,
            organization_id=org_a.id,
            checklist_template_id=template.id,
            checklist_version_id=published.id,
            batch_reference="BATCH-CROSS",
        )

    assert list_checklist_tasks(viewer).count() == 2
    assert list_pending_checklist_tasks(viewer).count() == 2
    assert list_checklist_tasks(manager_b).count() == 0
    assert get_checklist_task(viewer, task.id) is not None
    with pytest.raises(PermissionDenied):
        get_checklist_task(manager_b, task.id)

    cancelled = cancel_checklist_task(actor=manager_a, task_id=task.id)
    assert cancelled.status == ChecklistTaskStatus.CANCELLED
    assert SecurityAuditEvent.objects.filter(event_type="CHECKLIST_TASK_CANCELLED").exists()
    again = cancel_checklist_task(actor=manager_a, task_id=task.id)
    assert again.status == ChecklistTaskStatus.CANCELLED
    with pytest.raises(PermissionDenied):
        cancel_checklist_task(actor=manager_b, task_id=task.id)
    assert ChecklistTask.objects.filter(pk=task.id).exists()


@pytest.mark.django_db
def test_task_ui_create_detail_cancel_csrf(client: Client) -> None:
    org = make_org(code="ORG-TSK4")
    manager = _manager(org=org)
    viewer = _viewer(org=org)
    template, published = _make_published(actor=manager, org=org, code="CHK-UI")
    draft = create_checklist_version(actor=manager, template_id=template.id)

    client.force_login(viewer)
    assert client.get(reverse("scheduling:task_list")).status_code == 200
    body = client.get(reverse("scheduling:task_list")).content.decode()
    assert "No checklist tasks match these filters." in body
    assert client.get(reverse("scheduling:task_create")).status_code == 403

    client.force_login(manager)
    create_get = client.get(
        reverse("scheduling:task_create"),
        {"organization": str(org.id), "checklist_template": str(template.id)},
    )
    assert create_get.status_code == 200
    html = create_get.content.decode()
    assert str(published.id) in html
    assert str(draft.id) not in html
    assert "Published" in html

    resp = client.post(
        reverse("scheduling:task_create"),
        {
            "organization": str(org.id),
            "checklist_template": str(template.id),
            "checklist_version": str(published.id),
            "batch_reference": "UI-BATCH-1",
        },
    )
    assert resp.status_code == 302
    task = ChecklistTask.objects.get(batch_reference="UI-BATCH-1")
    detail = client.get(reverse("scheduling:task_detail", args=[task.id]))
    assert detail.status_code == 200
    assert "UI-BATCH-1" in detail.content.decode()
    assert "Version" in detail.content.decode()

    assert client.get(reverse("scheduling:task_cancel", args=[task.id])).status_code == 405
    csrf_client = Client(enforce_csrf_checks=True)
    csrf_client.force_login(manager)
    assert csrf_client.post(reverse("scheduling:task_cancel", args=[task.id])).status_code == 403
    assert client.post(reverse("scheduling:task_cancel", args=[task.id])).status_code == 302
    task.refresh_from_db()
    assert task.status == ChecklistTaskStatus.CANCELLED

    # forged draft version rejected
    bad = client.post(
        reverse("scheduling:task_create"),
        {
            "organization": str(org.id),
            "checklist_template": str(template.id),
            "checklist_version": str(draft.id),
            "batch_reference": "UI-BATCH-DRAFT",
        },
    )
    assert bad.status_code == 200
    assert ChecklistTask.objects.filter(batch_reference="UI-BATCH-DRAFT").count() == 0


@pytest.mark.django_db
def test_admin_registered_no_delete(client: Client) -> None:
    org = make_org(code="ORG-TSK5")
    manager = _manager(org=org)
    manager.is_superuser = True
    manager.save(update_fields=["is_superuser"])
    template, published = _make_published(actor=manager, org=org, code="CHK-ADM")
    task = create_batch_checklist_task(
        actor=manager,
        organization_id=org.id,
        checklist_template_id=template.id,
        checklist_version_id=published.id,
        batch_reference="ADM-BATCH",
    )
    client.force_login(manager)
    changelist = client.get(reverse("admin:scheduling_checklisttask_changelist"))
    assert changelist.status_code == 200
    assert b"ADM-BATCH" in changelist.content
    delete = client.get(reverse("admin:scheduling_checklisttask_delete", args=[task.id]))
    assert delete.status_code == 403


class ChecklistTaskRaceTests(TransactionTestCase):
    def test_concurrent_create_dedupes(self) -> None:
        org = make_org(code="ORG-TSK6")
        manager = _manager(org=org)
        template, published = _make_published(actor=manager, org=org, code="CHK-RACE")

        def _create() -> str:
            connection.close()
            with transaction.atomic():
                task = create_batch_checklist_task(
                    actor=manager,
                    organization_id=org.id,
                    checklist_template_id=template.id,
                    checklist_version_id=published.id,
                    batch_reference="RACE-BATCH",
                )
            return str(task.id)

        with ThreadPoolExecutor(max_workers=2) as pool:
            ids = list(pool.map(lambda _: _create(), range(2)))
        assert len(set(ids)) == 1
        assert ChecklistTask.objects.filter(batch_reference="RACE-BATCH").count() == 1
