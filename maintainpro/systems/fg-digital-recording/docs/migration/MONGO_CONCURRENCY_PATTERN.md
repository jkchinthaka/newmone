# Mongo Concurrency Pattern — Approved Design

**Status:** Design approved for spikes; mass rewrite not authorized until spikes pass.  
**Production target DB:** `mgintginpro_prod` (FG collections `fg_*` only)  
**Classification:** CUTOVER still BLOCKED until proven on isolated Mongo POC

---

## Problem

PostgreSQL `select_for_update()` (~138 call sites) serializes competing writers.
django-mongodb-backend does **not** support row-level `SELECT FOR UPDATE`.

Removing locks and using check-then-save would create race bugs.

---

## Approved pattern: optimistic conditional transition (compare-and-set)

### A. Versioned state transition

```text
WHERE id = X AND status = SUBMITTED AND concurrency_version = 7
SET   status = APPROVED, concurrency_version = 8
```

Exactly one concurrent request may observe `matched_count == 1`.

### B. Immutable unique decision (Supervisor / QA)

```text
INSERT decision(submission_id=S, decision=D, ...)
UNIQUE(submission_id)
ON DUPLICATE KEY:
  if existing.decision == D → idempotent return
  else → conflict
```

### C. Official MongoDB multi-document transactions

Allowed **only** when topology is a replica set (or mongos) with sessions.
Must not assume company `127.0.0.1:27018` topology until read-only audit proves it.
Prefer single-document CAS + unique indexes when sufficient.

### D. Retry behavior

- Transient transaction / network errors: bounded retry with jitter
- Business conflict / stale version: **no** blind retry of a different decision
- Duplicate POST with same decision: idempotent success

---

## Implementation module

`apps/core/optimistic_transition.py`

- `conditional_update` / `require_conditional_update`
- `create_immutable_unique`
- `cas_versioned_update`

---

## Spike order

1. Supervisor review (immutable unique decision)
2. QA review
3. Recording / submit / correction
4. RCA close/cancel vs mutation

Do not mass-rewrite all 138 sites before spikes pass.

---

## Explicit non-patterns

- Delete `select_for_update` without replacement
- Check-then-save without predicate
- Rely on application-level sleep/locks
- Invent business rules to "simplify" concurrency
