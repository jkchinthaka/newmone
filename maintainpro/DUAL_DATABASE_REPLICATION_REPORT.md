# Dual Database Replication Report

## Executive Summary

MaintainPro now has a dual-database replication architecture with MongoDB Atlas `nelna` as the primary database and local MongoDB `bileeta_db` as the backup target. Normal application writes continue through the existing Prisma service, and write replication is captured centrally with a primary-side `ReplicationOutbox` model plus a polling NestJS sync worker.

## Audit Summary

The current implementation before this change used a single MongoDB Prisma datasource through `MONGODB_URI`/`DATABASE_URL`, with direct `PrismaService` injection across application modules. Existing audit middleware stored field-level history but was not suitable as a replication log. A legacy `MongoSyncService` existed behind `MONGO_SYNC_ON_STARTUP=true`, but it is a startup/full-sync compatibility path and not safe as the production replication mechanism. Health checks reported one database connection only.

## Implemented Architecture

- Primary Prisma datasource now uses `DATABASE_URL`, normalized from `PRIMARY_DATABASE_URL` for backward compatibility.
- Added primary/backup environment variables with placeholders in committed templates.
- Added `ReplicationOutbox` schema with status, retry, payload, correlation, source, target, and sync timestamp fields.
- Added `ReplicationOperation` and `ReplicationOutboxStatus` enums.
- Added a backup Prisma client owned by `PrismaService` and configured from `BACKUP_DATABASE_URL`.
- Added centralized Prisma middleware to capture create/update/upsert/delete operations for syncable Prisma models.
- Added transaction-aware outbox collection for code paths that already use `prisma.$transaction`.
- Added `ReplicationSyncService` polling worker for retryable async replication.
- Added idempotent backup apply logic using stable `id` upserts and delete-by-id.
- Added protected read-only admin endpoint `GET /api/admin/replication/status`.
- Added readiness and public health output for primary database and backup replication state.
- Added System Health web card for replication mode, open events, failures, lag, strict mode, and last sync.
- Added manual scripts `npm run db:backup:resync` and `npm run db:backup:verify`.
- Replaced runtime `createMany` paths for generated approval/line records with per-row `create` calls so replication sees stable generated IDs.

## Files Changed

- `prisma/schema.prisma`
- `apps/api/src/config/env.validation.ts`
- `apps/api/src/app.module.ts`
- `apps/api/src/database/prisma.service.ts`
- `apps/api/src/database/prisma.module.ts`
- `apps/api/src/database/replication.config.ts`
- `apps/api/src/database/replication.utils.ts`
- `apps/api/src/database/replication-sync.service.ts`
- `apps/api/src/database/replication-admin.controller.ts`
- `apps/api/src/database/backup-resync.ts`
- `apps/api/src/database/backup-verify.ts`
- `apps/api/src/health.service.ts`
- `apps/api/test/database-replication.spec.ts`
- `apps/api/package.json`
- `apps/web/app/(dashboard)/system-health/page.tsx`
- `apps/api/.env.example`
- `.env.example`, `.env.local.example`, `.env.production.example`, `.env.docker.example`
- `docker-compose.yml`, `docker-compose.dev.yml`
- `apps/api/src/modules/work-orders/work-orders.service.ts`
- `apps/api/src/modules/inventory/inventory.service.ts`
- documentation files listed in this report

## Runtime Behavior

- Default mode is `async_outbox`.
- Backup outages do not block primary writes in async mode. Events remain in primary `ReplicationOutbox` and retry until synced or dead-lettered.
- Strict mode attempts backup apply during the request after the outbox event is created. If strict backup readiness is required, backup failure causes the request to fail and the event remains retryable.
- Backup writes are idempotent by primary `id`, so retries and resync runs can safely re-apply the latest scalar/enum payload.

## Security And Credential Handling

- No real database credentials were added to committed files.
- Environment examples use placeholders only.
- Error messages shown in logs/readiness are sanitized with database URL masking.
- The admin replication endpoint is authenticated and requires `settings.system.manage`.

## Verification Plan

Validation will be completed with:

```bash
npm run db:generate
npx prisma validate --schema ./prisma/schema.prisma
npm run typecheck --workspace @maintainpro/api
npm run typecheck --workspace @maintainpro/web
npm run test --workspace @maintainpro/api -- --runTestsByPath test/database-replication.spec.ts
npm run test --workspace @maintainpro/api
npm run build
docker compose -f docker-compose.dev.yml config
docker compose -f docker-compose.yml config
```

## Residual Risks And Operator Notes

- Prisma middleware captures outbox events after the primary mutation returns. Existing transactional code paths collect events and persist them after the top-level transaction completes; non-transaction writes still have a small process-crash window between the primary write and outbox insert. Manual verification and resync scripts are provided to repair backup divergence. Eliminating that window entirely would require routing all mutating writes through an explicit transactional repository layer or MongoDB change stream capture.
- `createMany` does not return generated IDs. Runtime paths found in work-order and inventory flows were converted to per-row `create`; future bulk insert code should do the same or provide stable IDs explicitly.
- The backup resync script is non-destructive and does not delete backup-only records.
- Legacy `MongoSyncService` should remain disabled unless a separately reviewed compatibility sync is required.
