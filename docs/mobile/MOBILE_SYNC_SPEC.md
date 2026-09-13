# MaintainPro Mobile V2 — Sync Spec

**Base SHA:** `2fd697e004da8524b6348c1ad2d33411a873a2a8`

## Principles

1. No full DB replication — cache operational working sets only.
2. Confirmed user drafts must survive app kill, reboot, and token expiry.
3. Retries must not duplicate critical transactions (prefer `Idempotency-Key`).
4. Server timestamps are authoritative (Asia/Colombo business day for FG).
5. Never silently wipe outbox on logout; require explicit discard or sync-first.

## Outbox schema (Drift)

| Field | Notes |
|---|---|
| operationId | UUID client-generated |
| tenantId / userId | Isolation keys |
| entityType / entityId | e.g. `WorkOrder`, id |
| operation | e.g. `NOTE_DRAFT`, `STATUS_UPDATE`, `EVIDENCE_UPLOAD` |
| payloadJson | Encrypted-at-rest strategy TBD; vault isolation by user |
| payloadHash | Detect duplicate enqueue |
| idempotencyKey | Sent when backend supports |
| state | LOCAL_DRAFT \| QUEUED \| SYNCING \| SYNCED \| CONFLICT \| FAILED_RETRYABLE \| FAILED_PERMANENT |
| attempts / lastError / createdAt | Retry bookkeeping |

## Offline allowed (initial)

- WO notes / inspection draft fields
- FG CL18/24/30 form drafts
- Accident / facility issue drafts
- Photo queue (compress → upload → confirm → delete temp)
- Readings / free-text notes

## Online required (initial)

- Critical WO status transitions needing server validation
- Inventory issue / reserve / return (stock accuracy)
- Gate In / Out / override
- Supervisor approval / QA verification
- Destructive admin actions

## Conflict handling

On `409` / version mismatch: mark `CONFLICT`, show conflict UI, never silent overwrite. Domains: Work Orders, Inventory, Vehicles, FG, Gate.

## Idempotency (API reality)

- CORS already allows `Idempotency-Key`
- **Implemented today mainly on inventory** stock-out / transfers / adjustments
- **Gap:** work-orders HTTP mutations lack generic Idempotency-Key middleware  
  → Documented as API gap; client still sends key where safe; do not claim client-only dedupe is sufficient for critical records

## Connectivity lifecycle

- Offline → queue
- Online → drain FIFO per tenant/user with backoff
- App resume → invalidate stale cache, refresh session, reconnect Socket.IO only while foreground

## Media pipeline

Capture → validate → resize/compress → EXIF policy → local queue → upload → server ack → associate entity → delete temp only after success.

## Sync Center UX

Surfaces counts by state, last error, retry/cancel permanent failures (with confirmation), never auto-drop `QUEUED`/`SYNCING` drafts.
