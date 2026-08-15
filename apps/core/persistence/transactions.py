"""Backend-neutral transaction boundaries.

On PostgreSQL, use Django's ``django.db.transaction``.

On MongoDB, ``django.db.transaction.atomic()`` is a documented no-op
(``supports_transactions = False``). This facade matches that default:

* Do **not** start multi-document Mongo transactions for ordinary service
  ``atomic()`` boundaries — those produce ``WriteConflict`` under concurrency
  and fight the approved CAS / unique-index patterns.
* Use ``mongo_multi_doc_atomic()`` only for explicitly classified multi-doc
  units that implement TransientTransactionError retry.
* Nested savepoints remain unsupported on Mongo.
"""

from __future__ import annotations

import time
from collections.abc import Callable, Iterator
from contextlib import contextmanager
from functools import wraps
from typing import Any

from django.db import DatabaseError, transaction as django_transaction

from apps.core.persistence.backend import is_mongodb


def _mongo_transaction_module() -> Any:
    from django_mongodb_backend import transaction as mongo_transaction

    return mongo_transaction


def is_transient_transaction_error(exc: BaseException) -> bool:
    """True for Mongo TransientTransactionError / WriteConflict (code 112)."""
    cur: BaseException | None = exc
    seen: set[int] = set()
    while cur is not None and id(cur) not in seen:
        seen.add(id(cur))
        code = getattr(cur, "code", None)
        if code == 112:
            return True
        labels = getattr(cur, "errorLabels", None) or ()
        if "TransientTransactionError" in labels:
            return True
        text = str(cur)
        if "WriteConflict" in text or "TransientTransactionError" in text:
            return True
        cur = cur.__cause__ or cur.__context__
    return False


@contextmanager
def atomic(*, using: str | None = None, savepoint: bool = True) -> Iterator[Any]:
    """Enter an atomic block appropriate for the active database vendor.

    Mongo: organizational no-op (CAS / unique indexes own concurrency).
    PostgreSQL: real ``django.db.transaction.atomic``.
    """
    if is_mongodb():
        yield
        return

    with django_transaction.atomic(using=using, savepoint=savepoint):
        yield


@contextmanager
def mongo_multi_doc_atomic(*, using: str | None = None) -> Iterator[Any]:
    """Explicit Mongo multi-document transaction (rare; prefer CAS/unique)."""
    if not is_mongodb():
        with django_transaction.atomic(using=using):
            yield
        return
    mongo_transaction = _mongo_transaction_module()
    with mongo_transaction.atomic(using=using):
        yield


def run_mongo_multi_doc_atomic(
    fn: Callable[[], Any],
    *,
    using: str | None = None,
    attempts: int = 8,
) -> Any:
    """Run ``fn`` inside ``mongo_multi_doc_atomic`` with WriteConflict retry."""
    delay = 0.005
    last: BaseException | None = None
    for attempt in range(attempts):
        try:
            with mongo_multi_doc_atomic(using=using):
                return fn()
        except Exception as exc:  # noqa: BLE001 — inspect then re-raise
            last = exc
            if not is_mongodb() or not is_transient_transaction_error(exc):
                raise
            if attempt + 1 >= attempts:
                raise
            time.sleep(delay)
            delay = min(delay * 2, 0.1)
    assert last is not None
    raise last


def atomic_fn(func: Callable[..., Any]) -> Callable[..., Any]:
    """Decorator equivalent of ``atomic()`` (Mongo has no savepoints)."""

    @wraps(func)
    def inner(*args: Any, **kwargs: Any) -> Any:
        with atomic():
            return func(*args, **kwargs)

    return inner


def on_commit(func: Callable[..., Any], *, using: str | None = None) -> None:
    """Schedule ``func`` after the current transaction commits successfully.

    On Mongo with no-op ``atomic()``, runs ``func`` immediately (same practical
    behavior as Django when not in an atomic block).
    """
    if is_mongodb():
        # Prefer backend on_commit when a real multi-doc txn is active.
        try:
            connection = django_transaction.get_connection(using)
            if getattr(connection, "in_atomic_block_mongo", False):
                _mongo_transaction_module().on_commit(func, using=using)
                return
        except DatabaseError:
            pass
        func()
        return
    django_transaction.on_commit(func, using=using)
