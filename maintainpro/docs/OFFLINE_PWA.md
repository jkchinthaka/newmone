# Offline PWA

## Current architecture

- Service worker: `apps/web/public/sw.js` (shell + offline.html)
- Action queue: `apps/web/lib/offline-queue.ts` (idempotency keys, retry metadata)
- Evidence offline drafts: `apps/web/lib/work-order-evidence-offline.ts`
- Conflict classification: `apps/web/lib/offline/conflict.ts`

## Conflict classes

| Class | Examples | Behavior |
|-------|----------|----------|
| SAFE_MERGE | notes, photos | Apply without blocking |
| POTENTIAL_CONFLICT | status, meters | Warn if server newer |
| CRITICAL | completion/assignment | Require confirmation |

## Rules

- Never persist tokens/passwords in the queue
- Never silently overwrite newer server state
- Every mutating offline action requires `idempotencyKey` / `localActionId`
