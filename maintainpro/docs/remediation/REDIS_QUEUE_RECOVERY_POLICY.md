# Redis and Queue Recovery Policy

**Phase:** 6A — policy documented  
**Selected policy:** **B — Redis is operational state; queues rebuilt/reconciled from MongoDB authoritative records**

## Decision

| Policy | Description | Selected? |
| --- | --- | --- |
| A | Recover queue state from Redis AOF/RDB backup | No |
| B | Treat Redis/Bull as ephemeral; rebuild from MongoDB SoT | **Yes** |

MaintainPro authoritative business state lives in **MongoDB** (work orders, notifications preferences, ERP outbox records, audit). Redis holds Bull queues, rate limits, and transient job payloads.

## Acceptable data loss (Policy B)

| Redis data | Acceptable loss on DR? | Rationale |
| --- | ---: | --- |
| Pending notification jobs | Yes | Re-enqueue from MongoDB notification records / business triggers |
| Delayed jobs | Yes (within replay window) | Re-schedule from domain schedules where persisted |
| In-flight job locks | Yes | Idempotent handlers must tolerate redelivery |
| Failed job metadata in Redis | Partial | Persist terminal failures to MongoDB audit where required |

## Duplicate-delivery prevention

1. Handlers must be **idempotent** (natural keys, `jobId`, or dedupe collection).
2. Email/SMS: use provider message dedupe or store `notificationSentId` on domain row before send.
3. ERP sync jobs: rely on `ReplicationOutbox` / ERP sync cursor models — not Redis alone.
4. Stock movements: already guarded by conditional updates and idempotency keys (inventory).

## Notification replay

- On startup after Redis loss: scan pending notification rows / retryable ERP sync states in MongoDB.
- Replay with capped batch size and exponential backoff — **no unbounded queue replay**.
- Mark replay source `DR_STARTUP_RECONCILE` in logs (no secrets).

## Delayed jobs

- Jobs scheduled only in Redis without MongoDB anchor may be **lost** — acceptable under Policy B.
- New delayed work must persist schedule anchor in MongoDB where business-critical (follow-up P1 if gaps found).

## Dead-letter handling (DLQ)

- Bull failed jobs: surface in admin/health; operator may retry after root-cause fix.
- `ReplicationOutbox` `DEAD_LETTER`: separate from Redis — reconcile via `db:backup:verify` / admin tools.
- DR: do not auto-replay all DLQ entries without classification.

## Startup reconciliation (required design)

On API boot after Redis empty/cold start:

1. Drain or ignore stale Redis keys.
2. Enqueue reconciliation pass for: pending notifications, stuck ERP retries (env-gated), report export jobs if persisted.
3. Expose readiness flag `queueReconciliationComplete` before marking fully ready (when configured).

## Implementation status

| Item | Status |
| --- | --- |
| Policy B documented | **Done (Phase 6A)** |
| Full startup reconciler for all queues | **P1 OPERATIONAL_BLOCKER** if not fully implemented before production DR claim |
| Bounded replay limits | Required before production |

**Do not claim complete disaster recovery** until queue reconciliation is implemented and tested. Phase 6A documents policy; full reconciler may remain P1.

## Compose note

E2E Redis uses persistent volume for stack stability; DR rehearsal treats Redis as disposable — MongoDB restore drives business correctness.
