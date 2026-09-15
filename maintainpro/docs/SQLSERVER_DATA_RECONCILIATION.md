# SQL Server Data Reconciliation

**Phase:** 15A — Live Validation & Migration Rehearsal  
**Date:** 2026-09-15  
**Source:** MongoDB fixture `MaintainProMigrateSource` @ `mongodb://127.0.0.1:27018` (disposable; production Mongo untouched)  
**Target:** SQL Server `MaintainProDev` (disposable)  
**Collation:** `SQL_Latin1_General_CP1_CI_AS`  
**Result:** PASS — `criticalFailures=0` on dry-run, apply, and second apply (idempotency)

## Transform registry

| Mongo | SQL Server |
|-------|------------|
| `*.id` / `_id` ObjectId string | Same string PK `NVARCHAR(36)` |
| Nested FK ObjectIds (`tenantId`, `userId`, …) | Hex string via `toSqlId` / `normalizeDocument` |
| BSON Date | Preserved as JS `Date` for Prisma |
| Money Floats (selected) | `DECIMAL(18,2)` via `toSqlDecimal` |
| `Role.permissionIds[]` + `Permission.roleIds[]` | `RolePermission` rows (compound upsert) |
| `User.skills[]` | `UserSkill` rows |
| `JobCode.requiredPartIds[]` | `JobCodeRequiredPart` |
| `PmPlan.requiredPartIds[]` | `PmPlanRequiredPart` |
| `VendorContract.assetIds[]` / `siteIds[]` | `VendorContractAsset` / `VendorContractSite` |
| `TraceabilityRecord.sprayLogIds[]` | `TraceabilitySprayLink` |
| Other `String[]` (photos, keywords, …) | `NVARCHAR(MAX)` JSON array text |
| Former `Json` fields | `NVARCHAR(MAX)` JSON text via `toJsonText` / `parseJsonText` |
| Prisma enums | `NVARCHAR(64)` strings; TS enums in `prisma-enums.ts` |

## Apply rehearsal counts (fixture)

| Model | Source | SQL | Migrated | Failed | Skipped | Orphans | Result |
| ----- | -----: | --: | -------: | -----: | ------: | ------: | ------ |
| Tenant | 1 | 1 | 1 | 0 | 0 | 0 | PASS |
| Permission | 2 | 2 | 2 | 0 | 0 | 0 | PASS |
| Role | 2 | 2 | 2 | 0 | 0 | 0 | PASS |
| Department | 1 | 1 | 1 | 0 | 0 | 0 | PASS |
| User | 2 | 2 | 2 | 0 | 0 | 0 | PASS |
| Site | 1 | 1 | 1 | 0 | 0 | 0 | PASS |
| FunctionalLocation | 1 | 1 | 1 | 0 | 0 | 0 | PASS |
| AssetDomain | 1 | 1 | 1 | 0 | 0 | 0 | PASS |
| AssetCategoryMaster | 1 | 1 | 1 | 0 | 0 | 0 | PASS |
| AssetTypeMaster | 1 | 1 | 1 | 0 | 0 | 0 | PASS |
| Asset | 1 | 1 | 1 | 0 | 0 | 0 | PASS |
| Vehicle | 1 | 1 | 1 | 0 | 0 | 0 | PASS |
| Supplier | 1 | 1 | 1 | 0 | 0 | 0 | PASS |
| Warehouse | 1 | 1 | 1 | 0 | 0 | 0 | PASS |
| SparePart | 1 | 1 | 1 | 0 | 0 | 0 | PASS |
| JobCode | 1 | 1 | 1 | 0 | 0 | 0 | PASS |
| MaintenanceRequest | 1 | 1 | 1 | 0 | 0 | 0 | PASS |
| WorkOrder | 1 | 1 | 1 | 0 | 0 | 0 | PASS |
| WorkOrderStatusHistory | 1 | 1 | 1 | 0 | 0 | 0 | PASS |
| ApprovalRule | 1 | 1 | 1 | 0 | 0 | 0 | PASS |
| ApprovalRequest | 1 | 1 | 1 | 0 | 0 | 0 | PASS |
| ApprovalStep | 1 | 1 | 1 | 0 | 0 | 0 | PASS |
| ApprovalDecision | 1 | 1 | 1 | 0 | 0 | 0 | PASS |
| PmPlan | 1 | 1 | 1 | 0 | 0 | 0 | PASS |
| AssetMeter | 1 | 1 | 1 | 0 | 0 | 0 | PASS |
| WorkOrderCostSnapshot | 1 | 1 | 1 | 0 | 0 | 0 | PASS |
| VendorContract | 1 | 1 | 1 | 0 | 0 | 0 | PASS |
| AuditLog | 1 | 2 | 1 | 0 | 0 | 0 | PASS |
| RolePermission (from parent arrays) | 3 | 3 | 3 | 0 | 0 | 0 | PASS |
| UserSkill (from parent arrays) | 3 | 3 | 3 | 0 | 0 | 0 | PASS |
| JobCodeRequiredPart (from parent arrays) | 1 | 1 | 1 | 0 | 0 | 0 | PASS |
| PmPlanRequiredPart (from parent arrays) | 1 | 1 | 1 | 0 | 0 | 0 | PASS |
| VendorContractAsset (from parent arrays) | 1 | 1 | 1 | 0 | 0 | 0 | PASS |
| VendorContractSite (from parent arrays) | 1 | 1 | 1 | 0 | 0 | 0 | PASS |
| RefreshToken | 0 | 0 | 0 | 0 | 0 | 0 | SKIP (no source; session recreate) |
| PasswordResetToken | 0 | 0 | 0 | 0 | 0 | 0 | SKIP (ephemeral) |
| Driver / Inspection / Compliance / PartIssue / Fleet sub-entities / Outbox / … | 0 | 0 | 0 | 0 | 0 | 0 | SKIP (absent from fixture; registry covers MIGRATE when present) |

**Totals (fixture core + junctions):** Source migrated rows ≈ 31 document models + 10 junction rows; Failed = 0; Orphans = 0.

AuditLog SQL=2 vs Source=1: expected — live marker row `p15a-marker-audit` inserted during backup/restore drill after first migrate; source count unchanged.

## Idempotency (second `--apply`)

| Check | Result |
|-------|--------|
| criticalFailures | 0 |
| Junction duplicates | None (compound unique upserts) |
| Core counts stable | PASS |
| RolePermission / UserSkill / JobCodeRequiredPart / PmPlanRequiredPart / VendorContract* | PASS |

## Relationship reconciliation

| Relationship | Result |
|--------------|--------|
| User → Role | PASS |
| Role → Permission (RolePermission) | PASS (3 links) |
| Department hierarchy | PASS (1 dept) |
| Site / FunctionalLocation | PASS |
| Asset → taxonomy / Site / FL | PASS |
| Vehicle → Asset (unique assetId) | PASS |
| Request → Asset / WO | PASS |
| WorkOrder → Asset / status history | PASS |
| Approval Request → Step → Decision | PASS |
| PM → Asset | PASS |
| Meter → Asset | PASS |
| Vendor contract → Asset/Site junctions | PASS |
| Cost snapshot precision (175.25 / 10.50) | PASS |
| Audit entity references | PASS |
| Cross-tenant FK leakage | PASS (0) |

## Business invariants (SQL-backed)

| Invariant | Result |
|-----------|--------|
| Converted request has correct primary WO | PASS |
| WorkOrder Asset/FL FKs valid | PASS |
| Vehicle.assetId unique | PASS |
| Cost snapshot equals source at Decimal precision | PASS |
| Approval chain complete | PASS |
| RolePermission preserved | PASS |
| No cross-tenant relationships | PASS |
| Parts issued − returned = consumption | N/A (no PartIssue in fixture) |
| PM no duplicate occurrence/generated WO | N/A (no PmAutoGeneration in fixture) |

## Search / collation

* Database collation: `SQL_Latin1_General_CP1_CI_AS` (case-insensitive, accent-sensitive)
* Asset tag search `LIKE 'ast-%'` matched `AST-100` — PASS
* Email `contains: 'ADMIN'` matched fixture admin — PASS

## Backup / restore drill (executed)

1. `BACKUP DATABASE [MaintainProDev] TO DISK='/var/opt/mssql/backup/MaintainProDev_p15a.bak'` — success (2714 pages)
2. Inserted marker `AuditLog.id='p15a-marker-audit'` on live DB
3. `RESTORE DATABASE [MaintainProDev_Drill]` from bak with MOVE — success
4. Drill DB users=2; marker absent on drill (pre-marker backup) — PASS
5. Live DB retains marker — PASS
6. Mongo source untouched

## Schema verification (MaintainProDev)

| Check | Count / evidence |
|-------|------------------|
| Base tables | 185 |
| Foreign keys | 379 |
| Indexes | 1011 |
| Junction tables | RolePermission, UserSkill, JobCodeRequiredPart, PmPlanRequiredPart, VendorContractAsset, VendorContractSite, TraceabilitySprayLink |
| PK/FK ID type | `NVARCHAR(36)` |
| Money | `DECIMAL(18,2)` |
| FK delete/update | `NO ACTION` |

## Application smoke (Prisma data-plane vs SQL)

HTTP login smoke deferred: fixture passwords are not production bcrypt hashes. Data-plane smoke (`scripts/mongo-to-sqlserver/smoke-sql.ts`) against live SQL: **17/17 PASS** (tenant, users, RBAC junctions, assets CI search, request→WO, PM, meter, cost, fleet, vendor, audit).

## Notes

* Fixture is representative CMMS core, not a full production dump. Model registry classifies remaining active models as MIGRATE when source collections exist; SKIP when absent/ephemeral/derived.
* Production Mongo was **not** modified or deleted.
* Production cutover: **NOT** performed.
