# Mobile V2 — Inventory / Procurement

## Source contracts

| Surface | Nest | Permission / role |
|---------|------|-------------------|
| Parts list/detail | `GET /api/inventory/parts`, `GET /api/inventory/parts/:id` | `inventory.manage` + read roles |
| Low stock | `GET /api/inventory/low-stock` | `inventory.manage` |
| Warehouses | `GET /api/inventory/warehouses` | `inventory.manage` |
| Movements | `GET /api/inventory/parts/:id/movements` | `inventory.manage` |
| Dashboard KPIs | `GET /api/inventory/dashboard` | `inventory.manage` |
| Suppliers | `GET /api/suppliers`, `GET /api/suppliers/:id` | Role-only (keeper/manager/supervisor…) |
| Purchase orders | `GET /api/inventory/purchase-orders`, `/:id` | `purchase_orders.view` |
| ERP platform | `GET /api/erp/status` | `erp.view` |
| Inventory ERP readiness | `GET /api/inventory/erp/readiness` | `inventory.manage` |

**Global part requests:** `GET /api/work-orders/part-requests` (`part_requests.view`, tenant-scoped, paginated).

**Warehouse item balances:** `GET /api/inventory/warehouse-balances` (`inventory.manage`, tenant-scoped, paginated; part + warehouse projection).

Per-WO requests remain at `GET /work-orders/:id/part-requests`.

## Mobile routes

- `/inventory` hub
- `/inventory/parts`, `/inventory/parts/:id`
- `/inventory/low-stock`
- `/inventory/warehouses`
- `/inventory/suppliers`, `/inventory/suppliers/:id`
- `/inventory/purchase-orders`, `/inventory/purchase-orders/:id`
- `/inventory/part-requests`
- `/inventory/warehouse-balances`
- `/inventory/erp`

## Read vs blocked mutations

| Operation | Mobile V2 |
|-----------|-----------|
| Parts browse/search/detail | READ |
| Low stock / warehouses / dashboard | READ |
| Suppliers browse | READ |
| PO list/detail/approval status display | READ |
| ERP status/readiness | READ |
| Stock issue/return/adjust/transfer | **BLOCKED** (online desktop; server idempotency required) |
| PO approve/reject | **BLOCKED** (workflow + audit; desktop) |
| GRN receiving | **BLOCKED** (`PurchaseReceiptIdempotency` — no mobile workaround) |
| ERP apply/retry | **BLOCKED** |

## Stock authority

Flutter displays `quantityInStock`, `availableQuantity`, and low/out flags from Nest responses only. Client does not decrement stock locally.

## Offline policy

- **Cache OK (future):** parts list snapshot, suppliers, PO summaries.
- **Online required:** all stock/financial mutations, approvals, receiving, ERP apply.

## Idempotency (server)

- `InventoryIdempotency` — engine ops when key provided
- `InventoryStockIssueIdempotency` — stock-out
- `PurchaseReceiptIdempotency` — GRN create

Mobile does not enqueue stock mutations offline.
