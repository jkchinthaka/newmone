# Production Deployment Readiness Checklist

Use this checklist before go-live. This sprint adds honest readiness helpers only — **no automatic deployment**.

## Quick commands

From `maintainpro/`:

```bash
npm run typecheck
npm run lint
npm run test
npm run build
npm run deployment:readiness
node scripts/healthcheck.mjs
```

API admin endpoints (authenticated):

- `GET /api/health/readiness`
- `GET /api/health/deployment-readiness`

## 1. Database readiness

- [ ] `PRIMARY_DATABASE_URL` / `DATABASE_URL` points to production MongoDB
- [ ] `npm run db:generate` succeeds in CI/build
- [ ] `npm run db:push` / seed plan documented (seed only where approved)
- [ ] Backup replication policy reviewed (`BACKUP_DATABASE_URL`, `DATABASE_REPLICATION_MODE`)
- [ ] Backup verify script run in staging (`npm run db:backup:verify`)

## 2. Redis / queue readiness

- [ ] `REDIS_URL` configured when `REDIS_REQUIRED_IN_PRODUCTION=true`
- [ ] `/health/readiness` queue section operational or explicitly accepted as degraded
- [ ] Notification queue failures monitored

## 3. Health / readiness endpoints

- [ ] `/health` public liveness reachable
- [ ] `/health/readiness` protected in production (`READINESS_API_KEY` and/or admin JWT)
- [ ] Swagger disabled in production unless explicitly approved (`SWAGGER_ENABLED=false`)

## 4. Email / SMS readiness

- [ ] Follow `docs/NOTIFICATION_PROVIDER_SETUP.md`
- [ ] `/notifications/readiness` shows expected states
- [ ] Template samples reviewed (`/notifications/templates/samples`)
- [ ] UAT flags remain disabled until staging sign-off (`NOTIFICATION_UAT_ENABLED`, `NOTIFICATION_REAL_SENDS_ENABLED`)
- [ ] Allowlisted UAT recipient(s) documented (`NOTIFICATION_UAT_ALLOWED_RECIPIENTS`)
- [ ] One allowlisted UAT email test recorded (masked response, no secret leakage)
- [ ] SMS UAT either signed off live or documented as `not_configured` / `mock`
- [ ] No mock modes in production unless temporary and approved

## 5. ERP readiness

- [ ] Follow `docs/ERP_INVENTORY_INTEGRATION_PLAN.md`
- [ ] `ERP_MODE` set intentionally (`disabled` until live contract approved)
- [ ] Inventory adapter readiness reviewed in `/health/readiness`
- [ ] `ERP_READ_ONLY_SYNC_ENABLED=false` in production until Bileeta stock endpoint approved
- [ ] `ERP_STOCK_SYNC_APPLY_ENABLED=false` unless local overwrite UAT signed off
- [ ] Dry-run stock sync UAT recorded via `POST /inventory/erp/stock-sync/dry-run` (mock/sandbox)
- [ ] Matched/unmatched/changed summary reviewed; no secrets in responses
- [ ] Confirm no ERP write/post endpoints were enabled

## 6. Object storage

- [ ] `STORAGE_MODE` not `local` for multi-instance production
- [ ] Cloudinary/MinIO/R2/S3 credentials stored as secrets
- [ ] Upload smoke test in staging

## 7. Domain / SSL / routing

- [ ] `CORS_ORIGIN` and `FRONTEND_URL` match production domains
- [ ] TLS certificates valid for API + web
- [ ] Web `NEXT_PUBLIC_API_URL` (or equivalent) points to production API

## 8. Backups & rollback

- [ ] MongoDB backup schedule confirmed
- [ ] Replication/outbox lag alerting configured
- [ ] Rollback plan documented (previous container/image tag + env snapshot)
- [ ] Facility backfill apply mode remains off (`ALLOW_FACILITY_BACKFILL_APPLY=false`) unless in maintenance window

## 9. Seed / permissions / roles

- [ ] Production seed strategy approved (no demo passwords in prod)
- [ ] Facility roles seeded (`FACILITY_MANAGER`, `BUILDING_SUPERVISOR`, etc.)
- [ ] Admin/super-admin accounts use MFA policy (org requirement)

## 10. UAT role checks

- [ ] ADMIN, FACILITY_MANAGER, SUPERVISOR, VIEWER, DRIVER paths verified
- [ ] `/facilities`, `/facilities/reports`, `/facilities/reports/aging`, `/cleaning/issues`, QR reporting, Action Center

## 11. Monitoring / logging

- [ ] Centralized logs for API/web
- [ ] Error tracking wired (Sentry or equivalent)
- [ ] Queue failure and replication lag alerts

## 12. Final security checklist

- [ ] JWT secrets rotated and stored securely
- [ ] `ALLOW_PUBLIC_REGISTRATION_IN_PRODUCTION` reviewed
- [ ] CSRF/cookie auth flows regression tested
- [ ] Tenant isolation spot checks on new endpoints
- [ ] No secrets committed; `.env` not in repo

## Production blockers (fail closed)

Treat as blockers until resolved:

- Primary DB unavailable
- Required Redis unavailable in production config
- Missing JWT/CORS/frontend URL configuration
- Required object storage unavailable when `OBJECT_STORAGE_REQUIRED_FOR_READINESS=true`
- Live integration modes selected with incomplete credentials

Warnings (may go-live with explicit acceptance):

- Email/SMS/ERP disabled in production
- Local storage mode
- Optional backup replication not required by env flags

## Helper output

`npm run deployment:readiness` prints JSON summary:

- `overallStatus`: `ready` | `warning` | `blocked`
- `blockers` / `warnings`
- per-check status with recommended actions

Exit codes:

- `0` ready
- `1` warning
- `2` blocked
