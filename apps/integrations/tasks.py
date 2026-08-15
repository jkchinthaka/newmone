"""Celery helpers for integration retries — mock/path only; no live vendor pull."""

from __future__ import annotations

from typing import Any

from apps.integrations.retry import DEFAULT_RETRY_POLICY
from celery import shared_task


@shared_task(name="apps.integrations.tasks.compute_backoff_delay")  # type: ignore[untyped-decorator]
def compute_backoff_delay(attempt: int) -> dict[str, Any]:
    """Expose backoff calculation for SRE/ops tests without sleeping."""
    delay = DEFAULT_RETRY_POLICY.delay_for_attempt(int(attempt))
    return {"attempt": int(attempt), "delay_seconds": delay}
