# MP-004 — ERP stock sync idempotency

**Status in this batch:** PARTIALLY FIXED (source-level; no Prisma migration)

## Guarantees now (same Node process)

- Absolute target: `quantityInStock = erpQuantity` (never `+=`).
- Single snapshot per apply: either one ERP fetch, or caller-supplied `erpBalances` from dry-run (no mid-apply refetch).
- Dry-run returns full `changedRows` + `erpBalances` for consistent apply handoff.
- Per-tenant in-process mutex serializes concurrent identical applies.
- Per-row skip when already at ERP quantity (retry-safe absolute converge).
- Per-row failures → `status: "partial"` with `failedCount` / `failedPartNumbers` (never silent full success).

## Remaining gap (schema required for crash-safe durability)

Persisted `ErpStockSyncRun` with unique `(tenantId, idempotencyKey)` still required for:

1. Cross-instance concurrent apply safety  
2. Crash mid-loop resume accounting without duplicate `StockMovement` rows across processes  
3. Client idempotency keys surviving process restart  

Do **not** introduce that model on this live remediation branch without a planned additive migration.

## Out of scope

Daily ERP Excel inventory import (separate future feature).
