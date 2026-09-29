# MaintainPro — Product Finalization Ledger

Persistent record for the 15-phase finalization programme. Read `AI_SESSION_HANDOVER.md` first, then this file, then `git log origin/main`.

Statuses used for every page and phase: **NOT STARTED**, **IN PROGRESS**, **IMPLEMENTED — NOT VERIFIED**, **PARTIALLY VERIFIED**, **BLOCKED**, **VERIFIED COMPLETE**.

A page is **VERIFIED COMPLETE** only when database, API, RBAC, workflow, integration, automated tests, browser UAT, and GitHub validation are all recorded. A phase is **VERIFIED COMPLETE** only when every required page in that phase is.

A page can be **LOCAL DEVELOPMENT COMPLETE** when its database, API, RBAC, workflow, UI, local integration checks, and browser UAT are recorded, and no local application defect remains. Vercel, Cloudflare, and Netlify failures do not block that status and must not stop the next local page. Do not delete or disconnect those hosting configurations without explicit approval.

RELEASE READINESS stays separate. Do not record GitHub deployment checks, `full-stack-e2e`, MinIO, Vercel, Cloudflare, or Netlify as passed unless that exact check passed.

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

Browser UAT on 2026-09-29 ~17:05 IST, signed-in Cursor browser, user `superadmin@maintainpro.local`, tenant MaintainPro Default Tenant. No password was recorded.

| Check | Result |
| --- | --- |
| Session | Login at 16:53 returned 200, then `/requests`, `/auth/me`, and `/tenants/me` returned 200. The same session opened the list, filters, and detail through 17:01. |
| Counts | Open 0, Awaiting triage 0, Open high / critical 0, Converted 1. All requests list total 2: MR-2026-00002 Cancelled and MR-2026-00001 Converted to Work Order. Cancelled is not one of the four cards. |
| Card filter | `?stage=open` showed “0 requests” and “No requests match these filters.” `?stage=converted` showed 1 row, MR-2026-00001, “Showing 1–1 of 1.” |
| Search and clear | `?stage=converted&q=pump` kept that row. Clear filters returned to `/requests` with 2 requests. |
| Actions | Menu for MR-2026-00001 offered only “Open request” and “Open work order WO-2026-0006”. Escape set `aria-expanded=false`. |
| Detail | `/requests/cmu815bnr0021ozy4uvrbu19o`. Next step: “Progress continues on the work order.” API `GET /api/backend/maintenance-requests/cmu815bnr0021ozy4uvrbu19o` 200. |
| Layout | `documentElement.scrollWidth` equalled the viewport at 1440, 820, and 390 for list and detail. |
| API errors | Dev log showed 200 for the request list, summary, and detail during this pass. Redis `ECONNREFUSED 127.0.0.1:6380` continued and did not fail these pages. |
| Copy | Filtered count said “1 request match this view”. Fixed locally to “matches” / “match”. |

Screenshots: `requests-desktop-1440.png`, `requests-detail-desktop-1440.png`, `requests-detail-tablet-820.png`, `requests-list-tablet-820.png`, `requests-list-mobile-390.png`, `requests-detail-mobile-390.png` under `%LOCALAPPDATA%\Temp\cursor\screenshots`.

Cross-role browser denial was not repeated. The earlier API smoke remains the technician 403 evidence.

---

## B. 15-phase roadmap

| Phase | Name | Programme status |
| --- | --- | --- |
| 00 | Baseline reconciliation | PARTIALLY VERIFIED — baseline recorded; PR #62 app checks passed on `c4bb680e`; MinIO, Vercel, and Workers still fail |
| 01 | Login, session, invitation onboarding | LOCAL DEVELOPMENT COMPLETE. Release readiness BLOCKED |
| 02 | Global application shell | LOCAL DEVELOPMENT COMPLETE. Release readiness BLOCKED |
| 03 | Action Center | LOCAL DEVELOPMENT COMPLETE. Release readiness BLOCKED |
| 04 | Maintenance dashboard | LOCAL DEVELOPMENT COMPLETE. Release readiness BLOCKED |
| 05 | All jobs / work orders | IMPLEMENTED — NOT VERIFIED |
| 06 | Machinery / service / vehicle jobs | IMPLEMENTED — NOT VERIFIED |
| 07 | Work order details / My Jobs | IMPLEMENTED — NOT VERIFIED |
| 08 | Maintenance requests | List and detail LOCAL DEVELOPMENT COMPLETE; `/requests/new` not started. Release readiness BLOCKED |
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

- **Current phase:** 04 Maintenance dashboard — LOCAL DEVELOPMENT COMPLETE on `feature/phase-04-maintenance-dashboard` (`cde25d49`). Release readiness remains BLOCKED.
- **Next phase:** 05 All jobs / work orders. Continue without waiting for CONTINUE.
- **Phase 01:** locally complete at `4cf25f20`. Legacy raw `TenantInvitation` tokens were not rewritten.
- **Previous page:** `/requests` and `/requests/[id]` — LOCAL DEVELOPMENT COMPLETE. Release readiness remains BLOCKED.
- `/requests/new` stays in Phase 08 and is not started.

### Requests list and detail — two statuses

LOCAL DEVELOPMENT STATUS: COMPLETE. Implementation is the slice on main (`89533ac0`). Local tests: web label tests 12/12, API action tests 16/16. SUPER_ADMIN browser UAT at 1440, 820, and 390 passed. Initial `/requests` load at 17:18 IST, signed in: Performance resource timing showed `auth/me` 200, `tenants/me` 200, list 200, and summary 200. The server log matches those 200s. No Next.js error overlay and no alert. The document-start console recorder did not attach, so individual first-paint console lines were not listed. A later client navigation to the detail page produced no hooked console error or warning. No local application defect was found on that load. Redis on port 6380 is refused and did not fail the page.

RELEASE READINESS STATUS: BLOCKED. Origin PR #62 head `c04ff246`: `validate-monorepo`, `release-validate`, `build`, `docker-build`, and `fresh-sqlserver-migrate` passed. `full-stack-e2e` failed on the MinIO image pull (`unauthorized`). Vercel and Cloudflare Workers Builds failed; build logs were not retrieved. These are not recorded as passed. PR #62 is not merged. Local commits `04dc017c` and `8e999fde` stay unpushed.

---

## D. Page-by-page checklist

Required pages that exist in the current tree. "Implemented" means a route file exists. It is not UAT.

### Phase 01 — Login, session, invitation onboarding

| Page | Route | Local status | Notes |
| --- | --- | --- | --- |
| Login | `/login` | LOCAL DEVELOPMENT COMPLETE | Existing login kept. Failed sign-in stays on the page with “Incorrect email or password.” An external `returnTo` is ignored and lands on `/action-center`. Reload keeps the session. Access and refresh cookies are HttpOnly. Tokens are not stored in localStorage. |
| Forgot password | `/forgot-password` and `/reset-password` | LOCAL DEVELOPMENT COMPLETE | Unknown and registered emails both receive “If this email exists, a reset link has been sent.” The reset token is stored as a SHA-256 hash for 15 minutes, older unused tokens are marked used, and a second use is rejected. Refresh sessions are revoked on reset. `EMAIL_MODE=disabled` locally, so no mailbox delivery was observed and the log line does not include the token. An invalid token shows “Invalid or expired reset token.” |
| Accept invitation | `/accept-invite` | LOCAL DEVELOPMENT COMPLETE | Public page no longer depends on the signed-in query client. Invite creation accepts the SQL role id. Acceptance claims the invitation once, keeps the server-assigned tenant and role, and sets a password that matches the reset-password rule. A disposable development account was accepted and then signed in. |
| Register | `/register` | LOCAL DEVELOPMENT COMPLETE | `ALLOW_PUBLIC_REGISTRATION=false`. The page explains invitation-only access and links to sign-in and `/accept-invite`. A workspace `invitationToken` still opens the join form. Closed registration returns 403 before any email lookup, including for an existing address. A bad workspace token returns 400 and creates no user. Public registration is not enabled. |
| Splash | `/splash` | LOCAL DEVELOPMENT COMPLETE | `/` redirects here. A signed-in admin lands on `/action-center`. A safe `returnTo` is used first. External return paths are ignored. A missing session goes to `/login`. If `/auth/me` cannot be reached, the page shows Try again instead of sending the user to login. The previous 1.6 second wait was removed. |

Each Phase 01 page, starting with `/login`, must be checked through database session records, API, RBAC, workflow, UI, integration, and local tests before the next page. Do not begin Phase 02 until every Phase 01 page is locally complete.

Return-path hardening commit `faba0ab7` is historical evidence, not a fresh UAT of this phase.

### Phase 02 — Global shell

| Surface | Location | Status |
| --- | --- | --- |
| Shared dashboard layout | `apps/web/app/(dashboard)/layout.tsx` | LOCAL DEVELOPMENT COMPLETE (`ae7f84dd`) |
| Sidebar and navigation | `components/layout/sidebar.tsx`, `nav-links.tsx`, `lib/navigation.ts` | LOCAL DEVELOPMENT COMPLETE |
| Topbar and global actions | `components/layout/topbar.tsx` | LOCAL DEVELOPMENT COMPLETE |
| Breadcrumbs and legacy routes | `lib/breadcrumbs.ts`, `/dashboard` and `/workspace` redirect to `/action-center` | LOCAL DEVELOPMENT COMPLETE |
| Mobile and tablet navigation | `mobile-nav.tsx`, `mobile-bottom-nav.tsx` | LOCAL DEVELOPMENT COMPLETE |

No database, API contract, or permission grant changed in this pass. Navigation visibility stays in `getVisibleNavigationItems` / `canAccessNavigationPath`, which the route guard uses before painting a denied page. Browser walk used the seeded admin and cleaner accounts. The cleaner was sent from `/admin` to `/action-center?reason=access_denied`. A forced `401` from `/auth/me` landed on `/login?reason=session_expired&returnTo=/requests`. Sign-out reached `/login`. A signed-out visit to `/requests` reached `/login`. Tenant id stayed the same from `/requests` to `/assets`. Requests showed `aria-current="page"` after the Maintenance group was opened. `/dashboard` and `/workspace` both landed on `/action-center`. At 1440 the sidebar was visible; at 820 and 390 it was hidden and the menu button was available. The drawer locked body scroll, closed from the dimmed area and the close button, and closed after Asset Register was opened. Offline mode showed the existing offline banner. Document overflow was false at 1440, 820, and 390. Redis on `127.0.0.1:6380` still refused and was not treated as a shell defect. Fixes in this pass: drawer body scroll lock, 44px group and full-navigation controls, pin controls large enough to use in the drawer, a named Logout control when its text is hidden, and no unread badge when the notification count request fails.

### Phase 03 — Action Center

| Page | Route | Status |
| --- | --- | --- |
| Action Center | `/action-center` | LOCAL DEVELOPMENT COMPLETE | Live queues, inventory, invitations, facility feed, and KPI strip. Readiness no longer holds the rest of the page. Overdue and high-priority cards open matching work-order queues. |
| Legacy redirects | `/dashboard`, `/workspace` | LOCAL DEVELOPMENT COMPLETE | Both land on `/action-center`. |

No schema migration. No permission grant. Technicians still cannot open the high-priority queue. Readiness stays a separate query, so a slow Redis check shows “Checking readiness” while the rest of the board is already visible. Signed-in browser, `superadmin@maintainpro.local`, tenant MaintainPro Default Tenant: search for “overdue” kept that card and hid inventory and admin. `/work-orders?queue=high-priority` showed badge 2 and list total 2. Document overflow was false at 390 and 1440. Web `action-center.test.ts` 24/24. API `action-center.spec.ts` and `work-order-queues.spec.ts` 22/22 together. Redis on `127.0.0.1:6380` still refused and is not an Action Center defect. Release readiness stays BLOCKED.

### Phase 04 — Maintenance dashboard

| Page | Route | Status |
| --- | --- | --- |
| Maintenance dashboard | `/maintenance` | LOCAL DEVELOPMENT COMPLETE | SQL counts match the admin cards. Unassigned opens a list of 19 (OPEN or PLANNED, no technician). Machinery queues are scoped to `jobDomain`. No schema migration. No permission grant. Non-admin browser sign-in was not repeated. |

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
| Request list and detail | `/requests`, `/requests/[id]` | LOCAL DEVELOPMENT COMPLETE. Release readiness BLOCKED |
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
2. PR #62 origin head `c04ff246`: `release-validate` passed in 16m47s. `full-stack-e2e`, Vercel, and Workers still fail. Do not merge. Do not change the MinIO image until an anonymous manifest pull returns 200.
3. SUPER_ADMIN browser UAT is recorded. Additional evidence: client navigation to the detail page emitted no hooked `console.error` or `console.warn`; no error overlay. `maintenance-request-ui.test.ts` 12/12 and `maintenance-requests-actions.spec.ts` 16/16. Stage cards exclude Cancelled and Closed. A no-permission user gets no actions. Other roles were not signed in through the browser.
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

Local development continues on localhost SQL Server. Hosting failures do not stop the phase list.

### DEPLOYMENT / RELEASE READINESS

| Check | Status | Notes |
| --- | --- | --- |
| `validate-monorepo`, `release-validate`, `build`, `docker-build`, `fresh-sqlserver-migrate` | pass on origin `c04ff246` | App CI jobs. |
| `full-stack-e2e` / MinIO | fail | Anonymous Quay pull returns `unauthorized`. Image not changed. |
| Vercel | fail | Deployment `dpl_BgGAqXGZCXoA9sSppycbQwbUvkg5`. Log not retrieved. Guard in `apps/web/lib/api-url.ts` stays. |
| Cloudflare Workers Builds | fail | Build `9eb336a6-f906-4c32-8175-606db8a9f706`. Log not retrieved. |
| Netlify preview | pass | Not a production release. |

Overall release readiness: **BLOCKED**. Do not mark this passed. Do not disconnect these hosts. Production migrations stay out of scope.

---

## L. Progress history

| When | What | SHA / PR |
| --- | --- | --- |
| 2026-09-29 | My Jobs, vendor eligibility, maintenance costs merged to main | #59 `6264948f`, #60 `74e66f2a`, #61 `fd250e72` |
| 2026-09-29 | Requests list and detail pushed directly to main; local gates recorded; browser UAT not done | `89533ac0` then docs through `52311b8f` |
| 2026-09-29 | Jest heap CI fix opened | PR #62, `39597a7f` and later handover commits through `a5f14019` |
| 2026-09-29 | Phase 00 reconciliation. Confirmed Requests is on main. Expanded this ledger to the 15-phase format. No second Requests implementation. | `c4bb680e` |
| 2026-09-29 | Shared dashboard layout verified on localhost. Unauthorized routes are not painted before the access check. Skip link added. | `ae7f84dd`, local, not pushed |
| 2026-09-29 | Phase 02 shell finished locally: sidebar, topbar, breadcrumbs, mobile drawer, tenant stability, cleaner denial, expired session, logout, and offline banner. | `feature/phase-02-shell`, not pushed |
| 2026-09-29 | Phase 03 Action Center: readiness no longer blocks the board; overdue and high-priority cards open matching queues. No schema change. No permissions granted. | `feature/phase-03-action-center` `42c9d82c`, not pushed |
| 2026-09-29 | Phase 04 dashboard cards open the work-order queues that match their counts, including waiting parts. | `feature/phase-04-maintenance-dashboard` `cde25d49`, not pushed |

---

## M. Exact NEXT ACTION

Start Phase 05 All jobs / work orders (`/maintenance/jobs` and `/work-orders`). Do not merge `feature/phase-04-maintenance-dashboard` into main. It contains unmerged `ci/jest-heap-oom` (`4c41d269`) plus Phases 01–04. Release readiness stays BLOCKED.
