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

node scripts/uat-002-api-workflows.mjs
node scripts/render-env-audit.mjs
node scripts/verify-hosted-logins.mjs
```

Portfolio screenshots: [screenshots/README.md](screenshots/README.md)

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
| Security Officer | Fleet/security; no work orders | **PASS** | Fleet nav; no WO nav; **no dedicated gate UI** |
| Inventory Keeper | Inventory, procurement; no work orders | **PASS** | Lands on inventory module |

---

## MVP workflow

| Step | Status | Notes |
|------|--------|-------|
| Create / view asset | **PARTIAL** | `/assets` loads (admin); create modal **OPERATOR-OWNED** |
| Create work order | **PARTIAL** | `/work-orders` UI exists; create flow **OPERATOR-OWNED** |
| Approve work order (if permitted) | **PARTIAL** | Part-request approval API exists; WO approval builder roadmap |
| Assign technician | **PARTIAL** | API `POST /work-orders/:id/assign`; UI **OPERATOR-OWNED** |
| Reserve / request spare part | **PARTIAL** | Part-requests panel in WO editor |
| Technician updates job status | **PARTIAL** | API + UI; RBAC roles extended for TECHNICIAN |
| Upload evidence (metadata/readiness) | **PARTIAL** | Evidence upload-request API; presigned UAT pending |
| Supervisor verifies / completes | **OPERATOR-OWNED** | Signature/mobile roadmap |
| Cost visible on WO | **PARTIAL** | Cost fields on WO model |
| Dashboard/report reflects update | **PARTIAL** | Reports hub loads; live refresh **OPERATOR-OWNED** |
| Audit log entry created | **PARTIAL** | Settings audit tab + API `/settings/audit-logs` PASS |

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
| Mobile/web scan if available | **NOT AVAILABLE** | Dedicated gate screen not shipped |

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
| Part reservation on WO | **PARTIAL** | Part-requests API; full browser flow **OPERATOR-OWNED** |
| Stock issue | **PARTIAL** | API `inventory.stock_issue`; UI **OPERATOR-OWNED** |
| Negative stock prevented / warned | **OPERATOR-OWNED** | Service-layer guard; manual negative attempt |

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
| Deployment URL reachable | ☑ | ☐ |
| No secrets in repo | ☑ | ☐ |

---

## Sign-off

| Role | Name | Date | Result |
|------|------|------|--------|
| QA | | 2026-06-12 | **PARTIAL PASS** — UAT-002 browser/API PASS post-deploy; MVP lifecycle operator-owned |
| Product owner | | | |
| DevOps | | 2026-06-12 | **PASS** — UAT-001 credentials; smoke green |

**UAT-001 status:** **PASS** (credentials + smoke)

**UAT-002 status:** **PARTIAL PASS** — Hosted API + browser personas verified on live Render commit `1a97432`; manager/technician work-order list RBAC **PASS**. Full MVP lifecycle, gate UI, and production cutover remain open.

**Operator action:** None required for RBAC — re-run `npm run uat:002:validate` after future staging deploys.
