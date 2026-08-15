"""Durable FG idempotency helpers (Mongo-compatible unique compound index)."""

from __future__ import annotations

import time
from typing import Any, Callable, TypeVar

from django.core.exceptions import ValidationError
from django.db import IntegrityError
from django.utils import timezone

from apps.core.models import IdempotencyKey, IdempotencyKeyStatus
from apps.core.persistence import atomic
from apps.organizations.models import Organization

T = TypeVar("T")


class IdempotentReplay(Exception):
    """Raised when a completed key is replayed — carry the original result."""

    def __init__(self, record: IdempotencyKey) -> None:
        self.record = record
        super().__init__("Idempotent replay")


def begin_idempotent(
    *,
    organization: Organization,
    scope: str,
    key: str,
) -> IdempotencyKey:
    """Claim an idempotency key or return the existing row."""
    scope_n = (scope or "").strip()
    key_n = (key or "").strip()
    if not scope_n or not key_n:
        raise ValueError("Idempotency scope and key are required.")

    existing = IdempotencyKey.objects.filter(
        organization=organization, scope=scope_n, key=key_n
    ).first()
    if existing is not None:
        return existing

    try:
        with atomic():
            record = IdempotencyKey(
                organization=organization,
                scope=scope_n,
                key=key_n,
                status=IdempotencyKeyStatus.PENDING,
            )
            # Avoid full_clean UniqueConstraint ValidationError racing with insert.
            record.save()
            return record
    except (IntegrityError, ValidationError):
        existing = IdempotencyKey.objects.filter(
            organization=organization, scope=scope_n, key=key_n
        ).first()
        if existing is None:
            raise
        return existing


def complete_idempotent(
    record: IdempotencyKey,
    *,
    result_reference: str = "",
    result_payload: dict[str, Any] | None = None,
) -> IdempotencyKey:
    record.status = IdempotencyKeyStatus.COMPLETED
    record.result_reference = (result_reference or "").strip()
    record.result_payload = result_payload or {}
    record.completed_at = timezone.now()
    record.save(
        update_fields=["status", "result_reference", "result_payload", "completed_at"]
    )
    return record


def fail_idempotent(record: IdempotencyKey, *, error_code: str = "SAVE_FAILED") -> IdempotencyKey:
    record.status = IdempotencyKeyStatus.FAILED
    record.error_code = (error_code or "SAVE_FAILED")[:64]
    record.completed_at = timezone.now()
    record.save(update_fields=["status", "error_code", "completed_at"])
    return record


def _try_claim(record: IdempotencyKey) -> bool:
    """CAS claim: PENDING/FAILED → IN_PROGRESS. Only one concurrent caller wins."""
    allowed = (IdempotencyKeyStatus.PENDING, IdempotencyKeyStatus.FAILED)
    if record.status not in allowed:
        return False
    updated = IdempotencyKey.objects.filter(pk=record.pk, status=record.status).update(
        status=IdempotencyKeyStatus.IN_PROGRESS,
        error_code="",
        completed_at=None,
    )
    if updated == 1:
        record.status = IdempotencyKeyStatus.IN_PROGRESS
        record.error_code = ""
        record.completed_at = None
        return True
    return False


def run_idempotent(
    *,
    organization: Organization,
    scope: str,
    key: str,
    fn: Callable[[], T],
    result_reference_attr: str = "id",
) -> tuple[T | None, IdempotencyKey, bool]:
    """Execute ``fn`` once per (organization, scope, key).

    Returns ``(result, row, created_work)``. On replay of COMPLETED, ``result`` is
    None and the caller reloads via ``row.result_reference``. Concurrent losers
    see IN_PROGRESS / COMPLETED and do not re-run ``fn``.

    ``fn`` owns its own transaction/atomicity. Callers that need multi-document
    rollback should wrap business writes inside ``fn`` with
    ``mongo_multi_doc_atomic`` / ``atomic``.
    """
    record = begin_idempotent(organization=organization, scope=scope, key=key)
    if record.status == IdempotencyKeyStatus.COMPLETED:
        return (None, record, False)

    if not _try_claim(record):
        record.refresh_from_db()
        return (None, record, False)

    try:
        result = fn()
        ref = str(getattr(result, result_reference_attr, "") or "")
        complete_idempotent(record, result_reference=ref)
        return (result, record, True)
    except Exception:
        fresh = IdempotencyKey.objects.filter(pk=record.pk).first()
        if fresh is not None and fresh.status == IdempotencyKeyStatus.IN_PROGRESS:
            fail_idempotent(fresh, error_code="SAVE_FAILED")
        raise


def execute_idempotent(
    *,
    organization: Organization,
    scope: str,
    key: str,
    fn: Callable[[], T],
    reload: Callable[[str], T | None],
    pending_fallback: Callable[[], T | None] | None = None,
    pending_message: str = "Duplicate submit is already being processed. Retry shortly.",
    wait_attempts: int = 8,
    wait_seconds: float = 0.05,
) -> T:
    """Run ``fn`` once; on replay reload the original entity via ``reload(result_reference)``."""
    normalized = (key or "").strip()
    if not normalized:
        return fn()

    result, row, created = run_idempotent(
        organization=organization,
        scope=scope,
        key=normalized,
        fn=fn,
    )
    if created and result is not None:
        return result

    for _ in range(max(1, wait_attempts)):
        row.refresh_from_db()
        if row.status == IdempotencyKeyStatus.COMPLETED and row.result_reference:
            existing = reload(str(row.result_reference))
            if existing is not None:
                return existing
        if pending_fallback is not None:
            fallback = pending_fallback()
            if fallback is not None:
                return fallback
        if row.status == IdempotencyKeyStatus.FAILED:
            break
        time.sleep(wait_seconds)

    if pending_fallback is not None:
        fallback = pending_fallback()
        if fallback is not None:
            return fallback
    raise ValidationError({"idempotency_key": pending_message})
