# Go-Live Master Data Load Order — REAL Endpoints Only

**Source of truth:** Actual controller routes, bulk-import adapters, and admin screens in the codebase.  
**Rule:** Only entities with real import endpoints or admin create forms are listed. Others = manual / not supported.  
**CSV columns:** Taken directly from adapter `TEMPLATE_COLUMNS` or admin form fields.  
**Sri Lankan context:** Phone +94, plates CP-ABC-1234 / WP-XXX-XXXX, currency LKR, tax 18%.

---

## 1. Assets — Bulk Import ✅ (Real endpoint)

**Endpoint:** `POST /api/backend/bulk-import/asset/preview` → `POST /api/backend/bulk-import/asset/:importId/commit`  
**UI:** Admin → Bulk Imports → Entity: Asset  
**Adapter:** `AssetBulkImportAdapter` (`apps/api/src/modules/bulk-import/adapters/asset.adapter.ts`)  
**Natural key:** `assetTag` (tenant-scoped unique)

| Column | Required | Type | Notes |
|--------|----------|------|-------|
| assetTag | ✓ | string | UPPERCASE, format: `AST-XXXX` (validated by `isValidAssetTag`) |
| name | ✓ | string | Display name |
| category | ✓ | enum | One of: `MACHINERY`, `EQUIPMENT`, `VEHICLE`, `TOOL`, `INFRASTRUCTURE`, `FACILITY`, `OTHER` |
| condition | | enum | One of: `NEW`, `GOOD`, `FAIR`, `POOR`, `SCRAP` (default `GOOD`) |
| manufacturer | | string | e.g., "Cummins" |
| model | | string | e.g., "C150D5" |
| serialNumber | | string | e.g., "SN-88421" |
| location | | string | Free text location hint |
| supplier | | string | Free text supplier name |
| ownerName | | string | Optional |
| description | | string | Optional |

**CSV Example (Sri Lankan):**
```csv
assetTag,name,category,condition,manufacturer,model,serialNumber,location,supplier,ownerName,description
AST-1001,Backup Generator Colombo,MACHINERY,GOOD,Cummins,C150D5,SN-88421,Colombo Power House,Lanka Power (Pvt) Ltd,Engineering Dept,Primary backup for data center
AST-1002,Chiller Unit Kandy,HVAC,GOOD,Carrier,30XA,SN-KDY-001,Kandy Hospital Cooling Plant,CoolAir Lanka,Facilities,Chiller for OT block
```

---

## 2. Vehicles — Bulk Import ✅ (Real endpoint)

**Endpoint:** `POST /api/backend/bulk-import/vehicle/preview` → `POST /api/backend/bulk-import/vehicle/:importId/commit`  
**UI:** Admin → Bulk Imports → Entity: Vehicle  
**Adapter:** `VehicleBulkImportAdapter`  
**Natural key:** `registrationNo` (global unique — NOT tenant-scoped)

| Column | Required | Type | Notes |
|--------|----------|------|-------|
| registrationNo | ✓ | string | Sri Lankan format: `WP-CAB-1234` or `CP-ABC-1234` |
| make | ✓ | string | e.g., "Toyota", "Mitsubishi" |
| vehicleModel | ✓ | string | e.g., "Hilux", "Canter" |
| year | ✓ | int | 1990–2100 |
| type | ✓ | enum | One of: `CAR`, `VAN`, `TRUCK`, `BUS`, `MOTORCYCLE`, `TRACTOR`, `TRAILER`, `OTHER` |
| fuelType | ✓ | enum | One of: `PETROL`, `DIESEL`, `HYBRID`, `ELECTRIC`, `CNG`, `LPG` |
| ownershipType | | enum | One of: `OWNED`, `LEASED`, `RENTED`, `THIRD_PARTY` (default `OWNED`) |
| assetTag | | string | Optional link to Asset.assetTag |
| currentMileage | | number | Default 0 |
| location | | string | e.g., "Colombo Depot" |
| costCenter | | string | e.g., "CC-100" |
| vendorName | | string | e.g., "ABC Motors" |
| description | | string | Optional |

**CSV Example (Sri Lankan):**
```csv
registrationNo,make,vehicleModel,year,type,fuelType,ownershipType,assetTag,currentMileage,location,costCenter,vendorName,description
WP-NA-1234,Toyota,Hilux,2023,TRUCK,DIESEL,OWNED,AST-2001,15000,Colombo Depot,CC-100,Toyota Lanka,Site transport
CP-LM-5678,Mitsubishi,Canter,2022,TRUCK,DIESEL,LEASED,AST-2002,22000,Kandy Depot,CC-200,Mitsubishi Motors Lanka,Material delivery
```

---

## 3. Departments — Bulk Import ✅ (Real endpoint)

**Endpoint:** `POST /api/backend/bulk-import/department/preview` → `POST /api/backend/bulk-import/department/:importId/commit`  
**UI:** Admin → Bulk Imports → Entity: Department  
**Adapter:** `DepartmentBulkImportAdapter`  
**Natural key:** `code` (tenant-scoped unique, uppercased)

| Column | Required | Type | Notes |
|--------|----------|------|-------|
| code | ✓ | string | Uppercased, e.g., `MAINT`, `IT`, `HR` |
| name | ✓ | string | Display name |
| description | | string | Optional |

**CSV Example:**
```csv
code,name,description
MAINT,Maintenance,Maintenance operations
IT,Information Technology,IT systems and support
HR,Human Resources,People operations
```

---

## 4. Suppliers — Bulk Import ✅ (Real endpoint)

**Endpoint:** `POST /api/backend/bulk-import/supplier/preview` → `POST /api/backend/bulk-import/supplier/:importId/commit`  
**UI:** Admin → Bulk Imports → Entity: Supplier  
**Adapter:** `SupplierBulkImportAdapter`  
**Natural key:** `vendorCode` (tenant-scoped unique)

| Column | Required | Type | Notes |
|--------|----------|------|-------|
| vendorCode | ✓ | string | e.g., `SUP-001`, `SUP-LUB-01` |
| name | ✓ | string | e.g., "ABC Suppliers (Pvt) Ltd" |
| contactName | | string | e.g., "Jane Silva" |
| email | | string | Valid email format validated |
| phone | | string | Sri Lankan: `+94 11 234 5678` or `+94 77 123 4567` |
| address | | string | Optional |
| website | | string | Optional |
| taxNumber | | string | Optional (SVAT/VAT number) |

**CSV Example (Sri Lankan):**
```csv
vendorCode,name,contactName,email,phone,address,website,taxNumber
SUP-001,ABC Suppliers (Pvt) Ltd,Jane Silva,sales@abcsuppliers.lk,+94 11 234 5678,123 Galle Road Colombo 03,,123456789-7000
SUP-002,Lanka Lubricants (Pvt) Ltd,Priyantha Perera,orders@lankalubricants.lk,+94 77 123 4567,456 Kandy Road Colombo 05,www.lankalubricants.lk,987654321-7000
```

---

## 5. Job Codes — Bulk Import ✅ (Real endpoint)

**Endpoint:** `POST /api/backend/bulk-import/job-code/preview` → `POST /api/backend/bulk-import/job-code/:importId/commit`  
**UI:** Admin → Bulk Imports → Entity: Job Code  
**Adapter:** `JobCodeBulkImportAdapter`  
**Natural key:** `code` (tenant-scoped unique)

| Column | Required | Type | Notes |
|--------|----------|------|-------|
| code | ✓ | string | e.g., `JC-100`, `PM-ENG-001` |
| name | ✓ | string | e.g., "Engine Oil Change" |
| category | | string | Free text category |
| estimatedHours | | number | Decimal hours, e.g., `1.5` |
| description | | string | Optional |

**CSV Example:**
```csv
code,name,category,estimatedHours,description
JC-100,Engine Oil Change,Preventive Maintenance,1.5,Standard oil and filter change
JC-101,Cooling System Flush,Preventive Maintenance,2.0,Full flush and refill
JC-200,Breakdown Response,Corrective,0,Initial diagnosis only
```

---

## 6. Spare Parts — Inventory Excel Import ✅ (Real endpoint, separate from bulk-import)

**Endpoint:** `POST /api/backend/inventory/imports/preview` → `POST /api/backend/inventory/imports/:id/apply`  
**UI:** Inventory → Import (UI at `app/(dashboard)/inventory/import`)  
**Service:** `InventoryExcelImportService` (`apps/api/src/modules/inventory/inventory-excel-import.service.ts`)  
**Note:** This is ERP stock balances import — maps ERP item codes to local parts. NOT a generic spare part master creator.

**Create single part:** `POST /api/backend/inventory/parts` (admin form at Inventory → Parts → New)  
**Fields from `CreatePartDto` (in `inventory.controller.ts:113`):**
- partNumber (required, string, tenant-unique)
- name (required, string)
- category (required, string, free text)
- unitCost (required, number)
- unit (optional, string, default "pcs")
- minimumStock (optional, int)
- reorderPoint (optional, int)
- quantityInStock (optional, int, cached from ERP)
- location (optional, string, bin/shelf hint)
- supplierId (optional, UUID)

**UI create form:** Inventory page → "New Part" button (no CSV import for master data)

---

## 7. Asset Tags — Dedicated Import ✅ (Real endpoint)

**Endpoint:** `POST /api/backend/admin/asset-tags/preview` → `POST /api/backend/admin/asset-tags/apply`  
**UI:** Admin → Asset Tags (`app/(dashboard)/admin/asset-tags/page.tsx`)  
**Controller:** `AssetTagImportController`  
**Template:** `GET /api/backend/admin/asset-tags/template.csv` or `.xlsx`  
**Columns:** `assetTag`, `assetCode`, `serialNumber`, `erpCode`, `vehicleRegistrationNo`, `note`  
**Purpose:** Assign/change asset tags on existing Assets or Vehicles by matching `assetCode` / `serialNumber` / `erpCode` / `vehicleRegistrationNo`.

**CSV Template:**
```csv
assetTag,assetCode,serialNumber,erpCode,vehicleRegistrationNo,note
AST-ABCD,,,,,
```

---

## 8. Job Categories (Maintenance Config) — Admin Create Form ✅

**UI:** Admin → Maintenance Configuration → Job Domains & Categories (`/admin/job-categories`)  
**Endpoints:**  
- `GET /api/backend/admin/maintenance-config/job-categories` (list)
- `POST /api/backend/admin/maintenance-config/job-categories` (create)
- `PATCH /api/backend/admin/maintenance-config/job-categories/:id` (update active)
- `POST /api/backend/admin/maintenance-config/job-categories/seed-defaults` (seed)

**Form fields (from `AdminJobCategoriesPage`):**
- jobDomain: `MACHINERY` | `SERVICE` | `VEHICLE`
- level: `MAIN` | `SUB`
- code: string (e.g., `HVAC`)
- name: string
- parentId: UUID (required when level=SUB)

**No CSV import** — manual create via UI only. Seed defaults available.

---

## 9. Priority / SLA Rules — Admin Edit Form ✅

**UI:** Admin → Maintenance Configuration → Priority / SLA (`/admin/priority-sla`)  
**Endpoints:**  
- `GET /api/backend/admin/maintenance-config/priority-sla` (list)
- `POST /api/backend/admin/maintenance-config/priority-sla` (upsert)

**Fields per priority (CRITICAL, HIGH, MEDIUM, LOW):**
- responseMinutes (int, nullable)
- completionMinutes (int, nullable)
- escalateOnBreach (bool)
- notifyOnBreach (bool)
- active (bool)
- reason (string, required on save)

**No CSV import** — manual edit via UI table.

---

## 10. Fault / Cause / Remedy Codes (Analysis Codes) — Admin Create Form ✅

**UI:** Admin → Maintenance Configuration → Fault / Cause / Remedy (`/admin/fault-codes`)  
**Endpoints:**  
- `GET /api/backend/admin/maintenance-config/analysis-codes?kind=FAILURE|CAUSE|REMEDY`
- `POST /api/backend/admin/maintenance-config/analysis-codes` (create or toggle active)

**Form fields:**
- kind: `FAILURE` | `CAUSE` | `REMEDY`
- code: string (e.g., `BEARING_FAIL`)
- name: string
- description: string (optional)
- reason: string (required on save)

**No CSV import** — manual create via UI.

---

## 11. Hold / Delay Reason Codes — Admin Create Form ✅

**UI:** Admin → Maintenance Configuration → Hold / Delay Reasons (`/admin/reason-codes`)  
**Endpoints:**  
- `GET /api/backend/admin/maintenance-config/reason-codes?kind=HOLD|DELAY`
- `POST /api/backend/admin/maintenance-config/reason-codes` (create or toggle active)

**Form fields:**
- kind: `HOLD` | `DELAY`
- code: string (e.g., `WAITING_PARTS`)
- name: string
- description: string (optional)
- requiresNotes: boolean
- reason: string (required on save)

**No CSV import** — manual create via UI.

---

## 12. Default Tax Rate — Admin Form ✅

**UI:** Admin → Maintenance Configuration (main page, `DefaultTaxRateSetting` component)  
**Endpoints:**  
- `GET /api/backend/admin/maintenance-config/tax-rate`
- `PATCH /api/backend/admin/maintenance-config/tax-rate` { defaultTaxRatePercent: number }

**Value:** Decimal 0–100 (default 18.00 for Sri Lanka VAT)

---

## 13. Sites — NO IMPORT / NO ADMIN CREATE FORM ❌

**Model:** `Site` (Phase 3 spatial master)  
**Admin screen:** None found (`grep` finds no `app/(dashboard)/admin/sites` or `app/(dashboard)/master-data/sites`)  
**API:** No controller found for Site CRUD under `/admin`  
**Status:** **MANUAL / NOT SUPPORTED** — must insert via SQL or Prisma script

---

## 14. Functional Locations — NO IMPORT / NO ADMIN CREATE FORM ❌

**Model:** `FunctionalLocation` (Phase 3)  
**Admin screen:** None found  
**API:** No controller found  
**Status:** **MANUAL / NOT SUPPORTED**

---

## 15. Users — NO CSV IMPORT ❌ (Admin invite/create form exists)

**UI:** Admin → People (`/admin/people`) and Admin → People → New (`/admin/people/new`)  
**Endpoints:**  
- `POST /api/backend/admin/users` (create with email, role, etc.)
- `POST /api/backend/admin/users/invite` (send invitation)
- `POST /api/backend/users/invite` (tenant invite)

**Form fields (from `AdminPeopleNewPage`):**
- email, firstName, lastName, roleId, phone, designation, departmentId, branchScope, dailyCapacityHours

**Note:** Password set via invitation flow (UserInvitation), not direct create. No bulk import.

---

## 16. Roles — NO CSV IMPORT ❌ (Admin form exists)

**UI:** Admin → Roles (`/admin/roles`)  
**Endpoints:**  
- `GET /api/backend/admin/roles-permissions`
- `POST /api/backend/admin/roles`
- `PATCH /api/backend/admin/roles/:id/permissions`

**No CSV import** — manual create/permission sync via UI.

---

## 17. Warehouses — NO IMPORT / NO ADMIN CREATE FORM ❌

**Model:** `Warehouse`  
**Admin screen:** None found  
**API:** Only `GET /api/backend/inventory/warehouses` (list) — no create/update endpoints  
**Status:** **MANUAL / NOT SUPPORTED**

---

## 18. Warehouse Item Balances — NO IMPORT ❌

**Model:** `WarehouseItemBalance`  
**Managed via:** Stock Count sessions (`/admin/inventory/stock-counts` UI) or ERP stock sync apply  
**No direct CSV import** for initial balances.

---

## 19. Maintenance Templates — Admin Create Form ✅

**UI:** Admin → Maintenance Templates (`/admin/maintenance-templates`)  
**Endpoints:**  
- `GET /api/backend/admin/maintenance-config/maintenance-templates`
- `POST /api/backend/admin/maintenance-config/maintenance-templates`
- `POST /api/backend/admin/maintenance-config/maintenance-templates/seed-defaults`

**Fields:** code, name, description, jobDomain, jobType, categoryCode, subcategoryCode, defaultPriority, estimatedHours, estimatedDowntimeMin, defaultExecutionMode, requiredSkillsJson, defaultPartsJson, safetyRequirementsJson, permitRequirement, checklistTemplateId, signOffRequirementsJson, instructions, documentsJson

---

## 20. Checklist Templates — Admin Create Form ✅

**UI:** Admin → Checklist Templates (`/admin/checklist-templates`)  
**Endpoints:** CRUD under `/api/backend/checklist-templates` (from CleaningModule/MaintenanceModule)  
**No CSV import** — manual create via UI.

---

## 21. Feature Flags — Admin Toggle ✅

**UI:** Admin → Feature Flags (`/admin/feature-flags`)  
**Endpoint:** `GET/POST /api/backend/admin/maintenance-config/feature-flags`  
**No import** — toggle switches only.

---

## 22. Asset Domains / Categories / Types (Taxonomy) — Admin Create Form ✅

**UI:** Admin → Asset Domains (`/admin/asset-masters`)  
**Endpoints:**  
- `POST /api/backend/asset-taxonomy/domains`
- `POST /api/backend/asset-taxonomy/categories`
- `POST /api/backend/asset-taxonomy/types`
- `POST /api/backend/asset-taxonomy/attributes`
- `POST /api/backend/asset-taxonomy/seed-defaults`

**No CSV import** — manual create via UI. Seed defaults available.

---

## 23. Approval Rules — Admin Form ✅

**UI:** Admin → Approval Rules (`/admin/approval-rules`)  
**Endpoints:** CRUD under `/api/backend/admin/approvals/rules`  
**No CSV import** — manual create via UI.

---

## Summary: What Can Be Imported via CSV

| Entity | Import Method | Template Source |
|--------|---------------|-----------------|
| Asset | Bulk Import (`/bulk-import/asset`) | `AssetBulkImportAdapter.TEMPLATE_COLUMNS` |
| Vehicle | Bulk Import (`/bulk-import/vehicle`) | `VehicleBulkImportAdapter.TEMPLATE_COLUMNS` |
| Department | Bulk Import (`/bulk-import/department`) | `DepartmentBulkImportAdapter.TEMPLATE_COLUMNS` |
| Supplier | Bulk Import (`/bulk-import/supplier`) | `SupplierBulkImportAdapter.TEMPLATE_COLUMNS` |
| Job Code | Bulk Import (`/bulk-import/job-code`) | `JobCodeBulkImportAdapter.TEMPLATE_COLUMNS` |
| Spare Part (master) | **NO CSV** — Admin form only | `CreatePartDto` fields |
| Spare Part (ERP balances) | Inventory Excel Import (`/inventory/imports`) | ERP-specific columns |
| Asset Tag (assign to existing) | Asset Tag Import (`/admin/asset-tags`) | `TEMPLATE_HEADERS` in service |
| Job Category | **NO CSV** — Admin form + seed | Form fields in `AdminJobCategoriesPage` |
| Priority SLA | **NO CSV** — Admin table edit | Form fields in `AdminPrioritySlaPage` |
| Analysis Codes (Fault/Cause/Remedy) | **NO CSV** — Admin form | Form fields in `AdminFaultCodesPage` |
| Reason Codes (Hold/Delay) | **NO CSV** — Admin form | Form fields in `AdminReasonCodesPage` |
| Default Tax Rate | **NO CSV** — Admin form | Single number field |
| Sites | **NOT SUPPORTED** | — |
| Functional Locations | **NOT SUPPORTED** | — |
| Users | **NO CSV** — Admin invite form | Form fields in `AdminPeopleNewPage` |
| Roles | **NO CSV** — Admin form | Permission sync UI |
| Warehouses | **NOT SUPPORTED** | — |
| Warehouse Balances | **NO CSV** — Stock Count / ERP Sync | — |

---

## Execution Order (Dependency-Aware)

1. **Seed defaults first** (run in order):
   - `POST /asset-taxonomy/seed-defaults` (domains, categories, types, attributes)
   - `POST /maintenance-config/job-categories/seed-defaults`
   - `POST /maintenance-config/maintenance-templates/seed-defaults`
   - `PATCH /maintenance-config/tax-rate` { defaultTaxRatePercent: 18 }

2. **Bulk imports (CSV) — any order, but parents before children if linking:**
   - Departments (referenced by Assets, Users)
   - Suppliers (referenced by Parts, POs)
   - Assets (referenced by Work Orders, Vehicles via assetTag)
   - Vehicles (referenced by Work Orders, Drivers)
   - Job Codes (referenced by Work Orders, Templates)

3. **Admin forms (manual, post-seed):**
   - Job Categories (MAIN then SUB)
   - Priority SLA (all 4 priorities)
   - Fault/Cause/Remedy codes
   - Hold/Delay reason codes
   - Maintenance Templates
   - Checklist Templates
   - Feature Flags
   - Asset Taxonomy extensions
   - Approval Rules

4. **Not supported / manual SQL:**
   - Sites, Functional Locations, Warehouses, Warehouse Balances
   - Insert via Prisma script or SQL if needed

---

## UNVERIFIED Items (could not confirm in codebase)

| Item | Reason |
|------|--------|
| Site CRUD API | No controller found under `/api/admin` or `/api/backend` |
| FunctionalLocation CRUD API | No controller found |
| Warehouse CRUD API | Only GET list in InventoryController |
| Warehouse Balance initial load | Only via Stock Count session or ERP apply |
| User bulk create | Only single create + invite flow |
| Role bulk create | Only single create + permission sync |

---

## Sri Lankan Sample Data Conventions

- Phone: `+94 11 234 5678` (landline), `+94 77 123 4567` (mobile)
- Vehicle plates: `WP-ABC-1234` (Western Province), `CP-XXX-1234` (Central), `NP-XXX-1234` (North Western), etc.
- Currency: LKR (no symbol in CSV, numeric only)
- Tax: 18% default (VAT)
- Company suffix: `(Pvt) Ltd` or `PLC`