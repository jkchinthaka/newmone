# Phase 14 — Production Hardening, Acceptance Map & Go-Live Preparation

**Branch:** `maintainpro/integration-v1`  
**Baseline SHA (clean HEAD):** `dacae29be806ed627babfb485f139f199828ef6f`  
**Historical tip (reference only):** `ce38e89` (branch `maintainpro/phase-14-production`)  
**Date:** 2026-09-15  

---

## Executive verdict

**READY FOR STAGING UAT — not unconditionally production-ready.**

Phases 8–13 delivered the core planning, supply, fleet, domain, admin, and reporting engines with automated unit/integration coverage on branch `maintainpro/integration-v1`. Production cutover depends on the operator-owned blockers listed under [Go-Live Blockers](#go-live-blockers).

---

## Scope delivered (Phases 0–13 on integration-v1)

| Phase | Focus | Canonical SHA |
|-------|-------|---------------|
| 0 | Current-state audit | `f78d465` |
| 1 | Scope cleanup, RBAC foundation | `b108e76` |
| 2 | Responsive web / PWA baseline | `e18a58c` |
| 3 | Organization & functional locations | `b8d53ff` |
| 4 | Universal asset engine | `a50b6b9` |
| 5 | Maintenance requests & triage | `6b59480` |
| 6 | Work order core lifecycle | `bb48180` |
| 7 | Approval engine | `b871a8d` |
| 8 | PM plans, triggers, meters, inspection, calibration, compliance, auto-WO | integration-v1 |
| 9 | Parts classification, cost snapshots, contracts, ERP honesty | integration-v1 |
| 10 | Vehicle↔Asset, tyres/batteries, gate, accident chain | integration-v1 |
| 11 | Company domain profiles + shared KPI engine | integration-v1 |
| 12 | Operational admin + safety guards | integration-v1 |
| 13 | Role home + versioned KPIs | integration-v1 |
| **14** | **Hardening docs, acceptance matrix, production readiness** | **`dacae29`** |

---

## Historical Phase 14 — disposition

The historical branch `maintainpro/phase-14-production` (tip `ce38e89`) was produced from a diverged Phases 8–14 stack that forked directly from `main@290bf3a` **before** Phases 2–7 were built on the canonical integration line.

**Decision:** REFERENCE ONLY — do not cherry-pick or stack-merge the historical branch.

| Historical artefact | Disposition |
|--------------------|-------------|
| `_p14_extract/PHASE_14_PRODUCTION.md` | Docs reused as reference; canonical version in this file |
| `_p14_extract/phase14-acceptance-map.spec.ts` | Superseded by `apps/api/test/phase14-acceptance-map.spec.ts` (expanded to 33 items) |
| `_p14_extract/COMPLETION.md` | Historical record; disposition recorded here |
| Stack commits on `phase-14-production` | Not cherry-picked; engines already ported in Phases 8–13 on integration-v1 |

`_p14_extract/` has been removed after integration.

---

## Database cleanup policy

Destructive drops are **deferred** — no destructive Prisma model deletes in Phase 14.

| Action | Status |
|--------|--------|
| Drop confirmed-unused models | **DEFERRED** — retain until dependency audit on live schema + backup verification |
| Forward-only schema additions (Phases 8–13) | **DONE** — require `db:push` + `db:generate` on each environment |
| Soft-retired module routes (farm, cleaning, billing, QA, go-live, post-go-live, predictive-ai) | **Registered/retained** — write-stop/migrate-first policy documented in `DATA_DISPOSITION_REPORT.md` |
| Legacy `MaintenanceSchedule` alongside `PmPlan` | **RETAINED** |
| `Asset.location` legacy field | **RETAINED** — until facility hierarchy migration verified |
| `FacilityIssue` create path | **RETAINED** — migrate-first policy; see `MIGRATION_RUNBOOK.md` |

---

## Soft-retired module inventory

The following modules remain registered in `AppModule` and their routes still serve existing data. **No new feature investment.** Write-stop / migrate-first policy applies.

| Module | Status | Policy |
|--------|--------|--------|
| `FarmModule` (crops, fields, harvest, etc.) | Soft-retired | Document only; no new writes after migration |
| `CleaningModule` | Soft-retired | Same |
| `BillingModule` | Soft-retired | Same |
| `QaModule` | Soft-retired | Same |
| `GoLiveModule` | Soft-retired | Same |
| `PostGoLiveModule` | Soft-retired | Same |
| `PredictiveAiModule` | Soft-retired | Same |

See `DATA_DISPOSITION_REPORT.md` for full model-level disposition.

---

## Performance / indexes

WO filters (`tenantId+status`, `dueDate`, `pmPlanId`), compliance `expiresAt`, meter readings `(meterId, recordedAt)`, vehicle `registrationNo`/`assetId`, PM `nextDueAt`.

Pagination required on all list endpoints — avoid unbounded select-all.

---

## Security checks (code-level)

- JWT + Roles guards on all Phase 8–13 controllers
- Tenant scoping via `requireTenantId` on mutating services
- Admin safety: last admin, self-deactivate, tech reassignment, config confirmation (`admin-safety.ts`)
- ERP mock never reported as production success (`supply-boundary.erpSyncOutcome`)
- No secrets committed in any phase commit
- `sanitizeSystemResponse` strips all sensitive config fields before API response
- Gate override audit fields captured

Operator-owned: HTTPS termination, production secret rotation, rate-limit tuning at edge.

---

## Acceptance matrix summary (33 items)

| # | Scenario | Status | Evidence |
|---|----------|--------|----------|
| 1–7 | Request → WO lifecycle | automated | `work-order-lifecycle-phase06`, `work-orders-*` |
| 8–9 | Approval engine | automated | `approval-engine-phase07` |
| 10 | OVERDUE excludes CLOSED/CANCELLED | automated | `reporting-kpis-phase13`, `phase14-hardening` |
| 11 | Cross-tenant isolation | automated | `cross-tenant-isolation` |
| 12 | RBAC WO governance | automated | `work-orders-governance` |
| 13–14 | Parts/asset history | automated | `work-order-parts-governance`, `work-order-activity-timeline` |
| 15 | PM calendar trigger | automated | `planning-phase08` |
| 16 | Meter trigger | automated | `planning-phase08` |
| 17 | Combined trigger | automated | `planning-phase08` |
| 18 | Compliance expiry alert | automated | `planning-phase08` |
| 19 | Failed inspection → corrective WO | automated | `planning-phase08` |
| 20 | Calibration FAIL workflow | automated | `planning-phase08` |
| 21 | Vendor/external WO | automated | `maintenance-supply-phase09` |
| 22 | ERP boundary/mock honesty | automated | `maintenance-supply-phase09`, `phase14-hardening` |
| 23 | Fleet service job lifecycle | automated | `fleet-lifecycle-phase10` |
| 24 | Gate blocking | automated | `fleet-lifecycle-phase10` |
| 25 | Gate override audit | automated | `fleet-lifecycle-phase10` |
| 26 | Accident → repair → claim chain | automated | `fleet-lifecycle-phase10` |
| 27 | Admin safety guards | automated | `admin-governance-phase12`, `phase14-hardening` |
| 28 | Data-quality rules | automated | `admin-governance-phase12` |
| 29 | KPI formulas | automated | `reporting-kpis-phase13`, `phase14-hardening` |
| 30–32 | Responsive/PWA/audit trail | manual_uat | Staging browser + device QA |
| 33 | Backup / restore drill | **operator BLOCKER** | OPERATOR_ACTION_REQUIRED |

Full machine-readable map: `apps/api/test/phase14-acceptance-map.spec.ts`

---

## Tests run (Phase 14 validation)

```bash
cd maintainpro/apps/api
npx jest --config ./jest.config.cjs \
  test/phase14-acceptance-map.spec.ts \
  test/phase14-hardening.spec.ts \
  test/planning-phase08.spec.ts \
  test/maintenance-supply-phase09.spec.ts \
  test/fleet-lifecycle-phase10.spec.ts \
  test/domain-coverage-phase11.spec.ts \
  test/admin-governance-phase12.spec.ts \
  test/reporting-kpis-phase13.spec.ts \
  test/cross-tenant-isolation.spec.ts \
  test/auth-throttling.spec.ts
```

---

## Go-Live Blockers

1. **Backup/restore drill** — NOT executed this phase. OPERATOR_ACTION_REQUIRED before production.
2. **Live MongoDB `db:push`** — must align Atlas schema for Phases 8–13 new models.
3. **Bileeta ERP credentials** — not validated live; BLOCKER for ERP-dependent workflows.
4. **SMTP/SMS production providers** — credentials and send-path not live-tested.
5. **Business master data** — Nelna PM frequencies, temperature limits, tenant-specific values. OWNER REQUIRED.
6. **Manual browser UAT (items 30–32)** — must pass on staging before production.
7. **CI must pass** on `integration-v1` before any merge to `main`.

**Main merge recommendation: NO** — do not merge to `main` until all blockers cleared.

---

## Git discipline

- Do **not** invent release tags before CI + operator approval.
- Merge to `main` only after: CI green, operator sign-off, UAT pass, backup drill evidence.
- Never force-push; never rewrite phase branch history.
- Historical branches `maintainpro/phase-08-*` through `phase-14-production` remain as reference — do not delete.
