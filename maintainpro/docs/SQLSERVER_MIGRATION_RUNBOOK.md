# SQL Server Migration Runbook

## Prerequisites

- SQL Server reachable
- Database `MaintainProDev` (or target) created
- `DATABASE_URL` uses `sqlserver://` protocol
- Prisma 5.22.0
- Mongo source URL available for data copy (`MONGO_URL` / `MONGODB_URI`) — read-only

Example (dev only):

```env
DATABASE_URL="sqlserver://localhost:1433;database=MaintainProDev;user=<USER>;password=<PASSWORD>;schema=dbo;encrypt=true;trustServerCertificate=true"
```

Production: avoid `trustServerCertificate=true` unless policy requires it.

## Schema deploy

```bash
cd maintainpro
npm run db:generate
npm run db:migrate:status
npm run db:migrate:deploy
```

Do **not** use `db push` for production SQL Server.

Initial migration: `prisma/migrations/20260915120000_phase15_sqlserver_init`.

Legacy PostgreSQL folders were moved to `prisma/migrations_legacy_postgresql/` (reference only).

## Data migration

```bash
# Dry-run (default)
MONGO_URL="mongodb://..." SQLSERVER_URL="$DATABASE_URL" \
  npx ts-node --transpile-only scripts/migrate-mongo-to-sqlserver.ts

# Apply to disposable target
... scripts/migrate-mongo-to-sqlserver.ts --apply
```

- Idempotent upserts by preserved string `id`
- No Mongo deletes
- Transform Role.permissionIds → RolePermission before/during apply (see transform registry in reconciliation doc)

## Smoke after migrate

1. API boots with SQL `DATABASE_URL`
2. Login
3. Assets / Requests / Request→WO / WO lifecycle / PM / Fleet / Reports / Admin

## Cutover

See `SQLSERVER_CUTOVER_ROLLBACK.md`. Engineering completion ≠ production cutover.
