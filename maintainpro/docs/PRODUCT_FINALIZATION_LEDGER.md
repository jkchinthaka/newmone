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
| 05 | All jobs / work orders | LOCAL DEVELOPMENT COMPLETE. Release readiness BLOCKED |
| 06 | Machinery / service / vehicle jobs | LOCAL DEVELOPMENT COMPLETE. Release readiness BLOCKED |
| 07 | Work order details / My Jobs | IN PROGRESS |
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

- **Current phase:** 07 My Jobs and work-order execution. Phases 05 and 06 are locally complete on `feature/phase-05-all-jobs`. Release readiness remains BLOCKED.
- **Next phase:** 07. Continue without waiting for CONTINUE.
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
| Maintenance dashboard | `/maintenance` | LOCAL DEVELOPMENT COMPLETE | Unassigned is the `unassigned` queue (OPEN/PLANNED, no technician): API and list both 19. Open load queue is 24; machinery/service/vehicle open-load lists are 15/3/6. Requests use stage `open`. PM uses plans view `due`. Approvals match the inbox statuses. Low stock uses the inventory low-stock predicate. Technician dashboard is 200 with stock and approvals hidden. Cleaner is 403. Redis readiness is not part of this page request. |

### Phase 05 — All jobs / work orders

| Page | Route | Status |
| --- | --- | --- |
| All jobs | `/maintenance/jobs` | LOCAL DEVELOPMENT COMPLETE | One Work Orders heading. Queue view no longer shows a second count row from a different query. |
| Work orders | `/work-orders` | LOCAL DEVELOPMENT COMPLETE | Server redirect keeps the query (`/maintenance/jobs?queue=unassigned`). |

Known overlap resolved: `/work-orders` redirects to `/maintenance/jobs` and keeps the query. The board heading is Work Orders. Queue view uses the queue summary for counts.

### Phase 06 — Domain jobs

| Page | Route | Status |
| --- | --- | --- |
| Machinery jobs | `/maintenance/jobs/machinery` | LOCAL DEVELOPMENT COMPLETE | Same board, `jobDomain=MACHINERY`. Open-load list 15. |
| Service jobs | `/maintenance/jobs/service` | LOCAL DEVELOPMENT COMPLETE | Same board, `jobDomain=SERVICE`. Open-load list 3. |
| Vehicle jobs | `/maintenance/jobs/vehicle` | LOCAL DEVELOPMENT COMPLETE | Same board, `jobDomain=VEHICLE`. Open-load list 6. |

### Phase 07 — Work order details and My Jobs

| Page | Route | Status |
| --- | --- | --- |
| My Jobs | `/work-orders/my` | LOCAL DEVELOPMENT COMPLETE | Assigned mechanic saw the disposable job. After close it left My Jobs. Superadmin My Jobs stays 0 because that user has no assignment. |
| Work order execution | `/maintenance/jobs?wo=` | LOCAL DEVELOPMENT COMPLETE | Disposable inspection WO-2026-0249 went assigned, in progress, technician completed, verified, and closed. Evidence upload stays BLOCKED / NOT VERIFIED. |

PR #59 merged at `6264948f`. Seed admin My Jobs can be empty because the list is assigned-to-me, not every tenant job.

Phase 07 evidence so far, branch `feature/phase-07-my-jobs`:

- My Jobs view counts are the assigned totals. Filters narrow the list only.
- `tech@maintainpro.local` `GET /work-orders/my-jobs` returned 200, scope `assigned-to-me`, active 3, overdue 3, completed 2. `cleaner@maintainpro.local` returned 403.
- Starting, holding, or technician-completing a job as a technician or mechanic requires assignment on that work order. Admins and managers are not restricted that way.
- Starting an assigned job opens one labour session for that user and tenant, and refuses a second open session for the same technician.
- Part issue records work-order usage, quantity, cost, and a pending ERP event (`WORK_ORDER_PART_CONSUMPTION`). It does not write `SparePart.quantityInStock` or warehouse balances. Bileeta owns the stock quantity. `work-order-erp-stock-boundary.spec.ts` 7/7. The disposable assigned flow is still required before this phase is complete.
- Supervisor verification refuses the person who completed the job, unless an admin records an override reason of at least 3 characters.
- Evidence file upload is BLOCKED / NOT VERIFIED. `STORAGE_MODE` and `STORAGE_UPLOADS_ENABLED` are not set in local `.env`. MinIO remains a release failure. Evidence security was not disabled.
- Signed-in browser as the seeded admin stayed on `/work-orders/my` after reload (`/auth/me` 200) and after opening `/maintenance`. Counts were 0 because that user has no assignments.
A follow-up hardens that fix: the first refresh claims the token with an atomic update. A second refresh of that same token while the replacement is still being written, or within 15 seconds while the replacement is still valid, returns `REFRESH_TOKEN_ROTATED` and does not revoke the family. The browser retries instead of signing out. A replay after 15 seconds, or after the replacement is revoked, still revokes the family. `auth-refresh-replay.spec.ts` 4/4. Token lifetime was not extended.
- Evidence file upload remains BLOCKED / NOT VERIFIED.
- No schema migration. No permission grant.

- Disposable job `WO-2026-0249` (`cmunp5r4p001jq6w1gnojrpar`) was assigned to `mechanic@maintainpro.local`, appeared in My Jobs, started, opened one labour session, and rejected a second start with 409. `admin@maintainpro.local` issued one approved part. `PartIssue` quantity 1, line cost 1, outbox `WORK_ORDER_PART_CONSUMPTION` stayed `PENDING`. `SparePart.quantityInStock` stayed 19 and no warehouse balance row was created. A stale version returned 409. The mechanic verify call returned 403. `manager@maintainpro.local` verified and closed. Status history is CREATED, PLANNED, ASSIGNED, IN_PROGRESS, TECHNICIAN_COMPLETED, VERIFIED, CLOSED. `WorkOrder.version` ended at 7. The duplicate-labour job was cancelled. After close, board counts were assigned 3, in progress 2, supervisor verification 0, unassigned 19, overdue 5. Maintenance dashboard showed overdue 5, open load 24, unassigned 19, verification 0, and no page error. Redis 6380 refusal remains unrelated.
- Evidence file upload remains BLOCKED / NOT VERIFIED. Local development allowed completion with a note because storage uploads are unset and `NODE_ENV` is development. No photo was uploaded and evidence security was not disabled.
- `POST /inventory/parts/:id/stock-out` is a Phase 12 audit item. Bileeta owns stock quantity, and that inventory endpoint still decrements local quantity. It was not changed in Phase 07.

Phase 07 is LOCAL DEVELOPMENT COMPLETE on `feature/phase-07-my-jobs` at the acceptance commit. Release readiness stays blocked (Vercel, Cloudflare, MinIO). Do not merge this branch into main.

### Phase 08 — Maintenance requests (active)

| Page | Route | Status |
| --- | --- | --- |
| Request list and detail | `/requests`, `/requests/[id]` | LOCAL DEVELOPMENT COMPLETE. Release readiness BLOCKED |
| Report issue | `/requests/new` | LOCAL DEVELOPMENT COMPLETE. Release readiness BLOCKED |
| QR report redirect | `/qr/report-issue` | LOCAL DEVELOPMENT COMPLETE. Release readiness BLOCKED |

Disposable request `MR-2026-00003` was reported by `supervisor@maintainpro.local`, triaged and accepted by `manager@maintainpro.local`, and converted to `WO-2026-0251` (Machinery, High, same asset and tenant). Parallel conversion returned one new work order and one already-converted result for the same id. The requester could not review or accept their own request (403). Technician and cleaner list/create returned 403. A not-sure request required a site, stored no job domain, and cancelled. A duplicate closed onto its canonical request. Closed and cancelled records rejected further triage. Summary counts matched the list: open 0, awaiting triage 0, high/critical 0, converted 2. The converted card listed 2 of 2, then clearing it restored 7 of 7. QR `assetTag=AST-1001` with an external `next` landed on `/requests/new?assetTag=AST-1001`. Request attachments stay BLOCKED / NOT VERIFIED because storage uploads are unset. Evidence upload security was not disabled.

`maintenance-requests.spec.ts`, `maintenance-requests-actions.spec.ts`, and `request-lifecycle.spec.ts` passed 42/42. `lib/__tests__/qr-report-redirect.test.ts` passed 3/3. No schema migration.

Phase 08 is LOCAL DEVELOPMENT COMPLETE on `feature/phase-08-requests`. Release readiness stays blocked (Vercel, Cloudflare, MinIO). Do not merge this branch into main.

### Phase 09 — Assets, sites, locations

| Page | Route | Status |
| --- | --- | --- |
| Assets | `/assets` | LOCAL DEVELOPMENT COMPLETE. Release readiness BLOCKED |
| Asset health | `/assets/health` | IMPLEMENTED — NOT VERIFIED |
| Organization / facilities | `/admin/organization` | LOCAL DEVELOPMENT COMPLETE for the current one-site hierarchy. Release readiness BLOCKED |

The tenant has 1 site, 1 functional location, and 7 assets. SQL asset count matched `GET /assets` total 7, and the signed-in assets page showed Total assets 7. `POST /assets/bulk-import` now returns 400 and does not write rows. Spreadsheet import stays on `POST /bulk-import/asset/preview` then commit, with CREATE, UPDATE, SKIP, and ERROR. Asset tag lookup is tenant-scoped. Sites and functional locations are not bulk-imported: one of each does not justify a second importer, and parent moves already reject a parent on another site or an inactive parent. Inactive assets cannot be used on a new maintenance request (400). Technician asset create and cleaner asset list returned 403. `asset-bulk-import-tenant.spec.ts`, `bulk-import.service.spec.ts`, and `organization-locations.spec.ts` passed 22/22. No schema migration. Asset health was not re-walked in this pass.

Phase 09 is LOCAL DEVELOPMENT COMPLETE on `feature/phase-09-assets`. Release readiness stays blocked (Vercel, Cloudflare, MinIO). Do not merge this branch into main.

### Phase 10 — Preventive maintenance

| Page | Route | Status |
| --- | --- | --- |
| Plans | `/maintenance/plans` | LOCAL DEVELOPMENT COMPLETE. Release readiness BLOCKED | Signed-in page showed Active 1, Due in 7 days 0, Overdue 1, and 1 plan. The overdue filter still listed that plan. Next due 1 Sep 2026, every 30 days, work order WO-2026-0252. |
| Planning redirect | `/maintenance/planning` | IMPLEMENTED — NOT VERIFIED |
| Forecast | `/maintenance/forecast` | LOCAL DEVELOPMENT COMPLETE. Release readiness BLOCKED | Page loaded with no error. The forecast table is empty, matching SQL `MaintenanceForecast` count 0. Due preventive plans stay on the plans page, not in this schedule-forecast table. |
| Inspections | `/maintenance/inspections`, `/maintenance/inspections/[id]` | LOCAL DEVELOPMENT COMPLETE. Release readiness BLOCKED | Ad hoc inspection scheduled, started, and completed as PASS. Re-inspection created a new row and left the original COMPLETED/PASS. The page showed Completed this week 1 and 2 inspections. |
| Reliability | `/maintenance/reliability`, `/maintenance/reliability/rca/[id]` | LOCAL DEVELOPMENT COMPLETE for the existing summary. Release readiness BLOCKED | Page showed repeat failures 0, open RCAs 2, overdue CAPAs 0. API summary 200. Cleaner summary 403. RCA detail was not re-opened. |
| Job codes | `/maintenance/job-codes` | IMPLEMENTED — NOT VERIFIED | Page file exists. It was not re-walked in this pass. |

BACKGROUND PM SCHEDULER — BLOCKED / NOT VERIFIED. Redis is unavailable, so no scheduled run was treated as success. The generate service was called directly.

INSPECTION EVIDENCE — BLOCKED / NOT VERIFIED. The evidence upload call returned 400 while storage uploads are unset. The rest of the inspection flow does not depend on that upload.

Filtered unique index `WorkOrder_pm_occurrence_key` is present with filter `pmPlanId IS NOT NULL AND pmOccurrenceKey IS NOT NULL`. Duplicate groups: 0. Plan list total 1 matched SQL. Overdue list total 1 matched the overdue summary. No PM bulk upload was added. Calendar recurrence is an interval in days, not a calendar-month rule, so month-end overflow does not apply. `planning-phase08.spec.ts` and `pm-plan-status.spec.ts` passed 21/21.

Phase 10 is LOCAL DEVELOPMENT COMPLETE on `feature/phase-10-preventive-maintenance` at the acceptance commit. Release readiness stays blocked (Vercel, Cloudflare, MinIO, Redis scheduler, inspection file storage). Do not merge this branch into main.

### Phase 11 — Fleet and gate

| Page | Route | Status |
| --- | --- | --- |
| Fleet | `/fleet` | IMPLEMENTED — NOT VERIFIED |
| Gate | `/fleet/gate` | IMPLEMENTED — NOT VERIFIED |
| Vehicles | `/vehicles`, `/vehicles/[id]`, `/vehicles/health`, `/vehicles/costs`, `/vehicles/[id]/documents` | IMPLEMENTED — NOT VERIFIED |
| Compliance, accidents, insurance, fines | `/compliance`, `/accidents`, `/insurance-claims`, `/traffic-fines` | IMPLEMENTED — NOT VERIFIED |

Gate override attestation is in `1fc5d37f`. Live-map RBAC mismatch (RBAC-03) remains an open prior finding.

**Product decision, implemented in Phase 11:** Live Map is **RETIRED / NOT PRODUCT SCOPE**. The fleet home page no longer renders a map. `GET /fleet/live-map` and `GET /fleet/street-view` are removed. The map component, live socket hook, and live-map role helper are removed. `GpsLocation` rows are kept for vehicle history and are not dropped. Gate, vehicles, compliance, and maintenance links are unchanged. Phase 15 must not treat Live Map as unfinished work.

Phase 11 gate-out, gate-in, and vehicle lifecycle UAT is still open. Do not start Phase 12 until that pass is recorded.

### Phase 12 — Spare parts and ERP

| Page | Route | Status |
| --- | --- | --- |
| Inventory | `/inventory*` including `/inventory/stock-counts` | IMPLEMENTED — NOT VERIFIED |
| Procurement | `/procurement`, `/procurement/vendors`, matching, recommendations | IMPLEMENTED — NOT VERIFIED |
| Maintenance supply | `/maintenance-supply` | IMPLEMENTED — NOT VERIFIED |
| ERP exceptions | `/erp/exceptions` | IMPLEMENTED — NOT VERIFIED |

Bileeta remains the stock-valuation source. Vendor eligibility merge is PR #60. Nav-vs-API (RBAC-01) and unbounded parts fetch (F-07) are still open prior findings.

Phase 12 audit (recorded during Phase 07, not changed): `POST /inventory/parts/:id/stock-out` still decrements local `SparePart.quantityInStock`. Work-order part issue does not. When Phase 12 starts, decide whether that inventory endpoint must stop writing the Bileeta-owned quantity and use the same pending ERP consumption path.

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
