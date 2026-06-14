# Final UAT and Production Cutover Checklist

Use this document for **DEPLOY-004**, **PROD-001**, and **UAT-001** sign-off. No secrets belong in this file.

## Staging URLs (public)

| Service | URL |
|---------|-----|
| Web | `https://newmone.chinthakajayaweera1.workers.dev` |
| API | `https://newmone.onrender.com` |
| API base (smoke) | `https://newmone.onrender.com/api` |

Recommended production domain: **`maintenance.nelna.lk`** (operator-owned DNS/TLS).

---

## Part 1 — Operator actions (Render + Atlas)

### Render API (`maintainpro-api`) environment

Set in Render dashboard (never commit):

| Variable | Staging value / note |
|----------|----------------------|
| `DATABASE_URL` | Atlas URI with path `/maintainpro_staging` |
| `PRIMARY_DATABASE_URL` | Mirror `DATABASE_URL` |
| `MONGODB_URI` | Mirror `DATABASE_URL` |
| `MONGO_DATABASE_NAME` | `maintainpro_staging` |
| `PRIMARY_DATABASE_NAME` | `maintainpro_staging` |
| `CORS_ORIGIN` | `https://newmone.chinthakajayaweera1.workers.dev` |
| `FRONTEND_URL` | `https://newmone.chinthakajayaweera1.workers.dev` |
| `REDIS_REQUIRED_IN_PRODUCTION` | `false` until Redis provisioned |
| `REDIS_REQUIRED_FOR_READINESS` | `false` until Redis provisioned |
| `REDIS_URL` | Render Key Value internal URL when provisioned |
| `HEALTHCHECK_DEPENDENCY_TIMEOUT_MS` | `15000` (in blueprint) |
| JWT secrets | From secret manager |
| Smoke/seed passwords | Secret manager only |

After env changes: **Manual Deploy** → wait **60–90s** warm-up.

### Atlas

- [ ] Staging cluster uses database **`maintainpro_staging`**
- [ ] Network Access allows Render egress (staging); tighten for production
- [ ] Backups enabled on cluster
- [ ] **Rotate** any password exposed during UAT; update local `.env`, Render env, secret manager
- [ ] Do **not** commit `.env`

### Automated hosted smoke

From `maintainpro/` with shell env only:

```bash
npm run smoke:deploy
```

Optional tuning: `SMOKE_REQUEST_TIMEOUT_MS=60000`, `SMOKE_WARMUP_ATTEMPTS=2`, `SMOKE_WARMUP_DELAY_MS=5000`.

Expected: Frontend OK · Health OK · Readiness OK · CORS OK · Login OK.

---

## Part 2 — Manual browser UAT (UAT-001)

Use seeded staging accounts from secret manager. Record pass/fail per role.

### Auth & session

- [ ] `/login` loads over HTTPS
- [ ] Super-admin login succeeds
- [ ] Dashboard loads after login
- [ ] Logout works
- [ ] Session expiry / re-login acceptable
- [ ] Browser console: no CORS, cookie, or API base URL errors

### Role spot checks

- [ ] **ADMIN** — admin console, users, settings
- [ ] **SUPERVISOR** — cleaning/facility supervisor paths
- [ ] **SECURITY_OFFICER** — gate/vehicle scan paths
- [ ] **CLEANER** — cleaning scan/report (no admin nav)
- [ ] **VIEWER** — read-only modules

### Core modules

- [ ] **Assets** — list, detail, create/edit (authorized roles)
- [ ] **Vehicles / Fleet** — list, detail, gate flows
- [ ] **Work Orders** — list, create, status update
- [ ] **Work Order activity timeline** — loads; evidence panel shows readiness state
- [ ] **Evidence upload readiness** — disabled message when storage not configured
- [ ] **Facility hierarchy** — `/facilities` CRUD for manage roles
- [ ] **Facility Issues** — linked to hierarchy where applicable
- [ ] **Cleaning Issues** — create/list/sign-off paths
- [ ] **Duplicate issue warning** — appears for repeat reports in window
- [ ] **Inventory / parts** — list, stock, part requests
- [ ] **ERP stock sync** — readiness + dry-run only (no apply in staging unless approved)
- [ ] **Notifications** — readiness panel; UAT send disabled unless explicitly enabled
- [ ] **Reports** — module reports load
- [ ] **System Health** — deployment/readiness panels load

### UX / mobile

- [ ] Responsive layout on tablet/phone width
- [ ] PWA manifest / install prompt basic check
- [ ] No broken navigation or blank screens on primary routes

---

## Part 3 — Production cutover (PROD-001)

### Domain & TLS

- [ ] Production subdomain chosen (e.g. `maintenance.nelna.lk`)
- [ ] DNS A/CNAME to Cloudflare / hosting
- [ ] TLS certificate valid for web + API
- [ ] `CORS_ORIGIN` / `FRONTEND_URL` updated to production origin
- [ ] Web `NEXT_PUBLIC_API_URL` points to production API

### Environment separation

- [ ] Production Atlas DB **separate** from `maintainpro_staging`
- [ ] Production Render service or env group (not staging secrets)
- [ ] `NODE_ENV=production`
- [ ] `ALLOW_MOCK_IN_PRODUCTION=false` for live integrations
- [ ] `REDIS_REQUIRED_IN_PRODUCTION=true` when Redis provisioned
- [ ] `READINESS_API_KEY` or admin-only readiness in production

### Backups & rollback

- [ ] MongoDB backup schedule confirmed
- [ ] Restore test documented (sample collection restore or drill)
- [ ] Rollback plan: previous Render deploy + env snapshot
- [ ] Admin emergency access documented (break-glass super-admin)

### Observability

- [ ] Centralized API logs (Render/log drain)
- [ ] Error tracking recommended (Sentry or equivalent)
- [ ] Queue/replication lag monitoring when enabled

### Go / no-go table

| Gate | Status | Owner |
|------|--------|-------|
| Hosted `smoke:deploy` all green | | DevOps |
| Manual UAT checklist signed | | QA / Product |
| Atlas password rotated post-UAT | | DevOps |
| Production DB isolated | | DevOps |
| CORS/TLS production origins | | DevOps |
| Backups + rollback tested | | DevOps |
| Known residual risks accepted | | Product |

**Go** only when all blockers are green or explicitly waived in writing.

---

## Part 4 — Feature gap audit (launch vs Phase 2)

### Must-have before launch (blockers / near-blockers)

- [ ] Hosted login + dashboard UAT signed off
- [ ] Render/Atlas staging env aligned to `maintainpro_staging`
- [ ] JWT/CORS production origins configured
- [ ] Seed/admin access without demo passwords in production
- [ ] Tenant isolation spot checks on critical modules

### Should-have soon after launch

- [ ] Real SMTP provider (production notifications)
- [ ] Real object storage for evidence uploads (`STORAGE_UPLOADS_ENABLED`)
- [ ] Render Redis for notification queues
- [ ] Admin audit-log UI
- [ ] Backup status / replication lag dashboard
- [ ] CSV import (assets/parts/users)
- [ ] PDF/Excel report export
- [ ] QR label print/export

### Phase 2 (not launch blockers)

- Full Flutter mobile app parity
- Advanced BI dashboards
- AI copilot improvements
- ERP live write-back (after contract approval)
- SLA escalation automation
- UAT feedback button
- Role-based in-app help/guides

---

## Part 5 — Residual risks (accept or mitigate)

| Risk | Mitigation |
|------|------------|
| Render free-tier cold start | Smoke warm-up/retry; upgrade plan for production |
| Temporary Atlas password from UAT | Rotate before production cutover |
| Email/SMS disabled | Accept for staging; enable with allowlist before prod sends |
| Evidence uploads metadata-only | Enable storage provider before photo UAT |
| ERP read-only mock | Bileeta dry-run only until live contract |
| Browser UAT not automated | Manual checklist above |

---

## Quick reference commands

```bash
npm run typecheck
npm run lint
npm run test
npm run build
npm run db:smoke          # local Atlas only
npm run smoke:deploy      # hosted staging
node scripts/healthcheck.mjs
```
