# MP-005 — Notification enqueue duplicate-delivery notes

**Status:** FIXED for production create→EMAIL/SMS/PUSH/IN_APP paths that always pass `notificationId`.

## Guarantees

- Job identity: `notification:{notificationId}:{channel}` (per-channel; avoids collapsing EMAIL+SMS).
- Ambiguous `queue.add` (timeout/network): **no** direct-send fallback; throws `ServiceUnavailableException`.
- Duplicate Bull `jobId`: treat as already enqueued; no second send.
- Definitive enqueue failure / queue marked non-operational: direct fallback (intentional availability).
- `markRead` / `markAllRead` no longer enqueue ad-hoc jobs without ids (gateway already emits).

## Remaining risk (not blocking for durable notificationId paths)

- Bull worker retries after a provider send that succeeded but returned ambiguously can still double-deliver at the SMTP/SMS provider unless the provider supports idempotency keys (not in schema today).
- Multi-instance: queue jobId uniqueness is Redis/Bull-scoped (OK); direct fallback when queue is marked down is process-local health state.
