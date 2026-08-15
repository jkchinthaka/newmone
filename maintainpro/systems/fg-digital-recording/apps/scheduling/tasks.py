"""Celery tasks for checklist schedule generation (Phase 07E)."""

from __future__ import annotations

import datetime as dt
from typing import Any

from django.utils import timezone
from django.utils.dateparse import parse_datetime

from apps.scheduling.generation import DEFAULT_CATCHUP_LOOKBACK, run_active_schedule_generation
from celery import shared_task


@shared_task(name="apps.scheduling.tasks.generate_due_checklist_tasks")  # type: ignore[untyped-decorator]
def generate_due_checklist_tasks(
    as_of_iso: str | None = None,
    lookback_minutes: int | None = None,
    organization_id: str | None = None,
) -> dict[str, Any]:
    """
    Replay-safe due-occurrence generation.

    Beat poll cadence is infrastructure only — not a Nelna checklist frequency.
    lookback supports catch-up after missed Beat runs without duplicating tasks.
    """
    as_of = None
    if as_of_iso:
        as_of = parse_datetime(as_of_iso)
        if as_of is None:
            as_of = timezone.now()
    lookback = DEFAULT_CATCHUP_LOOKBACK
    if lookback_minutes is not None:
        lookback = dt.timedelta(minutes=max(1, int(lookback_minutes)))
    org_uuid = None
    if organization_id:
        import uuid

        org_uuid = uuid.UUID(str(organization_id))
    return run_active_schedule_generation(
        as_of=as_of,
        lookback=lookback,
        organization_id=org_uuid,
        actor=None,
    )
