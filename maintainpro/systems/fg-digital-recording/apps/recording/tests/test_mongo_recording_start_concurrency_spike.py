"""Concurrency spike tests for recording start CAS / unique(task) pattern."""

from __future__ import annotations

import uuid
from concurrent.futures import ThreadPoolExecutor, as_completed

import pytest
from django.db import connection
from tests.factories import make_org

from apps.core.db_namespace import restore_postgresql_table_names
from apps.recording.models import ChecklistRecord
from apps.recording.services import start_checklist_recording
from apps.recording.tests.test_phase08a_draft_recording import (
    _make_rich_published,
    _pending_task,
    _recorder,
    _task_manager,
)

pytestmark = pytest.mark.django_db(transaction=True)


@pytest.fixture(autouse=True)
def _ensure_pg_table_names() -> None:
    restore_postgresql_table_names()


def _fixture():
    org = make_org(code=f"RS{uuid.uuid4().hex[:8].upper()}")
    manager = _task_manager(org=org)
    recorder = _recorder(org=org)
    published = _make_rich_published(
        actor=manager, org=org, code=f"T{uuid.uuid4().hex[:6].upper()}"
    )
    task = _pending_task(
        manager=manager,
        org=org,
        published=published,
        batch=f"B{uuid.uuid4().hex[:6].upper()}",
    )
    return recorder, task


def test_concurrent_start_creates_single_record() -> None:
    recorder, task = _fixture()

    def _run() -> ChecklistRecord:
        connection.close()
        return start_checklist_recording(actor=recorder, task_id=task.id)

    with ThreadPoolExecutor(max_workers=4) as pool:
        futures = [pool.submit(_run) for _ in range(4)]
        results = [f.result() for f in as_completed(futures)]

    ids = {r.id for r in results}
    assert len(ids) == 1
    assert ChecklistRecord.objects.filter(checklist_task_id=task.id).count() == 1


def test_start_idempotent_repeat_call() -> None:
    recorder, task = _fixture()
    first = start_checklist_recording(actor=recorder, task_id=task.id)
    second = start_checklist_recording(actor=recorder, task_id=task.id)
    assert first.id == second.id
    assert first.started_by_id == second.started_by_id


def test_concurrent_start_two_recorders_one_owner() -> None:
    org = make_org(code=f"RT{uuid.uuid4().hex[:8].upper()}")
    manager = _task_manager(org=org)
    recorder_a = _recorder(org=org)
    recorder_b = _recorder(org=org)
    published = _make_rich_published(
        actor=manager, org=org, code=f"T{uuid.uuid4().hex[:6].upper()}"
    )
    task = _pending_task(
        manager=manager,
        org=org,
        published=published,
        batch=f"B{uuid.uuid4().hex[:6].upper()}",
    )

    def _run(actor) -> ChecklistRecord:
        connection.close()
        return start_checklist_recording(actor=actor, task_id=task.id)

    with ThreadPoolExecutor(max_workers=2) as pool:
        f1 = pool.submit(_run, recorder_a)
        f2 = pool.submit(_run, recorder_b)
        a = f1.result()
        b = f2.result()

    assert a.id == b.id
    assert ChecklistRecord.objects.filter(checklist_task_id=task.id).count() == 1
    # Ownership is not transferred after first successful create
    assert a.started_by_id == b.started_by_id
