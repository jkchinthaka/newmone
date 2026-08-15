"""Phase 07G — checklist task assignment workflow tests."""

from __future__ import annotations

import threading
import uuid
from typing import Any

import pytest
from django.contrib.auth.models import Permission
from django.contrib.contenttypes.models import ContentType
from django.core.exceptions import PermissionDenied, ValidationError
from django.db import connection
from django.test import TransactionTestCase
from tests.factories import grant_role, make_org, make_role_with_permission, make_user

from apps.accounts.models import User
from apps.checklists.models import ChecklistTemplate
from apps.checklists.services import (
    add_checklist_item,
    add_checklist_section,
    create_checklist_template,
    create_checklist_version,
    publish_checklist_version,
)
from apps.organizations.models import Organization
from apps.scheduling.assignment import (
    assign_checklist_task,
    assignment_does_not_grant_permission,
    list_assignment_history,
    unassign_checklist_task,
)
from apps.scheduling.models import (
    ChecklistTask,
    ChecklistTaskAssignmentAction,
    ChecklistTaskAssignmentEvent,
)
from apps.scheduling.selectors import (
    list_assigned_checklist_tasks,
    list_my_checklist_tasks,
    list_unassigned_checklist_tasks,
)
from apps.scheduling.services import (
    ASSIGN_CHECKLIST_TASK,
    RECORD_CHECKLIST_TASK,
    create_batch_checklist_task,
)
from apps.security_audit.models import SecurityAuditEvent


def _perm(model: type[Any], codename: str) -> Permission:
    ct = ContentType.objects.get_for_model(model)
    permission, _ = Permission.objects.get_or_create(
        content_type=ct,
        codename=codename,
        defaults={"name": f"Can {codename.replace('_', ' ')}"},
    )
    return permission


def _manager(*, org: Organization) -> User:
    suffix = uuid.uuid4().hex[:6].upper()
    user = make_user(employee_code=f"E07G{suffix}", is_staff=True)
    role = make_role_with_permission(
        code=f"R07G{suffix}",
        name=f"07G manager {suffix}",
        permission=_perm(ChecklistTask, "manage_checklisttask"),
    )
    role.permissions.add(_perm(ChecklistTask, "view_checklisttask"))
    role.permissions.add(_perm(ChecklistTask, "assign_checklisttask"))
    role.permissions.add(_perm(ChecklistTemplate, "manage_checklist"))
    role.permissions.add(_perm(ChecklistTemplate, "view_checklisttemplate"))
    grant_role(user, role, organization=org)
    return user


def _viewer(*, org: Organization) -> User:
    suffix = uuid.uuid4().hex[:6].upper()
    user = make_user(employee_code=f"V07G{suffix}")
    role = make_role_with_permission(
        code=f"RV07G{suffix}",
        name=f"07G viewer {suffix}",
        permission=_perm(ChecklistTask, "view_checklisttask"),
    )
    grant_role(user, role, organization=org)
    return user


def _published_task(*, actor: User, org: Organization, batch: str) -> ChecklistTask:
    suffix = uuid.uuid4().hex[:4].upper()
    template = create_checklist_template(
        actor=actor, organization=org, code=f"CHK07G{suffix}", name=f"CHK07G{suffix}"
    )
    version = create_checklist_version(actor=actor, template_id=template.id)
    section = add_checklist_section(actor=actor, version_id=version.id, title="S")
    add_checklist_item(
        actor=actor,
        section_id=section.id,
        code="I1",
        label="Item",
        response_type="YES_NO",
    )
    published = publish_checklist_version(actor=actor, version_id=version.id)
    return create_batch_checklist_task(
        actor=actor,
        organization_id=org.id,
        checklist_template_id=template.id,
        checklist_version_id=published.id,
        batch_reference=batch,
    )


@pytest.mark.django_db
def test_assign_reassign_unassign_preserves_history() -> None:
    org = make_org(code="ORG07G1")
    actor = _manager(org=org)
    assignee_a = make_user(employee_code="A07G1")
    assignee_b = make_user(employee_code="B07G1")
    task = _published_task(actor=actor, org=org, batch="BATCH-07G-1")

    assigned = assign_checklist_task(
        actor=actor,
        task_id=task.id,
        assignee_kind="USER",
        assigned_user_id=assignee_a.id,
        reason="initial",
    )
    assert assigned.assignee_kind == "USER"
    assert assigned.assigned_user_id == assignee_a.id
    assert assigned.assigned_by_id == actor.id
    assert assigned.assigned_at is not None

    reassigned = assign_checklist_task(
        actor=actor,
        task_id=task.id,
        assignee_kind="USER",
        assigned_user_id=assignee_b.id,
        reason="handoff",
    )
    assert reassigned.assigned_user_id == assignee_b.id

    unassigned = unassign_checklist_task(actor=actor, task_id=task.id, reason="done")
    assert unassigned.assignee_kind == ""
    assert unassigned.assigned_user_id is None

    history = list_assignment_history(actor=actor, task_id=task.id)
    assert [h.action for h in history] == [
        ChecklistTaskAssignmentAction.ASSIGN,
        ChecklistTaskAssignmentAction.REASSIGN,
        ChecklistTaskAssignmentAction.UNASSIGN,
    ]
    assert history[0].assigned_user_id == assignee_a.id
    assert history[1].assigned_user_id == assignee_b.id
    assert history[1].previous_assigned_user_id == assignee_a.id
    assert history[2].assignee_kind == ""
    assert history[2].previous_assigned_user_id == assignee_b.id

    # History rows are immutable.
    with pytest.raises(ValidationError):
        history[0].reason = "tamper"
        history[0].save()  # type: ignore[no-untyped-call]
    with pytest.raises(ValidationError):
        history[0].delete()  # type: ignore[no-untyped-call]

    assert SecurityAuditEvent.objects.filter(event_type="CHECKLIST_TASK_ASSIGNED").exists()
    assert SecurityAuditEvent.objects.filter(event_type="CHECKLIST_TASK_REASSIGNED").exists()
    assert SecurityAuditEvent.objects.filter(event_type="CHECKLIST_TASK_UNASSIGNED").exists()


@pytest.mark.django_db
def test_unauthorized_assignment_denied() -> None:
    org = make_org(code="ORG07G2")
    manager = _manager(org=org)
    viewer = _viewer(org=org)
    assignee = make_user(employee_code="A07G2")
    task = _published_task(actor=manager, org=org, batch="BATCH-07G-2")

    with pytest.raises(PermissionDenied):
        assign_checklist_task(
            actor=viewer,
            task_id=task.id,
            assignee_kind="USER",
            assigned_user_id=assignee.id,
        )
    task.refresh_from_db()
    assert task.assignee_kind == ""
    assert ChecklistTaskAssignmentEvent.objects.filter(checklist_task=task).count() == 0


@pytest.mark.django_db
def test_assignment_does_not_grant_permission() -> None:
    org = make_org(code="ORG07G3")
    manager = _manager(org=org)
    assignee = make_user(employee_code="A07G3")
    task = _published_task(actor=manager, org=org, batch="BATCH-07G-3")

    assign_checklist_task(
        actor=manager,
        task_id=task.id,
        assignee_kind="USER",
        assigned_user_id=assignee.id,
    )
    task.refresh_from_db()
    assert assignment_does_not_grant_permission(
        assignee=assignee, permission=ASSIGN_CHECKLIST_TASK, task=task
    )
    assert assignment_does_not_grant_permission(
        assignee=assignee, permission=RECORD_CHECKLIST_TASK, task=task
    )
    # Without VIEW, assignee cannot see My Tasks / history for the org.
    assert list_my_checklist_tasks(assignee).count() == 0
    with pytest.raises(PermissionDenied):
        list_assignment_history(actor=assignee, task_id=task.id)


@pytest.mark.django_db
def test_queues_my_unassigned_assigned_scoped() -> None:
    org = make_org(code="ORG07G4")
    manager = _manager(org=org)
    viewer = _viewer(org=org)
    other = make_user(employee_code="O07G4")
    task_a = _published_task(actor=manager, org=org, batch="BATCH-07G-4A")
    task_b = _published_task(actor=manager, org=org, batch="BATCH-07G-4B")

    assign_checklist_task(
        actor=manager,
        task_id=task_a.id,
        assignee_kind="USER",
        assigned_user_id=viewer.id,
    )

    assert list_unassigned_checklist_tasks(viewer).filter(pk=task_b.id).exists()
    assert not list_unassigned_checklist_tasks(viewer).filter(pk=task_a.id).exists()
    assert list_my_checklist_tasks(viewer).filter(pk=task_a.id).exists()
    assert not list_my_checklist_tasks(viewer).filter(pk=task_b.id).exists()
    assert list_assigned_checklist_tasks(viewer).filter(pk=task_a.id).exists()
    # other has no VIEW scope → empty queues
    assert list_my_checklist_tasks(other).count() == 0
    assert list_unassigned_checklist_tasks(other).count() == 0


@pytest.mark.django_db
def test_cross_org_assignment_denied() -> None:
    org_a = make_org(code="ORG07GA")
    org_b = make_org(code="ORG07GB")
    manager_a = _manager(org=org_a)
    manager_b = _manager(org=org_b)
    assignee = make_user(employee_code="X07G")
    task_a = _published_task(actor=manager_a, org=org_a, batch="BATCH-XA")

    with pytest.raises(PermissionDenied):
        assign_checklist_task(
            actor=manager_b,
            task_id=task_a.id,
            assignee_kind="USER",
            assigned_user_id=assignee.id,
        )
    task_a.refresh_from_db()
    assert task_a.assignee_kind == ""


@pytest.mark.django_db
def test_role_and_team_architecture_targets() -> None:
    org = make_org(code="ORG07G5")
    manager = _manager(org=org)
    task = _published_task(actor=manager, org=org, batch="BATCH-07G-5")
    role = make_role_with_permission(
        code=f"ROLE07G{uuid.uuid4().hex[:4]}",
        name="Role target",
        permission=_perm(ChecklistTask, "view_checklisttask"),
    )

    role_assigned = assign_checklist_task(
        actor=manager,
        task_id=task.id,
        assignee_kind="ROLE",
        assigned_role_id=role.id,
        reason="role pool",
    )
    assert role_assigned.assignee_kind == "ROLE"
    assert role_assigned.assigned_role_id == role.id
    # ROLE ownership does not appear in My Tasks for the manager unless USER-assigned.
    assert not list_my_checklist_tasks(manager).filter(pk=task.id).exists()
    assert list_assigned_checklist_tasks(manager).filter(pk=task.id).exists()

    team_assigned = assign_checklist_task(
        actor=manager,
        task_id=task.id,
        assignee_kind="TEAM",
        assigned_team_code="TEAM-OPAQUE-1",
        reason="opaque team",
    )
    assert team_assigned.assignee_kind == "TEAM"
    assert team_assigned.assigned_team_code == "TEAM-OPAQUE-1"


class ConcurrentReassignmentTests(TransactionTestCase):
    def test_concurrent_reassignment_preserves_history(self) -> None:
        org = make_org(code="ORG07GC")
        manager = _manager(org=org)
        u1 = make_user(employee_code="C07G1")
        u2 = make_user(employee_code="C07G2")
        task = _published_task(actor=manager, org=org, batch="BATCH-CONC")
        assign_checklist_task(
            actor=manager,
            task_id=task.id,
            assignee_kind="USER",
            assigned_user_id=u1.id,
            reason="seed",
        )

        errors: list[BaseException] = []

        def _run(user_id: uuid.UUID, reason: str) -> None:
            try:
                connection.close()
                assign_checklist_task(
                    actor=manager,
                    task_id=task.id,
                    assignee_kind="USER",
                    assigned_user_id=user_id,
                    reason=reason,
                )
            except BaseException as exc:  # noqa: BLE001
                errors.append(exc)

        t1 = threading.Thread(target=_run, args=(u1.id, "t1"))
        t2 = threading.Thread(target=_run, args=(u2.id, "t2"))
        t1.start()
        t2.start()
        t1.join(timeout=30)
        t2.join(timeout=30)

        assert not errors, errors
        history = list(
            ChecklistTaskAssignmentEvent.objects.filter(checklist_task_id=task.id).order_by(
                "assigned_at", "created_at", "id"
            )
        )
        # seed ASSIGN + two concurrent REASSIGN events (serialized by select_for_update)
        assert len(history) == 3
        assert history[0].action == ChecklistTaskAssignmentAction.ASSIGN
        assert {history[1].action, history[2].action} == {ChecklistTaskAssignmentAction.REASSIGN}
        task.refresh_from_db()
        assert task.assignee_kind == "USER"
        assert task.assigned_user_id in {u1.id, u2.id}
