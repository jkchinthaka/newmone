# Database Health Report

**Branch:** `maintainpro/final-enterprise-closure`  
**Audit date:** 2026-09-17 (final closure refresh)  
**Schema:** Prisma 5.22 + Microsoft SQL Server

## Schema Overview

- Modular monolith CMMS/EAM/Fleet schema
- Provider: SQL Server (`sqlserver`) — **application primary**
- Mongo remains migration-source / reconcile tooling only until signed cutover
- IDs: cuid `@db.NVarChar(36)`
- FK delete behavior: **NoAction only** (0 Cascade relations in Prisma)

## Model Count

| Metric | Value |
|--------|------:|
| Prisma models | ~214 |
| FK onDelete Cascade | 0 |
| FK onDelete NoAction | ~439 |

## Fresh empty-database proof (2026-09-17)

| Step | Result |
|------|--------|
| Create `MaintainProEmptyProof` | PASSED |
| `prisma migrate deploy` (12 migrations from zero) | PASSED |
| Seed | PASSED |
| Idempotent seed re-run | PASSED |
| Backup/restore drill (`npm run db:sqlserver:drill`) | PASSED (WITH MOVE) |

## Unique Constraints

Tenant-aware uniques include assetTag, registrationNo, woNumber, requestNumber, partNumber, vendorCode (filtered unique), permitNumber, generationKey, etc.

`@@unique([tenantId, id])` on Asset, Vehicle, WorkOrder, AssetMeter, WorkflowVersion, OrganizationUnit for trigger support.

## Tenant Isolation

| Layer | Status |
|-------|--------|
| Column `tenantId` on business tables | Present on core models |
| App `assertTenantEntityExists` | Present + tests |
| DB triggers cross-tenant FK | `20260917240000` |
| PartRequest.tenantId | Required |
| Supplier.tenantId | **Required** (`20260917250000`; quarantine tenant for unresolved legacy) |
| VendorPortalAccess tenant match | Trigger `trg_VendorPortalAccess_tenant` |

## Data Integrity Risks (final)

| ID | Severity | Finding | Status |
|----|----------|---------|--------|
| DI-1 | CRITICAL | Cross-tenant WO→Asset | **FIXED** — triggers |
| DI-2 | CRITICAL | MeterCorrection no FK | **FIXED** |
| DI-3 | HIGH | Float money on parts/vendor/claims | **FIXED** → Decimal(18,2) |
| DI-4 | HIGH | PartRequest.tenantId nullable | **FIXED** |
| DI-5 | HIGH | Reporting multi-tenant exposure | **MITIGATED** — tenantId on views; Power BI RLS EXTERNAL |
| DI-6 | MEDIUM | Branch string scopes | **MITIGATED** — OrganizationUnit |
| DI-7 | MEDIUM | No WorkflowInstance table | Documented — WO+StatusHistory |
| DI-8 | MEDIUM | Farm/utility Float money | **FIXED** in `20260917250000` |
| DI-9 | MEDIUM | Soft delete inconsistency | Documented retirement/status pattern |
| DI-10 | MEDIUM | Asset hierarchy cycles app-only | **FIXED** — `trg_Asset_no_hierarchy_cycle` |

**CRITICAL = 0 · HIGH = 0 · remaining MEDIUM are documented non-blocking or mitigated.**

## Money / Decimal

Operational money fields use `Decimal(18,2)` (rates may use 18,4). Remaining Float fields are sensors/measurements (odometer, GPS, capacity), not currency.

## Organization / Asset / Vehicle

Recursive `OrganizationUnit` with cycle protection; Asset parent hierarchy with DB cycle + cross-tenant triggers; Vehicle shares maintenance WO architecture.

## Workflow / Approval / Inventory / Vendor / Safety / Audit / Reporting

See `docs/DATABASE_MAPPING_AUDIT.md` and `docs/DATA_MODEL.md` ERDs. Reporting views `vw_rpt_*` include tenantId.

## Remaining external database risks

- Live staging Mongo↔SQL reconciliation against production snapshot (tooling complete: `npm run db:reconcile`)
- Power BI production RLS configuration (views + docs complete)
