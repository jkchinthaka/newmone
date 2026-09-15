# Phase 15 — MongoDB → Microsoft SQL Server Migration Audit

**Date:** 2026-09-15  
**Source branch:** `maintainpro/integration-v1`  
**Source SHA:** `c54d7824ad42da0cd33c9c3a49dd5f7d0a6d2ed1`  
**Phase branch:** `maintainpro/phase-15-sqlserver-migration`  
**Prisma:** `^5.22.0` (kept — no Prisma 6/7 upgrade in this phase)  
**Schema:** `prisma/schema.prisma` — provider `mongodb`, **177 models**, ~6093 lines

> This audit was completed **before** active schema conversion. Classifications below drive the SQL Server target design.

---

## 1. Executive summary

| Area | Finding | Classification |
|------|---------|----------------|
| Datasource | `provider = "mongodb"` | APPLICATION CODE CHANGE + SCHEMA |
| PK IDs | 177 × `@default(auto()) @map("_id") @db.ObjectId` | TYPE CONVERSION |
| FK ObjectIds | 740 `@db.ObjectId` total | TYPE CONVERSION |
| Scalar lists `String[]` | 47 fields | ARRAY NORMALIZATION / JSON CONVERSION |
| Implicit M2M | `Role`↔`Permission` via dual arrays | RELATION NORMALIZATION |
| `Json` fields | 71 | JSON CONVERSION (keep Prisma `Json` on SQL Server where safe) |
| `onDelete: Cascade` | 71 | BLOCKER risk — multiple cascade paths |
| Financial `Float` | ~67 money-like | TYPE CONVERSION → `Decimal` |
| `mode: "insensitive"` | ~130 API call sites | APPLICATION CODE CHANGE |
| `db:push` / `db:migrate` alias | Mongo workflow | MIGRATION SCRIPT CHANGE |
| ReplicationOutbox / backup-resync | Mongo dual-DB | BACKUP/RESTORE CHANGE |
| `mongoose` package | Present, **unused** in API source | APPLICATION CODE CHANGE (retain until FG/other confirmed; removable from MaintainPro API) |
| Local SQL Server | Not installed on engineer host (MySQL/Postgres only) | BLOCKER for live apply until Docker/instance provisioned |
| Production cutover | Not in scope of engineering-only completion | BLOCKER (by design) |

---

## 2. MongoDB-specific Prisma features inventory

### 2.1 Datasource

```prisma
datasource db {
  provider = "mongodb"
  url      = env("DATABASE_URL")
}
```

**Target:** `provider = "sqlserver"`, same `DATABASE_URL` env name with SQL Server connection string.

### 2.2 ObjectId / `_id` / `auto()`

| Marker | Count | Action |
|--------|------:|--------|
| `@db.ObjectId` | 740 | Remove; map PKs/FKs to `@db.NVarChar(36)` |
| `@map("_id")` | 177 | Remove |
| `@default(auto())` | 177 | Replace with `@default(cuid())` for **new** rows; **preserve** migrated Mongo ID strings |

**ID strategy (locked):** application IDs remain `String` (`NVarChar(36)`). Migrated ObjectId hex strings (24 chars) preserved. New records use `cuid()`. Do not mix integer identities.

### 2.3 Scalar lists (`String[]`) — 47 fields

#### RELATIONAL_JUNCTION_REQUIRED

| Model | Field | ObjectId? | Target junction |
|-------|-------|-----------|-----------------|
| `Permission` | `roleIds` | Y | `RolePermission` (drop dual array; Role owns join) |
| `Role` | `permissionIds` | Y | `RolePermission` |
| `JobCode` | `requiredPartIds` | Y | `JobCodeRequiredPart` |
| `PmPlan` | `requiredPartIds` | Y | `PmPlanRequiredPart` |
| `TraceabilityRecord` | `sprayLogIds` | Y | `TraceabilitySprayLink` |
| `VendorContract` | `assetIds` | Y | `VendorContractAsset` |
| `VendorContract` | `siteIds` | N | `VendorContractSite` |
| `SoftwareRelease` | `linkedChangeRequests` | N | `SoftwareReleaseLink` (type+id) or retain serialized (soft-retired module) |
| `SoftwareRelease` | `linkedQaIssues` | N | same |
| `SoftwareRelease` | `linkedTickets` | N | same |

#### SERIALIZED_JSON_TEXT (NVARCHAR(MAX) holding JSON array string)

Non-query-critical URL/tag lists: `User.skills`, `Employee.skills`/`workCategories`, photo/document/attachment URL arrays, taxonomy keyword arrays, `ApprovalRule.priorityScope`/`workTypeScope`, checklist `options`, `Supplier.serviceCategories`, etc.

**Central helpers:** `apps/api/src/common/utils/json-array.ts` — serialize/parse with safe failure.

#### Classification: User.skills

Prefer **UserSkill** junction (skills used for assignment filtering) — RELATION NORMALIZATION.

### 2.4 Json fields (71)

Prisma SQL Server **supports** `Json` natively. Strategy:

| Class | Action |
|-------|--------|
| **B — snapshots / audit** | Keep `Json` (SQL Server stores as NVARCHAR). Optional future NVARCHAR(Max)+helpers. |
| **A — queryable** | Keep `Json` for Phase 15 engineering cutover; document follow-up normalization for `Asset.customAttributes`, `ApprovalRule.conditions`, checklist item graphs if indexing needed. Do **not** opaque-string critical cost line items without helpers. |

`WorkOrderCostSnapshot.lineItems` remains `Json` with Decimal money columns on the snapshot header — preserve Phase 9 immutability.

### 2.5 Cascade paths (SQL Server BLOCKER risk)

71 `onDelete: Cascade`. Riskiest multi-path from `Tenant`:

- Facility: Tenant→Property→Building→Floor→Room (+ Tenant direct)
- Taxonomy: Tenant→AssetDomain→Category→Type→AttributeDef
- Site→FunctionalLocation (+ Tenant)
- MaintenanceRequest→History (+ Tenant)
- TenantMembership / Invitation (Tenant + User)

**Strategy:** Prefer `onDelete: NoAction` / `onUpdate: NoAction` on historical and multi-path FKs. Soft-delete tenants in app layer. Do not cascade-delete maintenance history.

### 2.6 Nullable unique

SQL Server allows multiple NULLs in unique indexes differently than Mongo sparse unique. Audit `Vehicle.assetId`, ERP external refs, optional legacy IDs — may need filtered unique indexes via custom SQL migration.

### 2.7 Float → Decimal (financial)

~67 money-like Float fields. Phase 15 converts high-value CMMS financial fields to `Decimal @db.Decimal(18, 2)` (cost snapshots, WO costs, PO lines, invoices, approval thresholds). Farm/soft-retired Floats documented as TYPE CONVERSION backlog if compile-risk outweighs cutover value — preference is convert CMMS-critical first.

### 2.8 DateTime

Keep Prisma `DateTime` → SQL `datetime2`. Application stores UTC; do not reinterpret as local.

### 2.9 Indexes

Rebuild tenant isolation composites: `tenantId`, `tenantId+status`, `tenantId+createdAt`, asset/request/WO/PM/fleet/ERP/audit patterns per Phase 15 brief §17. Avoid index explosion.

---

## 3. Application / tooling inventory

| Component | Path | Classification |
|-----------|------|----------------|
| PrismaService | `apps/api/src/database/prisma.service.ts` | APPLICATION — replace `$runCommandRaw` ping |
| Seed | `apps/api/src/database/seed.ts` | APPLICATION — RolePermission junctions; no `permissionIds: { set }` |
| workforce-seed | `apps/api/src/database/workforce-seed.ts` | APPLICATION — remove `$runCommandRaw` / `$unset` |
| backup-resync / verify | `apps/api/src/database/backup-*.ts` | BACKUP/RESTORE CHANGE — Mongo dual-DB; retire/adapt |
| ReplicationOutbox | schema + `replication-sync.service.ts` | BACKUP/RESTORE — retain model for generic outbox or mark Mongo-legacy |
| env.validation | `apps/api/src/config/env.validation.ts` | APPLICATION — allow `sqlserver` provider |
| docker-compose | `docker-compose*.yml` | DEPLOY — add SQL Server service; Mongo retained as migration source only |
| package.json scripts | `db:push` / `db:migrate` alias | MIGRATION SCRIPT CHANGE → `prisma migrate` |
| Legacy `prisma/migrations` | PostgreSQL lock | Discard/replace with SQL Server initial migration |
| `mongoose` | `apps/api/package.json` only | Unused in MaintainPro API — document; do not break FG if shared |
| `mode: "insensitive"` | ~130 sites / 25 files | APPLICATION CODE CHANGE |
| ObjectId validators | `operations.service.ts`, farm modules, phase4 helper | APPLICATION — accept cuid + 24-hex |

### Raw Mongo usage

| File | Usage |
|------|-------|
| `prisma.service.ts` | `$runCommandRaw({ ping: 1 })` |
| `workforce-seed.ts` | `$runCommandRaw` + `$unset` |
| `scripts/import-vehicles.ts` | `$runCommandRaw` upsert |

### Roles service

`roles.service.ts` uses `permissionIds: { set: [...] }` — must become RolePermission sync.

---

## 4. Data migration design (preview)

| Item | Decision |
|------|----------|
| Source | MongoDB read-only snapshot |
| Target | SQL Server `MaintainProDev` (local) / disposable test DB |
| Dual-write | **Not** default |
| Script | `scripts/migrate-mongo-to-sqlserver.ts` — dry-run default, `--apply` for writes |
| ID preservation | Copy Mongo `_id` / `id` strings as-is into SQL PK |
| Order | Tenant → Roles/Permissions → Users → org → assets → fleet → requests → WOs → approvals → PM → parts → audit (derive exact graph from schema) |

---

## 5. Environment

**Canonical after cutover:**

```env
DATABASE_URL="sqlserver://localhost:1433;database=MaintainProDev;user=...;password=...;schema=dbo;encrypt=true;trustServerCertificate=true"
```

- Never commit credentials.
- Production: avoid `trustServerCertificate=true` unless policy requires.
- `PRIMARY_DATABASE_URL` / `BACKUP_DATABASE_URL` / `MONGODB_URI`: mark **source-migration-only / legacy** after cutover.
- `DATABASE_PROVIDER`: allow `sqlserver`.

---

## 6. Blockers (pre-implementation)

1. **Multiple cascade paths** — must soften before SQL Server migrate apply.
2. **Scalar list / M2M** — RolePermission + other junctions required before generate.
3. **Local SQL Server instance** — not present on audit host; Docker SQL Server 2022 required for apply validation.
4. **Insensitive search** — must be rewritten before SQL-backed tests pass.
5. **Mongo backup-resync** — not a SQL Server backup; Phase 14 restore blocker remains until SQL backup/restore executed.
6. **Production cutover** — explicitly out of engineering auto-complete.

---

## 7. Compatibility matrix (summary classes)

| Class | Meaning |
|-------|---------|
| DIRECTLY COMPATIBLE | Scalar String/Int/Boolean/DateTime/enums with bounded lengths |
| TYPE CONVERSION | ObjectId→NVarChar(36), Float→Decimal(money), auto()→cuid() |
| RELATION NORMALIZATION | M2M / ID arrays → junctions |
| JSON CONVERSION | Keep Json or NVARCHAR snapshot; Class A follow-ups documented |
| ARRAY NORMALIZATION | String[] → junction or JSON text |
| APPLICATION CODE CHANGE | Queries, seeds, ping, insensitive, validators |
| MIGRATION SCRIPT CHANGE | prisma migrate, mongo→sql pipeline |
| BACKUP/RESTORE CHANGE | Replace Mongo dual-DB with SQL Server backup runbook |
| BLOCKER | Cascade cycles, missing SQL Server, production cutover gates |

---

## 8. Audit gate

**Schema conversion must not begin until this file exists on the Phase 15 branch.**

Next: convert schema per this audit → `prisma validate` / `generate` → migrate → application adaptations → data pipeline → reconciliation docs → tests.
