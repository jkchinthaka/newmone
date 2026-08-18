"""Mongo-safe optimistic / conditional transition primitive.

Approved concurrency pattern for replacing PostgreSQL ``select_for_update``
on the same-database MongoDB migration path.

Pattern: atomic compare-and-set (conditional update)

Conceptual transition::

    WHERE:
      id = X
      status = SUBMITTED
      version = 7   # optional when model carries concurrency_version

    SET:
      status = APPROVED
      version = 8

Only one concurrent writer may observe ``matched_count == 1``.

Also supported:

* unique-constraint insert for immutable one-shot decisions (Supervisor/QA)
* idempotent re-read when the unique key already exists with the same decision
* conflict when the unique key exists with a different decision

This module does **not** silently remove locking. Callers must encode the
business predicate in ``expected`` filters.
"""

from __future__ import annotations

from collections.abc import Mapping
from dataclasses import dataclass
from typing import Any

from django.core.exceptions import ValidationError
from django.db import IntegrityError
from django.db.models import Model, QuerySet

from apps.core.persistence.transactions import atomic


class TransitionConflictError(Exception):
    """Raised when a conditional transition loses a race or sees a stale version."""


class TransitionIdempotentHitError(Exception):
    """Raised when an identical prior decision already exists (caller may return it)."""

    def __init__(self, existing: Model) -> None:
        super().__init__("Identical prior decision exists.")
        self.existing = existing


@dataclass(frozen=True)
class TransitionResult:
    applied: bool
    matched: int
    instance: Model | None


def conditional_update(
    queryset: QuerySet,
    *,
    expected: Mapping[str, Any],
    updates: Mapping[str, Any],
) -> TransitionResult:
    """Apply updates only when ``expected`` still matches.

    Works on PostgreSQL and MongoDB backends that support filtered QuerySet.update.
    """
    filtered = queryset.filter(**expected)
    matched = filtered.update(**updates)
    instance = None
    if matched == 1:
        # Best-effort refresh of the winning row when primary key known
        pk = expected.get("pk") or expected.get("id")
        if pk is not None:
            instance = queryset.model.objects.filter(pk=pk).first()
    return TransitionResult(applied=matched == 1, matched=matched, instance=instance)


def require_conditional_update(
    queryset: QuerySet,
    *,
    expected: Mapping[str, Any],
    updates: Mapping[str, Any],
) -> TransitionResult:
    result = conditional_update(queryset, expected=expected, updates=updates)
    if not result.applied:
        raise TransitionConflictError(
            f"Conditional update matched {result.matched} row(s); expected exactly 1."
        )
    return result


def _resolve_unique_conflict(
    *,
    model: type[Model],
    unique_lookup: Mapping[str, Any],
    decision_field: str,
    decision_value: Any,
) -> Model:
    existing = model.objects.filter(**unique_lookup).first()
    if existing is None:
        raise TransitionConflictError("Unique constraint conflict but existing row not found.")
    if getattr(existing, decision_field) == decision_value:
        return existing
    raise TransitionConflictError("Immutable decision already exists with a different value.")


def create_immutable_unique(
    *,
    model: type[Model],
    create_kwargs: Mapping[str, Any],
    unique_lookup: Mapping[str, Any],
    decision_field: str,
    decision_value: Any,
) -> tuple[Model, bool]:
    """Insert an immutable decision row protected by a unique constraint.

    Race handling:
    * IntegrityError / unique ValidationError → re-read by ``unique_lookup``
    * same decision → return existing (idempotent)
    * different decision → TransitionConflictError

    Returns:
        (instance, created) tuple where created=True only for fresh inserts.
    """
    from django.db import DatabaseError

    from apps.core.persistence.transactions import is_transient_transaction_error

    last_error: BaseException | None = None
    for _attempt in range(5):
        try:
            obj = model(**create_kwargs)
            if hasattr(obj, "full_clean"):
                obj.full_clean()
            with atomic():
                obj.save()
            return (obj, True)
        except IntegrityError:
            existing = _resolve_unique_conflict(
                model=model,
                unique_lookup=unique_lookup,
                decision_field=decision_field,
                decision_value=decision_value,
            )
            return (existing, False)
        except ValidationError:
            # Django unique validators fire in full_clean before IntegrityError.
            existing = _resolve_unique_conflict(
                model=model,
                unique_lookup=unique_lookup,
                decision_field=decision_field,
                decision_value=decision_value,
            )
            return (existing, False)
        except DatabaseError as exc:
            last_error = exc
            # Duplicate-key may arrive wrapped; WriteConflict needs re-read/retry.
            text = str(exc)
            if "E11000" in text or "duplicate key" in text.lower():
                existing = _resolve_unique_conflict(
                    model=model,
                    unique_lookup=unique_lookup,
                    decision_field=decision_field,
                    decision_value=decision_value,
                )
                return (existing, False)
            if is_transient_transaction_error(exc):
                existing = model.objects.filter(**unique_lookup).first()
                if existing is not None:
                    if getattr(existing, decision_field) == decision_value:
                        return (existing, False)
                    raise TransitionConflictError(
                        "Immutable decision already exists with a different value."
                    ) from exc
                continue
            raise
    if last_error is not None:
        raise last_error
    raise TransitionConflictError("Unable to create immutable unique row after retries.")


def cas_versioned_update(
    model: type[Model],
    *,
    pk: Any,
    expected_version: int,
    updates: Mapping[str, Any],
    version_field: str = "concurrency_version",
) -> Model:
    """Compare-and-set using an integer version field.

    Requires the model to expose ``version_field``. On success the version is
    incremented atomically as part of the filtered update.
    """
    payload = dict(updates)
    payload[version_field] = expected_version + 1
    result = conditional_update(
        model.objects.all(),
        expected={"pk": pk, version_field: expected_version},
        updates=payload,
    )
    if not result.applied:
        raise TransitionConflictError(
            f"Stale {version_field}={expected_version} for {model.__name__} pk={pk}."
        )
    obj = model.objects.filter(pk=pk).first()
    if obj is None:
        raise TransitionConflictError(f"{model.__name__} pk={pk} missing after CAS update.")
    return obj


def cas_status_transition(
    model: type[Model],
    *,
    pk: Any,
    from_status: str,
    to_status: str,
    extra_updates: Mapping[str, Any] | None = None,
    status_field: str = "status",
) -> Model:
    """Atomically move ``status_field`` from ``from_status`` to ``to_status``.

    Duplicate identical transitions raise ``TransitionConflictError`` so the
    caller can re-read and treat already-applied terminal states as idempotent.
    """
    payload = dict(extra_updates or {})
    payload[status_field] = to_status
    result = conditional_update(
        model.objects.all(),
        expected={"pk": pk, status_field: from_status},
        updates=payload,
    )
    if not result.applied:
        raise TransitionConflictError(
            f"Status CAS {model.__name__} pk={pk} {from_status!r}→{to_status!r} matched "
            f"{result.matched} row(s)."
        )
    obj = model.objects.filter(pk=pk).first()
    if obj is None:
        raise TransitionConflictError(f"{model.__name__} pk={pk} missing after status CAS.")
    return obj
