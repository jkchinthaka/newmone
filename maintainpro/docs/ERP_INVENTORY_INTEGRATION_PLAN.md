# ERP Inventory Integration Plan (Bileeta Foundation)

## Scope

Foundation-only sprint deliverable. No live ERP HTTP calls, no credentials, no posting/sync side effects.

## Adapter

`InventoryErpAdapter` (`apps/api/src/modules/inventory/inventory-erp-adapter.service.ts`)

Methods (disabled/no-op by default):

| Method | Purpose |
|---|---|
| `getStockBalance(partSku)` | Read on-hand quantity for a part/item |
| `syncPartCatalog()` | Import/update spare part catalog |
| `syncPurchaseOrderStatus(poNumber)` | Pull PO status updates |
| `syncWorkOrderPartRequest(requestId)` | Push/pull WO part request state |

All methods return honest `ok: false` with explanatory messages until live adapter implementation is approved.

## Configuration / readiness

| Variable | Notes |
|---|---|
| `ERP_MODE` | `disabled`, `mock`, `live` |
| `ERP_BASE_URL` | Preferred base URL alias (foundation) |
| `ERP_API_URL` | Existing legacy/live endpoint URL |
| `ERP_API_KEY` | Credential presence check only — no values in repo |
| `ALLOW_MOCK_IN_PRODUCTION` | Required for mock ERP in production |

Readiness states mirror notification foundation:

- `disabled`
- `not_configured`
- `misconfigured`
- `configured`

Surfaces:

- `InventoryErpAdapterService.describeReadiness()`
- `/api/health/readiness` → `operationalFoundations.inventoryErp`

Production mock safety from SEC-013 remains intact.

## Mapping documentation (planned live sync)

### Part / item mapping

| MaintainPro | Bileeta (TBD with customer API spec) |
|---|---|
| `SparePart.partNumber` | Item code / SKU |
| `SparePart.name` | Item description |
| `SparePart.unit` | UOM |
| `SparePart.category` | Item group |

### Stock balance mapping

| MaintainPro | Bileeta |
|---|---|
| `SparePart.quantityOnHand` | Warehouse balance qty |
| `SparePart.reorderLevel` | Reorder/min stock (if provided) |
| Tenant / warehouse code | Bileeta warehouse/location code |

### Purchase order mapping

| MaintainPro | Bileeta |
|---|---|
| `PurchaseOrder.poNumber` | ERP PO reference |
| `PurchaseOrder.status` | ERP PO status |
| `PurchaseOrder.totalAmount` | ERP PO total |
| Line items (`PurchaseOrderLine`) | ERP PO lines |

Existing PO sync path: `ErpSyncProviderService.syncPurchaseOrder()` (separate PO posting integration).

### Work order part request mapping

| MaintainPro | Bileeta |
|---|---|
| `PartRequest.id` | ERP material request id |
| `PartRequest.status` | ERP issue/approval status |
| `WorkOrder.woNumber` | ERP maintenance order ref |
| Requested part/qty | ERP component demand |

## Sync direction (target architecture)

| Flow | Direction | Notes |
|---|---|---|
| Part catalog | ERP → MaintainPro | Scheduled + manual reconcile |
| Stock balance | ERP → MaintainPro | Read-only in phase 1 |
| PO status | ERP → MaintainPro | Poll/webhook when API confirmed |
| WO part request | MaintainPro → ERP | Requires approval + idempotency keys |

## Error handling (live phase requirements)

- Timeout using `ERP_TIMEOUT_MS`
- No silent success — surface provider HTTP status/body summary
- Retry with backoff for transient failures
- Dead-letter + operator alert for repeated sync failures
- Tenant-scoped audit log entries for each sync attempt

## Required Bileeta API details (customer approval needed)

- Base URL and auth scheme
- Item catalog endpoint + pagination
- Stock balance endpoint (warehouse filters)
- PO status endpoint
- Material request create/update endpoints
- Rate limits and sandbox credentials process

## Approval checklist

1. Confirm Bileeta API contract and sandbox access process
2. Map warehouse/tenant codes with operations team
3. Decide sync cadence (real-time vs scheduled)
4. UAT with read-only stock sync in staging
5. Enable `ERP_MODE=live` only after credentials stored in secret manager
6. Keep mock/disabled modes for disaster rollback

## Tests

- `apps/api/test/erp-inventory-adapter.spec.ts`
- `apps/api/test/erp-stock-sync.spec.ts`
- `apps/api/test/erp-stock-mapping.spec.ts`
- Existing `erp-sync-provider.service.spec.ts` for PO provider safety

---

## ERP-002 — Bileeta read-only stock sync (implemented)

### Adapter

`BileetaInventoryErpAdapter` (`apps/api/src/modules/inventory/bileeta-inventory-erp.adapter.ts`)

| Method | Purpose |
|---|---|
| `checkReadiness()` | Reports mode, missing keys, read/apply flags |
| `fetchStockBalances()` | Read-only GET to Bileeta stock endpoint (or mock balances) |

No ERP write/post/update methods exist in this adapter.

### Service

`ErpStockSyncService` (`erp-stock-sync.service.ts`)

| Method | Purpose |
|---|---|
| `getReadiness()` | Pass-through readiness |
| `dryRunStockSync()` | Fetch ERP balances + compare with tenant parts (default) |
| `applyStockSnapshot()` | Local-only stock update when apply flag enabled |

### API endpoints

| Endpoint | RBAC | Notes |
|---|---|---|
| `GET /inventory/erp/readiness` | `inventory.manage` + inventory roles | No secrets returned |
| `POST /inventory/erp/stock-sync/dry-run` | same | Default safe path |
| `POST /inventory/erp/stock-sync/apply` | ADMIN/SUPER_ADMIN/INVENTORY_KEEPER/ASSET_MANAGER | Blocked unless `ERP_STOCK_SYNC_APPLY_ENABLED=true` |

### Configuration / safety

| Variable | Default | Notes |
|---|---|---|
| `ERP_MODE` | `mock` | `disabled`, `mock`, `sandbox`, `live` |
| `ERP_READ_ONLY_SYNC_ENABLED` | `false` | Must be `true` before real/sandbox ERP read |
| `ERP_STOCK_SYNC_APPLY_ENABLED` | `false` | Must be `true` before local stock apply |
| `ERP_BASE_URL` | empty | Preferred base URL for stock GET |
| `ERP_API_KEY` | empty | Bearer/API key (secret manager only) |
| `ERP_STOCK_ENDPOINT` | empty | Approved Bileeta stock balance path |
| `ERP_WAREHOUSE_CODE` | optional | Query param when supported |
| `ERP_TENANT_CODE` | optional | Query param when supported |
| `ERP_TIMEOUT_MS` | `15000` | Read timeout |

Rules:

- Dry-run is default; no local mutation in dry-run.
- Apply updates `SparePart.quantityInStock` only and writes `StockMovement` type `ADJUSTMENT` with reference `erp-stock-sync`.
- No automatic scheduled sync in this task.
- No part creation/deletion from ERP rows.

### Item / stock mapping (deterministic)

| MaintainPro | Bileeta JSON field (expected) |
|---|---|
| `SparePart.partNumber` | `itemCode` / `partSku` / `partNumber` / `sku` |
| `SparePart.quantityInStock` | `quantityOnHand` / `quantity` / `qty` / `onHand` |
| Warehouse filter | `ERP_WAREHOUSE_CODE` → `warehouse` query param |

Matching is by normalized item code only (uppercase trim). Name-only matching is not used.

### Bileeta stock balance contract (pending customer approval)

Expected read-only GET response shape:

```json
{
  "items": [
    { "itemCode": "BRG-001", "quantityOnHand": 12, "warehouseCode": "MAIN" }
  ]
}
```

Confirm with Bileeta:

- Exact endpoint path (`ERP_STOCK_ENDPOINT`)
- Auth header scheme (`ERP_AUTH_HEADER`, default Bearer)
- Pagination/filter parameters
- Sandbox vs live base URLs
- Rate limits and error payload format

### UI

- `/system-health` → Inventory ERP Sync card (readiness + dry-run summary; no secrets; no apply button)
