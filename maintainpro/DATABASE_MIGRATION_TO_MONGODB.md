# MongoDB Rollout Runbook

This runbook is the active database rollout path for MaintainPro. The Prisma datasource in `prisma/schema.prisma` uses `provider = "mongodb"`; SQL migration folders under `prisma/migrations/` are legacy metadata and are not the production deployment mechanism.

## Target State

- Primary database: MongoDB Atlas database `nelna`.
- Backup database: authenticated local MongoDB 7 replica set database `bileeta_db`.
- Application ORM: Prisma Client generated from `prisma/schema.prisma`.
- Prisma datasource: `DATABASE_URL=${PRIMARY_DATABASE_URL}`.
- Backup target URI shape: `mongodb://<username>:<password>@localhost:27017/bileeta_db?authSource=bileeta_db&replicaSet=rs0`.
- Docker backup URI shape: `mongodb://<username>:<password>@mongo:27017/bileeta_db?authSource=bileeta_db&replicaSet=rs0`.
- Atlas primary URI shape: `mongodb+srv://<username>:<password>@<cluster-host>/nelna?retryWrites=true&w=majority`.

## Required Environment Variables

```env
DATABASE_PROVIDER=mongodb
PRIMARY_DATABASE_URL=mongodb+srv://<username>:<password>@<atlas-host>/nelna?retryWrites=true&w=majority
BACKUP_DATABASE_URL=mongodb://<username>:<password>@localhost:27017/bileeta_db?authSource=bileeta_db&replicaSet=rs0
DATABASE_URL=${PRIMARY_DATABASE_URL}
MONGODB_URI=${PRIMARY_DATABASE_URL}
PRIMARY_DATABASE_NAME=nelna
BACKUP_DATABASE_NAME=bileeta_db
MONGO_DATABASE_NAME=nelna
MONGO_SYNC_ON_STARTUP=false
DATABASE_REPLICATION_ENABLED=true
DATABASE_REPLICATION_MODE=async_outbox
DATABASE_REPLICATION_RETRY_ATTEMPTS=5
DATABASE_REPLICATION_RETRY_DELAY_MS=5000
DATABASE_REPLICATION_BATCH_SIZE=100
BACKUP_DATABASE_REQUIRED_FOR_READINESS=false
BACKUP_DATABASE_REQUIRED_FOR_STRICT_MODE=true
```

`DATABASE_URL` is kept for Prisma compatibility and must resolve to `PRIMARY_DATABASE_URL`.

Never commit real credentials. If a credential was pasted into a committed file or shared terminal output, rotate it before go-live.

## Local Backup MongoDB Setup

1. Create a MongoDB 7 single-node replica set named `rs0`.
2. Create a database named `bileeta_db`.
3. Create an application user in `bileeta_db` with `readWrite` on `bileeta_db`.
4. Copy `.env.local.example` to `.env` and replace placeholders with the real Atlas primary URI and local backup URI.
5. Confirm the backup URI authenticates against `authSource=bileeta_db`.

```bash
mongosh "mongodb://<username>:<password>@localhost:27017/bileeta_db?authSource=bileeta_db&replicaSet=rs0" --eval "db.runCommand({ ping: 1 })"
```

## Docker MongoDB Setup

1. Copy `.env.docker.example` to `.env`.
2. Set `MONGO_INITDB_ROOT_USERNAME`, `MONGO_INITDB_ROOT_PASSWORD`, `MONGO_APP_USERNAME`, and `MONGO_APP_PASSWORD` to local-only values.
3. Start the development stack.

```bash
npm run docker:up:dev
```

The Docker init script creates the backup app user in `bileeta_db` on a new Mongo volume. If an older unauthenticated volume already exists, stop the stack and either migrate its data into the new database or create a fresh volume intentionally. Do not delete data-bearing volumes without an approved backup.

## Schema Rollout

Run from the `maintainpro/` repository root.

```bash
npm run db:generate
npm run db:push
```

`npm run db:migrate` is a compatibility alias for `db:push`. Do not use Prisma SQL migration commands as production instructions for MongoDB.

## Seed And Verification

Seed after schema push:

```bash
export MAINTAINPRO_SEED_PASSWORD="<secure-seed-password-from-secret-store>"
npm run db:seed
```

Do not commit the seed password. Provide it through the shell, Render secret env vars, or the operator's secret manager.

The seed is idempotent and verifies:

- Required roles exist, including `SECURITY_OFFICER`.
- Required permissions exist, including `gate.out.create`, `gate.in.create`, and `operations.scan_lookup`.
- `SUPER_ADMIN` has the full permission catalog.
- Tenant-level vehicle gate policy exists.
- Core MongoDB collections are queryable.

After seeding, confirm expected access paths:

```bash
npm run test --workspace @maintainpro/api -- --runTestsByPath test/roles.guard.spec.ts test/permissions.guard.spec.ts test/vehicles-phase2.http-e2e.spec.ts test/phase3-workflow.http-e2e.spec.ts
```

## Backup Replication Verification

Use the dual-database runbook for operational details: [DUAL_DATABASE_REPLICATION.md](DUAL_DATABASE_REPLICATION.md).

Before relying on the backup database, run:

```bash
npm run db:backup:resync -- --dry-run
npm run db:backup:verify
```

After backup connectivity is confirmed and an operator approves repair:

```bash
npm run db:backup:resync
npm run db:backup:verify
```

## Application Readiness Checks

1. Start or deploy the API.
2. Open `/health` and `/health/ready`.
3. Confirm the primary database check reports MongoDB Atlas connectivity as healthy.
4. Confirm the backup replication check reports the backup database status, pending events, failures, last successful sync, and lag.
5. Confirm optional providers report their real state:
   - SMTP disabled or configured.
   - SMS disabled or configured.
   - ERP `mock` blocked in production unless explicitly allowed, or HTTP configured.
   - Push `noop` or HTTP configured.
6. Run the deployment smoke script against hosted services.

```bash
$env:MAINTAINPRO_WEB_URL="https://app.example.com"
$env:MAINTAINPRO_API_URL="https://api.example.com/api"
$env:MAINTAINPRO_SMOKE_EMAIL="<smoke-test-email>"
$env:MAINTAINPRO_SMOKE_PASSWORD="<smoke-test-password>"
npm run smoke:deploy
```

## Rollback Plan

Before production rollout:

- Take a MongoDB Atlas backup or snapshot.
- Preserve the local backup MongoDB volume or snapshot.
- Record the deployed Git SHA, Render deploy id, and web deploy id.
- Export a copy of production environment variable names without secret values.

If rollout fails before writes are accepted:

1. Disable public traffic or keep the previous deployment active.
2. Revert API and web to the last known-good deployment.
3. Restore the pre-rollout environment variables if they changed.
4. Re-run `/health/ready` and smoke tests.

If rollout fails after production writes have started:

1. Pause non-essential background jobs and provider integrations.
2. Preserve the current MongoDB state for investigation.
3. Restore from the latest approved backup only after product owner approval, because restores can discard accepted user writes.
4. Rotate any database or provider credential that may have been exposed during incident response.

## Credential Rotation Checklist

- Rotate both primary Atlas and backup MongoDB app user passwords before production launch.
- Rotate JWT secrets if they were used in local testing or shared outside the secret manager.
- Rotate SMTP, SMS, ERP, push, Cloudinary, Stripe, Google, and RapidAPI keys before enabling those providers in production.
- Redeploy API after changing backend secrets.
- Redeploy web after changing public API URL variables.

## Go-Live Gate

Proceed only when all are true:

- `npm run db:generate` passes.
- `npm run db:push` has been rehearsed on staging.
- `npm run db:seed` passes seed verification.
- `npm run db:backup:verify` passes after an approved resync or live replication window.
- API typecheck, focused authorization/provider tests, and production build pass.
- `/health/ready` shows the primary database ready, backup replication visible, and optional providers either configured or intentionally disabled.
- Custom domains, DNS, HTTPS, and CORS are verified against final production origins.
