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
- Existing `erp-sync-provider.service.spec.ts` for PO provider safety
