# Production Readiness Report

**Last updated:** 2026-07-01  
**Verdict:** **Pilot-ready** on staging (UAT-001, UAT-005 PASS; UAT-002/003/004 partial pass; **UAT-007 PARTIAL PASS**). **Not** production-ready until operator completes [PRODUCTION_OPERATOR_CHECKLIST.md](docs/PRODUCTION_OPERATOR_CHECKLIST.md) (DNS, prod DB/env, live integrations, post-cutover smoke).

**UAT-007:** Workforce planning sprint — multi-assignee work orders, conditional asset validation, workload dashboard, leave/capacity checks on assignment API. Roster CRUD UI and full skill suggestion engine remain partial.

**UAT-006:** Go-live decision pack prepared — **NO-GO for cutover** until operator-owned items complete. See [docs/PRODUCTION_GO_LIVE_DECISION_PACK.md](docs/PRODUCTION_GO_LIVE_DECISION_PACK.md).

## Executive summary

MaintainPro’s **core platform** (multi-tenant API, RBAC, work orders, assets, fleet, inventory, audit, health/readiness, web dashboard, mobile foundation) is **production-oriented** and suitable for a **scoped staging rollout**.

Integrations default to **disabled or mock** and must be explicitly enabled with credentials. Do not claim full production readiness for email, SMS, push, or ERP until env modes are `live` and UAT-signed.

## Resolved vs outdated documentation

| Topic | Old report claim | Verified status (code) |
|-------|------------------|------------------------|
| `SECURITY_OFFICER` role | “Not in Prisma enum” | **RESOLVED** — `RoleName.SECURITY_OFFICER` in schema; seeded user `security@maintainpro.local`; permissions `gate.in.create`, `gate.out.create`, `operations.scan_lookup` |
| Email delivery | “No implementation” | **UPDATED** — Nodemailer SMTP when `EMAIL_MODE=live` |
| SMS | “No implementation” | **UPDATED** — generic HTTP provider; mock mode for dev |
| Push | “Noop only” | **PARTIAL** — noop/mock default; HTTP live provider when configured |
| ERP sync | “MOCK only” | **PARTIAL** — mock default; sandbox/live HTTP read sync available |
| README architecture | “PostgreSQL” | **FIXED** — MongoDB Atlas documented |

## Readiness matrix

| Area | Status | Notes |
|------|--------|-------|
| Core API (NestJS + Prisma MongoDB) | **Ready** | Modular monolith, validation, global guards |
| Multi-tenancy + RBAC | **Ready** | Tenant middleware, JWT, roles, permissions guards |
| Audit trail | **Ready** | Prisma middleware + domain audit; WO lifecycle audited (UAT-004) |
| Work order approval | **Partial** | Approve/reject API + kanban UI; auto-approve for privileged creators |
| Workforce planning (UAT-007) | **Partial** | Multi-assignee model + API; designation filter; leave/capacity checks; roster UI roadmap |
| Fleet gate UI | **Partial** | `/fleet/gate` page shipped; override admin-only on API |
| File / evidence storage | **Partial** | Readiness indicator ENABLED/DISABLED/MISCONFIGURED; staging disabled |
| Web dashboard | **Ready** | Role nav, live KPIs on core modules |
| Mobile app | **Partial** | Flutter features exist; offline parity incomplete |
| Auth security | **Partial** | HttpOnly refresh + CSRF; access JWT still in localStorage (documented risk) |
| Frontend security headers | **Ready** | CSP, HSTS, frame denial in `next.config.mjs` |
| Error boundaries (web) | **Ready** | `app/error.tsx`, `app/global-error.tsx` |
| Health / readiness | **Ready** | Public liveness; protected deep readiness |
| Queue / Redis | **Partial** | Graceful degrade; optional in staging render.yaml |
| Email | **Partial** | Disabled by default; live with SMTP |
| SMS | **Partial** | Disabled/mock/live modes |
| Push | **Partial** | Disabled/mock/live; not Firebase-native |
| ERP stock sync | **Partial** | Mock default; dry-run + read sync when configured |
| File / evidence storage | **Partial** | Indicator ENABLED/DISABLED/MISCONFIGURED; staging DISABLED; presigned bytes operator-owned |
| Notification providers | **Partial** | EMAIL_/SMS_/PUSH_ indicators; staging disabled; UAT allowlist for safe tests |
| Production cutover docs | **Ready** | Runbook + domain checklist (UAT-005) |
| Go-live decision pack | **Ready** (UAT-006) | Decision matrix, operator checklist, pilot plan — cutover not executed |
| Reports server export | **Ready** | API `GET /reports/:module/export` verified |
| Hosted staging smoke | **Partial** | Health/CORS pass; login needs credential alignment |
| UAT-001 browser sign-off | **Partial** | Wrong-password UX verified; full flow pending login |
| Custom production domain | **Not ready** | Planned `maintenance.nelna.lk` |
| Observability (APM/metrics) | **Partial** | Health/readiness only; Sentry-ready pattern documented |

## SECURITY_OFFICER

**Status: Ready (backend + seed + permissions)**

- Prisma enum: `SECURITY_OFFICER`
- Seed user: `security@maintainpro.local`
- Gate endpoints: `@Permissions("gate.out.create")`, `@Permissions("gate.in.create")`
- UAT checklist: [docs/UAT_CHECKLIST.md](docs/UAT_CHECKLIST.md#security-officer)

## Token storage

| Token | Storage | Risk |
|-------|---------|------|
| Access JWT | `localStorage` (web) | XSS exposure — mitigated with CSP; future: cookie-only access |
| Refresh JWT | HttpOnly cookie | Lower risk |
| CSRF | Cookie + header on refresh/logout | Required for cookie auth path |

Logout clears localStorage session keys. Session expiry redirects to `/login?reason=session_expired`.

## Integration modes (production guards)

`env.validation.ts` blocks mock SMS/push/ERP in production unless `ALLOW_MOCK_IN_PRODUCTION=true` (not recommended for real ops).

## Deployment evidence

| Component | Evidence |
|-----------|----------|
| API | `render.yaml`, `https://newmone.onrender.com/health` |
| Web | `wrangler.jsonc`, `https://newmone.chinthakajayaweera1.workers.dev` |
| Smoke | `scripts/smoke-deployment.mjs` |
| CI | `.github/workflows/ci.yml` |

## Launch blockers (P0)

1. ~~Align hosted seed password with smoke/UAT credentials~~ — UAT-001 PASS
2. ~~Complete UAT-001 browser sign-off~~ — PASS
3. Production domain + TLS + isolated prod DB — **operator checklist (UAT-006)**
4. Rotate staging Atlas password post-UAT — operator-owned
5. Enable only required integrations with live credentials — operator-owned
6. Post-cutover smoke on production URLs — blocked until cutover

## Launch blockers (P1 — if feature required at go-live)

- Live email/SMS for operational alerts
- ERP live/sandbox sync with signed mapping
- Push notifications with real provider
- Evidence file storage provider UAT

## Recommended next actions

1. Execute [PRODUCTION_OPERATOR_CHECKLIST.md](docs/PRODUCTION_OPERATOR_CHECKLIST.md) when go/no-go approves cutover
2. Complete pilot training per [PILOT_ROLLOUT_PLAN.md](docs/PILOT_ROLLOUT_PLAN.md)
3. Re-run `npm run smoke:deploy` and `npm run uat:005:validate` against **production** URLs after cutover
4. Add Sentry DSN when monitoring account is ready
5. Capture staging screenshots for README portfolio section

## Related documents

- [docs/SECURITY_CHECKLIST.md](docs/SECURITY_CHECKLIST.md)
- [docs/UAT_CHECKLIST.md](docs/UAT_CHECKLIST.md)
- [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md)
- [docs/PRODUCTION_GO_LIVE_DECISION_PACK.md](docs/PRODUCTION_GO_LIVE_DECISION_PACK.md)
- [docs/PRODUCTION_OPERATOR_CHECKLIST.md](docs/PRODUCTION_OPERATOR_CHECKLIST.md)
- [docs/PILOT_ROLLOUT_PLAN.md](docs/PILOT_ROLLOUT_PLAN.md)
