# Dual Database Replication Runbook

MaintainPro uses MongoDB Atlas as the primary source of truth and a local MongoDB replica-set database as an asynchronous backup target.

## Target Topology

- Primary database: MongoDB Atlas database `nelna`.
- Backup database: local MongoDB database `bileeta_db`.
- Application ORM: Prisma Client with `DATABASE_URL` pointing at the primary database.
- Replication mechanism: primary write, durable `ReplicationOutbox` event in the primary database, background sync to the backup database.
- Stable identity: backup writes use the primary record `id` for idempotent `upsert` or `delete`.

## Required Environment Variables

Use secret-manager values in shared environments. Do not commit real usernames, passwords, hosts, or API keys.

```env
DATABASE_PROVIDER=mongodb
PRIMARY_DATABASE_URL=mongodb+srv://<username>:<password>@<atlas-host>/nelna?appName=Nelna
BACKUP_DATABASE_URL=mongodb://<username>:<url_encoded_password>@<backup-host>:27017/bileeta_db?authSource=bileeta_db&replicaSet=rs0
DATABASE_URL=${PRIMARY_DATABASE_URL}
MONGODB_URI=${PRIMARY_DATABASE_URL}
PRIMARY_DATABASE_NAME=nelna
BACKUP_DATABASE_NAME=bileeta_db
MONGO_DATABASE_NAME=nelna
DATABASE_REPLICATION_ENABLED=true
DATABASE_REPLICATION_MODE=async_outbox
DATABASE_REPLICATION_RETRY_ATTEMPTS=5
DATABASE_REPLICATION_RETRY_DELAY_MS=5000
DATABASE_REPLICATION_BATCH_SIZE=100
BACKUP_DATABASE_REQUIRED_FOR_READINESS=false
BACKUP_DATABASE_REQUIRED_FOR_STRICT_MODE=true
```

## Replication Modes

- `async_outbox`: default. The API writes to the primary database and queues a primary-side outbox event. The background worker retries backup sync until it succeeds or reaches the dead-letter threshold. Backup outages do not block normal primary writes.
- `strict_dual_write`: the API writes the primary record, queues the outbox event, then applies the event to the backup before returning. When `BACKUP_DATABASE_REQUIRED_FOR_STRICT_MODE=true`, backup failure blocks the request and leaves the outbox event retryable.
- `disabled`: no new replication events are captured and the worker stays idle.

## Schema And Generation

Run from the `maintainpro/` directory after schema changes or first setup.

```bash
npm run db:generate
npm run db:push
```

The `ReplicationOutbox` model is stored in the primary database. It tracks the entity type, stable entity id, operation, payload, status, attempts, retry time, last error, correlation id, and sync timestamp.

## Local Backup Setup

1. Run MongoDB 7 as a single-node replica set named `rs0`.
2. Create database `bileeta_db`.
3. Create an application user with `readWrite` on `bileeta_db`.
4. Use a URL-encoded password in `BACKUP_DATABASE_URL`.
5. Confirm the backup is reachable.

```bash
mongosh "mongodb://<username>:<password>@localhost:27017/bileeta_db?authSource=bileeta_db&replicaSet=rs0" --eval "db.runCommand({ ping: 1 })"
```

Docker Compose uses the `mongo` service as the backup target by default and keeps the app ready for an Atlas primary through `PRIMARY_DATABASE_URL`.

## Runtime Monitoring

Readiness exposes primary and backup replication state at:

- Public readiness payload: `GET /api/health/ready`
- Protected admin payload: `GET /api/admin/replication/status`
- Web dashboard: System Health page, Backup Replication card

The replication status includes:

- enabled/configured state
- replication mode
- primary and backup database names
- strict mode active flag
- pending, processing, failed, and dead-letter event counts
- last successful sync time
- current lag in milliseconds
- sanitized failure messages

The protected admin status endpoint requires authentication and `settings.system.manage` permission.

## Manual Resync

Use a dry run before any manual repair.

```bash
npm run db:backup:resync -- --dry-run
```

Apply a full primary-to-backup upsert pass:

```bash
npm run db:backup:resync
```

The resync script iterates Prisma models except `ReplicationOutbox`, keeps only scalar and enum fields, and upserts into the backup by stable `id`. It does not delete extra backup records; use a reviewed maintenance plan before destructive cleanup.

## Verification

Run comparison checks for critical business models and outbox health:

```bash
npm run db:backup:verify
```

The verification script prints primary counts, backup counts, checksum matches, last sync time, pending events, failed events, dead-letter events, and lag. A mismatch or failed/dead-letter event exits non-zero.

## Failure Handling

- Backup unavailable in `async_outbox`: primary writes continue, outbox events become `FAILED`, and the worker retries with `nextRetryAt`.
- Backup unavailable in `strict_dual_write`: request fails when strict backup readiness is required, and the outbox event remains retryable.
- Repeated failures: events move to `DEAD_LETTER` after `DATABASE_REPLICATION_RETRY_ATTEMPTS`.
- Recovery: restore backup connectivity, inspect `/health/ready`, run `npm run db:backup:verify`, and use `npm run db:backup:resync` when counts or checksums differ.

## Operational Notes

- Keep `MONGO_SYNC_ON_STARTUP=false`; the legacy sync service is not the replication path.
- Use `DATABASE_URL=${PRIMARY_DATABASE_URL}` for Prisma compatibility.
- Keep Redis optional for replication. The replication worker is DB-backed and does not rely on Bull queues.
- Runtime bulk insert paths that require generated IDs should use normal `create` calls so outbox capture has stable record IDs.
- Sanitized logs and health payloads must not expose database credentials.
