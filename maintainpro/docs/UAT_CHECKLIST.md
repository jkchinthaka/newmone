# UAT Checklist

Use with staging: **Web** `https://newmone.chinthakajayaweera1.workers.dev` · **API** `https://newmone.onrender.com/api`

Credentials from secret manager only — never commit passwords.

Also see [FINAL_UAT_AND_CUTOVER_CHECKLIST.md](FINAL_UAT_AND_CUTOVER_CHECKLIST.md) for cutover-specific items.

## Automated helpers

```bash
# Hosted smoke (shell env)
npm run smoke:deploy

# Staging browser (shell env)
npm run test:e2e:staging

# DevOps UAT-001 bootstrap (Render API key in .env.render.local; no secrets printed)
node scripts/uat-001-staging-bootstrap.mjs
node scripts/render-env-audit.mjs
node scripts/verify-hosted-logins.mjs
```

---

## Authentication

| Test | Pass | Fail | Notes |
|------|------|------|-------|
| Admin login | ☑ | ☐ | `admin@maintainpro.local` — PASS 2026-06-12 hosted API |
| Manager login | ☑ | ☐ | `manager@maintainpro.local` — PASS 2026-06-12 hosted API |
| Technician login | ☑ | ☐ | `tech@maintainpro.local` — PASS 2026-06-12 hosted API |
| Security officer login | ☑ | ☐ | `security@maintainpro.local` — PASS 2026-06-12 hosted API |
| Store keeper login | ☑ | ☐ | `inventory@maintainpro.local` — PASS 2026-06-12 hosted API |
| Invalid password message | ☑ | ☐ | Verified earlier on staging (`Invalid email or password`, no session_expired redirect) |
| Logout | ☐ | ☐ | Manual browser |
| Session expiry redirect | ☐ | ☐ | Manual browser — `/login?reason=session_expired` |

---

## MVP workflow

| Step | Pass | Fail | Notes |
|------|------|------|-------|
| Create / view asset | ☐ | ☐ | |
| Create work order | ☐ | ☐ | |
| Approve work order (if permitted) | ☐ | ☐ | |
| Assign technician | ☐ | ☐ | |
| Reserve / request spare part | ☐ | ☐ | |
| Technician updates job status | ☐ | ☐ | |
| Upload evidence (metadata/readiness) | ☐ | ☐ | |
| Supervisor verifies / completes | ☐ | ☐ | |
| Cost visible on WO | ☐ | ☐ | |
| Dashboard/report reflects update | ☐ | ☐ | |
| Audit log entry created | ☐ | ☐ | Settings → Audit or API |

---

## Security officer

| Test | Pass | Fail | Notes |
|------|------|------|-------|
| Login as `security@maintainpro.local` | ☑ | ☐ | Hosted API login PASS 2026-06-12 |
| Only security/fleet menus visible | ☐ | ☐ | Manual browser |
| Gate-out allowed vehicle | ☐ | ☐ | |
| Gate-out blocked (expired docs) | ☐ | ☐ | |
| Gate-in | ☐ | ☐ | |
| Unauthorized override denied | ☐ | ☐ | |
| Audit record on gate action | ☐ | ☐ | |
| Mobile/web scan if available | ☐ | ☐ | |

---

## Admin / regression (post `039e361`)

| Test | Pass | Fail | Notes |
|------|------|------|-------|
| `/admin` no React #310 | ☐ | ☐ | Local e2e PASS; staging browser pending |
| `/action-center` no crash | ☐ | ☐ | Local e2e PASS; staging browser pending |
| Non-admin `/admin` permission state | ☐ | ☐ | |

---

## Inventory

| Test | Pass | Fail | Notes |
|------|------|------|-------|
| Low-stock visible | ☐ | ☐ | |
| Part reservation on WO | ☐ | ☐ | |
| Stock issue | ☐ | ☐ | |
| Negative stock prevented / warned | ☐ | ☐ | |

---

## ERP sync

| Test | Pass | Fail | Notes |
|------|------|------|-------|
| Mode badge (mock/sandbox/live) | ☐ | ☐ | System health / inventory ERP panel |
| Dry-run sync | ☐ | ☐ | |
| Failed sync reason visible | ☐ | ☐ | |
| Retry / refresh readiness | ☐ | ☐ | |

---

## Notifications

| Test | Pass | Fail | Notes |
|------|------|------|-------|
| Readiness panel loads | ☐ | ☐ | `/system-health` |
| UAT email test (allowlisted) | ☐ | ☐ | Only if UAT flags enabled |
| UAT SMS test | ☐ | ☐ | |
| Push provider status honest | ☐ | ☐ | mock/live/disabled |

---

## Reports

| Test | Pass | Fail | Notes |
|------|------|------|-------|
| Reports dashboard loads | ☐ | ☐ | |
| Overdue / open WO metrics | ☐ | ☐ | |
| Export if available | ☐ | ☐ | |

---

## Production validation

| Check | Pass | Fail |
|-------|------|------|
| `npm run typecheck` | ☐ | ☐ |
| `npm run test` | ☐ | ☐ |
| `npm run build` | ☐ | ☐ |
| `npm run smoke:deploy` | ☑ | ☐ |
| Deployment URL reachable | ☑ | ☐ |
| No secrets in repo | ☑ | ☐ |

---

## Sign-off

| Role | Name | Date | Result |
|------|------|------|--------|
| QA | | 2026-06-12 | **PASS** (auth + hosted smoke); manual browser/MVP flows pending |
| Product owner | | | |
| DevOps | | 2026-06-12 | **PASS** (Render env aligned, startup seed, smoke) |

**UAT-001 status (2026-06-12):** **PASS** for credential blocker — Render `MAINTAINPRO_SEED_PASSWORD` set and aligned with smoke credentials; idempotent seed applied on Render deploy (`maintainpro_staging`); hosted login + `npm run smoke:deploy` all checks PASS. Manual browser walkthrough (logout, MVP workflows, `/admin` on staging) remains operator-owned.

### DevOps verification log (2026-06-12)

| Step | Result |
|------|--------|
| Render env audit | `DATABASE_URL`/`PRIMARY_DATABASE_URL` → `maintainpro_staging`; `MAINTAINPRO_SEED_PASSWORD` set; `CORS_ORIGIN` + `FRONTEND_URL` aligned to Workers URL |
| Seed command | Idempotent `npm run db:seed` via env-gated Docker entrypoint on Render deploy (`MAINTAINPRO_RUN_STARTUP_SEED=true`, then disabled) |
| Hosted login verification | admin, manager, technician, security_officer, store_keeper, superadmin — all **PASS** |
| `npm run smoke:deploy` | Frontend, health, CORS, login — all **PASS** |
| Commits | `cbd1722`, `e615c9d` on `main` |

**Operator action:** Store `MAINTAINPRO_SEED_PASSWORD` from Render secret manager in your team vault; set local/CI `MAINTAINPRO_SMOKE_PASSWORD` to the same value for future smoke runs. Password values were never logged or committed.
