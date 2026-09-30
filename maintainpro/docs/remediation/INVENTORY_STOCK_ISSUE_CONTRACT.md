# Inventory Stock Issue Contract (Phase 5A)

**Document type:** Stock-out API / E2E contract.  
**Success status:** HTTP **200** (`@HttpCode(HttpStatus.OK)` on `POST /inventory/parts/:id/stock-out`).

## Field contract

| Field | Required | Source | Validation |
| --- | ---: | --- | --- |
| `partId` | path | selected inventory item | tenant-scoped; missing → 404 |
| `quantity` | yes | operator | positive number; excess → **400** |
| `workOrderId` | yes | selected work order | same tenant; missing → **400**; cross-tenant → **400** |
| `notes` | optional | operator | safe text (not renamed from/to `reason`) |
| `overrideReason` | conditional | authorized override | required when WO is COMPLETED/CANCELLED; audited |
| `idempotencyKey` | optional | client / `Idempotency-Key` header | tenant-scoped unique; replay returns the current part without a second consumption record |

## Work-order linkage

Every normal stock-out must:

1. Require non-empty `workOrderId`.
2. Resolve WO in the actor’s tenant.
3. Resolve part in the actor’s tenant.
4. Block closed WO without `overrideReason`.
5. Reject non-positive quantity.
6. Do not change `SparePart.quantityInStock`. Bileeta owns that quantity. The value is an ERP snapshot.
7. Create a `PENDING` `DomainEventOutbox` row (`WORK_ORDER_PART_CONSUMPTION`) with the work order, part, quantity, and cost snapshot. Do not create a stock movement that lowers the mirror.
8. Reject cross-tenant part/WO combinations (part 404/403; WO 400).
9. Record audit metadata with `quantityInStockMutated: false` (no credentials).

## HTTP status table

| Case | Status |
| --- | --- |
| Inventory list / detail / movements / low-stock (authorized) | 200 |
| Work-order create | 201 |
| Stock-out success / idempotent replay | **200** |
| Missing `workOrderId` / invalid WO | **400** |
| Missing permission / role | **403** |
| Missing authentication | **401** |
| Missing CSRF (BFF) | **403** `CSRF_INVALID` |
| Cross-tenant part | **403** or **404** (existing NotFound policy) |

Do not treat 400/422 as success. Do not use `status < 500` as an authorization assertion.

## Idempotency policy

- Model: `InventoryStockIssueIdempotency` with `@@unique([tenantId, key])`.
- Same tenant + key + same payload → return current part (no second consumption event from a replay that already stored the key).
- Same key + different payload → **400**.
- Keys are tenant-scoped (not global).
- Concurrent first-writer wins (`P2002` → treat as replay).
- Clients without a key remain non-idempotent (compatibility); E2E and UI should supply a key for issue flows.
- Records store part/WO/qty/movement refs only — no credentials.

## Atomicity / reconciliation

- Stock-out does not decrement `quantityInStock`. A later ERP Excel snapshot import is what updates the mirror.
- Historical stock movements already stored are left as they are. This change does not rewrite them.
- Failure paths must not write a stock movement that changes the mirror.

## E2E work-order strategy

Preferred: manager BrowserContext creates a Tenant A WO via BFF; capture `workOrderId` in memory; inventory keeper issues against it. No hardcoded ObjectIds; no direct Mongo from Playwright.

## Work-order part requests

`POST /inventory/parts/:id/stock-out` records maintenance consumption for a work order. It does not decrement `SparePart.quantityInStock`. `POST /inventory/parts/:id/stock-in`, purchase receipt, local adjustment, transfer, movement reversal, stock-count post, tool return, and the transaction-style Excel apply also do not change that quantity. The approved writers are ERP stock sync apply and ERP Excel snapshot import.

The approved work-order path (`issuePartRequest`) does not call that decrement. Bileeta owns `SparePart.quantityInStock`. The work-order path records usage, the cost snapshot, and a pending ERP event. A pending or failed event stays visible and is not treated as a successful ERP post.

## Compatibility

- Field name remains `notes` (not forced rename to `reason`).
- Web stock-out dialog requires `workOrderId`.
- Optional `idempotencyKey` in body or `Idempotency-Key` header.
