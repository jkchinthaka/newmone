# Mobile V2 — Inventory Mutation Safety Audit

Audit date: current `feature/mobile-v2` head. Mobile remains **read-first** until every required property is proven for each operation.

## Legend

| MOBILE_SAFE | Meaning |
|-------------|---------|
| **NO** | Do not implement on mobile yet |
| **PARTIAL** | Server has partial guards; mobile still blocked pending end-to-end proof |
| **YES** | Ready for guarded online-only mobile (not claimed yet) |

## Operations

### Stock issue (WO / inventory engine)

| Field | Finding |
|-------|---------|
| ENDPOINT | `POST /work-orders/:id/part-requests/:requestId/issue`, inventory stock engine `issue()` |
| PERMISSION | `part_requests.issue`, `inventory.stock_issue` |
| TENANT_SCOPE | Yes — tenant on stock engine + WO scope |
| ATOMICITY | Yes — transactional stock engine |
| IDEMPOTENCY | **Partial** — `InventoryStockIssueIdempotency` when client supplies `idempotencyKey` |
| CONCURRENCY | Engine authoritative balance; race tests not yet run for mobile contract |
| AUDIT | Yes — engine + WO audit paths |
| MOBILE_SAFE | **NO** — mobile client idempotency/retry contract not wired; offline queue forbidden |

### Stock return / adjustment / transfer

| Field | Finding |
|-------|---------|
| ENDPOINT | Inventory engine mutations (see `inventory.service.ts`) |
| IDEMPOTENCY | Optional keys on some paths — not uniform |
| MOBILE_SAFE | **NO** |

### WO part issue/return (line-level)

| Field | Finding |
|-------|---------|
| ENDPOINT | WO parts PATCH/POST routes |
| PERMISSION | `inventory.stock_issue` |
| MOBILE_SAFE | **NO** — same as stock issue |

### PO approval / reject

| Field | Finding |
|-------|---------|
| ENDPOINT | PO workflow in inventory/procurement modules |
| IDEMPOTENCY | Not proven for mobile replay |
| MOBILE_SAFE | **NO** |

### Receiving / GRN

| Field | Finding |
|-------|---------|
| ENDPOINT | Receipt create in `inventory.service.ts` |
| IDEMPOTENCY | **Yes** — `PurchaseReceiptIdempotency` when key provided |
| PO status / quantity validation | Server-side in receipt flow |
| MOBILE_SAFE | **NO** — integrity gap documented; mobile blocked |

### ERP apply/retry

| Field | Finding |
|-------|---------|
| ENDPOINT | `/inventory/erp-import` apply paths |
| MOBILE_SAFE | **NO** — financial side effects |

## Concurrency scenario (required before mobile stock mutation)

```
Device A reads balance 10 (server)
Device B issues 8 (server accepts → balance 2)
Device A requests issue 5
Expected: server rejects or reconciles to available 2
```

**Status:** Not validated in automated mobile gate yet.

## Decision

**INVENTORY_MUTATION_STATUS=BLOCKED** — read slice remains `COMPLETE_FOR_SAFE_READ`.
