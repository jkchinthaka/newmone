"""Backend-neutral transaction boundaries.

On MongoDB, prefer ``django_mongodb_backend.transaction.atomic`` when available.
On PostgreSQL, use Django's ``django.db.transaction``.

Nested savepoints are unsupported on Mongo — callers must avoid relying on
partial nested rollback. Prefer flattening multi-step workflows or single-document CAS.
"""

from __future__ import annotations

from collections.abc import Callable, Iterator
from contextlib import contextmanager
from functools import wraps
from typing import Any

from django.db import transaction as django_transaction

from apps.core.persistence.backend import is_mongodb


def _mongo_transaction_module() -> Any:
    from django_mongodb_backend import transaction as mongo_transaction

    return mongo_transaction


@contextmanager
def atomic(*, using: str | None = None, savepoint: bool = True) -> Iterator[Any]:
    """Enter an atomic block appropriate for the active database vendor.

    ``savepoint=False`` is recommended for Mongo callers that previously nested
    ``atomic()`` only for organizational structure (Mongo has no savepoints).
    """
    if is_mongodb():
        mongo_transaction = _mongo_transaction_module()
        # Mongo backend atomic does not provide PostgreSQL-style savepoints.
        with mongo_transaction.atomic(using=using):
            yield
        return

    with django_transaction.atomic(using=using, savepoint=savepoint):
        yield


def atomic_fn(func: Callable[..., Any]) -> Callable[..., Any]:
    """Decorator equivalent of ``atomic()`` (Mongo has no savepoints)."""

    @wraps(func)
    def inner(*args: Any, **kwargs: Any) -> Any:
        with atomic():
            return func(*args, **kwargs)

    return inner


def on_commit(func: Callable[..., Any], *, using: str | None = None) -> None:
    """Schedule ``func`` after the current transaction commits successfully."""
    if is_mongodb():
        mongo_transaction = _mongo_transaction_module()
        mongo_transaction.on_commit(func, using=using)
        return
    django_transaction.on_commit(func, using=using)
