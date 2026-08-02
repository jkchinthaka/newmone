# Secret and Configuration Recovery

**Phase:** 6A  
**Rule:** Document **secret names and owners only — never values.**

## Recovery inventory

| Secret / config item | Owner | Approved storage | Rotation frequency | Recovery source | Last rotation status | Production requirement |
| --- | --- | --- | --- | --- | --- | --- |
| MongoDB root credential | **OPERATOR** (DBA) | Host vault / secret manager | On compromise or policy | Operator break-glass vault | **OPERATOR_OWNED_P0 — not rotated in Phase 6A** | Required; least privilege; not in Git |
| MongoDB application user (`DATABASE_URL` / `PRIMARY_DATABASE_URL`) | DBA + DevOps | Secret manager + server `.env` | Quarterly (PROVISIONAL) | Vault + compose env | **MANAGEMENT_APPROVAL_REQUIRED** | Required at boot |
| `BACKUP_DATABASE_URL` app user | DBA | Secret manager | Quarterly (PROVISIONAL) | Vault | **MANAGEMENT_APPROVAL_REQUIRED** | Required if replication enabled |
| `JWT_ACCESS_SECRET` / `JWT_SECRET` | Security + Backend | Secret manager | On compromise / 90d (PROVISIONAL) | Vault | **MANAGEMENT_APPROVAL_REQUIRED** | Boot fails if missing/CI sentinel |
| `JWT_REFRESH_SECRET` | Security + Backend | Secret manager | With access secret | Vault | **MANAGEMENT_APPROVAL_REQUIRED** | Required |
| CSRF / session cookie config (`COOKIE_SECURE`, `ALLOW_INSECURE_HTTP`) | Security + DevOps | Env + documented policy | On transport mode change | Git policy + env | Documented Phase 2 | HTTP dual opt-in only |
| MinIO root / service credentials (`MINIO_ROOT_USER`, `MINIO_ROOT_PASSWORD`, access keys) | IT | Secret manager | Quarterly (PROVISIONAL) | Vault | **MANAGEMENT_APPROVAL_REQUIRED** | Internal network only |
| SMTP credentials (`SMTP_*`) | IT | Secret manager | Per provider policy | Vault | Optional integration | Env-gated no-op when unset |
| SMS provider credentials | IT | Secret manager | Per provider | Vault | Optional | Env-gated |
| ERP credentials (`ERP_*`, Bileeta, etc.) | BA + IT | Secret manager | Per vendor | Vault | MOCK in E2E | Never commit; sanitize payloads |
| Readiness / admin API key (if configured) | Security | Secret manager | On compromise | Vault | **MANAGEMENT_APPROVAL_REQUIRED** | Protect detailed readiness |
| Cloudflare / DNS / TLS cert + private key | **OPERATOR** | CF dashboard + host vault | Before expiry | Operator store | **OPERATOR_OWNED** | HTTPS target state |
| Release image references (`maintainpro-api|web:<SHA>`) | Release manager | Container registry | Each release | Registry + `APP_COMMIT_SHA` | Phase 3 validated | Immutable deploy |

## Configuration (non-secret)

| Item | In Git? | Recovery |
| --- | --- | --- |
| `docker-compose.yml`, production/E2E overlays | Yes (structure) | Git tag matching `APP_COMMIT_SHA` |
| `.env.production.example` | Yes (names only) | Template + operator values |
| Nginx `default.conf` | Yes | Redeploy with image |
| Prisma schema | Yes | Migrate/push per runbook |

## Phase 6A exclusions

- **Do not rotate** MongoDB root or production secrets during E2E rehearsal.
- E2E uses disposable credentials from `.env.e2e.example` / CI materialization — never committed.
- Recovery smoke uses disposable JWT settings on temporary recovery API only.

## Post-DR order of operations

1. Restore platform secrets from vault (names above).
2. Point `PRIMARY_DATABASE_URL` to **restored** fresh database (operator).
3. Redeploy API/Web images at known SHA.
4. Reconcile Redis queues per `REDIS_QUEUE_RECOVERY_POLICY.md` (Policy B).
5. Validate MinIO credentials against restored buckets.
6. Run business smoke — no secret values in logs.
