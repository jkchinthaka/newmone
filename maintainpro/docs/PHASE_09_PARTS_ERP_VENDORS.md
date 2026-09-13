# Phase 9 — Spare Parts, ERP, Costs, Vendors & Contracts

**Branch:** `maintainpro/phase-09-parts-erp-vendors`

## Source-of-truth rule

| Concern | Owner |
|---------|--------|
| Item master, warehouse stock, PO, GRN, financial accounting | **Bileeta** |
| WO reservations/requirements, consumption, maintenance metadata, compatible assets, cost snapshots | **MaintainPro** |

Mock ERP sync must **never** be reported as production success (`erpSyncOutcome`).

## Delivered

- `SparePartClassification`: SPARE_PART | CONSUMABLE | TOOL
- ERP code / maintenance alias / critical spare / reference stock fields
- `PartIssue` unit cost snapshot + tool return (`expectsReturn`, `quantityReturned`)
- `WorkOrderExecutionMode`: INTERNAL | EXTERNAL | MIXED
- Immutable `WorkOrderCostSnapshot` (parts + internal labour + external + transport + other = total)
- `VendorContract` (AMC/service/repair warranty) + `VendorContact`
- Contract expiry refresh (ACTIVE / EXPIRING / EXPIRED)
- Vendor assignment on WO

## API

`/maintenance-supply/work-orders/:id/cost-snapshot`  
`/maintenance-supply/work-orders/:id/execution-mode`  
`/maintenance-supply/work-orders/:id/assign-vendor`  
`/maintenance-supply/part-issues/:id/return`  
`/maintenance-supply/contracts`  
`/maintenance-supply/contracts/refresh-expiry`

## Tests

`test/maintenance-supply-phase09.spec.ts` — stock boundary, snapshot immutability, ERP mock honesty, tool return, vendor assignment, contract expiry.
