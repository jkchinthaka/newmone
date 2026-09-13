# Phase 14 — Database Cleanup, Hardening & Go-Live

**Branch:** `maintainpro/phase-14-production`

## Product status (honest)

**Verdict: CONDITIONALLY READY for staging UAT — not unconditionally production-ready.**

Phases 8–13 delivered the core planning, supply, fleet, domain, admin, and reporting engines with automated unit coverage. Production cutover still depends on operator-owned items listed under Remaining external dependencies.

## Database cleanup policy

Destructive drops are **deferred** until Phase-0 classification + backup verification on a non-production restore.

| Action | Status |
|--------|--------|
| Drop confirmed-unused models | **DEFERRED** — retain until dependency audit on live schema |
| Forward-only schema additions (Phases 8–10) | **DONE** — require `db:push` / generate on each environment |
| Dead go-live UI modules | Soft-deprioritized in Admin console (Phase 12); modules not deleted to avoid breaking existing routes |
| Legacy `MaintenanceSchedule` | Retained alongside `PmPlan` |

**Backup before any destructive production migration:** follow `docs/go-live/developer-protection/backup-restore-plan.md` and dual-DB replication runbooks.

## Performance / indexes added or present

WO filters (`tenantId+status`, `dueDate`, `pmPlanId`), compliance `expiresAt`, meter readings `(meterId, recordedAt)`, vehicle `registrationNo`/`assetId`, PM `nextDueAt`.

Pagination remains required on list endpoints — avoid unbounded select-all.

## Security checks completed (code-level)

- JWT + Roles guards on new controllers
- Tenant scoping via `requireTenantId` on mutating planning/supply/fleet/admin services
- Admin safety: last admin, self-deactivate, tech reassignment, config confirmation
- ERP mock never reported as production success
- No secrets committed in phase branches

Still operator-owned: HTTPS termination, production secret rotation, rate-limit tuning in live edge.

## Reliability

- Auto-WO duplicate prevention (`PmAutoGeneration` + open WO check)
- Cost snapshot immutability
- Gate override audit fields
- Queue/ERP degradation behavior unchanged (existing readiness)

## Acceptance matrix (33 items)

| # | Scenario | Evidence |
|---|----------|----------|
| 1–13 | Request → WO lifecycle | Existing WO module + prior remediation suites; not re-E2E'd in this phase |
| 14 | Asset history | Linked via WO/asset relations |
| 15 | PM calendar trigger | `planning-phase08` calendar tests |
| 16 | Meter trigger | phase08 meter tests |
| 17 | Combined trigger | phase08 combined OR tests |
| 18 | Expiry alert | phase08 compliance + expiry trigger |
| 19 | Failed inspection → corrective | phase08 inspection FAIL |
| 20 | Calibration workflow | phase08 calibration FAIL |
| 21 | Vendor/external WO | phase09 assign vendor + execution mode |
| 22 | ERP boundary/reconciliation | phase09 stock boundary + mock honesty |
| 23 | Fleet service | phase10 + existing fleet modules |
| 24 | Gate blocking | phase10 gate policy |
| 25 | Gate override audit | phase10 override tests |
| 26 | Accident → repair → claim | phase10 chain |
| 27 | Admin safety | phase12 guards |
| 28 | Data-quality rules | phase12 catalog |
| 29 | Reports KPIs | phase13 formula fixtures |
| 30 | Responsive flows | Existing DataTable/mobile patterns; manual device QA still operator |
| 31 | PWA/offline duplicate | Existing offline queue; not newly revalidated here |
| 32 | Audit trail | Existing AuditLog + admin audit section |
| 33 | Backup/restore | Documented; restore drill operator-owned |

## Tests run (Phase 14 validation)

```bash
cd maintainpro/apps/api
npx jest --config ./jest.config.cjs \
  test/planning-phase08.spec.ts \
  test/maintenance-supply-phase09.spec.ts \
  test/fleet-lifecycle-phase10.spec.ts \
  test/domain-coverage-phase11.spec.ts \
  test/admin-governance-phase12.spec.ts \
  test/reporting-kpis-phase13.spec.ts
```

**Result:** 6 suites, **43 passed**.

## Remaining external dependencies

- Live Mongo `db:push` of new models to staging/production
- Real Bileeta credentials / production ERP apply flags
- SMTP/SMS production providers
- Business master data (Nelna PM frequencies, temperature limits) — OWNER REQUIRED
- Manual browser UAT + backup restore drill evidence
- Merge to `main` only after required CI checks pass

## Git discipline

Do **not** invent release tags. Merge `maintainpro/phase-14-production` (contains Phases 8–14) to `main` only with passing CI and operator approval.
