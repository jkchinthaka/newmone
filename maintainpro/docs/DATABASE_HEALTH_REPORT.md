# Database Health Report

**Branch:** `maintainpro/phase-15-sqlserver-migration`  
**Audit date:** 2026-09-17  
**HEAD at audit start:** `cfef2526`  
**Schema:** Prisma 5.22 + SQL Server

## Schema Overview

- Modular monolith CMMS/EAM/Fleet schema
- Provider: SQL Server (`sqlserver`)
- IDs: cuid `@db.NVarChar(36)` — business numbers are separate fields
- FK delete behavior: **NoAction only** (0 Cascade relations in Prisma)

## Model Count

| Metric | Value |
|--------|------:|
| Prisma models | ~214 |
| FK onDelete Cascade | 0 |
| FK onDelete NoAction | ~439 |

## FK Count / Cascades

All Prisma relations use `onDelete: NoAction`. Operational rows (WO, Request, Audit, MeterReading, Downtime, Permit) are **not** deleted via cascade when masters are removed.

### Cascade table

| Pattern | Count | Risk |
|---------|------:|------|
| ON DELETE CASCADE | 0 | None |
| ON DELETE NO ACTION | All mapped FKs | Preferred — orphans blocked at delete time |
| ON DELETE SET NULL | 0 in Prisma | — |

## Unique Constraints

Strong tenant-aware uniques include: assetTag, registrationNo, woNumber, requestNumber, partNumber, vendorCode, permitNumber, generationKey, etc. (see MP-003 comments in schema).

Added: `@@unique([tenantId, id])` on Asset, Vehicle, WorkOrder, AssetMeter, WorkflowVersion, OrganizationUnit for integrity/trigger support.

## Tenant Isolation

| Layer | Status |
|-------|--------|
| Column `tenantId` on business tables | Present on core models |
| App `assertTenantEntityExists` | Present + tests |
| DB triggers cross-tenant FK | **Added** in `20260917240000` |
| PartRequest.tenantId | **Hardened to required** + backfill |
| Supplier.tenantId nullable | **MEDIUM** — legacy; portal/app still scopes |
| Composite Prisma FK (tenantId, assetId) | Not used (Prisma limitation with required tenant + optional asset) |

## Orphan Risks

| Risk | Mitigation |
|------|------------|
| MeterCorrection without meter | FK + orphan delete in migration |
| WO.workflowVersionId dangling | FK + nullify invalid before add |
| PartRequest without tenant | Backfill from WO; delete remainder |

## Data Integrity Risks

| ID | Severity | Finding | Status |
|----|----------|---------|--------|
| DI-1 | CRITICAL | Cross-tenant WO→Asset possible at DB | **FIXED** — triggers |
| DI-2 | CRITICAL | MeterCorrection no FK | **FIXED** |
| DI-3 | HIGH | Float money on parts/vendor/claims | **FIXED** → Decimal(18,2) |
| DI-4 | HIGH | PartRequest.tenantId nullable | **FIXED** |
| DI-5 | HIGH | Reporting views multi-tenant exposure | **MITIGATED** — tenantId NOT NULL + Power BI must filter; RLS external |
| DI-6 | MEDIUM | Branch only as string `branchScope` | **MITIGATED** — OrganizationUnit model |
| DI-7 | MEDIUM | No WorkflowInstance table | Documented — WO+StatusHistory sufficient |
| DI-8 | MEDIUM | Farm/utility Float money | Deferred (non-core) |
| DI-9 | MEDIUM | Soft delete only on EvidenceAttachment | Documented retirement/status pattern |
| DI-10 | LOW | Hierarchy cycles app-only for Asset | Acceptable with app tests; OrgUnit has trigger |

## Performance Risks

| Area | Notes |
|------|-------|
| Indexes | Strong tenant+status/dueDate coverage; added technician+status, workflowVersionId |
| N+1 | Domain services vary — not exhaustively profiled this pass |
| Reporting views | Simple projections; filter by tenantId in consumer |

## Migration Risks

| Migration | Notes |
|-----------|-------|
| `20260917240000` | Forward-only; Float→Decimal; destructive only for null-tenant PartRequest orphans and invalid FKs |
| Historical applied migrations | Not rewritten |

## Reporting Layer

- Views: `vw_rpt_dim_date`, `vw_rpt_dim_branch_site` (now joins OrgUnit), `vw_rpt_fact_maintenance`, `vw_rpt_fact_downtime`
- Security model: **service account + mandatory tenant filter in Power BI** (no SQL RLS yet — EXTERNAL/ops)
- KPI formulas: `docs/KPI_DEFINITIONS.md` / reporting-kpis module

## Fixes Applied

1. OrganizationUnit + CustomFieldValue models  
2. Tenant consistency triggers  
3. AuditLog / ConfigChangeHistory immutability triggers  
4. MeterCorrection → AssetMeter FK  
5. WorkOrder → WorkflowVersion FK  
6. PartRequest.tenantId NOT NULL + Decimal costs  
7. Money Decimal conversions (asset/vehicle/vendor/insurance/fines/budget)  
8. `(tenantId,id)` unique indexes  
9. Reporting view tenant predicates + OrgUnit dim  
10. `database-integrity.spec.ts`

## Remaining External Dependencies

- Production Power BI RLS / dataset gateway configuration  
- Live SQL Server role grants denying AuditLog DELETE to app users (trigger is app-DB safety net)  
- Bileeta live credentials (integration, not schema)

## Production-readiness verdict (database)

**Database architecture is enterprise-usable with CRITICAL/HIGH integrity gaps closed in this pass.**  
Do **not** claim “production ready” for Power BI multi-tenant RLS until ops configures dataset filters/RLS. Core OLTP integrity is substantially stronger after `20260917240000`.
