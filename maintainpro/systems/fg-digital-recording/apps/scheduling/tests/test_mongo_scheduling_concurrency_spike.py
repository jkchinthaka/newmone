"""Concurrency tests for schedule generation uniqueness and cancel CAS."""

from __future__ import annotations

import datetime as dt
import uuid
from concurrent.futures import ThreadPoolExecutor, as_completed
from typing import Any
from zoneinfo import ZoneInfo

import pytest
from django.contrib.auth.models import Permission
from django.contrib.contenttypes.models import ContentType
from django.db import connection
from tests.factories import (
    grant_role,
    make_org,
    make_role_with_permission,
    make_shift,
    make_user,
)

from apps.accounts.models import User
from apps.checklists.models import ChecklistTemplate
from apps.checklists.services import (
    add_checklist_item,
    add_checklist_section,
    create_checklist_template,
    create_checklist_version,
    publish_checklist_version,
)
from apps.core.db_namespace import restore_postgresql_table_names
from apps.organizations.models import Organization
from apps.scheduling.generation import create_checklist_schedule, generate_for_schedule
from apps.scheduling.models import (
    ChecklistMissedPolicy,
    ChecklistSchedule,
    ChecklistTask,
    ChecklistTaskStatus,
    ChecklistTriggerType,
)
from apps.scheduling.services import cancel_checklist_task

pytestmark = pytest.mark.django_db(transaction=True)
UTC = ZoneInfo("UTC")


@pytest.fixture(autouse=True)
def _ensure_pg_table_names() -> None:
    restore_postgresql_table_names()


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
    user = make_user(employee_code=f"SCH{suffix}", is_staff=True)
    role = make_role_with_permission(
        code=f"RSCH{suffix}",
        name=f"Sched {suffix}",
        permission=_perm(ChecklistSchedule, "manage_checklistschedule"),
    )
    role.permissions.add(_perm(ChecklistTask, "manage_checklisttask"))
    role.permissions.add(_perm(ChecklistTask, "view_checklisttask"))
    role.permissions.add(_perm(ChecklistTemplate, "manage_checklist"))
    role.permissions.add(_perm(ChecklistTemplate, "view_checklisttemplate"))
    grant_role(user, role, organization=org)
    return user


def _published(*, actor: User, org: Organization, code: str) -> Any:
    template = create_checklist_template(
        actor=actor, organization=org, code=code, name=f"Template {code}"
    )
    version = create_checklist_version(actor=actor, template_id=template.id)
    section = add_checklist_section(actor=actor, version_id=version.id, title="S")
    add_checklist_item(
        actor=actor,
        section_id=section.id,
        code="I1",
        label="Item",
        response_type="YES_NO",
        is_required=True,
    )
    published = publish_checklist_version(actor=actor, version_id=version.id)
    return template, published


def test_concurrent_generator_no_duplicate_tasks() -> None:
    org = make_org(code=f"SG{uuid.uuid4().hex[:6].upper()}")
    actor = _manager(org=org)
    template, version = _published(actor=actor, org=org, code="TGEN")
    shift = make_shift(org, code="DAYG")
    schedule = create_checklist_schedule(
        actor=actor,
        organization_id=org.id,
        code="SCH-GEN",
        name="Day start",
        checklist_template_id=template.id,
        checklist_version_id=version.id,
        trigger_type=ChecklistTriggerType.SHIFT_START,
        shift_id=shift.id,
        timezone_name="UTC",
        due_grace_minutes=60,
        missed_policy=ChecklistMissedPolicy.CREATE_OVERDUE,
    )
    as_of = dt.datetime(2026, 9, 1, 8, 0, tzinfo=UTC)

    def _run() -> int:
        connection.close()
        result = generate_for_schedule(schedule=schedule, as_of=as_of, actor=actor)
        return len(result.created) + len(result.existing)

    with ThreadPoolExecutor(max_workers=4) as pool:
        _ = [f.result() for f in as_completed([pool.submit(_run) for _ in range(4)])]

    keys = list(
        ChecklistTask.objects.filter(
            organization=org, checklist_template=template, schedule=schedule
        ).values_list("occurrence_key", flat=True)
    )
    assert keys, "expected catch-up generation to create at least one occurrence"
    assert len(keys) == len(set(keys)), f"duplicate occurrence_key values: {keys}"


def test_concurrent_cancel_idempotent() -> None:
    org = make_org(code=f"SC{uuid.uuid4().hex[:6].upper()}")
    actor = _manager(org=org)
    template, version = _published(actor=actor, org=org, code="TCAN")
    shift = make_shift(org, code="DAYC")
    schedule = create_checklist_schedule(
        actor=actor,
        organization_id=org.id,
        code="SCH-CAN",
        name="Cancel race",
        checklist_template_id=template.id,
        checklist_version_id=version.id,
        trigger_type=ChecklistTriggerType.SHIFT_START,
        shift_id=shift.id,
        timezone_name="UTC",
        due_grace_minutes=60,
        missed_policy=ChecklistMissedPolicy.CREATE_OVERDUE,
    )
    as_of = dt.datetime(2026, 9, 1, 8, 0, tzinfo=UTC)
    result = generate_for_schedule(schedule=schedule, as_of=as_of, actor=actor)
    task = (result.created or result.existing)[0]

    def _cancel() -> str:
        connection.close()
        cancelled = cancel_checklist_task(actor=actor, task_id=task.id)
        return cancelled.status

    with ThreadPoolExecutor(max_workers=4) as pool:
        results = [f.result() for f in as_completed([pool.submit(_cancel) for _ in range(4)])]

    assert set(results) == {ChecklistTaskStatus.CANCELLED}
    task.refresh_from_db()
    assert task.status == ChecklistTaskStatus.CANCELLED
