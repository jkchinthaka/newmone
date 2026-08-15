"""Phase 07E — recurring checklist scheduling tests."""

from __future__ import annotations

import datetime as dt
import time
import uuid
from typing import Any
from zoneinfo import ZoneInfo

import pytest
from django.contrib.auth.models import Permission
from django.contrib.contenttypes.models import ContentType
from django.core.exceptions import PermissionDenied, ValidationError
from django.utils import timezone
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
from apps.organizations.models import Organization, Shift
from apps.scheduling.generation import (
    _tz,
    create_checklist_schedule,
    create_manual_schedule_occurrence,
    generate_for_schedule,
    manual_occurrence_key,
    run_active_schedule_generation,
    shift_instance_window,
)
from apps.scheduling.models import (
    ChecklistMissedPolicy,
    ChecklistSchedule,
    ChecklistTask,
    ChecklistTaskStatus,
    ChecklistTriggerType,
)
from apps.scheduling.services import create_batch_checklist_task
from apps.scheduling.tasks import generate_due_checklist_tasks
from apps.security_audit.models import SecurityAuditEvent

UTC = ZoneInfo("UTC")


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
    user = make_user(employee_code=f"E07E{suffix}", is_staff=True)
    role = make_role_with_permission(
        code=f"R07E{suffix}",
        name=f"07E manager {suffix}",
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


@pytest.mark.django_db
def test_duplicate_generation_and_retry_idempotent() -> None:
    org = make_org(code=f"O07E1{uuid.uuid4().hex[:4].upper()}")
    actor = _manager(org=org)
    template, version = _published(actor=actor, org=org, code="T1")
    shift = make_shift(org, code="DAY1")
    schedule = create_checklist_schedule(
        actor=actor,
        organization_id=org.id,
        code="SCH-DAY",
        name="Day start",
        checklist_template_id=template.id,
        checklist_version_id=version.id,
        trigger_type=ChecklistTriggerType.SHIFT_START,
        shift_id=shift.id,
        timezone_name="UTC",
        due_grace_minutes=60,
        missed_policy=ChecklistMissedPolicy.CREATE_OVERDUE,
    )
    as_of = dt.datetime(2026, 3, 10, 8, 0, tzinfo=UTC)  # after 06:00 start
    # Narrow lookback so only today's SHIFT_START is due (not prior-day catch-up).
    first = generate_for_schedule(
        schedule=schedule, as_of=as_of, lookback=dt.timedelta(hours=4), actor=actor
    )
    assert len(first.created) == 1
    second = generate_for_schedule(
        schedule=schedule, as_of=as_of, lookback=dt.timedelta(hours=4), actor=actor
    )
    assert len(second.created) == 0
    assert len(second.existing) == 1
    assert second.existing[0].id == first.created[0].id
    assert ChecklistTask.objects.filter(schedule=schedule).count() == 1

    # Celery retry / second beat tick
    payload = generate_due_checklist_tasks(
        as_of_iso=as_of.isoformat(),
        organization_id=str(org.id),
        lookback_minutes=240,
    )
    assert payload["existing_count"] >= 1
    assert payload["replay_safe"] is True
    assert ChecklistTask.objects.filter(schedule=schedule).count() == 1


@pytest.mark.django_db
def test_overnight_shift_and_timezone() -> None:
    org = make_org(code=f"O07E2{uuid.uuid4().hex[:4].upper()}")
    actor = _manager(org=org)
    template, version = _published(actor=actor, org=org, code="T2")
    night = Shift.objects.create(
        organization=org,
        code="NIGHT1",
        name="Night",
        start_time=dt.time(22, 0),
        end_time=dt.time(6, 0),
        effective_from=dt.date(2026, 1, 1),
        is_active=True,
    )
    assert night.is_overnight is True
    schedule = create_checklist_schedule(
        actor=actor,
        organization_id=org.id,
        code="SCH-NIGHT",
        name="Night end",
        checklist_template_id=template.id,
        checklist_version_id=version.id,
        trigger_type=ChecklistTriggerType.SHIFT_END,
        shift_id=night.id,
        timezone_name="UTC",
        missed_policy=ChecklistMissedPolicy.CREATE_OVERDUE,
    )
    # 2026-03-11 05:00 is still within overnight instance that started 03-10 22:00
    as_of = dt.datetime(2026, 3, 11, 6, 30, tzinfo=UTC)  # after end
    start_dt, end_dt, op_date = shift_instance_window(night, as_of=as_of, tz=UTC)
    assert op_date == dt.date(2026, 3, 10)
    assert end_dt.hour == 6
    result = generate_for_schedule(
        schedule=schedule,
        as_of=as_of,
        lookback=dt.timedelta(hours=12),
        actor=actor,
    )
    assert len(result.created) == 1
    task = result.created[0]
    assert task.trigger_type == ChecklistTriggerType.SHIFT_END
    assert "shift_end:" in task.occurrence_key
    assert str(night.id) in task.occurrence_key


@pytest.mark.django_db
def test_missed_scheduler_run_catchup_and_missed_policy() -> None:
    org = make_org(code=f"O07E3{uuid.uuid4().hex[:4].upper()}")
    actor = _manager(org=org)
    template, version = _published(actor=actor, org=org, code="T3")
    schedule = create_checklist_schedule(
        actor=actor,
        organization_id=org.id,
        code="SCH-WIN",
        name="Window",
        checklist_template_id=template.id,
        checklist_version_id=version.id,
        trigger_type=ChecklistTriggerType.SCHEDULED,
        timezone_name="UTC",
        window_start_time=dt.time(9, 0),
        window_end_time=dt.time(10, 0),
        due_grace_minutes=0,
        missed_policy=ChecklistMissedPolicy.MARK_MISSED,
    )
    # Simulate Beat running late after window ended.
    late = dt.datetime(2026, 4, 1, 12, 0, tzinfo=UTC)
    result = generate_for_schedule(
        schedule=schedule,
        as_of=late,
        lookback=dt.timedelta(days=2),
        actor=actor,
    )
    assert len(result.created) >= 1
    assert any(t.status == ChecklistTaskStatus.MISSED for t in result.created)
    # Catch-up replay does not duplicate.
    again = generate_for_schedule(
        schedule=schedule, as_of=late, lookback=dt.timedelta(days=2), actor=actor
    )
    assert len(again.created) == 0
    assert SecurityAuditEvent.objects.filter(event_type="CHECKLIST_SCHEDULE_CREATED").exists()


@pytest.mark.django_db
def test_cross_org_isolation_and_manual() -> None:
    org_a = make_org(code=f"O07EA{uuid.uuid4().hex[:4].upper()}")
    org_b = make_org(code=f"O07EB{uuid.uuid4().hex[:4].upper()}")
    actor_a = _manager(org=org_a)
    actor_b = _manager(org=org_b)
    t_a, v_a = _published(actor=actor_a, org=org_a, code="TA")
    t_b, v_b = _published(actor=actor_b, org=org_b, code="TB")
    shift_b = make_shift(org_b, code="SB")
    with pytest.raises(PermissionDenied):
        create_checklist_schedule(
            actor=actor_a,
            organization_id=org_b.id,
            code="X",
            name="X",
            checklist_template_id=t_b.id,
            checklist_version_id=v_b.id,
            trigger_type=ChecklistTriggerType.SHIFT_START,
            shift_id=shift_b.id,
        )
    manual = create_checklist_schedule(
        actor=actor_a,
        organization_id=org_a.id,
        code="MAN1",
        name="Manual",
        checklist_template_id=t_a.id,
        checklist_version_id=v_a.id,
        trigger_type=ChecklistTriggerType.MANUAL,
    )
    task = create_manual_schedule_occurrence(
        actor=actor_a, schedule_id=manual.id, manual_token="TOKEN-1"
    )
    again = create_manual_schedule_occurrence(
        actor=actor_a, schedule_id=manual.id, manual_token="TOKEN-1"
    )
    assert again.id == task.id
    # Org B generation does not see Org A schedules
    payload = run_active_schedule_generation(
        as_of=timezone.now(), organization_id=org_b.id, actor=actor_b
    )
    assert payload["created_count"] == 0


@pytest.mark.django_db
def test_batch_path_still_idempotent_with_occurrence_key() -> None:
    org = make_org(code=f"O07E4{uuid.uuid4().hex[:4].upper()}")
    actor = _manager(org=org)
    template, version = _published(actor=actor, org=org, code="T4")
    t1 = create_batch_checklist_task(
        actor=actor,
        organization_id=org.id,
        checklist_template_id=template.id,
        checklist_version_id=version.id,
        batch_reference="BATCH-07E",
    )
    t2 = create_batch_checklist_task(
        actor=actor,
        organization_id=org.id,
        checklist_template_id=template.id,
        checklist_version_id=version.id,
        batch_reference="BATCH-07E",
    )
    assert t1.id == t2.id
    assert t1.occurrence_key == "batch:BATCH-07E"
    assert t1.trigger_type == ChecklistTriggerType.BATCH


@pytest.mark.django_db
def test_schedule_generation_performance_soft_guard() -> None:
    org = make_org(code=f"O07E5{uuid.uuid4().hex[:4].upper()}")
    actor = _manager(org=org)
    template, version = _published(actor=actor, org=org, code="T5")
    for i in range(15):
        shift = make_shift(org, code=f"S{i:02d}")
        create_checklist_schedule(
            actor=actor,
            organization_id=org.id,
            code=f"SCH{i:02d}",
            name=f"S{i}",
            checklist_template_id=template.id,
            checklist_version_id=version.id,
            trigger_type=ChecklistTriggerType.SHIFT_START,
            shift_id=shift.id,
            timezone_name="UTC",
            missed_policy=ChecklistMissedPolicy.CREATE_OVERDUE,
        )
    as_of = dt.datetime(2026, 5, 1, 10, 0, tzinfo=UTC)
    start = time.perf_counter()
    for _ in range(3):
        run_active_schedule_generation(
            as_of=as_of,
            lookback=dt.timedelta(hours=6),
            organization_id=org.id,
            actor=actor,
        )
    elapsed = time.perf_counter() - start
    assert elapsed < 20.0
    assert ChecklistTask.objects.filter(organization=org).count() >= 15


@pytest.mark.django_db
def test_batch_trigger_rejected_on_schedule_and_skip_policy() -> None:
    org = make_org(code=f"O07E6{uuid.uuid4().hex[:4].upper()}")
    actor = _manager(org=org)
    template, version = _published(actor=actor, org=org, code="T6")
    with pytest.raises(ValidationError):
        create_checklist_schedule(
            actor=actor,
            organization_id=org.id,
            code="BAD",
            name="Bad",
            checklist_template_id=template.id,
            checklist_version_id=version.id,
            trigger_type=ChecklistTriggerType.BATCH,
        )
    schedule = create_checklist_schedule(
        actor=actor,
        organization_id=org.id,
        code="SKIP1",
        name="Skip missed",
        checklist_template_id=template.id,
        checklist_version_id=version.id,
        trigger_type=ChecklistTriggerType.SCHEDULED,
        window_start_time=dt.time(8, 0),
        window_end_time=dt.time(9, 0),
        due_grace_minutes=0,
        missed_policy=ChecklistMissedPolicy.SKIP,
    )
    late = dt.datetime(2026, 6, 1, 12, 0, tzinfo=UTC)
    result = generate_for_schedule(
        schedule=schedule, as_of=late, lookback=dt.timedelta(days=1), actor=actor
    )
    assert len(result.created) == 0


@pytest.mark.django_db
def test_celery_task_and_interval_schedule_and_deactivate() -> None:
    org = make_org(code=f"O07E7{uuid.uuid4().hex[:4].upper()}")
    actor = _manager(org=org)
    template, version = _published(actor=actor, org=org, code="T7")
    schedule = create_checklist_schedule(
        actor=actor,
        organization_id=org.id,
        code="INT1",
        name="Interval",
        checklist_template_id=template.id,
        checklist_version_id=version.id,
        trigger_type=ChecklistTriggerType.SCHEDULED,
        timezone_name="UTC",
        window_start_time=dt.time(0, 0),
        window_end_time=dt.time(2, 0),
        interval_minutes=60,
        due_grace_minutes=120,
        missed_policy=ChecklistMissedPolicy.CREATE_OVERDUE,
    )
    as_of = dt.datetime(2026, 7, 1, 1, 30, tzinfo=UTC)
    payload = generate_due_checklist_tasks(
        as_of_iso="not-a-date",
        lookback_minutes=180,
        organization_id=str(org.id),
    )
    assert payload["replay_safe"] is True
    # Valid ISO path
    payload2 = generate_due_checklist_tasks(
        as_of_iso=as_of.isoformat(),
        lookback_minutes=180,
        organization_id=str(org.id),
    )
    assert payload2["created_count"] + payload2["existing_count"] >= 1
    from apps.scheduling.generation import deactivate_checklist_schedule

    deactivated = deactivate_checklist_schedule(actor=actor, schedule_id=schedule.id)
    assert deactivated.is_active is False
    again = deactivate_checklist_schedule(actor=actor, schedule_id=schedule.id)
    assert again.is_active is False


@pytest.mark.django_db
def test_edge_paths_timezone_interval_only_overnight_window_and_inactive() -> None:
    org = make_org(code=f"O07E8{uuid.uuid4().hex[:4].upper()}")
    actor = _manager(org=org)
    template, version = _published(actor=actor, org=org, code="T8")

    with pytest.raises(ValidationError):
        create_checklist_schedule(
            actor=actor,
            organization_id=org.id,
            code="BADTZ",
            name="Bad tz",
            checklist_template_id=template.id,
            checklist_version_id=version.id,
            trigger_type=ChecklistTriggerType.SCHEDULED,
            timezone_name="Not/AZone",
            window_start_time=dt.time(1, 0),
            window_end_time=dt.time(2, 0),
        )

    # Interval-only SCHEDULED (no window) — architecture support, not a Nelna cadence.
    interval_only = create_checklist_schedule(
        actor=actor,
        organization_id=org.id,
        code="INTONLY",
        name="Interval only",
        checklist_template_id=template.id,
        checklist_version_id=version.id,
        trigger_type=ChecklistTriggerType.SCHEDULED,
        timezone_name="UTC",
        interval_minutes=360,
        due_grace_minutes=0,
        missed_policy=ChecklistMissedPolicy.CREATE_OVERDUE,
    )
    noon = dt.datetime(2026, 8, 1, 12, 0, tzinfo=UTC)
    r1 = generate_for_schedule(
        schedule=interval_only, as_of=noon, lookback=dt.timedelta(hours=12), actor=actor
    )
    assert len(r1.created) >= 1

    # Overnight SCHEDULED window (provisional technical bound).
    overnight_win = create_checklist_schedule(
        actor=actor,
        organization_id=org.id,
        code="OWNWIN",
        name="Overnight window",
        checklist_template_id=template.id,
        checklist_version_id=version.id,
        trigger_type=ChecklistTriggerType.SCHEDULED,
        timezone_name="UTC",
        window_start_time=dt.time(22, 0),
        window_end_time=dt.time(2, 0),
        due_grace_minutes=30,
        missed_policy=ChecklistMissedPolicy.CREATE_OVERDUE,
    )
    after = dt.datetime(2026, 8, 2, 2, 15, tzinfo=UTC)
    r2 = generate_for_schedule(
        schedule=overnight_win, as_of=after, lookback=dt.timedelta(hours=8), actor=actor
    )
    assert len(r2.created) >= 1

    # MANUAL schedules are skipped by automatic generation.
    manual = create_checklist_schedule(
        actor=actor,
        organization_id=org.id,
        code="MANSKIP",
        name="Manual skip",
        checklist_template_id=template.id,
        checklist_version_id=version.id,
        trigger_type=ChecklistTriggerType.MANUAL,
    )
    skipped = generate_for_schedule(schedule=manual, as_of=noon, actor=actor)
    assert "manual_trigger_requires_explicit_token" in skipped.skipped

    from apps.scheduling.generation import deactivate_checklist_schedule

    with pytest.raises(ValidationError):
        manual_occurrence_key(schedule_id=manual.id, token=" ")
    deactivate_checklist_schedule(actor=actor, schedule_id=interval_only.id)
    interval_only.refresh_from_db()
    inactive = generate_for_schedule(schedule=interval_only, as_of=noon, actor=actor)
    assert "schedule_inactive" in inactive.skipped

    # Celery default as_of path (no ISO)
    payload = generate_due_checklist_tasks(organization_id=str(org.id))
    assert payload["replay_safe"] is True


def test_tz_helper_rejects_unknown_zone() -> None:
    with pytest.raises(ValidationError):
        _tz("Not/AZone")


@pytest.mark.django_db
def test_shift_missed_and_skip_policies_and_integrity_race() -> None:
    org = make_org(code=f"O07E9{uuid.uuid4().hex[:4].upper()}")
    actor = _manager(org=org)
    template, version = _published(actor=actor, org=org, code="T9")
    shift = make_shift(org, code="DAY9")
    missed_sched = create_checklist_schedule(
        actor=actor,
        organization_id=org.id,
        code="MISS1",
        name="Miss shift",
        checklist_template_id=template.id,
        checklist_version_id=version.id,
        trigger_type=ChecklistTriggerType.SHIFT_START,
        shift_id=shift.id,
        timezone_name="UTC",
        due_grace_minutes=0,
        missed_policy=ChecklistMissedPolicy.MARK_MISSED,
    )
    late = dt.datetime(2026, 9, 1, 12, 0, tzinfo=UTC)
    r = generate_for_schedule(
        schedule=missed_sched, as_of=late, lookback=dt.timedelta(hours=8), actor=actor
    )
    assert any(t.status == ChecklistTaskStatus.MISSED for t in r.created)

    skip_sched = create_checklist_schedule(
        actor=actor,
        organization_id=org.id,
        code="SKIPSH",
        name="Skip shift",
        checklist_template_id=template.id,
        checklist_version_id=version.id,
        trigger_type=ChecklistTriggerType.SHIFT_START,
        shift_id=shift.id,
        timezone_name="UTC",
        due_grace_minutes=0,
        missed_policy=ChecklistMissedPolicy.SKIP,
    )
    r2 = generate_for_schedule(
        schedule=skip_sched, as_of=late, lookback=dt.timedelta(hours=8), actor=actor
    )
    assert len(r2.created) == 0

    # IntegrityError race: second insert for same occurrence_key returns existing.
    from unittest.mock import patch

    from django.db import IntegrityError

    from apps.scheduling.generation import OccurrencePlan, upsert_occurrence_task

    existing = r.created[0]
    assert existing.window_start_at is not None
    assert existing.window_end_at is not None
    assert existing.due_at is not None
    plan = OccurrencePlan(
        occurrence_key=existing.occurrence_key,
        trigger_type=ChecklistTriggerType.SHIFT_START,
        window_start_at=existing.window_start_at,
        window_end_at=existing.window_end_at,
        due_at=existing.due_at,
        shift=shift,
        status=ChecklistTaskStatus.PENDING,
    )
    # Delete lookup path by filtering empty then force IntegrityError on save of duplicate key —
    # simpler: patch ChecklistTask.save to raise IntegrityError once after empty first().
    with patch("apps.scheduling.generation.ChecklistTask.objects") as objs:
        # First filter().first() -> None; after IntegrityError filter().first() -> existing
        filter_qs = objs.select_related.return_value.filter.return_value
        filter_qs.first.side_effect = [None, existing]
        objs.filter.return_value.first.return_value = existing
        with (
            patch.object(ChecklistTask, "full_clean", return_value=None),
            patch.object(ChecklistTask, "save", side_effect=IntegrityError("dup")),
        ):
            task, created = upsert_occurrence_task(
                actor=actor, schedule=missed_sched, plan=plan, as_of=late
            )
    assert created is False
    assert task.id == existing.id
