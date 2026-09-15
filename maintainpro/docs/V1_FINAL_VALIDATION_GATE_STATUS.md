# MaintainPro V1 — Final Validation Gate Status

**Date:** 2026-09-15  
**Branch:** `maintainpro/phase-15-sqlserver-migration`  
**Starting SHA (Phase 15A final):** `21ff7f04793ee018a08b164c479abf1e903e5a62`  
**Product scope:** Phases 0–14 FROZEN — validation / cutover / release only  

---

## Gate 0 — Baseline

| Check | Result |
|-------|--------|
| `git fetch` / clean working tree | PASS |
| Remote tip = Phase 15A final | PASS (`21ff7f04…`) |
| Phase 15A: Ready for SQL Server Staging UAT | YES |

---

## Gate 1 — SQL Server Staging UAT

### Environment (actual)

| Item | Status |
|------|--------|
| SQL Server | 2022 Developer (Docker `maintainpro-sql`), port 1433 |
| Database | `MaintainProDev` (disposable local — **not** company shared staging) |
| Schema | `db:migrate:deploy` up to date — 185 tables |
| API | Started locally against SQL Server — `/health` DB healthy |
| Web/PWA | **NOT EXECUTED** (no staging web session against SQL) |
| Redis | Reachable on `:6379` but Bull queue reported **degraded/failed** at readiness |
| Object storage | **degraded / local-mock** |
| Email | **disabled** |
| SMS | **disabled** |
| Bileeta / ERP | **mock** (`INVENTORY_ERP_MOCK`) — not live Bileeta staging |
| Scheduler/workers | **NOT fully validated** (queue failed) |

### Data

| Step | Result |
|------|--------|
| Representative Mongo → SQL (Phase 15A fixture) | Already applied; idempotent |
| Full production-like staging dump | **NOT EXECUTED** |
| Reconciliation (fixture) | See `SQLSERVER_DATA_RECONCILIATION.md` — fixture PASS |
| Reconciliation (full staging catalog Employees/Inspections/…) | **NOT EXECUTED** (absent from fixture) |

### Automated SQL API checks executed 2026-09-15

| Test ID | Role | Steps | Expected | Actual | Result |
|---------|------|-------|----------|--------|--------|
| G1-API-01 | ADMIN | POST `/api/auth/login` (bcrypt-updated fixture user) | Login success + JWT | Login successful; role ADMIN; RolePermission links present | PASS |
| G1-API-02 | TECHNICIAN | POST `/api/auth/login` | Login success | Login successful; role TECHNICIAN | PASS |
| G1-API-03 | ADMIN | GET `/health` | DB healthy | Database connected (~23ms) | PASS |
| G1-API-04 | ADMIN | GET assets / requests / work-orders / vehicles / PM / KPIs with `X-Tenant-Id` | 200 + data | `TENANT_ACCESS_DENIED` on all domain routes | **FAIL** |
| G1-API-05 | ADMIN | Full Request→WO→Close lifecycle via API | Complete lifecycle | **NOT EXECUTED** (blocked by tenant denial) | BLOCKED |
| G1-WEB-* | * | Browser UAT matrix (requester/supervisor/tech/admin/fleet/gate/…) | PASS per `UAT_RUNBOOK.md` | **NOT EXECUTED** | NOT EXECUTED |
| G1-ROLE-* | 11 canonical roles | SYSTEM_ADMIN…MANAGEMENT_VIEWER | Each role journey | Fixture only has ADMIN + TECHNICIAN | **FAIL / incomplete** |

### Gate 1 blockers

1. Domain APIs return `TENANT_ACCESS_DENIED` after successful SQL login (tenant middleware / fixture tenant registration mismatch).
2. Fixture is CMMS-core only — not full staging representative set (Employees, Inspections, Calibration, Compliance, Parts issue, Gate, …).
3. Canonical UAT roles not seeded for SQL staging.
4. No human tester sign-off; no web/PWA responsive UAT executed.
5. ERP remains mock; Redis queues degraded.

### Gate 1 verdict

**SQL Server Staging UAT Readiness = FAIL**

**STOP.** Gates 2–6 not started as PASS paths.

---

## Gate 2 — Bileeta / External Integrations

**NOT EXECUTED** (Gate 1 FAIL).

Observed on local SQL API readiness only:

| Dependency | Observed | Verdict for release |
|------------|----------|---------------------|
| Bileeta ERP | mock adapter | **NOT EXECUTED** live |
| Email | disabled | NOT EXECUTED |
| SMS | disabled | NOT EXECUTED |
| Storage | local/mock degraded | NOT EXECUTED |
| Redis/queues | degraded/failed | NOT EXECUTED |

`External Integration Readiness = FAIL` (not attempted as Gate 2).

---

## Gate 3 — Production SQL Cutover

**NOT EXECUTED**

No approved maintenance window, no production SQL credentials, no production access authorization in this session.

---

## Gate 4 — Production Smoke + Sign-off

**NOT EXECUTED**

Business sign-off: **pending** (not obtained; not invented).

---

## Gate 5 — Merge to `main`

**NOT EXECUTED** (requires `PRODUCTION ACCEPTED`).

---

## Gate 6 — MaintainPro V1 COMPLETE

**NOT DECLARED**

---

## Final verdict (mandatory single value)

**NOT READY**

---

## Next required actions (human / operator)

1. Fix SQL-backed tenant context so authenticated users can access tenant-scoped APIs.
2. Seed full staging role set + bcrypt accounts on a real staging SQL database.
3. Migrate representative staging Mongo snapshot; fill reconciliation for all required models.
4. Execute `docs/UAT_RUNBOOK.md` with named tester + dates; obtain critical-journey PASS.
5. Validate Bileeta staging (or formal accepted condition), email/SMS/storage/Redis as required.
6. Only then schedule production cutover window.
