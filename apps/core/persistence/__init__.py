"""Backend-neutral persistence / concurrency facade for Mongo migration.

Business services should prefer these helpers over scattering::

    if mongo: ...
    else: ...

PostgreSQL remains the ``main`` safety baseline until Mongo parity is proven.
"""

from __future__ import annotations

from apps.core.persistence.backend import DatabaseVendor, detect_database_vendor, is_mongodb
from apps.core.persistence.concurrency import (
    TransitionConflictError,
    TransitionIdempotentHitError,
    TransitionResult,
    cas_status_transition,
    cas_versioned_update,
    conditional_update,
    create_immutable_unique,
    require_conditional_update,
)
from apps.core.persistence.queries import (
    apply_mongo_queryset_compat,
    attach_reverse_relation,
    latest_ids_by_parent,
    lock_queryset,
    locked_get,
    prefetch_related_compat,
)
from apps.core.persistence.transactions import atomic, atomic_fn, on_commit

__all__ = [
    "DatabaseVendor",
    "TransitionConflictError",
    "TransitionIdempotentHitError",
    "TransitionResult",
    "atomic",
    "atomic_fn",
    "attach_reverse_relation",
    "apply_mongo_queryset_compat",
    "cas_status_transition",
    "cas_versioned_update",
    "conditional_update",
    "create_immutable_unique",
    "detect_database_vendor",
    "is_mongodb",
    "latest_ids_by_parent",
    "lock_queryset",
    "locked_get",
    "on_commit",
    "prefetch_related_compat",
    "require_conditional_update",
]
