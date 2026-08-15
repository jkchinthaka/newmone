"""Backend-neutral query helpers for Mongo compatibility.

``select_for_update`` and ``prefetch_related`` are unsupported on
django-mongodb-backend. Callers should use these helpers instead of
vendor ``if`` branches in business services.
"""

from __future__ import annotations

from collections import defaultdict
from collections.abc import Iterable, Sequence
from typing import Any
from uuid import UUID

from django.db.models import Model, QuerySet

from apps.core.persistence.backend import is_mongodb


def lock_queryset(
    queryset: QuerySet,
    *,
    of: tuple[str, ...] | None = ("self",),
    nowait: bool = False,
    skip_locked: bool = False,
) -> QuerySet:
    """Apply PostgreSQL ``select_for_update``; no-op on MongoDB.

    Defaults to ``of=("self",)`` so nullable ``select_related`` joins do not
    raise ``FOR UPDATE cannot be applied to the nullable side of an outer join``.

    Mongo callers MUST still protect invariants with unique indexes and/or
    compare-and-set updates. This helper only avoids an unsupported API.
    """
    if is_mongodb():
        return queryset
    kwargs: dict[str, Any] = {}
    if of is not None:
        kwargs["of"] = of
    if nowait:
        kwargs["nowait"] = nowait
    if skip_locked:
        kwargs["skip_locked"] = skip_locked
    return queryset.select_for_update(**kwargs)


def locked_get(
    model: type[Model],
    *,
    pk: Any,
    select_related: Sequence[str] = (),
    of: tuple[str, ...] | None = ("self",),
    extra_filters: dict[str, Any] | None = None,
) -> Model | None:
    """Load one row with PostgreSQL row lock; Mongo uses the same query without a lock.

    Callers that mutate state must still apply unique indexes and/or CAS.
    """
    qs = model.objects.all()
    if select_related:
        qs = qs.select_related(*tuple(select_related))
    filters: dict[str, Any] = {"pk": pk}
    if extra_filters:
        filters.update(extra_filters)
    return lock_queryset(qs.filter(**filters), of=of).first()


def prefetch_related_compat(queryset: QuerySet, *lookups: Any) -> QuerySet:
    """Apply ``prefetch_related`` on PostgreSQL; skip on Mongo (use batched loaders)."""
    if is_mongodb() or not lookups:
        return queryset
    return queryset.prefetch_related(*lookups)


def apply_mongo_queryset_compat() -> None:
    """No-op unsupported QuerySet APIs on Mongo so leftover call sites do not crash.

    This is a last-resort execution safety net. Production invariants still require
    ``lock_queryset`` / unique indexes / CAS. PostgreSQL is unchanged.
    """
    if not is_mongodb():
        return
    from django.db.models.query import QuerySet as DjangoQuerySet

    if getattr(DjangoQuerySet.select_for_update, "_fg_mongo_compat", False):
        return

    def _select_for_update(self: QuerySet, *args: Any, **kwargs: Any) -> QuerySet:
        return self

    _select_for_update._fg_mongo_compat = True  # type: ignore[attr-defined]
    DjangoQuerySet.select_for_update = _select_for_update  # type: ignore[method-assign]

    def _prefetch_related(self: QuerySet, *args: Any, **kwargs: Any) -> QuerySet:
        return self

    DjangoQuerySet.prefetch_related = _prefetch_related  # type: ignore[method-assign]


def attach_reverse_relation(
    parents: Sequence[Model],
    children: Iterable[Model],
    *,
    fk_attr: str,
    related_name: str,
) -> None:
    """Populate Django's prefetch cache so ``parent.related.all()`` does not N+1."""
    buckets: dict[Any, list[Model]] = defaultdict(list)
    for child in children:
        buckets[getattr(child, fk_attr)].append(child)
    for parent in parents:
        cache = getattr(parent, "_prefetched_objects_cache", None)
        if cache is None:
            cache = {}
            parent._prefetched_objects_cache = cache
        cache[related_name] = buckets.get(parent.pk, [])


def latest_ids_by_parent(
    *,
    model: type[Model],
    parent_field: str,
    number_field: str,
    parent_ids: Sequence[UUID],
    extra_filters: dict[str, Any] | None = None,
) -> list[UUID]:
    """Return PKs of the highest-numbered child per parent (no OuterRef/Subquery)."""
    if not parent_ids:
        return []
    filters = {f"{parent_field}__in": list(parent_ids)}
    if extra_filters:
        filters.update(extra_filters)
    rows = model.objects.filter(**filters).values_list("id", parent_field, number_field)
    best: dict[Any, tuple[UUID, Any]] = {}
    for pk, parent_id, number in rows:
        prev = best.get(parent_id)
        if prev is None or number > prev[1]:
            best[parent_id] = (pk, number)
    return [pk for pk, _number in best.values()]
