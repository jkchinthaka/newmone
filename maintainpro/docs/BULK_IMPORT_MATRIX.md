# Bulk Import Matrix

Classification of every candidate MaintainPro entity for bulk master-data
import, per the authoritative backend source (`prisma/schema.prisma`,
`apps/api/src/modules/*`) audited for this feature. See
[`BULK_IMPORT_ARCHITECTURE.md`](./BULK_IMPORT_ARCHITECTURE.md) for how the
framework itself works.

## Legend

- **BULK_IMPORT_REQUIRED** — explicitly requested; wired up in V1 or clearly next.
- **BULK_IMPORT_OPTIONAL** — safe candidate, not required for V1.
- **BULK_IMPORT_NOT_APPROPRIATE** — transactional/operational data; must never get a generic bulk-create per the task's own §5 exclusion list.
- **BLOCKED** — unsafe to implement generically without further design work (documented why).

## V1 — shipped

| ENTITY | WEB_ROUTE | BACKEND_MODEL | CURRENT_CREATE_API | CURRENT_UPDATE_API | NATURAL_KEY | REQUIRED_FIELDS | PERMISSION | TENANT_SCOPE | DUPLICATE_POLICY | IMPORT_SAFE | RATIONALE |
|---|---|---|---|---|---|---|---|---|---|---|---|
| **Vehicle** | `/vehicles` | `Vehicle` | `POST /vehicles` | `PATCH /vehicles/:id` | `registrationNo` (global unique) | registrationNo, make, vehicleModel, year, type, fuelType | SUPER_ADMIN (bulk import) | Tenant-scoped record; key is global | CREATE_NEW_SKIP_EXISTING (default) / UPDATE_EXISTING | Yes | Mandatory per task; existing `CreateVehicleDto` fully audited. |
| **Asset** | `/assets` | `Asset` | `POST /assets` | `PATCH /assets/:id` | `assetTag` (global unique) | assetTag, name, category | SUPER_ADMIN (bulk import) | Tenant-scoped record; key is global | CREATE_NEW_SKIP_EXISTING (default) / UPDATE_EXISTING | Yes | Mandatory per task. A separate JSON-array `POST /assets/bulk-import` already existed (kept, unrelated — no preview/session/audit trail/history UI); this framework adds the safe file-based wizard alongside it. |
| **Department** | `/master-data/departments` | `Department` | `POST /departments` | `PATCH /departments/:id` | `(tenantId, code)` | code, name | SUPER_ADMIN (bulk import) | Tenant | CREATE_NEW_SKIP_EXISTING (default) / UPDATE_EXISTING | Yes | Clean tenant-scoped natural key; hierarchical fields (parentId/managerId) intentionally excluded from V1 bulk columns to avoid cross-row ordering issues — use the existing UI for hierarchy. |
| **Supplier** | `/master-data/suppliers` (new page — see note) | `Supplier` | `POST /suppliers` | `PATCH /suppliers/:id` | `(tenantId, vendorCode)` | vendorCode, name | SUPER_ADMIN (bulk import) | Tenant | CREATE_NEW_SKIP_EXISTING (default) / UPDATE_EXISTING | Yes | No dedicated Suppliers management page existed before this change (the Master Data grid's "Suppliers" tile pointed at `/inventory` as a placeholder, and `/procurement/vendors` is a different "vendor eligibility/compliance" concept backed by `enterprise-ops`, not the `Supplier` model). Added a minimal list page so bulk import has a real, safe home; full CRUD UI is out of scope here. |
| **Job Code** | `/maintenance/job-codes` | `JobCode` | `POST /job-codes` | `PATCH /job-codes/:id` | `(tenantId, code)` | code, name | SUPER_ADMIN (bulk import) | Tenant | CREATE_NEW_SKIP_EXISTING (default) / UPDATE_EXISTING | Yes | Clean tenant-scoped natural key; sub-job nesting (parentId) excluded from V1 bulk columns for the same ordering reason as Department. |

## Backlog — framework ready, adapter not yet wired

| ENTITY | WEB_ROUTE | BACKEND_MODEL | NATURAL_KEY | TENANT_SCOPE | IMPORT_SAFE | RATIONALE |
|---|---|---|---|---|---|---|
| **Warehouse** | none dedicated today | `Warehouse` | `(tenantId, code)` | Tenant | Yes (`BULK_IMPORT_OPTIONAL`) | Master record only; already excludes stock movements/balances. No dedicated management page exists yet, same gap as Suppliers before this change — needs a small UI home like the one built for Suppliers. |
| **Utility Meter** | `/utilities` | `UtilityMeter` | `meterNumber` (global unique) | Tenant-scoped record; key is global | Yes (`BULK_IMPORT_OPTIONAL`) | Same globally-unique-key handling as Vehicle/Asset; straightforward adapter once prioritized. |
| **Facility / Room** | `/facilities` | `Room` (part of `Property → Building → Floor → Room`) | none enforced unique today | Tenant | `BULK_IMPORT_OPTIONAL`, needs schema-level natural key first | `Room.code` is a free-text, non-unique field. A bulk importer needs a real natural key — either add a `@@unique([tenantId, floorId, code])` constraint (a schema change beyond this task's scope) or require the full `Property/Building/Floor` path per row. Flagging rather than guessing a key, per the task's explicit instruction not to invent natural keys. |
| **Part / Inventory Master** (`SparePart`) | `/inventory` | `SparePart` | `partNumber` (global unique) | Tenant-scoped record; key is global | `BULK_IMPORT_OPTIONAL` | Master fields (name, category, unit, costs, reorder points) are safe to bulk-import; **must never touch `quantityInStock`/`reservedQuantity`/`availableQuantity`** — those remain the ERP Excel Import's exclusive integrity-controlled path (`InventoryTransactionEngine`). A future adapter should explicitly omit stock fields from its create/update payload. |
| **Driver** | `/fleet` | `Driver` | `licenseNumber` (global unique) | Tenant-scoped record; key is global | `BULK_IMPORT_OPTIONAL`, needs its own design | `Driver.userId` is a required 1:1 FK to an existing `User` — a "bulk create Driver" import is really "bulk **link** an existing user as a driver," which has different semantics (matching by user email, erroring when no such user exists) than every other adapter in this framework (which create the target record outright). Worth a dedicated design pass rather than forcing it into the generic `create()` contract. |

## Explicitly excluded from generic bulk import

| ENTITY | STATUS | RATIONALE |
|---|---|---|
| **Users / People** | **BLOCKED** | Per the task's own §21: bulk-creating accounts requires a `passwordHash` or a safe invitation flow. This codebase has a real `Invitation`/`TenantInvitation` lifecycle (`modules/invitations`, `/admin/invitations`) — a safe future implementation would bulk-create **invitations** (email + role + tenant), never `User` rows with passwords. Marking BLOCKED rather than weakening security, exactly as instructed. |
| Work Orders, Gate In/Out, Trip Start/End, Fuel transactions, Stock issue/return/adjustment/transfer, PO approval, GRN/Receiving, Financial approvals, Accidents, Insurance approval, Fine payment, FG controlled records, Notifications, Audit Logs | **NOT_APPROPRIATE** | Transactional/operational records, explicitly excluded by the task brief (§5). No generic bulk-create exists or is added for any of these. |
| Inventory ERP Excel Import (`InventoryImportRun`) / Inventory Excel "yellow-highlight" import (`ErpImportBatch`) | **NOT_APPROPRIATE for replacement** | Existing specialized stock-import workflows with their own integrity engine. Preserved unchanged and untouched by this framework — see `BULK_IMPORT_ARCHITECTURE.md`. |

## Farm module

Audited `modules/farm/*` and the corresponding Prisma models (`Field`,
`Crop`, `Harvest`, `Livestock`, `Irrigation`, `SprayLog`, `Weather`,
`SoilTest`, `FarmWorker`, `FarmFinance`, `Traceability`). Most are
transactional/event-logging in shape (harvest records, spray logs, weather
readings, worker attendance) and are correctly excluded per the task's §5
transactional-data rule. Two models are genuinely master/reference-data
shaped, but **neither has an enforced unique natural key in the schema
today**:

| Entity | Backend model | Natural key today | Status |
|---|---|---|---|
| Field | `Field` (name, blockCode, areaHectares, soilType, gpsPolygon) | none (`blockCode` is optional, not `@@unique`) | `BULK_IMPORT_OPTIONAL` backlog — needs a `@@unique([tenantId, blockCode])`-style schema addition (or a documented composite key) before a safe adapter can be written. Not invented here per the task's explicit instruction not to invent Farm models or guess keys. |
| FarmWorker | `FarmWorker` (name, nic, phone, workerType) | none enforced (`nic` looks like the natural candidate but has no unique constraint) | `BULK_IMPORT_OPTIONAL` backlog — same gap as Field. |

No Farm model is wired into V1, and no new Farm model or schema constraint
is introduced by this task. If either gap above is closed with a real
schema-backed natural key in a future change, both fit this same adapter
pattern with no framework changes needed.
