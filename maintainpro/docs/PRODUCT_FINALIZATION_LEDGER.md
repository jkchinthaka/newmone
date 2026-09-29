# MaintainPro — Product Finalization Ledger

Persistent record for the 15-phase finalization programme. Read `AI_SESSION_HANDOVER.md` first, then this file, then `git log origin/main`.

Statuses used for every page and phase: **NOT STARTED**, **IN PROGRESS**, **IMPLEMENTED — NOT VERIFIED**, **PARTIALLY VERIFIED**, **BLOCKED**, **VERIFIED COMPLETE**.

A page is **VERIFIED COMPLETE** only when database, API, RBAC, workflow, integration, automated tests, browser UAT, and GitHub validation are all recorded. A phase is **VERIFIED COMPLETE** only when every required page in that phase is.

Authoritative stack (verified 2026-09-29 against source, not older docs):

- Web/PWA: Next.js App Router in `maintainpro/apps/web`.
- API: NestJS in `maintainpro/apps/api`.
- Database: SQL Server. `prisma/schema.prisma` datasource `provider = "sqlserver"`. 25 migrations, last recorded `db:migrate:status` up to date on 2026-09-29.
- MongoDB and Flutter text in older docs is historical. Flutter was removed in PR #58 (`1a5c8803`).
- Permissions: `PermissionsGuard` loads permissions from the database. JWTs do not carry them. Service checks must use `withCurrentPermissions` and `hasCompatiblePermission`.

---

## A. Project baseline

Inspected 2026-09-29 from `C:\Dev\newmone` after `git fetch origin`.

| Fact | Evidence |
| --- | --- |
| `origin/main` | `52311b8f` `docs(handover): record branch HEAD after protocol commit` |
| Requests on main | Yes. Tree landed in `89533ac0` (message says `test(vendors)…`; the tree is the Requests slice plus the vendor-contract test fix). Docs `7878eb56`, `52311b8f`. Direct push to `main` by `jkchinthaka` at 2026-09-29T10:09:06Z. No PR. History was not rewritten. |
| Earlier merges already on main | PR #59 My Jobs `6264948f`; PR #60 Vendor eligibility `74e66f2a`; PR #61 Maintenance costs `fd250e72`; PR #58 Flutter retirement `1a5c8803` |
| Checkout at Phase 00 write | `ci/jest-heap-oom` @ `a5f14019`, later docs commit `c4bb680e` |
| PR #62 | Open. https://github.com/jkchinthaka/newmone/pull/62 |
| Worktrees left alone | `C:\Dev\newmone-maintenance-costs` @ `5ad5637c` (merged via #61); `C:\Dev\newmone-vendor-eligibility` @ `26790251` (merged via #60) |
| Stash | `stash@{0}` `pre-main-handover-20260929`. Not popped. |
| Remote branches | `origin/main`, `origin/ci/jest-heap-oom`, `origin/feature/my-jobs-workspace`, `origin/feature/vendor-eligibility`, `origin/feature/maintenance-costs` |
| Local branch equal to main | `maintainpro/finalization-iter-01` @ `52311b8f`, upstream removed |
| Route count | 194 `page.tsx` files under `apps/web` |

### CI and deployment at this inspection

PR #62 head `a5f14019` (re-run after the latest handover commit):

| Check | Result at inspection | Notes |
| --- | --- | --- |
| `fresh-sqlserver-migrate` | pass | 2m40s |
| `netlify/nelna/deploy-preview` | pass | |
| `build`, `docker-build`, `release-validate`, `validate-monorepo` | pending | Prior head `4a9a597b` was recorded in the handover as green for these after the heap fix. That result is not the result of `a5f14019`. |
| `full-stack-e2e` | fail | ~2m. Same MinIO `unauthorized` pull seen since `028ba871`. Not changed in PR #62. |
| Vercel | fail | Deployment failed. Local reproduction without `NEXT_PUBLIC_API_URL` hits the guard in `apps/web/lib/api-url.ts`. Dashboard logs were not read in this session. |
| Cloudflare Workers Builds | fail | No build log retrieved. Same `NEXT_PUBLIC_*` build-time gap is the standing hypothesis. |

Do not merge PR #62 while required checks are pending or failing. Do not force-push or reset `main`.

### CI recheck 2026-09-29 ~16:45 IST, head `c4bb680e`

`gh pr checks 62` against that commit (the Phase 00 docs push):

| Check | Result |
| --- | --- |
| `validate-monorepo` | pass, 8m45s |
| `release-validate` | pass, 17m15s |
| `fresh-sqlserver-migrate` | pass, 3m9s |
| `build` | pass, 4m32s |
| `docker-build` | pass, 9m4s |
| Netlify preview | pass |
| `full-stack-e2e` | fail, 1m54s. Log: `minio Error unauthorized` while pulling the pinned Quay images. Run `36558212887`. |
| Vercel | fail. Deployment `dpl_FpGAjGK5LXm8pjCFsC77WJKr6x6W`. Logs not retrieved. |
| Cloudflare Workers Builds | fail. Logs not retrieved. |

The Jest heap change in PR #62 is confirmed on head `c4bb680e`. It does not fix MinIO, Vercel, or Workers. Not merged.

### CI recheck 2026-09-29 ~16:50 IST, head `168694a2`

`gh pr checks 62` while the docs commit was still running:

| Check | Result |
| --- | --- |
| `full-stack-e2e` | fail, 1m53s. Log: `minio Error unauthorized`. Run `36560675132`. Same external image pull as `c4bb680e`. |
| `validate-monorepo`, `release-validate`, `fresh-sqlserver-migrate`, `build`, `docker-build` | pending at inspection |
| Vercel, Workers | pending or in progress at inspection |
| Netlify preview | pass |

Browser UAT remains **NOT VERIFIED**. The Cursor browser loaded `/requests`, showed “Session expired. Redirecting to sign in…”, and landed on `/login?reason=session_expired&returnTo=%2Frequests`. No password was entered.

---

## B. 15-phase roadmap

| Phase | Name | Programme status |
| --- | --- | --- |
| 00 | Baseline reconciliation | PARTIALLY VERIFIED — baseline recorded; PR #62 app checks passed on `c4bb680e`; MinIO, Vercel, and Workers still fail |
| 01 | Login, session, invitation onboarding | IMPLEMENTED — NOT VERIFIED |
| 02 | Global application shell | IMPLEMENTED — NOT VERIFIED |
| 03 | Action Center | IMPLEMENTED — NOT VERIFIED |
| 04 | Maintenance dashboard | IMPLEMENTED — NOT VERIFIED |
| 05 | All jobs / work orders | IMPLEMENTED — NOT VERIFIED |
| 06 | Machinery / service / vehicle jobs | IMPLEMENTED — NOT VERIFIED |
| 07 | Work order details / My Jobs | IMPLEMENTED — NOT VERIFIED |
| 08 | Maintenance requests | IN PROGRESS — list and detail PARTIALLY VERIFIED; create page not in this iteration |
| 09 | Assets, sites, locations | IMPLEMENTED — NOT VERIFIED |
| 10 | Preventive maintenance | IMPLEMENTED — NOT VERIFIED |
| 11 | Fleet and gate | IMPLEMENTED — NOT VERIFIED |
| 12 | Spare parts and ERP | IMPLEMENTED — NOT VERIFIED |
| 13 | Administration | IMPLEMENTED — NOT VERIFIED |
| 14 | Reports, costs, history | IMPLEMENTED — NOT VERIFIED (costs page only PARTIALLY VERIFIED) |
| 15 | System-wide final acceptance | NOT STARTED |

Out of the product surface, retained for deep links or server RBAC only, and not required pages of phases 01–15: `/farm/*`, `/cleaning/*`, `/fg/*`, `/billing`, `/predictive-ai`, `/qa/*`, `/delivery-readiness/*`, `/go-live/*`, `/post-go-live/*`, `/releases`, `/support/*`, `/operations/*`, `/change-requests`, and legacy FMS `/machinery*`, `/service*`, `/vehicle*`, `/pending-requests`, `/home`.

---

## C. Current phase and page

- **Current phase:** 08 Maintenance Requests.
- **Current page:** `/requests` and `/requests/[id]` (one iteration; detail is the same slice).
- **Status:** PARTIALLY VERIFIED.
- **Do not start** `/requests/new` until this page is VERIFIED COMPLETE or a recorded blocker makes further verification impossible and the user types CONTINUE past it.

---

## D. Page-by-page checklist

Required pages that exist in the current tree. "Implemented" means a route file exists. It is not UAT.

### Phase 01 — Login, session, invitation onboarding

| Page | Route | Status |
| --- | --- | --- |
| Login | `/login` | IMPLEMENTED — NOT VERIFIED |
| Forgot password | `/forgot-password` | IMPLEMENTED — NOT VERIFIED |
| Accept invitation | `/accept-invite` | IMPLEMENTED — NOT VERIFIED |
| Register | `/register` | IMPLEMENTED — NOT VERIFIED |
| Splash | `/splash` | IMPLEMENTED — NOT VERIFIED |

Return-path hardening commit `faba0ab7` is historical evidence, not a fresh UAT of this phase.

### Phase 02 — Global shell

| Surface | Location | Status |
| --- | --- | --- |
| Dashboard shell, sidebar, topbar, permission-aware nav | `apps/web` dashboard layout and `lib/navigation.ts` | IMPLEMENTED — NOT VERIFIED |

Requests nav roles were narrowed in iteration 01. The rest of the shell has not been walked under this programme.

### Phase 03 — Action Center

| Page | Route | Status |
| --- | --- | --- |
| Action Center | `/action-center` | IMPLEMENTED — NOT VERIFIED |
| Legacy redirects | `/dashboard`, `/workspace` | IMPLEMENTED — NOT VERIFIED |

### Phase 04 — Maintenance dashboard

| Page | Route | Status |
| --- | --- | --- |
| Maintenance dashboard | `/maintenance` | IMPLEMENTED — NOT VERIFIED |

### Phase 05 — All jobs / work orders

| Page | Route | Status |
| --- | --- | --- |
| All jobs | `/maintenance/jobs` | IMPLEMENTED — NOT VERIFIED |
| Work orders | `/work-orders` | IMPLEMENTED — NOT VERIFIED |

Known overlap: two entry points, titles "All Jobs" vs "Work Orders". Queue predicates were unified earlier. Not re-verified in this session.

### Phase 06 — Domain jobs

| Page | Route | Status |
| --- | --- | --- |
| Machinery jobs | `/maintenance/jobs/machinery` | IMPLEMENTED — NOT VERIFIED |
| Service jobs | `/maintenance/jobs/service` | IMPLEMENTED — NOT VERIFIED |
| Vehicle jobs | `/maintenance/jobs/vehicle` | IMPLEMENTED — NOT VERIFIED |

### Phase 07 — Work order details and My Jobs

| Page | Route | Status |
| --- | --- | --- |
| My Jobs | `/work-orders/my` | IMPLEMENTED — NOT VERIFIED |
| Work order execution | `/work-orders` (detail is in the work-order UI, not a separate `page.tsx`) | IMPLEMENTED — NOT VERIFIED |

PR #59 merged at `6264948f`. Prior local browser check showed an empty assigned list for the seed admin. Full assignment, labour, parts, and closure UAT is not recorded.

### Phase 08 — Maintenance requests (active)

| Page | Route | Status |
| --- | --- | --- |
| Request list and detail | `/requests`, `/requests/[id]` | PARTIALLY VERIFIED — browser UAT blocked on the login screen |
| Report issue | `/requests/new` | IMPLEMENTED — NOT VERIFIED |
| QR report redirect | `/qr/report-issue` | IMPLEMENTED — NOT VERIFIED |

List and detail evidence is §E and §G. Browser UAT is not done. GitHub validation for the slice is blocked: it is already on `main` without a PR, and PR #62 (CI heap only) is not merged.

### Phase 09 — Assets, sites, locations

| Page | Route | Status |
| --- | --- | --- |
| Assets | `/assets` | IMPLEMENTED — NOT VERIFIED |
| Asset health | `/assets/health` | IMPLEMENTED — NOT VERIFIED |
| Organization / facilities | `/admin/organization` | IMPLEMENTED — NOT VERIFIED |

Known from prior audit, not re-tested here: Facilities nav can point at an admin-only page.

### Phase 10 — Preventive maintenance

| Page | Route | Status |
| --- | --- | --- |
| Plans | `/maintenance/plans` | IMPLEMENTED — NOT VERIFIED |
| Planning redirect | `/maintenance/planning` | IMPLEMENTED — NOT VERIFIED |
| Forecast | `/maintenance/forecast` | IMPLEMENTED — NOT VERIFIED |
| Inspections | `/maintenance/inspections`, `/maintenance/inspections/[id]` | IMPLEMENTED — NOT VERIFIED |
| Reliability | `/maintenance/reliability`, `/maintenance/reliability/rca/[id]` | IMPLEMENTED — NOT VERIFIED |
| Job codes | `/maintenance/job-codes` | route not re-listed in this session's glob of inspected paths; treat as IMPLEMENTED — NOT VERIFIED only if the file is present when the phase starts |

Known open defects from the earlier audit, not fixed in this session: soft PM occurrence uniqueness (F-03), PM status machine (F-05).

### Phase 11 — Fleet and gate

| Page | Route | Status |
| --- | --- | --- |
| Fleet | `/fleet` | IMPLEMENTED — NOT VERIFIED |
| Gate | `/fleet/gate` | IMPLEMENTED — NOT VERIFIED |
| Vehicles | `/vehicles`, `/vehicles/[id]`, `/vehicles/health`, `/vehicles/costs`, `/vehicles/[id]/documents` | IMPLEMENTED — NOT VERIFIED |
| Compliance, accidents, insurance, fines | `/compliance`, `/accidents`, `/insurance-claims`, `/traffic-fines` | IMPLEMENTED — NOT VERIFIED |

Gate override attestation is in `1fc5d37f`. Live-map RBAC mismatch (RBAC-03) remains an open prior finding.

### Phase 12 — Spare parts and ERP

| Page | Route | Status |
| --- | --- | --- |
| Inventory | `/inventory*` including `/inventory/stock-counts` | IMPLEMENTED — NOT VERIFIED |
| Procurement | `/procurement`, `/procurement/vendors`, matching, recommendations | IMPLEMENTED — NOT VERIFIED |
| Maintenance supply | `/maintenance-supply` | IMPLEMENTED — NOT VERIFIED |
| ERP exceptions | `/erp/exceptions` | IMPLEMENTED — NOT VERIFIED |

Bileeta remains the stock-valuation source. Vendor eligibility merge is PR #60. Nav-vs-API (RBAC-01) and unbounded parts fetch (F-07) are still open prior findings.

### Phase 13 — Administration

Implemented `page.tsx` files under `/admin`: `page`, `users`, `roles`, `tenants`, `people`, `people/new`, `invitations`, `organization`, `security`, `audit`, `approvals`, `asset-masters`, `bulk-imports`, `data-quality`, `job-categories`, `maintenance-config`, `maintenance-templates`, `checklist-templates`, `fault-codes`, `reason-codes`, `priority-sla`, `reliability`, `work-permits`, `condition-monitoring`, `warranties`, `feature-flags`, `config-history`, `integrations`.

All are **IMPLEMENTED — NOT VERIFIED**. Config consumption into work orders has not been walked field by field.

### Phase 14 — Reports, costs, history

| Page | Route | Status |
| --- | --- | --- |
| Reports | `/reports`, `/reports/[module]`, exception and fraud-control routes | IMPLEMENTED — NOT VERIFIED |
| Maintenance costs | `/maintenance/costs` | PARTIALLY VERIFIED |
| Maintenance history | `/maintenance/history` | IMPLEMENTED — NOT VERIFIED |
| Vehicle cost history | `/vehicles/costs` | IMPLEMENTED — NOT VERIFIED |

Costs: PR #61 merged `fd250e72`. Unit fixture 2,000 − 1,000 + 1,500 + 2,500 = 5,000, estimate 4,000, variance +1,000 / +25%, open PO excluded. Signed-in page load showed two zero-cost sample jobs. Export, mutation refresh, cross-tenant denial, and full browser states were not completed. No production ERP journal posting was added.

### Phase 15 — Final acceptance

NOT STARTED. Depends on phases 01–14.

---

## E. Requests list and detail — preserved implementation record

This section is the iteration 01 record. It is not marked VERIFIED COMPLETE.

| Field | Value |
| --- | --- |
| Routes | `/requests`, `/requests/[id]` |
| On main | `89533ac0`, docs `7878eb56`, `52311b8f` |
| How it landed | Direct push, no PR, 2026-09-29T10:09Z |
| Schema | No migration. `MaintenanceRequest.version` used for optimistic concurrency |
| Status | PARTIALLY VERIFIED |

**API** (`apps/api/src/modules/maintenance-requests/`): list with `stage`, summary with `mine` plus `scope` and `capabilities`, detail, lifecycle posts, duplicate candidates. `guardedUpdate` on the nine status writes. `allowedActions` from `requestAllowedActions`. Date filter uses `reportedAt`.

**Permissions:** list/summary `maintenance_requests.view_own`; create/respond `…create`; triage `…triage`; accept `…approve`; close `…reject`; convert `…convert`; cancel `…cancel_own` and `…cancel_any` after review starts. `facility_issues.*` aliases stay in guard and service. SUPER_ADMIN / ADMIN bypass. No permissions were granted to TECHNICIAN, MECHANIC, or DRIVER.

**Web:** `app/(dashboard)/requests/page.tsx`, `[id]/page.tsx`, `lib/maintenance-request-ui.ts`, `lib/maintenance-requests-api.ts`, `lib/navigation.ts`.

**Defects fixed in that iteration**

| # | Defect | Fix |
| --- | --- | --- |
| R1 | Service read empty JWT permissions and fell back to role names | DB permissions via `withCurrentPermissions` and `hasCompatiblePermission` |
| R2 | Concurrent status writes overwrote each other | `guardedUpdate` on id + tenant + status + version; 409 on conflict. Live race: one 201, one 409 |
| R3 | UI offered owner Cancel where the API returns 403 | `allowedActions` is the only action source |
| R4 | Unresolved targets could not be accepted | Triage target pickers |
| R5 | Request-information, close, and mark-duplicate lacked segregation of duties | `assertNotSelfGoverned` |
| R6 | Nav showed Requests to roles the API rejects | Nav matches read roles and the list permission |
| R7 | Counters were not the same filter as the list | Shared `requestStageFilter`; summary follows view scope |
| R8 | Date filter used `createdAt` | Filter uses `reportedAt` |
| R9 | `window.prompt` and menus without Escape | Dialog plus Escape / outside click |
| R10 | Raw status codes in the UI | Label maps; server label "Accepted" |
| R11 | Duplicate close required a raw id | Pick from duplicate candidates |
| R12 | Detail error had no retry | Retry, back link, next-step banner |

REQ-04 concurrent convert was already fixed on main before this iteration.

Test-only fixes on the same commit: `vendor-repair-controls.spec.ts` and `maintenance-supply-phase09.spec.ts` now mock `vendorContract` after PR #60.

---

## F. Cross-cutting evidence already recorded

| Concern | Evidence | Limit |
| --- | --- | --- |
| RBAC audit | `npm run audit:rbac` — 951 routes, 0 violations (2026-09-29, Requests session) | Not re-run in the Phase 00 session |
| Tenant audit | `npm run audit:tenant` — 0 unapproved | Not re-run in the Phase 00 session |
| Migrations | `npm run db:migrate:status` — 25, up to date | No production migration authorized |
| Costs rollup | PR #61 unit tests and one signed-in page load | Not full UAT |
| My Jobs / vendor eligibility | Merged #59 and #60 | Not full browser lifecycle UAT under this programme |

---

## G. Test results

Recorded by the Requests iteration on 2026-09-29, against the tree that became `89533ac0` / main. Not re-executed in the Phase 00 docs session.

| Command | Result |
| --- | --- |
| `npm run typecheck` / `npm run lint` | pass |
| `npm run test` (API) | 221 suites passed, 1 skipped; 1933 passed, 10 skipped, 0 failed |
| `maintenance-requests-actions.spec.ts` | 16 / 16 |
| `npm test` in `apps/web` | 106 / 106 |
| Full build with `NEXT_PUBLIC_API_URL` | pass |
| Cold-cache API jest, 2 GB | OOM (CI reproduction) |
| Cold-cache API jest, 4 GB | 221 suites / 1933 tests pass |
| Live API smoke on local `MaintainProDev` | 15 / 15 |
| Browser visual / responsive UAT of `/requests` | not run |

PR #62 CI on head `a5f14019` is in section A. Do not treat the earlier green `4a9a597b` run as the result for `a5f14019`.

---

## H. Bugs discovered in Phase 00

No application defect was fixed in this reconciliation. Documentation defect: the Requests slice was already on `origin/main` at `52311b8f` while older handover text described it as local-only. The handover file on `a5f14019` had already been corrected by the prior session. This ledger now uses that Git fact as the baseline.

Standing failures, not introduced by Requests:

- Jest OOM on default Node heap: code fix is PR #62, not merged.
- `full-stack-e2e` MinIO image pull `unauthorized`.
- Vercel and Cloudflare Workers builds failing since at least 2026-09-18.

---

## I. Pending work and blockers

1. Finish Phase 08 page `/requests` and `/requests/[id]` before any other page.
2. PR #62 head `c4bb680e` app checks passed. Do not merge while `full-stack-e2e`, Vercel, or Workers is failing.
3. Browser UAT of `/requests` and `/requests/[id]` is **NOT VERIFIED**. Sign in on the Cursor browser at `http://localhost:3001/login?returnTo=%2Frequests`. A normal browser session is not visible to the agent. Do not type the seed password into the agent transcript.
4. `full-stack-e2e` needs an infra decision on the MinIO images. Not an application change for this page.
5. Vercel / Workers need `NEXT_PUBLIC_API_URL` (and the related public API vars) at build time, or a log that shows a different cause. Do not remove the fail-closed guard.
6. Business decision still open: whether TECHNICIAN / MECHANIC / DRIVER may report issues. No permission was granted.

---

## J. Branch, commit, PR, merge, CI

| Item | Value |
| --- | --- |
| Main | `52311b8f` |
| Active branch | `ci/jest-heap-oom`. CI evidence head `c4bb680e`. A later docs commit may follow this recheck. |
| Open PR | #62 https://github.com/jkchinthaka/newmone/pull/62 |
| Merged and already contained in main | #58 `1a5c8803`, #59 `6264948f`, #60 `74e66f2a`, #61 `fd250e72` |
| Requests commits on main | `89533ac0`, `7878eb56`, `52311b8f` |
| This Phase 00 docs update | recorded in section L after commit |

---

## K. Release readiness

Not release-ready. No phase is VERIFIED COMPLETE. Main CI is not green. Browser UAT of the active page has not run. Production deployment and production migrations are out of scope.

---

## L. Progress history

| When | What | SHA / PR |
| --- | --- | --- |
| 2026-09-29 | My Jobs, vendor eligibility, maintenance costs merged to main | #59 `6264948f`, #60 `74e66f2a`, #61 `fd250e72` |
| 2026-09-29 | Requests list and detail pushed directly to main; local gates recorded; browser UAT not done | `89533ac0` then docs through `52311b8f` |
| 2026-09-29 | Jest heap CI fix opened | PR #62, `39597a7f` and later handover commits through `a5f14019` |
| 2026-09-29 | Phase 00 reconciliation. Confirmed Requests is on main. Expanded this ledger to the 15-phase format. No second Requests implementation. | `c4bb680e` |
| 2026-09-29 | CONTINUE. Cursor browser on `/requests` showed session expired and returned to login with `returnTo=/requests`. UAT NOT VERIFIED. PR #62 head `168694a2` `full-stack-e2e` failed again on MinIO unauthorized; other app jobs still pending. | not merged |

---

## M. Exact NEXT ACTION

Stay on `/requests` and `/requests/[id]`.

1. CI for `c4bb680e` is recorded in section A. Do not merge PR #62 while `full-stack-e2e`, Vercel, or Workers is failing. Do not self-merge.
2. When the user has an authenticated browser session (the last observation was `http://localhost:3001/login`), run the Requests UAT described in `AI_SESSION_HANDOVER.md` and record it here. Do not type the seed password.
4. Mark this page VERIFIED COMPLETE only after that UAT and a recorded main SHA that contains both the Requests slice and a green required CI result.
5. The following page is `/requests/new`. Do not open it while this page is unfinished.
