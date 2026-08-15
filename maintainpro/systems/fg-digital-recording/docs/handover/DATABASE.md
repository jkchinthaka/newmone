# Database

## Current authoritative position

- PostgreSQL is the implemented system of record
- Redis is supporting infrastructure for cache and Celery
- MongoDB is not the application default database
- No production data cutover to MongoDB is authorized

Authoritative references:

- [../PROJECT_STATUS.md](../PROJECT_STATUS.md)
- [../architecture/ADR-002-POSTGRESQL-PRIMARY-DATABASE.md](../architecture/ADR-002-POSTGRESQL-PRIMARY-DATABASE.md)
- [../architecture/ADR-018-DATABASE-PLATFORM-MONGODB-ASSESSMENT.md](../architecture/ADR-018-DATABASE-PLATFORM-MONGODB-ASSESSMENT.md)
- [../migration/MONGODB_POC_RESULTS.md](../migration/MONGODB_POC_RESULTS.md)

## PostgreSQL

PostgreSQL remains the source of truth for:

- accounts and authentication state
- organization scope and RBAC
- checklist definitions and versions
- checklist tasks, records, submissions, reviews, and QA dispositions
- evidence metadata
- NCR/HOLD/CAPA and downstream quality modules

The repository was engineered around relational integrity, constraints, and transactional workflows.

## MongoDB status

Exact POC gate status from `docs/migration/MONGODB_POC_RESULTS.md`:

```text
STATUS: MONGODB POC PARTIAL — ISOLATED INVARIANTS PASSED; FULL APPLICATION NOT PROVEN — DO NOT MIGRATE
```

Recorded cutover decision from the same document:

```text
STATUS: MONGODB POC FAILED FOR CUTOVER — DO NOT MIGRATE
```

## Why MongoDB is blocked

Per the authoritative assessment:

- isolated mirror-model invariants passed in a POC
- full application behavior on MongoDB was not proven
- production-path gaps remain around `select_for_update`, nested savepoints, `prefetch_related`, `OuterRef`/`Subquery`, and stock `auth.User` AutoField behavior
- owner approval `APR-020` is still required

See [MONGODB_MIGRATION_STATUS.md](MONGODB_MIGRATION_STATUS.md) for the handover blocker summary.

## Local database setup

Default local host ports:

- PostgreSQL: `127.0.0.1:5433`
- Redis: `127.0.0.1:6380`

Bring up the local database services:

```powershell
docker compose up -d postgres redis
uv run python manage.py migrate
```

## Backup/restore scope

- PostgreSQL backup and restore are documented
- Evidence-file backup is a separate operational concern
- MongoDB backup is not part of the production SoR runbook

See [BACKUP_RESTORE.md](BACKUP_RESTORE.md) and [../operations/BACKUP_RESTORE_RUNBOOK.md](../operations/BACKUP_RESTORE_RUNBOOK.md).

## Handover rule

Any future database decision must preserve the repository’s current safety language:

- do not claim MongoDB is accepted as SoR
- do not claim cutover approval
- do not treat a POC as a migration authorization
