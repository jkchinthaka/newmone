# Production Go-Live Decision Pack (UAT-006)

**Document owner:** Product Owner + DevOps + QA Lead  
**Release baseline:** `4465e3d` (docs/e2e) · API staging verified on `e366196`  
**Target production domain:** `https://maintenance.nelna.lk`  
**Status:** **PREPARED — NOT EXECUTED** — no DNS cutover, no production env changes in this sprint

Credentials live in secret manager only. Never commit `.env` files or paste secrets in tickets.

---

## 1. Current readiness status

| Dimension | Verdict | Evidence |
|-----------|---------|----------|
| Portfolio-ready | **YES** | UAT-001 PASS; staged screenshots; validation scripts green |
| Pilot-ready | **YES** | Staging synced; UAT-005 PASS; multi-role UAT partial pass with documented gaps |
| Production-ready | **NO** | DNS not cut over; prod DB/env not provisioned; integrations disabled on staging |
| UAT-001 | **PASS** | Hosted login + smoke |
| UAT-002 | **PARTIAL PASS** | Multi-role browser/API; operator-owned credential alignment |
| UAT-003 | **PARTIAL PASS** | Hosted WO lifecycle API; live evidence + mobile gaps documented |
| UAT-004 | **PARTIAL PASS** | WO approve/reject, gate UI, audit; export/KPI gaps documented |
| UAT-005 | **PASS** | Provider diagnostics, cutover runbook, staging deploy sync |
| UAT-006 | **PASS (docs)** | This decision pack + operator checklist + pilot plan prepared |

### Staging reference (verified)

| Component | URL | Commit / deploy |
|-----------|-----|-----------------|
| API | `https://newmone.onrender.com/api` | Render live on `e366196` (`dep-d8vm2eb7uimc738k4jqg`) |
| Web | `https://newmone.chinthakajayaweera1.workers.dev` | Provider panel functional; local Wrangler deploy blocked (OAuth account scope) |

---

## 2. What is verified

### Platform and security

- Multi-tenant NestJS API with JWT, tenant context, roles, and permissions guards
- Prisma MongoDB schema; replication outbox pattern documented
- Audit trail on work order lifecycle (create, assign, status, complete, approve/reject)
- Health and readiness endpoints (`/health`, `/health/readiness`, deployment-readiness)
- Provider diagnostics: evidence + `EMAIL_*` / `SMS_*` / `PUSH_*` indicators (no secrets in payloads)
- Web security headers (CSP, HSTS, frame denial); error boundaries on dashboard routes
- Env validation blocks mock integrations in production unless explicitly overridden

### UAT and automation

- `npm run uat:005:validate` — full regression chain (typecheck, lint, 517+ tests, build, smoke)
- `npm run smoke:deploy` — hosted health, CORS, login probes
- Playwright staging suites for UAT-002, UAT-003, UAT-005
- Reports server export: `GET /reports/:module/export` verified on staging API

### Documentation

- Production cutover runbook, domain checklist, KPI matrix, security checklist
- Deployment environment checklist and Render/Cloudflare configuration references
- This go-live decision pack, operator checklist, and pilot rollout plan (UAT-006)

---

## 3. What is not verified (operator-owned)

| Item | Why it blocks production-ready |
|------|--------------------------------|
| DNS cutover to `maintenance.nelna.lk` | Not executed; staging URLs only |
| Isolated production MongoDB Atlas | Staging DB in use; no prod snapshot policy signed off |
| Production Render env group | Secrets, CORS, FRONTEND_URL not applied to prod service |
| Production Cloudflare Workers route | Custom domain not bound; prod `NEXT_PUBLIC_API_URL` not set |
| Live SMTP / SMS / push | Staging shows `EMAIL_DISABLED`, `SMS_DISABLED`, `PUSH_DISABLED` |
| Live evidence storage (Cloudinary/MinIO) | Staging shows evidence DISABLED; presigned upload not UAT'd live |
| Post-cutover smoke on production URLs | Not run — requires cutover first |
| Real tenant onboarding (no staging seed on prod) | Production bootstrap not executed |
| APM / Sentry / on-call paging | Health/readiness only |
| Mobile offline parity | Flutter foundation only; not pilot-certified |
| ERP live/sandbox sync | Mock/default; signed vendor mapping not UAT'd |

**Do not mark production-ready until every row above is complete and post-cutover smoke passes.**

---

## 4. Go / no-go decision matrix

Score each criterion **before** cutover window. **Go** requires all **P0** rows PASS and explicit sign-off from required approvers.

| ID | Criterion | Priority | Verified? | Owner | Go | No-go |
|----|-----------|----------|-----------|-------|-----|-------|
| G1 | Release commit approved (`4465e3d` or later tag) | P0 | Yes (staging) | DevOps | Tag matches main | Drift from approved release |
| G2 | `npm run uat:005:validate` PASS on release branch | P0 | Yes | QA | All green | Any failure |
| G3 | Production DB provisioned + schema applied | P0 | **No** | DevOps | Isolated Atlas, backup policy | Shared with staging |
| G4 | Pre-cutover Atlas snapshot / backup verified | P0 | **No** | DevOps | Snapshot ID recorded | No backup |
| G5 | Production env vars set (no staging secrets reused) | P0 | **No** | DevOps | Checklist signed | Missing JWT/CORS/DB |
| G6 | DNS TTL lowered ≥24h before change | P0 | **No** | DevOps | TTL ≤300s | Same-day surprise |
| G7 | `maintenance.nelna.lk` TLS + HSTS verified | P0 | **No** | DevOps | curl -I clean | Cert mismatch |
| G8 | CORS + FRONTEND_URL match production web origin | P0 | **No** | DevOps | Preflight PASS | Login/CORS fail |
| G9 | Integrations honestly configured (live or disabled) | P0 | **No** | DevOps | Readiness indicators match policy | Fake/mock in prod |
| G10 | Evidence storage live UAT (if required at go-live) | P1 | **No** | QA | Upload/download PASS | Required but disabled |
| G11 | SMTP live send test (if alerts required) | P1 | **No** | QA | Test email received | Required but disabled |
| G12 | Post-cutover `smoke:deploy` on prod URLs | P0 | **No** | QA | All probes PASS | Auth/health fail |
| G13 | Rollback owner assigned + runbook reviewed | P0 | Prepared | DevOps | Named on-call | No rollback owner |
| G14 | Pilot users identified + trained | P1 | Prepared | Product | Roster filed | No pilot scope |
| G15 | Communication plan sent to stakeholders | P1 | **No** | Product | Email/chat sent | Silent cutover |

### Recommendation (2026-06-27)

| Decision | Status |
|----------|--------|
| **Go for production cutover** | **NO-GO** |
| **Go for scoped pilot on staging** | **GO** (already available) |
| **Go for production cutover after operator checklist** | **CONDITIONAL GO** — only when G3–G9 and G12 are PASS |

**Rationale:** Engineering and UAT evidence support a **pilot** and **portfolio** narrative. Production cutover remains blocked on operator-owned infrastructure, credentials, DNS, and post-cutover verification.

---

## 5. Required operator approvals

| Approver | Responsibility | Sign-off (name / date) |
|----------|----------------|------------------------|
| Product Owner | Business scope, pilot roster, go/no-go | _________________ |
| DevOps Lead | DNS, Render, Cloudflare, Atlas, env vars | _________________ |
| QA Lead | Post-cutover smoke + UAT re-run on prod URLs | _________________ |
| Security / IT | JWT rotation, CORS, cookie policy, secret storage | _________________ |
| Maintenance / Operations Manager | Pilot department acceptance | _________________ |

**Minimum for cutover:** Product Owner + DevOps Lead + QA Lead (all three required).

---

## 6. Rollback plan

| Layer | Detection | Action | Target RTO |
|-------|-----------|--------|------------|
| Web (Cloudflare) | 5xx, blank app, CSP break | Roll back Workers deployment to previous version in dashboard | 5–15 min |
| API (Render) | Auth-wide 500, readiness blocked | Roll back Render deploy to prior commit | 5–10 min + warm-up |
| DNS | Wrong origin, cert errors | Revert `maintenance.nelna.lk` to previous CNAME/A | TTL-bound (plan for ≤300s) |
| Database | Schema regression, bad migration | Restore Atlas snapshot taken in pre-cutover step | Operator RTO (document in ticket) |
| Integrations | Leaked mock mode, failed sends | Set `EMAIL_MODE`/`SMS_MODE`/`PUSH_MODE` to `disabled`; disable uploads | 5 min |

**Rollback triggers (any one):**

- Post-cutover smoke fails twice within 30 minutes
- Critical RBAC bypass or cross-tenant data exposure
- Widespread auth failure (401/500) not explained by misconfiguration
- Data corruption confirmed by QA or DBA

**Rollback communication:** Product Owner notifies pilot users; DevOps posts status; QA logs defect ticket with timeline.

Detailed steps: [PRODUCTION_CUTOVER_RUNBOOK.md](PRODUCTION_CUTOVER_RUNBOOK.md#7-rollback-plan).

---

## 7. Post-go-live support plan

### Hypercare window (recommended: 2 weeks post-cutover)

| Phase | Duration | Activities |
|-------|----------|------------|
| T+0 to T+24h | Day 0 | DevOps + QA on standby; hourly health check; smoke every 4h |
| T+1 to T+7d | Week 1 | Daily standup with pilot leads; triage P0/P1 within SLA |
| T+8 to T+14d | Week 2 | Reduce to business-hours support; weekly status to Product Owner |

### Monitoring (available today)

- Public: `GET /health`, `GET /api/health`
- Admin: `/system-health`, `GET /api/health/deployment-readiness`
- Provider honesty: `/api/notifications/readiness`, `/api/evidence/readiness`

### Escalation

See [PILOT_ROLLOUT_PLAN.md](PILOT_ROLLOUT_PLAN.md) for contacts, severity levels, and rollback criteria.

### Success criteria (first 14 days)

- Pilot users complete core flows: login, WO view/create (role-permitted), inventory view, reports export (if in scope)
- No P0 incidents open >24h
- Provider indicators on prod match configured policy (no silent mock)
- Audit entries visible for WO mutations in pilot tenant

---

## 8. Related documents

| Document | Purpose |
|----------|---------|
| [PRODUCTION_OPERATOR_CHECKLIST.md](PRODUCTION_OPERATOR_CHECKLIST.md) | Step-by-step cutover tasks |
| [PILOT_ROLLOUT_PLAN.md](PILOT_ROLLOUT_PLAN.md) | Pilot scope, training, escalation |
| [PRODUCTION_CUTOVER_RUNBOOK.md](PRODUCTION_CUTOVER_RUNBOOK.md) | Technical cutover procedure |
| [PRODUCTION_DOMAIN_CUTOVER.md](PRODUCTION_DOMAIN_CUTOVER.md) | DNS and TLS checklist |
| [UAT_CHECKLIST.md](UAT_CHECKLIST.md) | Full UAT history |
| [PRODUCTION_READINESS_REPORT.md](../PRODUCTION_READINESS_REPORT.md) | Readiness matrix |

---

## 9. UAT-006 certification

| Check | Result |
|-------|--------|
| Decision pack created | **PASS** |
| Operator checklist created | **PASS** |
| Pilot rollout plan created | **PASS** |
| Production cutover **not** executed | **PASS** (honest) |
| Production-ready claim withheld | **PASS** |

**UAT-006 overall:** **PASS (documentation)** — management pack ready; **cutover remains NO-GO** until operator checklist complete.
