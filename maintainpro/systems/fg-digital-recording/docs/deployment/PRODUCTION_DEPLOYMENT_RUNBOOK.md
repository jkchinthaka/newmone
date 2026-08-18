# Production Deployment Runbook

**Do not claim production deployment without real execution on an authorized server.**

## 1. Prerequisites

- Approved release SHA
- Staging validation evidence (when staging exists)
- Secrets custody process
- DNS + TLS plan
- Backup owner named
- Support owner named

## 2. Server requirements (proposed)

- Linux host suitable for Docker Compose **or** systemd services
- CPU/RAM disk sized for PostgreSQL + Redis + web + Celery + logs + backups
- Outbound SMTP if email used
- Time sync (NTP) Asia/Colombo operational expectation

## 3. DNS

| Host | Purpose |
| --- | --- |
| `fg.nelna.lk` | FG application (placeholder until IT confirms) |
| `fg-staging.nelna.lk` | Staging (recommended) |

**EXTERNAL:** actual DNS records.

## 4. TLS

Terminate TLS at reverse proxy (Nginx/ingress).
**EXTERNAL BLOCKER** until certificates issued.

## 5–8. Database / Redis / Celery / Application

Recommended topology:

```text
Internet → Nginx → Django Web
                 → PostgreSQL (nelna_fg_db)
                 → Redis
                 → Celery Worker
                 → Celery Beat
```

Use production settings module: `config.settings.production`
Fail-closed required env vars are listed in `.env.example` and `production.py`.

## 9. Static / media

- `collectstatic` / frontend build (`npm ci` && `npm run build`)
- Media/object storage: MinIO/S3-compatible — **not** PostgreSQL for large files

## 10–11. Migrations / build

```bash
uv sync --locked --all-groups
npm ci && npm run build
uv run python manage.py migrate
uv run python manage.py collectstatic --noinput
uv run python manage.py check
```

## 12–13. Environment / secrets

- Copy from `.env.example`; fill production vault values
- Never commit `.env`
- `DEBUG=False`, secure cookies, HSTS, non-wildcard hosts

## 14. Backup

Enable scheduled PostgreSQL backup before go-live traffic.
See `docs/handover/BACKUP_RESTORE_DR.md`.

## 15. Deploy

1. Put maintenance notice if required by IT
2. Pull approved SHA
3. Migrate
4. Restart web/worker/beat
5. Verify health endpoints

## 16. Smoke (post-deploy)

Login, dashboard, one draft save, health live/ready — label **TECHNICAL SMOKE**.

## 17. Rollback

1. Redeploy previous approved SHA
2. Reverse migrations only if explicitly safe and tested
3. Restore DB only from verified backup with written approval

## 18. Monitoring

`docs/operations/MONITORING_RUNBOOK.md`

## 19. Support escalation

`docs/operations/SUPPORT_RUNBOOK.md`

## Staging package

See `infra/staging/` and `compose.staging.yaml` for a production-like local/staging template.
**Actually deployed staging:** not claimed unless company hosts it.
