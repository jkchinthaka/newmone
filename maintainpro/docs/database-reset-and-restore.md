# Destructive database reset and restore

MaintainPro supports a **fail-closed** full-data reset. It never runs automatically and never targets an unidentified or production database.

## Commands

| Script | Package command | Purpose |
| --- | --- | --- |
| `scripts/reset-all-data.mjs` | `npm run db:reset:all` | Delete all application collections after backup + confirmations |
| `scripts/verify-empty-database.mjs` | `npm run db:verify-empty` | Assert every Prisma model and live collection is empty |
| `scripts/bootstrap-admin.mjs` | `npm run db:bootstrap-admin` | Create one tenant + one `SUPER_ADMIN` only |
| `scripts/clear-redis-scoped.mjs` | `npm run redis:clear:scoped` | Delete MaintainPro/Bull-prefixed Redis keys (no `FLUSHALL`) |
| `scripts/clear-storage-test-data.mjs` | `npm run storage:clear:test-data` | Delete MinIO objects under a MaintainPro prefix (local/test only) |

Normal `npm run db:seed` is **not** invoked by reset.

## Safety gates (`db:reset:all`)

Required environment variables:

```text
ALLOW_DATABASE_RESET=true
CONFIRM_DATABASE_RESET=DELETE_ALL_MAINTAINPRO_DATA
APP_ENVIRONMENT=local|test|staging|development
PRIMARY_DATABASE_URL=...   # or DATABASE_URL
```

Recommended:

```text
EXPECTED_DATABASE_NAME=<exact-db-name>
MAINTAINPRO_BACKUP_DIR=<absolute-path-outside-repo>
```

Final interactive confirmation is required. For CI/non-TTY:

```text
DATABASE_RESET_YES=I_UNDERSTAND
```

The script refuses when:

- either confirmation variable is missing/incorrect;
- `NODE_ENV` / `APP_ENVIRONMENT` / classification is production;
- database URL or name is missing/unknown;
- classification is `unknown` or `unknown-remote` (set `APP_ENVIRONMENT` explicitly);
- `EXPECTED_DATABASE_NAME` does not match;
- a reset lock is already held;
- backup is required and fails verification.

### Backup

Staging and shared databases **must** be dumped with `mongodump` before deletion. Backups are written under `MAINTAINPRO_BACKUP_DIR` (default: sibling `maintainpro-backups` **outside** this repository) and must never be committed.

Restore (URL redacted in docs; use your secret manager):

```bash
mongorestore --uri="<REDACTED_URL>" --db=<databaseName> --drop "<backup-dir>/<databaseName>"
```

Disposable local/test only:

```text
SKIP_DATABASE_RESET_BACKUP=true
```

This flag is rejected for production and for non-local/non-test classifications.

## Empty verification

After a successful reset:

```bash
npm run db:generate
npm run db:verify-empty
```

`db:verify-empty` inspects every Prisma model and every live MongoDB collection (except documented `system.*` collections) and fails if any application documents remain.

## Optional bootstrap administrator

Only when explicitly instructed:

```bash
BOOTSTRAP_ADMIN_ENABLED=true
CONFIRM_BOOTSTRAP_ADMIN=CREATE_SINGLE_SUPER_ADMIN
BOOTSTRAP_ADMIN_EMAIL=you@example.com
BOOTSTRAP_ADMIN_PASSWORD='<12+ chars>'
BOOTSTRAP_TENANT_NAME='Acme Ops'
BOOTSTRAP_TENANT_SLUG=acme-ops
npm run db:bootstrap-admin
```

Creates: one `Tenant`, global `Permission` rows, one tenant `SUPER_ADMIN` `Role`, one `User`, one `TenantMembership`. No assets, work orders, farm, demo, or sample operational data.

## Redis / queues

```bash
ALLOW_REDIS_CACHE_CLEAR=true
CONFIRM_REDIS_CACHE_CLEAR=CLEAR_MAINTAINPRO_CACHE
REDIS_URL=...
npm run redis:clear:scoped
```

Deletes only known prefixes (`bull:`, `maintainpro:`, `tenant:`, `permissions:`, `reports:`, `idempotency:`, `session:`, …). Never `FLUSHALL`.

## Object storage

```bash
ALLOW_STORAGE_CLEAR=true
CONFIRM_STORAGE_CLEAR=CLEAR_MAINTAINPRO_TEST_OBJECTS
APP_ENVIRONMENT=local
EXPECTED_STORAGE_BUCKET=maintainpro-files-test
npm run storage:clear:test-data
```

Production evidence buckets are blocked. Orphaned objects outside the MaintainPro prefix are reported, not deleted.

## Production verdict

If the database was cleared but bootstrap, configuration, migration (`db:push`), or verification are incomplete, the production readiness verdict remains **NO-GO**.