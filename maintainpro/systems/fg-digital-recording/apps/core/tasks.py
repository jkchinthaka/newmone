"""Diagnostic Celery tasks — no business behavior."""

from __future__ import annotations

from celery import shared_task


@shared_task(name="apps.core.tasks.health_echo")  # type: ignore[untyped-decorator]
def health_echo(message: str = "ok") -> dict[str, str]:
    """Return a harmless echo payload for foundation validation."""
    safe = str(message)[:64]
    return {"echo": safe, "status": "ok"}
