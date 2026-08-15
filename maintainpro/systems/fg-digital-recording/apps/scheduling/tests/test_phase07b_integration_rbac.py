"""Phase 07B — batch integration port + recording permission foundation tests."""

from __future__ import annotations

import uuid
from typing import Any

import pytest
from django.contrib.auth.models import Permission
from django.contrib.contenttypes.models import ContentType
from django.core.exceptions import PermissionDenied, ValidationError
from tests.factories import grant_role, make_org, make_role_with_permission, make_user

from apps.accounts.models import User
from apps.checklists.services import (
    add_checklist_item,
    add_checklist_section,
    create_checklist_template,
    create_checklist_version,
    publish_checklist_version,
)
from apps.organizations.models import Organization
from apps.scheduling.integration import (
    BatchChecklistTaskRequest,
    accept_batch_checklist_task_request,
)
from apps.scheduling.models import ChecklistTask, ChecklistTaskStatus
from apps.scheduling.selectors import (
    actor_can_manage_checklist_tasks,
    actor_can_record_checklist_tasks,
    actor_can_record_task,
    task_is_eligible_for_recording,
)
from apps.scheduling.services import (
    MANAGE_CHECKLIST_TASK,
    RECORD_CHECKLIST_TASK,
    create_batch_checklist_task,
)


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
    user = make_user(employee_code=f"INT{suffix}", is_staff=True)
    role = make_role_with_permission(
        code=f"INTM{suffix}",
        name=f"Integration Manager {suffix}",
        permission=_perm("manage_checklisttask"),
    )
    role.permissions.add(_perm("view_checklisttask"))
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


def _make_published(*, actor: User, org: Organization, code: str = "CHK-INT") -> tuple[Any, Any]:
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
    return template, published


@pytest.mark.django_db
def test_record_permission_exists_and_is_separate_from_manage() -> None:
    org = make_org(code="ORG-INT1")
    manager = _manager(org=org)
    assert RECORD_CHECKLIST_TASK == "scheduling.record_checklisttask"
    assert MANAGE_CHECKLIST_TASK == "scheduling.manage_checklisttask"
    assert actor_can_manage_checklist_tasks(manager) is True
    assert actor_can_record_checklist_tasks(manager) is False

    record_perm = _perm("record_checklisttask")
    assert record_perm.codename == "record_checklisttask"
    # Manage role must not implicitly include record.
    from apps.access_control.models import ScopedRoleAssignment

    role_ids = ScopedRoleAssignment.objects.filter(user=manager, organization=org).values_list(
        "role_id", flat=True
    )
    assigned_codenames = set(
        Permission.objects.filter(access_roles__in=role_ids).values_list("codename", flat=True)
    )
    assert "manage_checklisttask" in assigned_codenames
    assert "record_checklisttask" not in assigned_codenames


@pytest.mark.django_db
def test_integration_port_delegates_idempotent_and_rejects_conflicts() -> None:
    org = make_org(code="ORG-INT2")
    org_b = make_org(code="ORG-INT2B")
    manager = _manager(org=org)
    template, published = _make_published(actor=manager, org=org, code="CHK-PORT")
    draft = create_checklist_version(actor=manager, template_id=template.id)

    request = BatchChecklistTaskRequest(
        organization_id=org.id,
        batch_reference="  EXT-BATCH-1  ",
        checklist_template_id=template.id,
        checklist_version_id=published.id,
    )
    task = accept_batch_checklist_task_request(actor=manager, request=request)
    assert task.batch_reference == "EXT-BATCH-1"
    assert task.status == ChecklistTaskStatus.PENDING
    assert task_is_eligible_for_recording(task) is True
    assert actor_can_record_task(manager, task) is False

    again = accept_batch_checklist_task_request(actor=manager, request=request)
    assert again.id == task.id
    assert ChecklistTask.objects.filter(organization=org).count() == 1

    with pytest.raises(ValidationError):
        accept_batch_checklist_task_request(
            actor=manager,
            request=BatchChecklistTaskRequest(
                organization_id=org.id,
                batch_reference="EXT-BATCH-1",
                checklist_template_id=template.id,
                checklist_version_id=draft.id,
            ),
        )

    with pytest.raises(ValidationError):
        accept_batch_checklist_task_request(
            actor=manager,
            request=BatchChecklistTaskRequest(
                organization_id=org.id,
                batch_reference="   ",
                checklist_template_id=template.id,
                checklist_version_id=published.id,
            ),
        )

    # Cross-org without manage permission → denied (not a mapping invention).
    with pytest.raises(PermissionDenied):
        accept_batch_checklist_task_request(
            actor=manager,
            request=BatchChecklistTaskRequest(
                organization_id=org_b.id,
                batch_reference="EXT-CROSS",
                checklist_template_id=template.id,
                checklist_version_id=published.id,
            ),
        )

    # With manage on org_b, template/org mismatch still rejected as ValidationError.
    role_b = make_role_with_permission(
        code=f"INTB{uuid.uuid4().hex[:6].upper()}",
        name="Manager B",
        permission=_perm("manage_checklisttask"),
    )
    role_b.permissions.add(_perm("view_checklisttask"))
    grant_role(manager, role_b, organization=org_b)
    with pytest.raises(ValidationError):
        accept_batch_checklist_task_request(
            actor=manager,
            request=BatchChecklistTaskRequest(
                organization_id=org_b.id,
                batch_reference="EXT-CROSS",
                checklist_template_id=template.id,
                checklist_version_id=published.id,
            ),
        )


@pytest.mark.django_db
def test_integration_port_requires_auth_and_preserves_published_only() -> None:
    org = make_org(code="ORG-INT3")
    manager = _manager(org=org)
    viewer = make_user(employee_code=f"INTV{uuid.uuid4().hex[:6].upper()}")
    role = make_role_with_permission(
        code=f"INTV{uuid.uuid4().hex[:6].upper()}",
        name="Viewer",
        permission=_perm("view_checklisttask"),
    )
    grant_role(viewer, role, organization=org)
    template, published = _make_published(actor=manager, org=org, code="CHK-AUTH")
    draft = create_checklist_version(actor=manager, template_id=template.id)

    with pytest.raises(PermissionDenied):
        accept_batch_checklist_task_request(
            actor=viewer,
            request=BatchChecklistTaskRequest(
                organization_id=org.id,
                batch_reference="EXT-VIEW",
                checklist_template_id=template.id,
                checklist_version_id=published.id,
            ),
        )

    with pytest.raises(ValidationError):
        create_batch_checklist_task(
            actor=manager,
            organization_id=org.id,
            checklist_template_id=template.id,
            checklist_version_id=draft.id,
            batch_reference="DRAFT-BLOCK",
        )

    # FG-QA-001 style: unpublished definition cannot create tasks via port.
    assert not ChecklistTask.objects.filter(batch_reference="DRAFT-BLOCK").exists()


@pytest.mark.django_db
def test_cancelled_task_not_eligible_for_recording() -> None:
    org = make_org(code="ORG-INT4")
    manager = _manager(org=org)
    template, published = _make_published(actor=manager, org=org, code="CHK-ELIG")
    task = create_batch_checklist_task(
        actor=manager,
        organization_id=org.id,
        checklist_template_id=template.id,
        checklist_version_id=published.id,
        batch_reference="ELIG-1",
    )
    assert task_is_eligible_for_recording(task) is True
    from apps.scheduling.services import cancel_checklist_task

    cancelled = cancel_checklist_task(actor=manager, task_id=task.id)
    assert task_is_eligible_for_recording(cancelled) is False
