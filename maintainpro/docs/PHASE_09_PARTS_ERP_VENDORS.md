# Phase 9 — Spare Parts, ERP Mapping, Costs, Vendors & Contracts

**Canonical branch:** `maintainpro/integration-v1`  
**Baseline SHA:** `9d18b59` (Phase 8 tip on integration-v1)  
**Historical tip (reference only, not rewritten):** `1562147` on `origin/maintainpro/phase-09-parts-erp-vendors`

## Source-of-truth boundary

| Concern | Owner |
|---------|--------|
| Item master, warehouse stock, PO, GRN, financial accounting | **Bileeta** |
| WO reservations/requirements, consumption, maintenance metadata, compatible assets, cost snapshots | **MaintainPro** |

Mock ERP sync must **never** be reported as production success (`erpSyncOutcome` in `supply-boundary.ts`).

## Key decisions

- **Supplier = Vendor.** No competing `Vendor` model. `Supplier` gains `VendorContact`, `VendorContract`, and WO `vendorSupplierId`.
- **Immutable `WorkOrderCostSnapshot`.** First write wins; later live unit costs must not rewrite historical WO totals.
- **Contract → ComplianceRequirement bridge.** Creating a `VendorContract` also creates a Phase 8 `ComplianceRequirement` (`typeKey` AMC | SERVICE_AGREEMENT | REPAIR_WARRANTY, `subjectType` SUPPLIER). `VendorContract.complianceRequirementId` stores the link; `refreshContractStatuses` updates both contract status and linked compliance status.
- Stock mutations for tool returns go through `InventoryTransactionEngine.returnStock` when the engine is injected (idempotency key `part-return:{issueId}:{qtyReturned}`).

## Schema (Phase 9)

- `SparePartClassification`: SPARE_PART | CONSUMABLE | TOOL
- SparePart: classification, erpCode, maintenanceAlias, maintenanceCategory, criticalSpare, referenceStock
- Warehouse: erpWarehouseCode, lastErpValidatedAt
- WorkOrder: executionMode (INTERNAL | EXTERNAL | MIXED), vendorSupplierId, costSnapshot
- PartIssue: unitCostSnapshot, expectsReturn, quantityReturned, return fields, erpIssueReference, warehouseId
- `WorkOrderCostSnapshot`, `VendorContact`, `VendorContract`, `RepairWarranty`
- PartCompatibility: optional `assetTypeMasterId`

## API (`/maintenance-supply`)

- `GET parts` — mapping status list
- `GET outstanding-tools`
- `GET work-orders/:id/cost`
- `POST work-orders/:id/cost-snapshot` / `.../cost-snapshot/auto`
- `PUT work-orders/:id/execution-mode`
- `POST work-orders/:id/assign-vendor` (optional ApprovalsService gate: VENDOR_REPAIR / BEFORE_ASSIGN_VENDOR)
- `POST part-issues/:id/return`
- `POST contracts` / `POST contracts/refresh-expiry`
- `POST map-erp-item` / `POST map-warehouse`

Permissions: `parts.view`, `parts.issue`, `parts.return`, `erp.mapping.manage`, `vendor.manage`, `contract.manage`, `cost.view`, `cost.adjust` (aliases to `inventory.manage` / `work_orders.manage`).

## Web

- `/maintenance-supply` — spare parts ERP mapping list + outstanding tool cards
- Nav secondary item “Supply & ERP Map” under parts roles

## Inventory / ERP model disposition

| Model / area | Disposition |
|--------------|-------------|
| SparePart, Warehouse, WarehouseItemBalance, StockMovement, InventoryIdempotency | **REUSE** (reference stock only; Bileeta remains official) |
| PartRequest, PartIssue, PartRequestApproval, WorkOrderPart | **REUSE** + **REFACTOR** (classification, unitCostSnapshot, tool return fields) |
| Supplier | **REUSE** as Vendor (no competing Vendor model) |
| PurchaseOrder / PurchaseReceipt | **KEEP SEPARATE** (ERP/purchasing truth) |
| Existing ERP sync / import modules | **REUSE** + **BRIDGE** via erpCode / erpWarehouseCode mapping |
| Historical Phase 9 `maintenance-supply` | **PORT WITH CHANGES** (boundary + cost + contracts onto Phase 3–8 models) |
| Parallel Vendor / competing stock ledgers | **DISCARD / REPLACE** |

## Historical Phase 9 comparison (`1562147`)

- **Reused clean:** supply-boundary SoT concept; mock ≠ production success.
- **Ported with changes:** classification, executionMode, cost snapshot, tool return, VendorContract→ComplianceRequirement, Supplier-as-vendor assign with Phase 7 approval.
- **Discarded:** notes-only vendor assign; any parallel official stock/purchase truth; wholesale historical schema duplicates of Phase 3–8.

## Tests

`apps/api/test/maintenance-supply-phase09.spec.ts` — 31 cases covering boundary, mock honesty, ERP unavailable, classifications, execution modes, RBAC catalog keys, immutable snapshot, master-cost isolation, consumption math, labour/external totals, issue/return/over-return, return idempotency key, consumable non-return, vendor assign, INTERNAL/MIXED modes, approval gate, contract+compliance, ERP/warehouse mapping + duplicate block, reconciliation flags, outstanding tools, tenant isolation, warranty/compatibility smoke.
