# Go-live master data

Nest global prefix is `api`. Paths below are the controller routes. UI paths are the Next.js pages.

## Bulk import

Module: `apps/api/src/modules/bulk-import`. UI: `/admin/bulk-imports`.

| Method | Path |
| --- | --- |
| GET | `/api/bulk-import/:entity/template` |
| POST | `/api/bulk-import/:entity/preview` |
| POST | `/api/bulk-import/:entity/:importId/commit` |

`:entity` is only a key of `BULK_IMPORT_ENTITY_SLUGS`: `asset`, `department`, `job-code`, `supplier`, `vehicle`.

### asset

| Header | Required | Sri Lankan sample |
| --- | --- | --- |
| Asset Tag | yes | AST-1001 |
| Name | yes | Colombo Cold Room |
| Category | yes | EQUIPMENT |
| Condition | no | GOOD |
| Manufacturer | no | Cummins |
| Model | no | C150D5 |
| Serial Number | no | SN-88421 |
| Location | no | Orugodawatta Depot |
| Supplier | no | ABC Suppliers |
| Owner Name | no | Nimal Perera |
| Description | no | Standby generator |

Category and Condition must be a Prisma `AssetCategory` or `AssetCondition` value. Condition defaults to GOOD.

### department

| Header | Required | Sri Lankan sample |
| --- | --- | --- |
| Code | yes | MAINT |
| Name | yes | Maintenance |
| Description | no | Colombo workshop |

### job-code

| Header | Required | Sri Lankan sample |
| --- | --- | --- |
| Code | yes | JC-100 |
| Name | yes | Engine oil change |
| Category | no | Preventive Maintenance |
| Estimated Hours | no | 1.5 |
| Description | no | Hilux service |

### supplier

| Header | Required | Sri Lankan sample |
| --- | --- | --- |
| Vendor Code | yes | SUP-001 |
| Name | yes | ABC Suppliers (Pvt) Ltd |
| Contact Name | no | Jane Silva |
| Email | no | sales@abcsuppliers.example |
| Phone | no | +94 11 234 5678 |
| Address | no | 42 Baseline Road, Colombo 09 |
| Website | no | |
| Tax Number | no | |

### vehicle

| Header | Required | Sri Lankan sample |
| --- | --- | --- |
| Registration No | yes | WP-CAB-1234 |
| Make | yes | Toyota |
| Model | yes | Hilux |
| Year | yes | 2022 |
| Type | yes | TRUCK |
| Fuel Type | yes | DIESEL |
| Ownership Type | no | OWNED |
| Asset Tag | no | AT-0042 |
| Current Mileage | no | 15000 |
| Location | no | Colombo Depot |
| Cost Center | no | CC-100 |
| Vendor Name | no | ABC Motors |
| Description | no | Western Province pool vehicle |

Type, Fuel Type, and Ownership Type must be a Prisma `VehicleType`, `FuelType`, or `VehicleOwnershipType` value. Ownership defaults to OWNED.

## Spare parts

UI: `/inventory/import`.

| Method | Path |
| --- | --- |
| POST | `/api/inventory/imports/preview` |
| POST | `/api/inventory/imports/:id/apply` |

Preview accepts an Excel file (`file`). Accepted headers include Item Code / Part Number, Quantity / Qty on hand, Unit Cost / Price, UOM, Warehouse Code, Product Description. Costs in samples are LKR (example unit cost `12500.00`).

## Asset tags

Controller: `apps/api/src/modules/assets/asset-tag-import.controller.ts`. UI: `/admin/asset-tags`.

| Method | Path |
| --- | --- |
| GET | `/api/admin/asset-tags/template.csv` |
| GET | `/api/admin/asset-tags/template.xlsx` |
| POST | `/api/admin/asset-tags/preview` |
| POST | `/api/admin/asset-tags/apply` |

Columns: `assetTag`, `assetCode`, `serialNumber`, `erpCode`, `vehicleRegistrationNo`, `note`.

```csv
assetTag,assetCode,serialNumber,erpCode,vehicleRegistrationNo,note
AST-1001,,,,,Colombo depot tag
```

## Other master data

| Data | How to load |
| --- | --- |
| Sites and functional locations | `/admin/organization` |
| Users | `/admin/users` |
| Roles | `/admin/roles` |
| Job categories | `/admin/job-categories` |
| Priority and SLA | `/admin/priority-sla` |
| Fault codes | `/admin/fault-codes` |
| Reason codes | `/admin/reason-codes` |
| Default tax rate (18, LKR quotes) | `/admin/maintenance-config` |
| Maintenance templates | `/admin/maintenance-templates` |
| Checklist templates | `/admin/checklist-templates` |
| Feature flags | `/admin/feature-flags` |
| Asset domain, category, type | `/admin/asset-masters` |
| Approval rules | `/admin/approval-rules` |
| Single asset | `/admin/assets/new` |
| Warehouses | manual |
| Warehouse item balances | manual |

## Load order

1. Departments, suppliers (`/admin/bulk-imports`).
2. Assets, then vehicles (vehicle Asset Tag should already exist when used).
3. Job codes.
4. Asset tags (`/admin/asset-tags`) for tags on existing assets or vehicles.
5. Spare-part quantities (`/inventory/import`).
6. Remaining rows in the table above, on that admin screen, or manual.
