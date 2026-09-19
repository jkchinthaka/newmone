# E2E Acceptance Results

**Branch:** `maintainpro/final-acceptance-validation`  
**Started from:** `5687cb2a` (PR #42)  
**Stack:** Docker compose dev (API :3000, Web :3001, SQL :14333, Redis, MinIO)

## Automated gates

| Gate | Result | Evidence |
|------|--------|----------|
| API typecheck | PASS | `tsc --noEmit` exit 0 |
| Web typecheck | PASS | `tsc --noEmit` exit 0 |
| API Jest | PASS | 206 suites / 1793 passed (10 skipped) |
| Web node:test | PASS | 51 passed |
| API production build | PASS | exit 0 |
| Web production build | PENDING this session | run before PR if not yet |
| Migrate status (Docker SQL) | PASS | 17 migrations applied incl. filtered unique |
| Action Center aggregates UI=API=SQL | PASS | `scripts/verify-action-center-wo-aggregates.mjs` |
| Request→WO journey UI/API/SQL | PASS | `scripts/verify-final-acceptance-journeys.mjs` 13/13 |
| Permissions guard regression | PASS | alias test for `facility_issues.manage` → create |
| Full-Stack E2E (CI) | PENDING PR | |
| SQL migration gate (CI) | PENDING PR | |

## Flagship journey (MANAGER + SUPERVISOR)

| Step | Result | SQL proof |
|------|--------|-----------|
| Login cookie session | PASS | httpOnly `maintainpro_access` |
| Short description rejected | PASS | HTTP 400 |
| Create request | PASS | `MaintenanceRequest` MR-2026-00002 NEW; description match |
| Idempotent recreate (same key) | PASS | same id returned |
| Start review | PASS | UNDER_REVIEW |
| Approve | PASS | APPROVED |
| Convert to WO | PASS | `WorkOrder` WO-2026-0006 OPEN HIGH; request CONVERTED_TO_WO + workOrderId FK |
| Convert retry | PASS | `alreadyConverted: true`, same WO id |
| Queues aggregate | PASS | 200 |

## Defects found and fixed this session

| ID | Sev | Fix |
|----|-----|-----|
| FA-001 | P1 | MANAGER `@Roles` allowed create but seed/alias lacked `maintenance_requests.create` — expanded compatibility aliases + seed |
| FA-002 | P1 | SQL Server unique on nullable `MaintenanceRequest.workOrderId` blocked 2nd unconverted request — filtered unique migration |

## Not fully exercised this session (OPEN)

Full WO lifecycle Hold/Resume/Verify/Close, PM planner, stock count post UI, procurement ERP live, fresh empty DB gate, backup/restore rehearsal, scale 10k WO load, production PWA offline, WCAG full audit, all 192 page button enumeration.
