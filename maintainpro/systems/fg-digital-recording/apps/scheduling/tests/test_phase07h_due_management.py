"""Phase 07H — checklist due / overdue foundation tests."""

from __future__ import annotations

import datetime as dt
import time
import uuid
from pathlib import Path
from typing import Any
from zoneinfo import ZoneInfo

import pytest
from django.contrib.auth.models import Permission
from django.contrib.contenttypes.models import ContentType
from django.test import Client
from django.urls import reverse
from django.utils import timezone
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
from apps.organizations.models import Organization, Shift
from apps.scheduling.due import (
    ChecklistDueDisplayState,
    derive_due_display_state,
    overdue_does_not_create_ncr,
    resolve_due_window,
    set_checklist_task_due_window,
)
from apps.scheduling.generation import shift_instance_window
from apps.scheduling.models import ChecklistTask, ChecklistTaskStatus
from apps.scheduling.selectors import list_checklist_tasks, list_overdue_checklist_tasks
from apps.scheduling.services import cancel_checklist_task, create_batch_checklist_task
from apps.security_audit.models import SecurityAuditEvent

UTC = ZoneInfo("UTC")
COLOMBO = ZoneInfo("Asia/Colombo")


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
    user = make_user(employee_code=f"E07H{suffix}", is_staff=True)
    role = make_role_with_permission(
        code=f"R07H{suffix}",
        name=f"07H manager {suffix}",
        permission=_perm(ChecklistTask, "manage_checklisttask"),
    )
    role.permissions.add(_perm(ChecklistTask, "view_checklisttask"))
    role.permissions.add(_perm(ChecklistTemplate, "manage_checklist"))
    role.permissions.add(_perm(ChecklistTemplate, "view_checklisttemplate"))
    grant_role(user, role, organization=org)
    return user


def _published(*, actor: User, org: Organization) -> tuple[Any, Any]:
    suffix = uuid.uuid4().hex[:4].upper()
    template = create_checklist_template(
        actor=actor, organization=org, code=f"CHK07H{suffix}", name=f"CHK07H{suffix}"
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
    return template, published


def _task(
    *, actor: User, org: Organization, batch: str, template: Any = None, version: Any = None
) -> ChecklistTask:
    if template is None or version is None:
        template, version = _published(actor=actor, org=org)
    return create_batch_checklist_task(
        actor=actor,
        organization_id=org.id,
        checklist_template_id=template.id,
        checklist_version_id=version.id,
        batch_reference=batch,
    )


@pytest.mark.django_db
def test_exact_boundaries_and_configured_due_soon() -> None:
    org = make_org(code="ORG07H1")
    actor = _manager(org=org)
    task = _task(actor=actor, org=org, batch="BATCH-07H-1")
    due_from = dt.datetime(2026, 8, 10, 10, 0, tzinfo=UTC)
    due_at = dt.datetime(2026, 8, 10, 12, 0, tzinfo=UTC)
    set_checklist_task_due_window(actor=actor, task_id=task.id, due_from=due_from, due_at=due_at)
    task.refresh_from_db()

    assert (
        derive_due_display_state(task, as_of=due_from - dt.timedelta(microseconds=1))
        == ChecklistDueDisplayState.NOT_DUE
    )
    assert derive_due_display_state(task, as_of=due_from) == ChecklistDueDisplayState.DUE
    # No invented DUE_SOON without configured due_soon_minutes.
    assert (
        derive_due_display_state(task, as_of=due_at - dt.timedelta(minutes=5))
        == ChecklistDueDisplayState.DUE
    )
    # Exact deadline remains DUE; OVERDUE is strictly after overdue_at.
    assert derive_due_display_state(task, as_of=due_at) == ChecklistDueDisplayState.DUE
    assert (
        derive_due_display_state(task, as_of=due_at + dt.timedelta(microseconds=1))
        == ChecklistDueDisplayState.OVERDUE
    )

    set_checklist_task_due_window(actor=actor, task_id=task.id, due_soon_minutes=30)
    task.refresh_from_db()
    assert (
        derive_due_display_state(task, as_of=due_at - dt.timedelta(minutes=30))
        == ChecklistDueDisplayState.DUE_SOON
    )
    assert (
        derive_due_display_state(task, as_of=due_at - dt.timedelta(minutes=31))
        == ChecklistDueDisplayState.DUE
    )
    assert overdue_does_not_create_ncr() is True


@pytest.mark.django_db
def test_timezone_colombo_boundaries() -> None:
    org = make_org(code="ORG07H2")
    actor = _manager(org=org)
    task = _task(actor=actor, org=org, batch="BATCH-07H-2")
    due_at_local = dt.datetime(2026, 8, 10, 18, 0, tzinfo=COLOMBO)
    due_from_local = dt.datetime(2026, 8, 10, 16, 0, tzinfo=COLOMBO)
    set_checklist_task_due_window(
        actor=actor, task_id=task.id, due_from=due_from_local, due_at=due_at_local
    )
    task.refresh_from_db()

    as_of_exact_utc = dt.datetime(2026, 8, 10, 12, 30, tzinfo=UTC)  # == 18:00 Colombo
    assert derive_due_display_state(task, as_of=as_of_exact_utc) == ChecklistDueDisplayState.DUE
    assert (
        derive_due_display_state(task, as_of=as_of_exact_utc + dt.timedelta(seconds=1))
        == ChecklistDueDisplayState.OVERDUE
    )
    assert (
        derive_due_display_state(task, as_of=dt.datetime(2026, 8, 10, 12, 29, 59, tzinfo=UTC))
        == ChecklistDueDisplayState.DUE
    )


@pytest.mark.django_db
def test_overnight_shift_due_window() -> None:
    org = make_org(code="ORG07H3")
    actor = _manager(org=org)
    night = Shift.objects.create(
        organization=org,
        code="N07H",
        name="Night",
        start_time=dt.time(22, 0),
        end_time=dt.time(6, 0),
        effective_from=dt.date(2026, 1, 1),
        is_active=True,
    )
    assert night.is_overnight
    as_of = dt.datetime(2026, 8, 10, 23, 0, tzinfo=COLOMBO)
    start_dt, end_dt, op_date = shift_instance_window(night, as_of=as_of, tz=COLOMBO)
    assert start_dt.date() == op_date
    assert end_dt > start_dt
    assert end_dt.hour == 6

    task = _task(actor=actor, org=org, batch="BATCH-07H-3")
    set_checklist_task_due_window(actor=actor, task_id=task.id, due_from=start_dt, due_at=end_dt)
    task.refresh_from_db()
    assert task.due_to == task.due_at
    assert derive_due_display_state(task, as_of=as_of) == ChecklistDueDisplayState.DUE
    assert (
        derive_due_display_state(task, as_of=start_dt - dt.timedelta(minutes=1))
        == ChecklistDueDisplayState.NOT_DUE
    )
    assert (
        derive_due_display_state(task, as_of=end_dt + dt.timedelta(seconds=1))
        == ChecklistDueDisplayState.OVERDUE
    )


@pytest.mark.django_db
def test_cancelled_and_missed_excluded() -> None:
    org = make_org(code="ORG07H4")
    actor = _manager(org=org)
    task = _task(actor=actor, org=org, batch="BATCH-07H-4")
    past = timezone.now() - dt.timedelta(hours=3)
    set_checklist_task_due_window(
        actor=actor, task_id=task.id, due_from=past - dt.timedelta(hours=1), due_at=past
    )
    assert list_overdue_checklist_tasks(actor).filter(pk=task.id).exists()

    cancel_checklist_task(actor=actor, task_id=task.id)
    assert derive_due_display_state(ChecklistTask.objects.get(pk=task.id)) is None
    assert not list_overdue_checklist_tasks(actor).filter(pk=task.id).exists()

    missed = _task(actor=actor, org=org, batch="BATCH-07H-4M")
    set_checklist_task_due_window(
        actor=actor, task_id=missed.id, due_from=past - dt.timedelta(hours=1), due_at=past
    )
    ChecklistTask.objects.filter(pk=missed.id).update(status=ChecklistTaskStatus.MISSED)
    assert derive_due_display_state(ChecklistTask.objects.get(pk=missed.id)) is None
    assert not list_overdue_checklist_tasks(actor).filter(pk=missed.id).exists()


@pytest.mark.django_db
def test_due_filters_queue_ui_and_audit() -> None:
    org = make_org(code="ORG07H5")
    actor = _manager(org=org)
    past = _task(actor=actor, org=org, batch="BATCH-PAST")
    future = _task(actor=actor, org=org, batch="BATCH-FUT")
    clock = dt.datetime(2026, 8, 10, 12, 0, tzinfo=UTC)
    set_checklist_task_due_window(
        actor=actor, task_id=past.id, due_at=clock - dt.timedelta(hours=1)
    )
    set_checklist_task_due_window(
        actor=actor,
        task_id=future.id,
        due_from=clock - dt.timedelta(hours=1),
        due_at=clock + dt.timedelta(hours=1),
        due_soon_minutes=20,
    )

    overdue = list(list_overdue_checklist_tasks(actor, as_of=clock))
    assert {t.batch_reference for t in overdue} == {"BATCH-PAST"}
    assert list_checklist_tasks(actor, due_state="DUE", as_of=clock).filter(pk=future.id).exists()
    assert (
        list_checklist_tasks(actor, due_state="DUE_SOON", as_of=clock + dt.timedelta(minutes=50))
        .filter(pk=future.id)
        .exists()
    )

    event = (
        SecurityAuditEvent.objects.filter(event_type="CHECKLIST_TASK_DUE_WINDOW_UPDATED")
        .order_by("-created_at")
        .first()
    )
    assert event is not None
    assert event.metadata.get("overdue_is_not_ncr") is True
    assert event.metadata.get("no_invented_sla") is True

    # UI uses timezone.now() — align deadlines to wall clock for the HTTP assertion.
    wall = timezone.now()
    set_checklist_task_due_window(
        actor=actor,
        task_id=past.id,
        clear_due_from=True,
        due_at=wall - dt.timedelta(hours=1),
        clear_due_soon_minutes=True,
    )
    set_checklist_task_due_window(
        actor=actor,
        task_id=future.id,
        clear_due_from=True,
        due_at=wall + dt.timedelta(hours=1),
        clear_due_soon_minutes=True,
    )
    assert (
        derive_due_display_state(ChecklistTask.objects.get(pk=past.id), as_of=wall)
        == ChecklistDueDisplayState.OVERDUE
    )
    client = Client()
    client.force_login(actor)
    resp = client.get(reverse("scheduling:task_list"), {"due": "OVERDUE"})
    assert resp.status_code == 200
    assert b"BATCH-PAST" in resp.content
    assert b"BATCH-FUT" not in resp.content

    due_src = Path("apps/scheduling/due.py").read_text(encoding="utf-8")
    for banned in (
        "30 minutes",
        "2 hours",
        "1 shift",
        "timedelta(minutes=30)",
        "timedelta(hours=2)",
    ):
        assert banned not in due_src


@pytest.mark.django_db
def test_resolve_due_window_aliases_and_fallback() -> None:
    org = make_org(code="ORG07H6")
    actor = _manager(org=org)
    task = _task(actor=actor, org=org, batch="BATCH-07H-6")
    due_from = dt.datetime(2026, 8, 10, 8, 0, tzinfo=UTC)
    due_at = dt.datetime(2026, 8, 10, 9, 0, tzinfo=UTC)
    set_checklist_task_due_window(
        actor=actor, task_id=task.id, due_from=due_from, due_at=due_at, due_soon_minutes=15
    )
    task.refresh_from_db()
    window = resolve_due_window(task)
    assert window.due_from == due_from
    assert window.due_to == due_at
    assert window.due_at == due_at
    assert window.due_soon_minutes == 15
    assert task.due_to == task.due_at

    task.due_from = None
    task.due_at = None
    task.window_start_at = due_from
    task.window_end_at = due_at
    task.save(
        update_fields=["due_from", "due_at", "window_start_at", "window_end_at", "updated_at"]
    )
    window = resolve_due_window(task)
    assert window.due_from == due_from
    assert window.due_at == due_at


@pytest.mark.django_db
def test_overdue_queue_performance() -> None:
    org = make_org(code="ORG07H7")
    actor = _manager(org=org)
    template, version = _published(actor=actor, org=org)
    now = timezone.now()
    for i in range(40):
        t = _task(
            actor=actor,
            org=org,
            batch=f"BATCH-PERF-{i:03d}",
            template=template,
            version=version,
        )
        set_checklist_task_due_window(
            actor=actor,
            task_id=t.id,
            due_from=now - dt.timedelta(hours=2),
            due_at=now - dt.timedelta(minutes=i + 1),
        )
    start = time.perf_counter()
    count = list_overdue_checklist_tasks(actor, as_of=now).count()
    elapsed = time.perf_counter() - start
    assert count == 40
    assert elapsed < 5.0
