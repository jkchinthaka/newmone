# Phase 15 — MongoDB → Microsoft SQL Server Migration

**Branch:** `maintainpro/phase-15-sqlserver-migration`  
**Source:** `maintainpro/integration-v1` @ `c54d7824ad42da0cd33c9c3a49dd5f7d0a6d2ed1`  
**Prisma:** `5.22.0` (no major upgrade)  
**Target DB:** Microsoft SQL Server — local `MaintainProDev`

## Objective

Platform migration only. Preserve Phase 0–14 business behavior, tenant isolation, and historical relationships.

## Architecture decisions

| Topic | Decision |
|-------|----------|
| ID strategy | `String @id @default(cuid()) @db.NVarChar(36)` — preserve migrated Mongo ObjectId hex strings |
| Enums | SQL Server Prisma 5 has **no enums** → `String @db.NVarChar(64)` + `apps/api/src/database/prisma-enums.ts` shim patched into client |
| Json | Prisma 5 SQL Server has **no Json** → `String @db.NVarChar(Max)` + `json-text.ts` helpers |
| Scalar lists | Junctions for RolePermission, UserSkill, JobCode/PmPlan parts, VendorContract links; other lists → JSON text |
| Cascades | All FK `onDelete`/`onUpdate` → `NoAction` (avoid multiple cascade paths) |
| Money | High-value CMMS costs → `Decimal(18,2)` |
| Dual-write | **Not** used |
| Production cutover | **Not** claimed in this phase |

## Deliverables

- Converted `prisma/schema.prisma` (sqlserver)
- Initial migration `20260915120000_phase15_sqlserver_init`
- `scripts/migrate-mongo-to-sqlserver.ts` (dry-run default)
- Application adaptations (RolePermission, insensitive removal, backup ping)
- Runbooks + reconciliation + audit docs
- Phase 15 Jest invariants

## Local apply status

SQL Server instance / Docker daemon were **not available** on the engineering host during this phase.  
Schema **validates** and client **generates**. Live `migrate deploy` / data apply / backup-restore = **NOT EXECUTED**.

## Next operator steps

1. Provision SQL Server + create `MaintainProDev`
2. Set `DATABASE_URL=sqlserver://...`
3. `npm run db:migrate:deploy`
4. Dry-run then `--apply` mongo→sql migration against disposable DB
5. Reconciliation + UAT on SQL Server
6. Do **not** cut over production without window + rollback plan
