# Go-Live Master Data Load Order

**Target:** Production `MaintainProProd` after minimal seed (SUPER_ADMIN, ADMIN, RBAC, tax 18%)
**Rule:** Load in dependency order — parents before children. Each step: verify count, spot-check 3 rows, confirm audit rows exist.
**CSV templates** use exact DTO/validation field names from the API. Import via Admin Console screens or direct API (POST /api/backend/import/{entity}).

---

## 1. Sites (Phase 3 Spatial Master)

**Dependency:** None (root of spatial hierarchy)
**Admin Screen:** Admin → Sites → Import CSV
**Endpoint:** `POST /api/backend/import/sites` (multipart/form-data, field `file`)
**Validation:** `apps/api/src/modules/sites/dto/create-site.dto.ts`

| Column | Required | Type | Notes |
|--------|----------|------|-------|
| code | ✓ | string ≤64 | Unique per tenant, e.g., `HQ`, `PLANT-A` |
| name | ✓ | string | Display name |
| type | ✓ | string ≤64 | `PLANT`, `WAREHOUSE`, `OFFICE`, `YARD` |
| description | | string | Optional |
| address | | string | Optional |
| contactPhone | | string | Optional |
| isActive | | boolean | Default `true` |

**CSV Example:**
```csv
code,name,type,description,address,contactPhone,isActive
HQ,Headquarters,OFFICE,Corporate HQ,123 Main St,+1-555-0100,true
PLANT-A,Plant Alpha,PLANT,Main production facility,456 Industrial Blvd,+1-555-0200,true
WH-1,Warehouse 1,WAREHOUSE,Primary storage,789 Logistics Way,+1-555-0300,true
```

**Verification:**
```sql
SELECT code, name, type, isActive FROM Site WHERE tenantId = '<tenant-id>' ORDER BY code;
-- Expect 3+ rows, all isActive=1
```

---

## 2. Departments

**Dependency:** None (but Sites may reference via FunctionalLocation.departmentId)
**Admin Screen:** Admin → Departments → Import CSV
**Endpoint:** `POST /api/backend/import/departments`
**Validation:** `apps/api/src/modules/departments/dto/create-department.dto.ts`

| Column | Required | Type | Notes |
|--------|----------|------|-------|
| code | ✓ | string ≤64 | Unique per tenant, e.g., `MAINT`, `IT`, `HR` |
| name | ✓ | string | Display name |
| description | | string | Optional |
| parentCode | | string | Code of parent department (for hierarchy) |
| managerEmail | | string | Email of User who manages this dept |
| isActive | | boolean | Default `true` |

**CSV Example:**
```csv
code,name,description,parentCode,managerEmail,isActive
MAINT,Maintenance,Maintenance operations,,maintenance.mgr@company.com,true
IT,Information Technology,IT systems,,it.mgr@company.com,true
HR,Human Resources,,,
MAINT-ELEC,Electrical,Electrical maintenance,MAINT,elec.lead@company.com,true
MAINT-MECH,Mechanical,Mechanical maintenance,MAINT,mech.lead@company.com,true
```

**Verification:**
```sql
SELECT code, name, parentId, isActive FROM Department WHERE tenantId = '<tenant-id>' ORDER BY code;
```

---

## 3. Asset Domains (Phase 4 Taxonomy Root)

**Dependency:** None
**Admin Screen:** Admin → Asset Taxonomy → Domains → Import
**Endpoint:** `POST /api/backend/import/asset-domains`
**Validation:** `AssetDomain` model + `AssetTaxonomyService.seedDefaults`

| Column | Required | Type | Notes |
|--------|----------|------|-------|
| code | ✓ | string ≤64 | Unique per tenant, e.g., `MACHINERY`, `VEHICLES`, `FACILITIES` |
| name | ✓ | string | Display name |
| description | | string | Optional |
| sortOrder | | int | Display order (default 0) |
| isActive | | boolean | Default `true` |
| profileJson | | string | JSON for domain profile overrides |

**CSV Example:**
```csv
code,name,description,sortOrder,isActive,profileJson
MACHINERY,Machinery & Equipment,Production machinery,1,true,"{}"
VEHICLES,Fleet Vehicles,Company vehicles,2,true,"{}"
FACILITIES,Facilities & Infrastructure,Building systems,3,true,"{}"
```

---

## 4. Asset Category Masters

**Dependency:** AssetDomain (domainId or domainCode)
**Admin Screen:** Admin → Asset Taxonomy → Categories → Import
**Endpoint:** `POST /api/backend/import/asset-categories`
**Validation:** `AssetCategoryMaster` model

| Column | Required | Type | Notes |
|--------|----------|------|-------|
| code | ✓ | string ≤64 | Unique per tenant+domain |
| name | ✓ | string | Display name |
| domainCode | ✓ | string | Must match existing AssetDomain.code |
| description | | string | Optional |
| legacyEnum | | string | Legacy AssetCategory enum value for migration |
| isActive | | boolean | Default `true` |

**CSV Example:**
```csv
code,name,domainCode,description,legacyEnum,isActive
PUMPS,Pumps,MACHINERY,Centrifugal & positive displacement,PUMP,true
MOTORS,Electric Motors,MACHINERY,AC/DC motors,MOTOR,true
CONVEYORS,Conveyors,MACHINERY,Belt & roller conveyors,CONVEYOR,true
HVAC,HVAC Systems,FACILITIES,Heating ventilation AC,HVAC,true
LIGHTING,Lighting Systems,FACILITIES,Interior/exterior lighting,LIGHTING,true
TRUCKS,Trucks,VEHICLES,Heavy/light trucks,TRUCK,true
VANS,Vans,VEHICLES,Passenger & cargo vans,VAN,true
```

---

## 5. Asset Type Masters

**Dependency:** AssetCategoryMaster (categoryId or categoryCode+domainCode)
**Admin Screen:** Admin → Asset Taxonomy → Types → Import
**Endpoint:** `POST /api/backend/import/asset-types`
**Validation:** `AssetTypeMaster` model

| Column | Required | Type | Notes |
|--------|----------|------|-------|
| code | ✓ | string ≤64 | Unique per tenant+category |
| name | ✓ | string | Display name |
| categoryCode | ✓ | string | Must match existing AssetCategoryMaster.code |
| domainCode | ✓ | string | Must match AssetDomain.code (for validation) |
| description | | string | Optional |
| isActive | | boolean | Default `true` |

**CSV Example:**
```csv
code,name,categoryCode,domainCode,description,isActive
CENTRIFUGAL,Centrifugal Pump,PUMPS,MACHINERY,Single/multi-stage centrifugal,true
POSITIVE-DISP,Positive Displacement Pump,PUMPS,MACHINERY,Gear, diaphragm, piston,true
AC-INDUCTION,AC Induction Motor,MOTORS,MACHINERY,3-phase squirrel cage,true
DC-BRUSH,DC Brush Motor,MOTORS,MACHINERY,Brushed DC motor,true
BELT,Belt Conveyor,CONVEYORS,MACHINERY,Flat/modular belt,true
ROLLER,Roller Conveyor,CONVEYORS,MACHINERY,Gravity & powered roller,true
```

---

## 6. Asset Attribute Definitions (Optional, per Type)

**Dependency:** AssetTypeMaster
**Admin Screen:** Admin → Asset Taxonomy → Types → Attributes tab
**Endpoint:** `POST /api/backend/import/asset-attributes`
**Validation:** `AssetAttributeDefinition` model

| Column | Required | Type | Notes |
|--------|----------|------|-------|
| typeCode | ✓ | string | AssetTypeMaster.code |
| categoryCode | ✓ | string | AssetCategoryMaster.code (for validation) |
| domainCode | ✓ | string | AssetDomain.code (for validation) |
| key | ✓ | string | Machine key, e.g., `ratedPowerKw` |
| label | ✓ | string | Display label, e.g., `Rated Power (kW)` |
| dataType | ✓ | string | `NUMBER`, `STRING`, `BOOLEAN`, `DATE`, `ENUM` |
| unit | | string | e.g., `kW`, `V`, `bar`, `rpm` |
| required | | boolean | Default `false` |
| optionsJson | | string | JSON array for ENUM: `["opt1","opt2"]` |
| minValue | | number | For NUMBER |
| maxValue | | number | For NUMBER |
| displayOrder | | int | Default 0 |
| isActive | | boolean | Default `true` |

**CSV Example:**
```csv
typeCode,categoryCode,domainCode,key,label,dataType,unit,required,optionsJson,minValue,maxValue,displayOrder,isActive
CENTRIFUGAL,PUMPS,MACHINERY,ratedPowerKw,Rated Power (kW),NUMBER,kW,true,,0,5000,1,true
CENTRIFUGAL,PUMPS,MACHINERY,flowRateM3h,Flow Rate (m³/h),NUMBER,m³/h,true,,0,10000,2,true
CENTRIFUGAL,PUMPS,MACHINERY,headM,Head (m),NUMBER,m,true,,0,500,3,true
CENTRIFUGAL,PUMPS,MACHINERY,sealType,Seal Type,ENUM,,true,"["Mechanical","Packing","Magnetic"]",,,4,true
```

---

## 7. Assets

**Dependency:** Site (siteId), FunctionalLocation (optional), Department (optional), AssetTypeMaster (optional)
**Admin Screen:** Assets → Import CSV
**Endpoint:** `POST /api/backend/import/assets`
**Validation:** `Asset` model + `CreateAssetDto`

| Column | Required | Type | Notes |
|--------|----------|------|-------|
| assetTag | ✓ | string ≤64 | **Unique per tenant** — primary business key |
| name | ✓ | string | Display name |
| category | ✓ | string | Legacy category (free text) — still required |
| typeMasterCode | | string | AssetTypeMaster.code (preferred over category) |
| status | | string | `ACTIVE`, `INACTIVE`, `RETIRED`, `DISPOSED` (default `ACTIVE`) |
| siteCode | | string | Site.code (resolved to siteId) |
| functionalLocationCode | | string | FunctionalLocation.code within site |
| departmentCode | | string | Department.code |
| description | | string | Optional |
| manufacturer | | string | Optional |
| model | | string | Optional |
| serialNumber | | string | Optional |
| purchaseDate | | date | YYYY-MM-DD |
| purchasePrice | | decimal | Optional |
| supplier | | string | Optional |
| location | | string | Legacy free-text location |
| criticality | | string | `SAFETY`, `PRODUCTION`, `QUALITY`, `ENVIRONMENT` |
| criticalityLevel | | string | `CRITICAL`, `HIGH`, `MEDIUM`, `LOW` |
| warrantyExpiry | | date | YYYY-MM-DD |
| isActive | | boolean | Default `true` |

**CSV Example:**
```csv
assetTag,name,category,typeMasterCode,status,siteCode,functionalLocationCode,departmentCode,description,manufacturer,model,serialNumber,purchaseDate,purchasePrice,supplier,criticality,criticalityLevel,warrantyExpiry,isActive
PMP-001,Cooling Water Pump 1,PUMPS,CENTRIFUGAL,ACTIVE,PLANT-A,FL-PLANT-A-MECH,MAINT-MECH,Primary cooling pump,Grundfos,NK 65-250/249,GRU-2026-001,2024-01-15,12500.00,Grundfos SA,PRODUCTION,HIGH,2027-01-15,true
MTR-001,Conveyor Drive Motor 1,MOTORS,AC-INDUCTION,ACTIVE,PLANT-A,FL-PLANT-A-MECH,MAINT-ELEC,Main conveyor motor,ABB,M3BP 160 MLA,ABB-2026-045,2023-06-10,8900.00,ABB Ltd,PRODUCTION,CRITICAL,2026-06-10,true
HVAC-001,Admin Building Chiller,HVAC,,ACTIVE,HQ,FL-HQ-BLDG-MECH,MAINT-MECH,Chiller for admin building,Carrier,30XA-250,CAR-2025-012,2023-03-22,45000.00,Carrier Corp,FACILITIES,MEDIUM,2026-03-22,true
```

**Verification:**
```sql
SELECT assetTag, name, category, typeMasterId, siteId, status, isActive
FROM Asset WHERE tenantId = '<tenant-id>' ORDER BY assetTag;
-- Check: assetTag unique, status valid, siteId resolves
```

---

## 8. Functional Locations (Sites → FL Hierarchy)

**Dependency:** Site (siteId), Department (optional for ownership), Parent FL (optional)
**Admin Screen:** Admin → Functional Locations → Import
**Endpoint:** `POST /api/backend/import/functional-locations`
**Validation:** `FunctionalLocation` model

| Column | Required | Type | Notes |
|--------|----------|------|-------|
| code | ✓ | string ≤64 | Unique per tenant+site |
| name | ✓ | string | Display name |
| siteCode | ✓ | string | Site.code |
| parentCode | | string | Parent FL.code (same site) |
| type | ✓ | string ≤64 | `BUILDING`, `FLOOR`, `ROOM`, `AREA`, `ZONE` |
| departmentCode | | string | Department.code (ownership) |
| description | | string | Optional |
| isActive | | boolean | Default `true` |

**CSV Example:**
```csv
code,name,siteCode,parentCode,type,departmentCode,description,isActive
PLANT-A-MECH,Mechanical Workshop,PLANT-A,,AREA,MAINT-MECH,Mechanical maintenance area,true
PLANT-A-ELEC,Electrical Workshop,PLANT-A,,AREA,MAINT-ELEC,Electrical maintenance area,true
HQ-BLDG-MECH,Mechanical Room,HQ,,ROOM,MAINT-MECH,Building mechanical systems,true
```

---

## 9. Vehicles

**Dependency:** Department (optional), Driver (optional, User with DRIVER role), Asset (optional 1:1)
**Admin Screen:** Fleet → Vehicles → Import
**Endpoint:** `POST /api/backend/import/vehicles`
**Validation:** `Vehicle` model + `CreateVehicleDto`

| Column | Required | Type | Notes |
|--------|----------|------|-------|
| registrationNo | ✓ | string ≤64 | **Unique per tenant** — license plate |
| assetTag | | string | Asset.assetTag (optional 1:1 link) |
| make | ✓ | string | Manufacturer |
| vehicleModel | ✓ | string | Model name |
| year | ✓ | int | 4-digit year |
| type | ✓ | string ≤64 | `CAR`, `VAN`, `TRUCK`, `TRACTOR`, `TRAILER`, `MOTORCYCLE` |
| fuelType | ✓ | string ≤64 | `PETROL`, `DIESEL`, `ELECTRIC`, `HYBRID`, `CNG`, `LPG` |
| status | | string | `AVAILABLE`, `IN_SERVICE`, `MAINTENANCE`, `DECOMMISSIONED` (default `AVAILABLE`) |
| ownershipType | | string | `OWNED`, `LEASED`, `RENTED` |
| vin | | string ≤32 | VIN (tenant-scoped unique when not null) |
| engineNo | | string | Optional |
| departmentCode | | string | Department.code |
| driverEmail | | string | User.email with DRIVER role |
| currentMileage | | number | Default 0 |
| acquisitionDate | | date | YYYY-MM-DD |
| purchasePrice | | decimal | Optional |
| color | | string | Optional |
| serviceIntervalDays | | int | Days between services |
| serviceIntervalMileage | | number | Km/miles between services |
| insuranceExpiry | | date | YYYY-MM-DD |
| roadTaxExpiry | | date | YYYY-MM-DD |

**CSV Example:**
```csv
registrationNo,assetTag,make,vehicleModel,year,type,fuelType,status,ownershipType,vin,departmentCode,driverEmail,currentMileage,acquisitionDate,purchasePrice,color,serviceIntervalDays,serviceIntervalMileage,insuranceExpiry,roadTaxExpiry
MH-01-AB-1001,,Toyota,Hilux,2023,TRUCK,DIESEL,AVAILABLE,OWNED,VIN12345678901234,MAINT,tech1@company.com,15000,2023-02-01,35000.00,White,180,15000,2026-02-01,2026-01-15
MH-01-AB-1002,VAN-001,Ford,Transit,2022,VAN,DIESEL,AVAILABLE,LEASED,VIN23456789012345,IT,tech2@company.com,22000,2022-08-15,28000.00,Blue,180,20000,2026-08-15,2026-07-30
```

---

## 10. Spare Parts (Inventory)

**Dependency:** Supplier (optional), Warehouse (optional for balances)
**Admin Screen:** Inventory → Spare Parts → Import
**Endpoint:** `POST /api/backend/import/spare-parts`
**Validation:** `SparePart` model + `CreateSparePartDto`

| Column | Required | Type | Notes |
|--------|----------|------|-------|
| partNumber | ✓ | string ≤64 | **Unique per tenant** — primary business key |
| name | ✓ | string | Display name |
| category | ✓ | string | Free-text category (e.g., `BEARING`, `FILTER`, `SEAL`) |
| classification | | string | `SPARE_PART`, `CONSUMABLE`, `TOOL` |
| erpCode | | string | ERP/Bileeta item code |
| maintenanceAlias | | string | Technician-friendly name |
| unit | | string | Default `pcs` (e.g., `pcs`, `m`, `kg`, `L`) |
| quantityInStock | | int | Default 0 (cached from ERP) |
| minimumStock | | int | Default 0 |
| reorderPoint | | int | Default 0 |
| maximumStock | | int | Default 0 |
| unitCost | | decimal | Default 0.00 |
| supplierCode | | string | Supplier.vendorCode (resolved to supplierId) |
| location | | string | Bin/shelf location hint |
| criticality | | string | `CRITICAL`, `NORMAL` |
| criticalSpare | | boolean | Default `false` |
| warrantyDays | | int | Optional |
| isActive | | boolean | Default `true` |

**CSV Example:**
```csv
partNumber,name,category,classification,erpCode,maintenanceAlias,unit,quantityInStock,minimumStock,reorderPoint,maximumStock,unitCost,supplierCode,location,criticality,criticalSpare,warrantyDays,isActive
BRG-6205,Deep Groove Ball Bearing 6205,BEARING,SPARE_PART,ERP-BRG-6205,Bearing 6205,pcs,50,10,5,100,12.50,SUP-BRG,A-01-01,NORMAL,false,365,true
FLT-OIL-15W40,Engine Oil 15W-40 20L,CONSUMABLE,CONSUMABLE,ERP-OIL-15W40,Oil 15W-40,L,200,50,20,500,45.00,SUP-LUB,B-02-03,NORMAL,false,,true
SEAL-MECH-01,Mechanical Seal Type 1,SEAL,SPARE_PART,ERP-SEAL-01,Mech Seal 1,pcs,5,2,1,10,85.00,SUP-SEAL,A-03-01,CRITICAL,true,180,true
```

---

## 11. Suppliers (Vendors)

**Dependency:** None
**Admin Screen:** Procurement → Suppliers → Import
**Endpoint:** `POST /api/backend/import/suppliers`
**Validation:** `Supplier` model + `CreateSupplierDto`

| Column | Required | Type | Notes |
|--------|----------|------|-------|
| vendorCode | | string ≤64 | Unique per tenant (optional, auto-generated if blank) |
| name | ✓ | string | Supplier name |
| contactName | | string | Primary contact |
| email | | string | Contact email |
| phone | | string | Contact phone |
| address | | string | Full address |
| website | | string | Optional |
| taxNumber | | string | Tax/VAT number |
| serviceCategoriesJson | | string | JSON array: `["MECHANICAL","ELECTRICAL","HYDRAULIC"]` |
| performanceScore | | number | 0-100 |
| blacklisted | | boolean | Default `false` |
| insuranceRequired | | boolean | Default `false` |
| insuranceExpiresAt | | date | YYYY-MM-DD |
| isActive | | boolean | Default `true` |

**CSV Example:**
```csv
vendorCode,name,contactName,email,phone,address,website,taxNumber,serviceCategoriesJson,performanceScore,blacklisted,insuranceRequired,insuranceExpiresAt,isActive
SUP-BRG,Bearing Supplies Inc,John Smith,john@bearingsupply.com,+1-555-1000,100 Industrial Dr,,TAX-1001,"["MECHANICAL","ROTATING"]",95,false,true,2026-12-31,true
SUP-LUB,Lubricants Corp,Jane Doe,jane@lubecorp.com,+1-555-2000,200 Oil Way,,TAX-1002,"["LUBRICATION","FLUIDS"]",92,false,true,2026-11-30,true
SUP-SEAL,Seal Technologies,Bob Wilson,bob@sealtech.com,+1-555-3000,300 Seal Ave,,TAX-1003,"["SEALING","HYDRAULIC"]",88,false,true,2026-10-31,true
```

---

## 12. Users (Additional beyond SUPER_ADMIN/ADMIN)

**Dependency:** Role (must exist), Department (optional), Site/FL (optional for branchScope)
**Admin Screen:** Admin → Users → Import
**Endpoint:** `POST /api/backend/import/users`
**Validation:** `User` model + `CreateUserDto` (password set via invite flow)

| Column | Required | Type | Notes |
|--------|----------|------|-------|
| email | ✓ | string | **Unique globally** — login identifier |
| firstName | ✓ | string | |
| lastName | ✓ | string | |
| roleName | ✓ | string | Must match Role.name (e.g., `TECHNICIAN`, `MANAGER`, `INVENTORY_KEEPER`) |
| departmentCode | | string | Department.code |
| phone | | string | |
| designation | | string | Job title (e.g., `Electrician`, `Planner`) |
| dailyCapacityHours | | number | Default 8 |
| branchScope | | string | Branch label for RBAC filtering |
| isActive | | boolean | Default `true` |

**CSV Example:**
```csv
email,firstName,lastName,roleName,departmentCode,phone,designation,dailyCapacityHours,branchScope,isActive
tech1@company.com,John,Technician,TECHNICIAN,MAINT-MECH,+1-555-1001,Mechanical Technician,8,PLANT-A,true
tech2@company.com,Jane,Technician,TECHNICIAN,MAINT-ELEC,+1-555-1002,Electrical Technician,8,PLANT-A,true
planner@company.com,Mike,Planner,MANAGER,MAINT,+1-555-1003,Maintenance Planner,8,PLANT-A,true
inventory@company.com,Sarah,Keeper,INVENTORY_KEEPER,MAINT,+1-555-1004,Store Keeper,8,PLANT-A,true
supervisor@company.com,Tom,Supervisor,SUPERVISOR,MAINT-MECH,+1-555-1005,Maintenance Supervisor,8,PLANT-A,true
```

**Note:** Passwords are NOT imported. Users receive invitation email to set password (UserInvitation flow).

---

## 13. Roles (Custom — beyond seeded RBAC)

**Dependency:** None (but Permission keys must exist)
**Admin Screen:** Admin → Roles → Import
**Endpoint:** `POST /api/backend/import/roles`
**Validation:** `Role` model + `RolePermission` junction

| Column | Required | Type | Notes |
|--------|----------|------|-------|
| name | ✓ | string ≤64 | Unique per tenant, e.g., `SENIOR_TECHNICIAN` |
| permissionKeysJson | ✓ | string | JSON array of permission keys from catalog |

**CSV Example:**
```csv
name,permissionKeysJson
SENIOR_TECHNICIAN,"["work_orders.update_status","work_orders.view_own","part_requests.create","part_requests.view","inventory.manage","qa.create","qa.view","assets.manage"]"
JUNIOR_TECHNICIAN,"["work_orders.update_status","work_orders.view_own","part_requests.create","part_requests.view"]"
```

---

## 14. Warehouses (for Inventory Balances)

**Dependency:** None
**Admin Screen:** Inventory → Warehouses → Import
**Endpoint:** `POST /api/backend/import/warehouses`
**Validation:** `Warehouse` model

| Column | Required | Type | Notes |
|--------|----------|------|-------|
| code | ✓ | string ≤64 | Unique per tenant |
| name | ✓ | string | Display name |
| erpWarehouseCode | | string | ERP warehouse code |
| isDefault | | boolean | Default `false` (one per tenant) |
| isActive | | boolean | Default `true` |

**CSV Example:**
```csv
code,name,erpWarehouseCode,isDefault,isActive
WH-MAIN,Main Warehouse,ERP-WH-01,true,true
WH-SUB,Sub Store,ERP-WH-02,false,true
WH-FIELD,Field Depot,ERP-WH-03,false,true
```

---

## 15. Warehouse Item Balances (Initial Stock)

**Dependency:** Warehouse, SparePart
**Admin Screen:** Inventory → Stock Take → Import Initial Balances
**Endpoint:** `POST /api/backend/import/warehouse-balances`
**Validation:** `WarehouseItemBalance` model

| Column | Required | Type | Notes |
|--------|----------|------|-------|
| warehouseCode | ✓ | string | Warehouse.code |
| partNumber | ✓ | string | SparePart.partNumber |
| quantityOnHand | ✓ | int | Physical count |
| reservedQuantity | | int | Default 0 |
| lastCountedAt | | datetime | ISO 8601 |

**CSV Example:**
```csv
warehouseCode,partNumber,quantityOnHand,reservedQuantity,lastCountedAt
WH-MAIN,BRG-6205,50,0,2026-10-19T10:00:00Z
WH-MAIN,FLT-OIL-15W40,200,0,2026-10-19T10:00:00Z
WH-MAIN,SEAL-MECH-01,5,0,2026-10-19T10:00:00Z
WH-SUB,BRG-6205,10,0,2026-10-19T10:00:00Z
```

---

## 16. Maintenance Job Categories (Work Order Types)

**Dependency:** None (seeded by MaintenanceConfigService, but can be extended)
**Admin Screen:** Maintenance → Job Categories → Import
**Endpoint:** `POST /api/backend/import/job-categories`
**Validation:** `MaintenanceJobCategory` model

| Column | Required | Type | Notes |
|--------|----------|------|-------|
| code | ✓ | string ≤64 | Unique per tenant |
| name | ✓ | string | Display name |
| description | | string | |
| jobDomain | ✓ | string | `MACHINERY`, `SERVICE`, `VEHICLE` |
| defaultPriority | | string | `LOW`, `MEDIUM`, `HIGH`, `CRITICAL` |
| estimatedHours | | number | |
| isActive | | boolean | Default `true` |

---

## 17. Priority SLA Rules

**Dependency:** None (seeded, extensible)
**Admin Screen:** Maintenance → SLA Rules → Import
**Endpoint:** `POST /api/backend/import/sla-rules`
**Validation:** `PrioritySlaRule` model

| Column | Required | Type | Notes |
|--------|----------|------|-------|
| priority | ✓ | string | `CRITICAL`, `HIGH`, `MEDIUM`, `LOW` |
| responseHours | ✓ | int | Time to first response |
| resolutionHours | ✓ | int | Time to resolution |
| escalationHours | | int | Time to escalate |
| isActive | | boolean | Default `true` |

---

## 18. Maintenance Reason Codes

**Dependency:** None (seeded, extensible)
**Admin Screen:** Maintenance → Reason Codes → Import
**Endpoint:** `POST /api/backend/import/reason-codes`
**Validation:** `MaintenanceReasonCode` model

| Column | Required | Type | Notes |
|--------|----------|------|-------|
| code | ✓ | string ≤64 | Unique per tenant |
| name | ✓ | string | Display name |
| category | | string | `BREAKDOWN`, `WEAR`, `OPERATOR_ERROR`, `ENVIRONMENT` |
| isActive | | boolean | Default `true` |

---

## 19. Fault Codes

**Dependency:** None (seeded, extensible)
**Admin Screen:** Maintenance → Fault Codes → Import
**Endpoint:** `POST /api/backend/import/fault-codes`
**Validation:** `FaultCode` model (if exists) or similar

| Column | Required | Type | Notes |
|--------|----------|------|-------|
| code | ✓ | string ≤64 | Unique per tenant |
| name | ✓ | string | Display name |
| description | | string | |
| isActive | | boolean | Default `true` |

---

## 20. Tenant Maintenance Setting (Tax Rate)

**Dependency:** Tenant (exists from seed)
**Admin Screen:** Admin → Settings → Maintenance
**Endpoint:** `PATCH /api/backend/tenant-maintenance-setting`
**Validation:** `TenantMaintenanceSetting` model

| Field | Required | Type | Notes |
|-------|----------|------|-------|
| defaultTaxRatePercent | ✓ | decimal(5,2) | Default 18.00 for go-live |

```json
{ "defaultTaxRatePercent": 18.00 }
```

---

## Import Execution Checklist

| Step | Entity | Count (Expected) | Verified By | Date |
|------|--------|------------------|-------------|------|
| 1 | Sites | | | |
| 2 | Departments | | | |
| 3 | Asset Domains | | | |
| 4 | Asset Categories | | | |
| 5 | Asset Types | | | |
| 6 | Asset Attributes | | | |
| 7 | Functional Locations | | | |
| 8 | Assets | | | |
| 9 | Vehicles | | | |
| 10 | Suppliers | | | |
| 11 | Spare Parts | | | |
| 12 | Warehouses | | | |
| 13 | Warehouse Balances | | | |
| 14 | Users | | | |
| 15 | Custom Roles | | | |
| 16 | Job Categories | | | |
| 17 | SLA Rules | | | |
| 18 | Reason Codes | | | |
| 19 | Fault Codes | | | |
| 20 | Tax Rate | 18.00 | | |

---

## Rollback for Master Data

If any import corrupts data:
1. Restore DB from last nightly backup (§9 of GO_LIVE_RUNBOOK.md)
2. Re-run imports from step 1 in order
3. Document in INCIDENT log

---

## CSV Encoding & Format Rules

- **Encoding:** UTF-8 with BOM (Excel compatible)
- **Delimiter:** Comma (`,`)
- **Quoting:** Double quotes for fields containing commas, quotes, or newlines
- **Date format:** `YYYY-MM-DD` (ISO 8601)
- **Datetime format:** `YYYY-MM-DDTHH:mm:ssZ` (ISO 8601 UTC)
- **Boolean:** `true` / `false` (lowercase)
- **JSON columns:** Valid JSON, escaped for CSV (double quotes → `""`)
- **Header row:** Required, exact column names as specified above