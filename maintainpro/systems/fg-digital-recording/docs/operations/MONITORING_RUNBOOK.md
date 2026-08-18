# Monitoring Runbook

**Purpose:** Production-oriented observability for FG Digital Recording.
**Do not log:** passwords, tokens, session IDs, or unnecessary sensitive business values.

## Minimum signals

| Signal | How to observe | Healthy | Action if unhealthy |
| --- | --- | --- | --- |
| Health live | `GET /health/live/` (or project equivalent) | 200 | Restart web; check process |
| Health ready | `GET /health/ready/` | 200 (DB/Redis OK) | Check PostgreSQL / Redis |
| Django errors | application JSON logs | no spike | triage traceback; no secret dump |
| Celery worker | worker process + ping/inspect | consuming | restart worker; check broker |
| Celery beat | beat process | scheduled | restart beat; avoid duplicate beats |
| Redis | `REDIS_URL` ping | PONG | restore Redis; web may degrade cache/queue |
| PostgreSQL | ready check / `pg_isready` | accepting | failover/restore per DR |
| Disk usage | host/volume metrics | headroom for DB+logs+backups | free disposable caches only |
| Backup status | backup job exit + artifact timestamp | fresh within RPO candidate | escalate; do not invent RPO |
| App error rate | reverse-proxy / APM if present | within baseline | incident process |

## Suggested alert ownership

| Alert | Owner | Notes |
| --- | --- | --- |
| Ready failing | IT | Blocks recording |
| Disk > threshold | IT | Protect backups |
| Backup failed | IT + Business continuity | **RPO BUSINESS DECISION** |
| Celery down | IT | Async jobs delayed |
| 5xx spike | IT + App support | Correlate deploy SHA |

## Logging hygiene

- Prefer structured JSON in production.
- Redact `Authorization`, cookies, `password`, tokens.
- Do not print full CSRF/session values.
- Correlate with `ENVIRONMENT_LABEL` and `APP_VERSION` / release SHA.

## SMTP / email

If email is used: configure timeouts and fail soft.
If credentials absent: **EXTERNAL BLOCKER — SMTP CREDENTIALS REQUIRED**.

## Staging vs production

Monitoring must be validated on staging before go-live.
Staging not yet deployed from this package unless company hosts it.

## Related docs

- `docs/operations/MONITORING_AND_ALERTS.md`
- `docs/operations/LOGGING_AND_OBSERVABILITY.md`
- `docs/operations/INCIDENT_RESPONSE.md`
- `docs/operations/SUPPORT_RUNBOOK.md`
