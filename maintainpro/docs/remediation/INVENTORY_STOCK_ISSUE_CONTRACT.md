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
| `idempotencyKey` | optional | client / `Idempotency-Key` header | tenant-scoped unique; replay returns same success without second deduction |

## Work-order linkage

Every normal stock-out must:

1. Require non-empty `workOrderId`.
2. Resolve WO in the actor’s tenant.
3. Resolve part in the actor’s tenant.
4. Block closed WO without `overrideReason`.
5. Reject non-positive quantity.
6. Atomically decrement only when `quantityInStock >= quantity` (`updateMany` conditional).
7. Create a stock movement with tenant, part, WO, actor, quantity, notes/reference.
8. Reject cross-tenant part/WO combinations (part 404/403; WO 400).
9. Record audit metadata (no credentials).

## HTTP status table

| Case | Status |
| --- | --- |
| Inventory list / detail / movements / low-stock (authorized) | 200 |
| Work-order create | 201 |
| Stock-out success / idempotent replay | **200** |
| Missing `workOrderId` / invalid WO / negative stock | **400** |
| Missing permission / role | **403** |
| Missing authentication | **401** |
| Missing CSRF (BFF) | **403** `CSRF_INVALID` |
| Cross-tenant part | **403** or **404** (existing NotFound policy) |

Do not treat 400/422 as success. Do not use `status < 500` as an authorization assertion.

## Idempotency policy

- Model: `InventoryStockIssueIdempotency` with `@@unique([tenantId, key])`.
- Same tenant + key + same payload → return current part (no second deduction).
- Same key + different payload → **400**.
- Keys are tenant-scoped (not global).
- Concurrent first-writer wins (`P2002` → treat as replay).
- Clients without a key remain non-idempotent (compatibility); E2E and UI should supply a key for issue flows.
- Records store part/WO/qty/movement refs only — no credentials.

## Atomicity / reconciliation

- Conditional `quantityInStock: { gte: quantity }` + decrement inside `$transaction` with movement (+ optional idempotency row).
- Opening − OUT + IN movements must equal current quantity for the E2E part after controlled issues.
- Failure paths must not leave orphan movements without deduction (transactional).

## E2E work-order strategy

Preferred: manager BrowserContext creates a Tenant A WO via BFF; capture `workOrderId` in memory; inventory keeper issues against it. No hardcoded ObjectIds; no direct Mongo from Playwright.

## Compatibility

- Field name remains `notes` (not forced rename to `reason`).
- Web stock-out dialog requires `workOrderId`.
- Optional `idempotencyKey` in body or `Idempotency-Key` header.
