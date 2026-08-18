# Mongo Concurrency Inventory (`select_for_update`)

**Generated (UTC):** 2026-08-13T04:11:53Z  
**Exact call-site count:** 1  

PostgreSQL row locks are **not** supported by django-mongodb-backend.
Do not delete these call sites without a proven Mongo-safe replacement.

## Domain summary

| Domain | Count |
| --- | ---: |
| other | 1 |

## Replacement policy

Approved pattern: **optimistic conditional transition** (atomic compare-and-set / conditional update + unique indexes + retry).
See `apps/core/optimistic_transition.py` and `docs/migration/MONGO_CONCURRENCY_PATTERN.md`.

Do **not** rewrite all sites blindly. Spike order:
1. Supervisor review
2. QA review
3. Recording / submission / correction
4. RCA

## Domain: other

### `apps/core/persistence/queries.py:44` — `lock_queryset`

- **File:** `apps/core/persistence/queries.py`
- **Function:** `lock_queryset`
- **Locked model (heuristic):** `UNKNOWN`
- **Invariant protected:** serialize competing writes on this row/aggregate (exact invariant requires service-level review)
- **Competing operation:** concurrent service calls touching the same entity
- **Failure if race occurs:** duplicate decisions, lost updates, invalid state transitions, or broken idempotency
- **Proposed Mongo replacement:** Optimistic conditional transition (compare-and-set) via `apps.core.optimistic_transition` — unique constraint + filter(status/version/decision) update; retry on conflict. Domain=other; locked=UNKNOWN.
- **Source:** `return queryset.select_for_update(**kwargs)`

