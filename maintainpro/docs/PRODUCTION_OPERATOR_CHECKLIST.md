# Production Operator Checklist

**Use with:** [PRODUCTION_GO_LIVE_DECISION_PACK.md](PRODUCTION_GO_LIVE_DECISION_PACK.md) · [PRODUCTION_CUTOVER_RUNBOOK.md](PRODUCTION_CUTOVER_RUNBOOK.md)  
**Target domain:** `maintenance.nelna.lk`  
**Do not execute until** Product Owner + DevOps + QA sign the go/no-go matrix.

Check each box in order. Record ticket ID and date in the change record. **Never paste secrets into this document.**

---

## Phase 0 — Pre-flight (T-7 to T-1 days)

| ☐ | Task | Owner | Pass criteria |
|---|------|-------|---------------|
| ☐ | Confirm release commit on `main` (baseline `4465e3d` or approved tag) | DevOps | `git log -1` matches change ticket |
| ☐ | Run `npm run uat:005:validate` from `maintainpro/` on release branch | QA | All steps PASS |
| ☐ | Review go/no-go matrix — all P0 rows planned | Product | Sign-off section complete |
| ☐ | Lower DNS TTL on `maintenance.nelna.lk` to 300s | DevOps | TTL verified in DNS panel |
| ☐ | Schedule cutover window + notify stakeholders | Product | Comms sent |

---

## Phase 1 — DNS cutover (`maintenance.nelna.lk`)

| ☐ | Task | Owner | Pass criteria |
|---|------|-------|---------------|
| ☐ | Create/update CNAME or A/AAAA for `maintenance.nelna.lk` → Cloudflare Workers route | DevOps | DNS resolves to expected target |
| ☐ | Enable Cloudflare proxy (orange cloud) + Full (strict) SSL | DevOps | No cert warnings in browser |
| ☐ | (Optional) `api.maintenance.nelna.lk` CNAME → Render custom domain | DevOps | API TLS valid if using subdomain |
| ☐ | Verify `_acme-challenge` / auto TLS completes | DevOps | Green lock on web + API |
| ☐ | `curl -I https://maintenance.nelna.lk` shows HSTS + CSP | DevOps | Headers match `next.config.mjs` policy |

Reference: [PRODUCTION_DOMAIN_CUTOVER.md](PRODUCTION_DOMAIN_CUTOVER.md)

---

## Phase 2 — Render production API

| ☐ | Task | Owner | Pass criteria |
|---|------|-------|---------------|
| ☐ | Create **separate** Render service or env group for production (do not reuse staging secrets) | DevOps | Prod service ID documented |
| ☐ | Set `NODE_ENV=production` | DevOps | Boot logs show production |
| ☐ | Set `PRIMARY_DATABASE_URL` / `DATABASE_URL` → **isolated prod Atlas** | DevOps | Not staging cluster/DB name |
| ☐ | Generate unique `JWT_ACCESS_SECRET` + `JWT_REFRESH_SECRET` | Security | Not copied from staging |
| ☐ | Set `CORS_ORIGIN=https://maintenance.nelna.lk` | DevOps | Exact origin, no trailing slash mismatch |
| ☐ | Set `FRONTEND_URL=https://maintenance.nelna.lk` | DevOps | Matches web URL |
| ☐ | Set `READINESS_API_KEY` for ops probes | DevOps | Stored in secret manager |
| ☐ | Deploy approved commit; wait until live | DevOps | Render dashboard shows live |
| ☐ | Confirm Swagger disabled or basic-auth protected | Security | Not public open API docs |

Reference: `render.yaml`, `.env.example`, `docs/DEPLOYMENT_ENVIRONMENT_CHECKLIST.md`

---

## Phase 3 — Cloudflare production web

| ☐ | Task | Owner | Pass criteria |
|---|------|-------|---------------|
| ☐ | Bind custom domain `maintenance.nelna.lk` to Workers project | DevOps | Route active in dashboard |
| ☐ | Set `NEXT_PUBLIC_API_URL` to production API base (include `/api`) | DevOps | Browser network tab hits prod API |
| ☐ | Set `NEXT_PUBLIC_API_ORIGIN` to production API origin (no `/api`) | DevOps | CORS preflight succeeds |
| ☐ | Deploy web from approved commit (`npm run cloudflare:build` + deploy) | DevOps | Workers version matches release |
| ☐ | Re-auth Wrangler if local deploy needed (account scope) | DevOps | `wrangler whoami` shows accounts |
| ☐ | Verify `/system-health` loads for admin (no error boundary) | QA | Provider panel visible |

Reference: `wrangler.jsonc`, root `wrangler.jsonc`

---

## Phase 4 — Production database

| ☐ | Task | Owner | Pass criteria |
|---|------|-------|---------------|
| ☐ | Provision isolated MongoDB Atlas cluster/database for production | DevOps | Separate from `maintainpro_staging` |
| ☐ | Apply schema: `npm run db:generate && npm run db:push` against **prod URI** (operator shell only) | DevOps | No migration errors |
| ☐ | **Do not** run default seed on production | DevOps | No staging personas in prod |
| ☐ | Create production tenant + admin via invitation/bootstrap flow | Product | Real org users only |
| ☐ | Configure `BACKUP_DATABASE_URL` if dual-write policy requires | DevOps | Replication mode documented |

---

## Phase 5 — Backup / snapshot

| ☐ | Task | Owner | Pass criteria |
|---|------|-------|---------------|
| ☐ | Take Atlas snapshot **before** cutover (or confirm greenfield empty prod) | DevOps | Snapshot ID in change ticket |
| ☐ | If migrating data: dry-run resync `npm run db:backup:resync -- --dry-run` | DevOps | Counts acceptable |
| ☐ | Post-cutover: `npm run db:backup:verify` (if replication enabled) | DevOps | Lag within policy |
| ☐ | Document RTO/RPO and restore owner | DevOps | Runbook link in ticket |

---

## Phase 6 — CORS, URLs, and secure cookies

| ☐ | Task | Owner | Pass criteria |
|---|------|-------|---------------|
| ☐ | `CORS_ORIGIN` = exact production web origin | DevOps | Preflight from browser PASS |
| ☐ | `FRONTEND_URL` used in email links (when SMTP live) | DevOps | Links point to prod domain |
| ☐ | Refresh cookie: HttpOnly, Secure, SameSite policy verified on prod | Security | DevTools → Application → Cookies |
| ☐ | CSRF cookie + header on refresh/logout path | Security | Refresh works; logout clears session |
| ☐ | Access JWT still in localStorage — confirm CSP enforced (known risk) | Security | Documented acceptance |

---

## Phase 7 — Integration credentials (honest modes only)

Set only what the business requires. Readiness endpoints must reflect truth — never fake live mode.

### Email (SMTP)

| ☐ | Task | Pass criteria |
|---|------|---------------|
| ☐ | `EMAIL_MODE=live` only when SMTP creds configured | `/notifications/readiness` → `EMAIL_ENABLED` or `EMAIL_MISCONFIGURED` (not fake enabled) |
| ☐ | SMTP host, port, user, password in Render secrets | Test send to ops mailbox |

### SMS

| ☐ | Task | Pass criteria |
|---|------|---------------|
| ☐ | `SMS_MODE=live` + provider URL/key when required | Readiness → `SMS_ENABLED` |
| ☐ | `ALLOW_MOCK_IN_PRODUCTION` **not** set unless explicitly approved | `env.validation.ts` guards honored |

### Push

| ☐ | Task | Pass criteria |
|---|------|---------------|
| ☐ | `PUSH_MODE=live` + provider URL/key when required | Readiness → `PUSH_ENABLED` |
| ☐ | UAT allowlist respected for test devices | No broadcast to real users without approval |

### Evidence storage

| ☐ | Task | Pass criteria |
|---|------|---------------|
| ☐ | `STORAGE_MODE=cloudinary` or `minio` + `STORAGE_UPLOADS_ENABLED=true` | `/evidence/readiness` → `ENABLED` |
| ☐ | Presigned upload + download UAT on prod | QA signs upload ticket |
| ☐ | If not required at go-live: leave `disabled` and document | Readiness shows `DISABLED` honestly |

---

## Phase 8 — Post-cutover smoke test

Run from operator shell with **production URLs only** (set env vars in shell — do not commit):

```bash
cd maintainpro
# MAINTAINPRO_WEB_URL=https://maintenance.nelna.lk
# MAINTAINPRO_API_URL=https://<prod-api>/api
# MAINTAINPRO_SMOKE_EMAIL=<prod admin>
# MAINTAINPRO_SMOKE_PASSWORD=<from secret manager>
npm run smoke:deploy
npm run uat:005:validate
```

| ☐ | Check | Pass criteria |
|---|-------|---------------|
| ☐ | Frontend OK | Smoke script PASS |
| ☐ | API health OK | `GET /health` → 200 |
| ☐ | CORS OK | Preflight from prod web |
| ☐ | Login OK | Real prod admin credentials |
| ☐ | `/system-health` provider panel | Evidence + EMAIL/SMS/PUSH indicators |
| ☐ | No secrets in readiness JSON | Manual spot-check |
| ☐ | Reports export sample | `GET /reports/operations/export?format=csv` → 200 |
| ☐ | QA Lead sign-off | Ticket updated |

---

## Phase 9 — Sign-off

| Role | Name | Date | Signature |
|------|------|------|-----------|
| DevOps Lead | | | |
| QA Lead | | | |
| Product Owner | | | |
| Security / IT | | | |

**Production-ready may be declared YES only after Phase 8 smoke PASS and this table is signed.**
