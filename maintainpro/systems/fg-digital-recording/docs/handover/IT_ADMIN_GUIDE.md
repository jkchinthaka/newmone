# IT Admin Guide — FG Digital Recording

Practical operations for IT administrators. Does not replace business approvals.

## Users and roles

- Create named users only (see `docs/security/PRODUCTION_USER_PROVISIONING.md`).
- Assign organization and site scope.
- Apply least privilege; review SoD (`docs/security/SEGREGATION_OF_DUTIES_MATRIX.md`).
- Deactivate leavers; do not delete historical actors.
- Demo accounts must not exist in production.

## Master data

- Load only company-approved CSVs from `docs/handover/templates/`.
- Never invent temperature limits, sites, shifts, or products.

## Migrations

```bash
uv run python manage.py showmigrations
uv run python manage.py migrate
uv run python manage.py makemigrations --check
```

## Health checks

- Live and ready HTTP endpoints (see monitoring runbook).
- Confirm PostgreSQL and Redis before declaring ready.

## Logs

- Production: structured JSON console logs.
- Do not paste secrets into tickets.
- Correlate incidents with release SHA / `APP_VERSION`.

## Celery / Redis

- Worker consumes async tasks; Beat schedules periodic jobs.
- One Beat instance per environment.
- Redis is non-authoritative; PostgreSQL remains SoR.

## Backups / restore

- `scripts/ops/backup_postgres.sh` (and related ops scripts).
- Non-production restore drill: `python scripts/ops/restore_drill.py`.
- Never overwrite development DB accidentally; use isolated restore DB.
- RPO/RTO: **BUSINESS/IT DECISION REQUIRED**.

## Deployment / restart / rollback

- Follow `docs/deployment/PRODUCTION_DEPLOYMENT_RUNBOOK.md`.
- Restart web, worker, beat independently as needed.
- Rollback to previous approved SHA with IT approval.

## Troubleshooting starters

| Symptom | First checks |
| --- | --- |
| Cannot login | user active, org assignment, lockout, password reset policy |
| 500 errors | app logs, recent deploy SHA, DB connectivity |
| Queue empty | permissions, filters, org scope, Celery if async |
| Health ready fail | Postgres, Redis |
| Disk full | logs, backup retention, safe cache cleanup only |

See also `docs/operations/SUPPORT_RUNBOOK.md`.
