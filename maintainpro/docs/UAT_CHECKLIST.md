# UAT Checklist

Use with staging: **Web** `https://newmone.chinthakajayaweera1.workers.dev` · **API** `https://newmone.onrender.com/api`

Credentials from secret manager only — never commit passwords.

Also see [FINAL_UAT_AND_CUTOVER_CHECKLIST.md](FINAL_UAT_AND_CUTOVER_CHECKLIST.md) for cutover-specific items.

## Automated helpers

```bash
# Hosted smoke (shell env)
npm run smoke:deploy

# Staging browser UAT-001
npm run test:e2e:staging

# Staging browser UAT-002 (multi-role + portfolio screenshots)
npm run test:e2e:staging:uat002

# Full UAT-002 validation (API workflows + e2e + build + smoke)
npm run uat:002:validate

# UAT-003 MVP lifecycle (hosted API + warm portfolio screenshots)
npm run test:e2e:staging:uat003
npm run uat:003:validate

node scripts/uat-003-mvp-lifecycle.mjs
node scripts/uat-002-api-workflows.mjs
node scripts/render-env-audit.mjs
node scripts/verify-hosted-logins.mjs
```

Portfolio screenshots: [screenshots/README.md](screenshots/README.md)

---

---

# UAT-007 summary (2026-06-28)

| Area | Status | Notes |
|------|--------|-------|
| **UAT-007 overall** | **PARTIAL PASS** | Workforce planning sprint — core API + UI; roster CRUD UI and skill suggestion algorithm roadmap |
| Optional asset for general WO | **PASS** | Conditional validation CORRECTIVE/EMERGENCY vs PREVENTIVE/INSPECTION/INSTALLATION |
| WorkOrderAssignee model | **PASS** | Multi-employee assignments with primary, planned dates, audit |
| Designation-based selection | **PASS** | `/workforce/employees?designation=` + assignment validation |
| Expected vs planned dates | **PASS** | `expectedCompletionDate`, `plannedStartAt`, `plannedEndAt` |
| In-progress due sorting + colors | **PASS** | Kanban IN_PROGRESS sorted; overdue/orange/yellow/green badges |
| Employee workload dashboard | **PASS** | Admin/management dashboard widget + `/workforce/workload-summary` |
| Monthly roster + leave models | **PASS** (schema) | `EmployeeRosterEntry`, `EmployeeLeaveRequest` — seed/UI partial |
| Leave assignment block | **PASS** | API blocks + manager override audited |
| Workload capacity check | **PASS** | Daily capacity hours on assignment |
| Skill matrix suggestions | **PARTIAL** | `User.skills[]` + designation filter; full suggestion engine roadmap |

Run: `npm run uat:007:validate` (runs typecheck, lint, test, build, smoke, and workforce unit tests). Run `npm run uat:005:validate` separately for full staging regression.

---

# UAT-006 summary (2026-06-27)

| Area | Status | Notes |
|------|--------|-------|
| **UAT-006 overall** | **PASS (docs)** | Management go-live pack prepared; cutover **not executed** |
| Go-live decision pack | **PASS** | `PRODUCTION_GO_LIVE_DECISION_PACK.md` |
| Operator checklist | **PASS** | `PRODUCTION_OPERATOR_CHECKLIST.md` |
| Pilot rollout plan | **PASS** | `PILOT_ROLLOUT_PLAN.md` |
| Go/no-go recommendation | **NO-GO** | Until operator checklist + post-cutover smoke |

---

# UAT-005 summary (2026-06-27)

| Area | Status | Notes |
|------|--------|-------|
| **UAT-005 overall** | **PASS** | Staging synced on Render `e366196`; `npm run uat:005:validate` green; production DNS/live creds remain operator-owned |
| Evidence storage indicator | **PASS** | `ENABLED` / `DISABLED` / `MISCONFIGURED` on `/evidence/readiness` |
| Notification indicators | **PASS** | `EMAIL_*` / `SMS_*` / `PUSH_*` on `/notifications/readiness` |
| System health provider panel | **PASS** | Admin `/system-health` integration diagnostics |
| Deployment readiness API | **PASS** | `GET /api/health/deployment-readiness` |
| Production domain checklist | **PASS** (docs) | `PRODUCTION_DOMAIN_CUTOVER.md` — not executed |
| Operator cutover runbook | **PASS** (docs) | `PRODUCTION_CUTOVER_RUNBOOK.md` |
| KPI source matrix | **PASS** (docs) | `KPI_SOURCE_MATRIX.md` |
| Reports export (API) | **PASS** | Server `GET /reports/:module/export` verified (operations CSV) |
| Staging integrations | **PASS** (honest) | Evidence DISABLED; email/SMS DISABLED on staging |

### Post-deploy UAT-005 verification (2026-06-27)

| Check | Result |
|-------|--------|
| Render deploy `dep-d8vm2eb7uimc738k4jqg` | **live** on `e366196` |
| `/notifications/readiness` push + indicators | **PASS** |
| `/system-health` provider panel (browser) | **PASS** (2/2 Playwright) |
| `npm run uat:005:validate` | **PASS** |
| Cloudflare local `wrangler deploy` | **BLOCKED** — OAuth token returns empty accounts; staging web already serving updated UI |

Run: `npm run uat:005:validate`

---

## UAT-004 summary (2026-06-27)

| Area | Status | Notes |
|------|--------|-------|
| **UAT-004 overall** | **PARTIAL PASS** | Production hardening sprint 1 — approval/audit/gate/evidence indicators shipped; live storage + prod cutover remain open |
| Work order approve/reject API | **PASS** | `PATCH /work-orders/:id/approve` · `PATCH /work-orders/:id/reject` — Manager/Operations only |
| Work order audit completeness | **PASS** | Create, assign, status, complete, approve/reject audited |
| Evidence storage indicator | **PASS** | `ENABLED` / `DISABLED` / `MISCONFIGURED` on readiness API |
| Fleet gate UI (`/fleet/gate`) | **PASS** | Security officer gate page + role guard; empty vehicle list shows honest placeholder (gate buttons after selection) |
| Dashboard KPI honesty | **PARTIAL** | Live API counts labeled; some enterprise KPIs still roadmap |
| Reports CSV/PDF export | **PARTIAL** | Client-side export on reports/inventory/vehicles; server bulk export roadmap |
| Session expiry | **PASS** (auto) + **OPERATOR-OWNED** (manual TTL) | `auth.spec.ts` + API interceptor; manual idle timeout simulation documented |

Run: `npm run uat:004:validate`

### Post-deploy UAT-004 verification (2026-06-27)

| Check | Result |
|-------|--------|
| Render deploy (API) | **live** on commit `b9c338d` |
| Cloudflare Workers (web) | **live** — `/fleet/gate` reachable on staging |
| `node scripts/uat-004-production-hardening.mjs` | **PASS** (approve/reject, audit, evidence indicator) |
| `npm run test:e2e:staging:uat004` | **PASS** (2/2) |
| Evidence storage on staging | **DISABLED** (honest indicator) |

**Not production-ready:** Live object storage for evidence bytes, production domain cutover, SMTP/SMS live notifications, server-side bulk report export, and full enterprise KPI parity remain open.

---

## UAT-003 summary (2026-06-27)

| Area | Status | Notes |
|------|--------|-------|
| **UAT-003 overall** | **PARTIAL PASS** | Hosted API MVP lifecycle verified end-to-end; dedicated WO approval, live evidence storage, gate UI, and mobile remain open |
| Baseline (UAT-001/002 regression) | **PASS** | Smoke, UAT-002 API (8/8 Playwright), typecheck, lint, 508 tests, build |
| Hosted MVP lifecycle API | **PASS** | `scripts/uat-003-mvp-lifecycle.mjs` on Render commit `c36af83` |
| Asset / vehicle register | **PARTIAL** | List + detail PASS; create in staging **OPERATOR-OWNED** |
| Work order creation | **PASS** | API create + web list/modal verified |
| Manager approval (WO) | **NOT AVAILABLE** | No dedicated approve/reject WO endpoint; part-request approval **PASS** |
| Technician assignment | **PASS** | Manager assign API after RBAC fix (`MANAGER` on create/assign) |
| Spare-part reservation / issue | **PASS** | Request → operational approve → inventory issue → stock movement |
| Technician execution | **PASS** | Status IN_PROGRESS → note → COMPLETED with cost/hours |
| Evidence / notes | **PARTIAL** | Notes PASS; evidence storage **disabled** on staging (readiness honest) |
| Completion + supervisor sign-off | **PARTIAL** | Completion PASS; supervisor signature **NOT AVAILABLE** |
| Audit trail | **PARTIAL** | Part issue + settings audit API PASS; WO **creation** not audited in service layer |
| Dashboard / reports | **PARTIAL** | `/reports/dashboard` PASS; not all enterprise KPI tiles live |
| Security gate flow | **PARTIAL** | API gate blocked PASS; allowed path PARTIAL (seed compliance); no `/fleet/gate` UI |
| Portfolio screenshots (UAT-003) | **PASS** | Warm-session Playwright 5/5; includes `06-work-order-detail.png` |
| Mobile technician | **NOT AVAILABLE** | Flutter app separate |

### Post-deploy UAT-003 verification (2026-06-27)

| Check | Result |
|-------|--------|
| Render deploy `dep-d8vdbje7r5hc73eeov2g` | **live** |
| Deployed commit | `c36af8393cf1fad3c71e43945f0315ad0909ab16` |
| `npm run uat:003:validate` | **PASS** |
| `npm run test:e2e:staging:uat003` | **PASS** (5/5) |
| `npm run test:e2e:staging:uat002` | **PASS** (8/8) |
| `npm run smoke:deploy` | **PASS** |

**Not production-ready:** Dedicated WO approval workflow, live object storage for evidence, production domain, gate UI, SMTP/SMS live notifications, and full dashboard KPI parity remain open.

---

## UAT-002 summary (2026-06-12)

| Area | Status | Notes |
|------|--------|-------|
| **UAT-002 overall** | **PARTIAL PASS** | Browser + hosted API verified; MVP lifecycle and gate UI remain operator-owned |
| Role-based browser nav | **PASS** | Admin, Manager, Technician, Security, Inventory — Playwright staging (8/8) |
| Hosted API workflows | **PASS** | All persona APIs green after Render deploy `1a97432` (see post-deploy log below) |
| Manager/technician WO API | **PASS** | `GET /work-orders` HTTP 200 on live staging (RBAC fix deployed) |
| MVP end-to-end lifecycle | **PARTIAL** | UI modules exist; full create→complete **OPERATOR-OWNED** |
| Security gate UI | **NOT AVAILABLE** | API gate PASS; `/fleet/gate` web route not shipped |
| Inventory browser | **PASS** | `/inventory` loads; low-stock KPIs visible |
| Dashboard KPIs | **PARTIAL** | Morning briefing + module summaries; not all enterprise KPIs |
| Portfolio screenshots | **PASS** | 10 staging PNGs under `docs/screenshots/staging/` |
| Mobile | **NOT AVAILABLE** | Flutter app separate; not in web UAT scope |

### Post-deploy RBAC verification (2026-06-12)

| Check | Result |
|-------|--------|
| Render deploy `dep-d8vcnalckfvc73ff7uvg` | **live** |
| Deployed commit | `1a9743296f679681d776ef390cb5cdeae4cb52e8` (verified match) |
| `manager_work_orders_api` | **PASS** HTTP 200 |
| `technician_work_orders_api` | **PASS** HTTP 200 |
| `npm run uat:002:validate` | **PASS** |
| `npm run smoke:deploy` | **PASS** |
| `npm run test:e2e:staging:uat002` | **PASS** (8/8) |

**Not production-ready:** Full MVP workflow sign-off, dedicated gate UI, live integrations, and production domain cutover remain open.

---

## Authentication

| Test | Pass | Fail | Notes |
|------|------|------|-------|
| Admin login | ☑ | ☐ | UAT-001 + UAT-002 browser PASS |
| Manager login | ☑ | ☐ | UAT-002 browser PASS |
| Technician login | ☑ | ☐ | UAT-002 browser PASS |
| Security officer login | ☑ | ☐ | UAT-002 browser PASS |
| Store keeper login | ☑ | ☐ | UAT-002 browser PASS |
| Invalid password message | ☑ | ☐ | Staging Playwright PASS |
| Logout | ☑ | ☐ | UAT-002 admin logout PASS |
| Session expiry redirect | ☐ | ☐ | **OPERATOR-OWNED** — manual expiry simulation |

---

## Role-based access (UAT-002)

| Role | Expected | Result | Notes |
|------|----------|--------|-------|
| Admin | Users, admin console, settings, audit, system health | **PASS** | Nav + `/admin` + `/system-health` |
| Manager | Work orders, reports, dashboards; no admin | **PASS** | Nav verified; no Admin Console link |
| Technician | Work orders; no admin/inventory | **PASS** | Nav verified |
| Security Officer | Fleet/security + gate UI; no work orders | **PASS** | `/fleet/gate` page + role guard (UAT-004) |
| Inventory Keeper | Inventory, procurement; no work orders | **PASS** | Lands on inventory module |

---

## MVP workflow

| Step | Status | Notes |
|------|--------|-------|
| Create / view asset | **PARTIAL** | `/assets` loads (admin); create modal **OPERATOR-OWNED** |
| Create work order | **PASS** | API + web kanban/modal verified (UAT-003) |
| Approve work order (if permitted) | **PASS** | `PATCH /work-orders/:id/approve` · `PATCH /work-orders/:id/reject` (UAT-004); Manager/Operations only |
| Assign technician | **PASS** | Manager `POST /work-orders/:id/assign` verified (UAT-003) |
| Reserve / request spare part | **PASS** | Full API chain request → approve → issue (UAT-003) |
| Technician updates job status | **PASS** | IN_PROGRESS → COMPLETED with actualCost/Hours (UAT-003) |
| Upload evidence (metadata/readiness) | **PARTIAL** | Readiness API reports **disabled** on staging; UI panel exists |
| Supervisor verifies / completes | **PARTIAL** | Completion without signature; mobile sign-off **NOT AVAILABLE** |
| Cost visible on WO | **PASS** | actualCost recorded on completion (UAT-003) |
| Dashboard/report reflects update | **PARTIAL** | Reports hub loads; live KPI refresh **OPERATOR-OWNED** |
| Audit log entry created | **PASS** | WO create, assign, status, complete, approve/reject audited (UAT-004) |

---

## Security officer

| Test | Status | Notes |
|------|--------|-------|
| Login as `security@maintainpro.local` | **PASS** | Browser + API |
| Only security/fleet menus visible | **PARTIAL** | Fleet yes; Dashboard/Action Center also visible |
| Gate-out allowed vehicle | **PARTIAL** | API records blocked state on seeded vehicle; allowed path when compliant |
| Gate-out blocked (expired docs) | **PASS** | API `gate_out_blocked` + movement record |
| Gate-in | **PARTIAL** | API after successful gate-out; blocked vehicle path N/A |
| Unauthorized override denied | **PASS** | Technician override → HTTP 403 |
| Audit record on gate action | **PARTIAL** | Gate movement persisted; audit explorer UI partial |
| Mobile/web scan if available | **PARTIAL** | `/fleet/gate` web page shipped (UAT-004); mobile scan **NOT AVAILABLE** |

---

## Admin / regression

| Test | Status | Notes |
|------|--------|-------|
| `/admin` no React #310 | **PASS** | Staging UAT-002 Playwright |
| `/action-center` no crash | **PASS** | Local + staging route smoke |
| Non-admin `/admin` permission state | **OPERATOR-OWNED** | Manual per-role check |

---

## Inventory

| Test | Status | Notes |
|------|--------|-------|
| Low-stock visible | **PASS** | `/inventory` KPI cards (browser) |
| Part reservation on WO | **PASS** | UAT-003 API lifecycle verified |
| Stock issue | **PASS** | Inventory keeper issue after operational approval (UAT-003) |
| Negative stock prevented / warned | **PASS** | HTTP 400 on over-issue probe (UAT-003) |

---

## Dashboard KPIs (UAT-002)

| KPI | Status | Notes |
|-----|--------|-------|
| Today's pending work orders | **PARTIAL** | WorkOrdersSummary / morning briefing |
| Overdue maintenance | **PARTIAL** | WO summary + reports |
| Critical assets | **PARTIAL** | Asset module; dedicated KPI card limited |
| Vehicles blocked from gate-out | **PARTIAL** | Fleet/alerts data; no dedicated gate KPI tile |
| Inventory low-stock items | **PASS** | Inventory summary + `/inventory` |
| ERP sync failed count | **PARTIAL** | System health panel (mock/disabled honest) |
| Monthly maintenance cost | **PARTIAL** | Reports financials module |
| Department-wise issue count | **NOT AVAILABLE** | Roadmap |
| Technician workload | **PARTIAL** | WO assigned filter for technician dashboard |

---

## ERP sync

| Test | Status | Notes |
|------|--------|-------|
| Mode badge (mock/sandbox/live) | **PASS** | `/system-health` screenshot captured |
| Dry-run sync | **OPERATOR-OWNED** | Env-gated |
| Failed sync reason visible | **PARTIAL** | Readiness panel |
| Retry / refresh readiness | **PARTIAL** | Admin system health |

---

## Notifications

| Test | Status | Notes |
|------|--------|-------|
| Readiness panel loads | **PASS** | `/system-health` |
| UAT email test (allowlisted) | **NOT AVAILABLE** | SMTP not enabled on staging |
| UAT SMS test | **NOT AVAILABLE** | SMS not enabled |
| Push provider status honest | **PASS** | mock/disabled shown in readiness |

---

## Reports export (UAT-004)

| Module | CSV | PDF | Server bulk | Notes |
|--------|-----|-----|-------------|-------|
| Reports hub | **PASS** | **PASS** | **PASS** (API) | Server export via `GET /reports/:module/export` (UAT-005 verified) |
| Vehicles list | **PASS** | **PASS** | **NOT AVAILABLE** | Current-view export in browser |
| Inventory | **PASS** | ☐ | **NOT AVAILABLE** | Selected/low-stock CSV only |
| Assets | **PASS** | **PASS** | **NOT AVAILABLE** | Client export on assets page |
| Work orders | ☐ | ☐ | **NOT AVAILABLE** | Roadmap (REP-004) |
| Audit logs | ☐ | ☐ | **NOT AVAILABLE** | API list only; export roadmap |

Manual browser verification of downloaded file contents: **OPERATOR-OWNED**.

---

## Session expiry (UAT-004)

| Test | Status | Notes |
|------|--------|-------|
| Automated: login 401 ≠ session expiry | **PASS** | `apps/web/e2e/auth.spec.ts` — invalid credentials stay on login |
| Automated: API 401 clears session | **PASS** | Axios interceptor redirects to `/login?reason=session_expired` |
| Manual: idle until JWT TTL expires | **OPERATOR-OWNED** | Set short `JWT_ACCESS_EXPIRES_IN` in staging; confirm redirect + re-login |
| Manual: refresh token rotation | **OPERATOR-OWNED** | Verify cookie refresh extends session without duplicate tabs |

---

## Reports

| Test | Status | Notes |
|------|--------|-------|
| Reports dashboard loads | **PASS** | Manager browser UAT |
| Overdue / open WO metrics | **PARTIAL** | API `/reports/dashboard` PASS |
| Export if available | **OPERATOR-OWNED** | CSV/PDF on several modules |

---

## Production validation

| Check | Pass | Fail |
|-------|------|------|
| `npm run typecheck` | ☑ | ☐ |
| `npm run test` | ☑ | ☐ |
| `npm run build` | ☑ | ☐ |
| `npm run smoke:deploy` | ☑ | ☐ |
| `npm run test:e2e:staging:uat002` | ☑ | ☐ |
| `npm run test:e2e:staging:uat003` | ☑ | ☐ |
| `npm run test:e2e:staging:uat004` | ☑ | ☐ |
| `npm run uat:005:validate` | ☑ | ☐ |
| `npm run test:e2e:staging:uat005` | ☑ | ☐ |
| Deployment URL reachable | ☑ | ☐ |
| No secrets in repo | ☑ | ☐ |

---

## Sign-off

| Role | Name | Date | Result |
|------|------|------|--------|
| QA | | 2026-06-27 | **PARTIAL PASS** — UAT-003 hosted MVP lifecycle API PASS; browser portfolio 5/5; gaps documented |
| Product owner | | | |
| DevOps | | 2026-06-27 | **PASS** — Render deploy `c36af83` live; smoke green |

**UAT-001 status:** **PASS** (credentials + smoke)

**UAT-002 status:** **PARTIAL PASS** — Hosted API + browser personas verified on live Render; manager/technician work-order list RBAC **PASS**.

**UAT-003 status:** **PARTIAL PASS** — Full hosted API lifecycle (create → assign → parts → execute → complete) **PASS** on staging; dedicated WO approval, live evidence storage, gate UI, and mobile **NOT AVAILABLE** / **PARTIAL** as documented.

**UAT-005 status:** **PASS** — Staging deployment synchronized on `e366196`; provider diagnostics, cutover runbook, and full validation suite green. Production DNS cutover and live integration credentials remain operator-owned.

**UAT-006 status:** **PASS (docs)** — Go-live decision pack, operator checklist, and pilot rollout plan prepared. **NO-GO** for production cutover until operator checklist and post-cutover smoke complete.

**Operator action:** Execute [PRODUCTION_OPERATOR_CHECKLIST.md](PRODUCTION_OPERATOR_CHECKLIST.md) only after explicit go-live approval per [PRODUCTION_GO_LIVE_DECISION_PACK.md](PRODUCTION_GO_LIVE_DECISION_PACK.md).
