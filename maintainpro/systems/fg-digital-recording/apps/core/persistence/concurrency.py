"""Concurrency primitives — re-export approved CAS helpers.

Implementation lives in ``apps.core.optimistic_transition``; this module is the
stable import path for services migrating off ``select_for_update``.
"""

from __future__ import annotations

from apps.core.optimistic_transition import (
    TransitionConflictError,
    TransitionIdempotentHitError,
    TransitionResult,
    cas_status_transition,
    cas_versioned_update,
    conditional_update,
    create_immutable_unique,
    require_conditional_update,
)

__all__ = [
    "TransitionConflictError",
    "TransitionIdempotentHitError",
    "TransitionResult",
    "cas_status_transition",
    "cas_versioned_update",
    "conditional_update",
    "create_immutable_unique",
    "require_conditional_update",
]
