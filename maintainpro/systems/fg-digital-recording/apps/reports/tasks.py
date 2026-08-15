"""Celery tasks for background report generation."""

from __future__ import annotations

import uuid
from typing import Any

from apps.reports.services import execute_report_run_by_id
from apps.security_audit.services import record_event
from celery import shared_task


@shared_task(
    name="apps.reports.tasks.generate_report_run",
    bind=True,
    max_retries=2,
    default_retry_delay=30,
)  # type: ignore[untyped-decorator]
def generate_report_run(self: Any, report_run_id: str) -> dict[str, Any]:
    """Generate CSV for a ReportRun (idempotent when already COMPLETED)."""
    try:
        run = execute_report_run_by_id(uuid.UUID(report_run_id))
    except Exception as exc:  # noqa: BLE001
        try:
            raise self.retry(exc=exc)
        except self.MaxRetriesExceededError:
            return {"ok": False, "reason": "max_retries", "error": str(exc)[:200]}
    record_event(
        event_type="REPORT_RUN_COMPLETED",
        actor=run.requested_by,
        metadata={
            "report_run_id": str(run.id),
            "organization_id": str(run.organization_id),
            "report_code": run.report_code,
            "row_count": run.row_count,
            "background": True,
        },
    )
    return {
        "ok": True,
        "report_run_id": str(run.id),
        "status": run.status,
        "row_count": run.row_count,
    }
