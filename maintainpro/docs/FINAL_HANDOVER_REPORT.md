# MaintainPro — Final Handover Report

Session scope: post-PR#39 QA, bug-fixing, and database/local-stack validation pass on branch
`maintainpro/final-handover-qa`. This document is honest about what was actually exercised and
verified in this session versus what remains — see [Section 8](#8-what-this-session-did-not-cover)
before treating anything not listed there as done.

## 1. System summary

- **Stack**: NestJS API (`apps/api`) + Next.js App Router web (`apps/web`), Prisma ORM against
  **Microsoft SQL Server** (provider `sqlserver` in `prisma/schema.prisma`; 16 migrations, 219
  tables in a fresh local DB). Note: `CLAUDE.md`'s architecture section describes an older
  MongoDB-based setup — that is stale relative to the current schema and should be updated
  separately; this session verified and worked against the actual SQL Server state.
- **Repository**: `jkchinthaka/newmone`, app lives under `maintainpro/`.
- **Baseline**: started from `main` at merge commit `46ebba02` (PR #39), which is itself
  documented in `docs/ENTERPRISE_FINAL_IMPLEMENTATION_REPORT.md`.
- **This session's branch**: `maintainpro/final-handover-qa`, commit `5aa9a653`.

## 2. Local environment used this session

| Component | Detail |
|---|---|
| SQL Server | Local native instance (`MSSQLSERVER`, default port 1433), **not** Docker (Docker Desktop was unavailable in this environment) |
| Dev database | `MaintainProDev`, app login `maintainpro_app`, pre-existing from a prior session, already seeded (12 users, 1 tenant, 219 tables) |
| API | `npm run dev:api` on `http://localhost:3000`, health/readiness endpoints confirmed |
| Web | `npm run dev:web` on `http://localhost:3001` |
| Redis | Not running locally; API degrades gracefully per documented `REDIS_REQUIRED_FOR_READINESS=false` behavior (confirmed via `/health/readiness`) |
| Backup DB replication | Not configured locally (`BACKUP_DATABASE_URL` unset) — intentional, not a defect |

## 3. Database validation performed

- `npm run db:migrate:status` found one unapplied migration (`20260918043000_work_order_status_defaults`) against the existing dev DB; ran `npm run db:migrate:deploy` — applied cleanly, zero errors. This *is* effectively the "upgrade from prior schema" gate (spec 24B), run against a real pre-existing database with real data.
- `npm run db:generate` regenerated the Prisma client successfully.
- **Fresh-database gate (spec 24A), actually run**: created a brand-new, genuinely empty
  SQL Server database (`MaintainProFreshTest`, via a sysadmin Windows-auth connection, since
  the app login itself correctly lacks `CREATE DATABASE`), then ran the exact sequence CI's
  `sqlserver-migration-gate.yml` runs: `db:migrate:deploy` against it (all 16 migrations
  applied cleanly, zero errors) → `db:seed` → `db:seed` again to check idempotency. Verified
  directly in the database (not just by log output) that the second run did not duplicate
  data: `MaintenanceJobCategory` had 33 rows / 33 distinct codes after both runs combined.
  Minor observability nit found, not a data bug: the seed script's own log line reports
  `created=33` on both the first *and* second run (it logs the batch size it processed, not
  actual inserted-vs-skipped counts) — cosmetic, left as-is. Database dropped and the app
  login's default database restored to `MaintainProDev` afterward.
- Did **not** perform a backup/restore rehearsal this session — see Section 8.

## 4. Validation gates run this session

All run from `maintainpro/` on branch `maintainpro/final-handover-qa`, after the fixes in
Section 6 were applied:

| Gate | Result |
|---|---|
| `npm run typecheck` (api + web) | **Pass** |
| `npm run test` (Jest, `@maintainpro/api`) | **Pass** — 206/207 suites (1 pre-existing skip), 1791/1801 tests (10 pre-existing skips) |
| `npm run build` (shared-types → ui-components → api → web) | **Pass** |
| `npm run lint` | Alias of typecheck — pass |

No pre-existing test was weakened or disabled to make these pass.

## 5. Live browser QA performed

Using Chrome browser automation against the local dev stack, logged in as multiple seeded
personas (`supervisor@maintainpro.local`, `manager@maintainpro.local`, both password
`MaintainPro_Local2026!`):

- **Request → Work Order journey** (flagship journey, spec section 12.A), end to end:
  create request (asset search, category, urgency, description) → submit → supervisor
  start-review → accept → convert to work order. Every step transitioned status correctly
  (`NEW → UNDER_REVIEW → APPROVED → CONVERTED_TO_WO`) and produced a real `WorkOrder` row
  (`WO-2026-0006`) linked back to the request.
- Clicking through from the request detail page into that work order **failed with a 404**
  — this is Bug #1 below, found and fixed in this session, then re-verified live.
- After the fix, opened the work order detail modal via the new `?wo=<id>` deep link as
  **SUPERVISOR**: Overview, History, Activity all loaded (previously 403). Assignment tab
  showed a clear "your role can't manage assignments" message instead of raw permission
  errors (Bug #2, fixed).
- Re-tested the same deep link as **MANAGER**: Assignment tab loaded the real employee list
  with no errors, confirming the fix doesn't regress the roles that should have access.
- Did not complete the full WO lifecycle (assign → start → complete → verify → close) with
  a live technician session this session — see Section 8.

## 6. Bugs found and fixed this session

All verified with typecheck + full test suite + build green, and (where noted) confirmed live
in the browser against the running local stack.

1. **Dead link: Request → Work Order navigation (404)**. The "WO-xxxx" link on a converted
   request's detail page, and the fraud-control admin-overrides report's "View" link, both
   pointed at `/work-orders/<id>` — a route that has **never existed** (work order detail is a
   client-side modal on the `/work-orders` list page, not a dedicated route). Added `?wo=<id>`
   deep-link support (`useWorkOrder` hook, `fetchWorkOrderById`) to the work orders list page so
   it opens the right work order on load, and repointed both links at it.
   Files: `apps/web/components/work-orders/{api,hooks,work-orders-page}.tsx`,
   `apps/web/app/(dashboard)/requests/[id]/page.tsx`,
   `apps/web/components/reports/admin-overrides-report-page.tsx`.

2. **RBAC gap: SUPERVISOR excluded from work order read endpoints it should have**.
   `GET /work-orders/:id`, `:id/history`, `:id/activity`, `:id/evidence`,
   `governance/exceptions`, and `governance/parts-exceptions` all excluded `SUPERVISOR`, even
   though supervisors already have full visibility via the list/queue endpoint and perform
   triage/verification on the very same work orders. This silently 403'd the new deep link
   above, and (independent of the deep-link bug) meant a supervisor could see a work order in
   a queue but not its own detail/history/evidence. Aligned the `@Roles(...)` on these
   endpoints with the existing list endpoint's role set; widened `:id/evidence` to also include
   `MANAGER`/`OPERATIONS_MANAGER`, which it was missing too.
   File: `apps/api/src/modules/work-orders/work-orders.controller.ts`.

3. **Broken UX: workforce assignment panel didn't respect its own permission boundaries**.
   The Assignment tab's employee picker fetched `/workforce/employees` and
   `/work-orders/:id/assignees` unconditionally, so any role without read access to those
   (e.g. `SUPERVISOR`) saw raw `"You do not have permission to access this resource."` banners
   in two places and a broken, non-functional form. Added `canViewWorkforceEmployees` /
   `canViewWorkOrderAssignees` client-side checks mirroring the backend role sets so those
   fetches are skipped and a clear explanatory message is shown instead.
   Files: `apps/web/lib/workforce-designations.ts`,
   `apps/web/components/work-orders/work-order-assignees-panel.tsx`.

4. **Security: auth forms missing `method="post"` (credential-in-URL risk)**. None of the
   login, register, accept-invite, or settings profile/password forms declared an explicit
   form `method`. HTML forms default to `method="get"`; if a submission ever falls back to
   native browser behavior (JS not yet hydrated, a thrown error before
   `preventDefault()`, etc.) the browser performs a GET and puts every field — including the
   password — into the URL, browser history, and server access logs. **This was reproduced
   live in this session**: a login attempt landed on
   `/login?email=...&password=...` in cleartext. Added explicit `method="post"` to all four
   forms as defense-in-depth (react-hook-form's `handleSubmit` already intercepts normal
   submits; this only protects the fallback path).
   Files: `apps/web/app/(auth)/{login,register/register-form-card,accept-invite,forgot-password}.tsx` (forgot-password fixed for consistency, lower severity), `apps/web/app/(dashboard)/settings/page.tsx`.

5. **Dev-environment defect: PWA service worker active under `next dev`**. The service worker
   registered unconditionally, including in local development, and silently served **stale
   cached JS chunks** across Fast Refresh reloads. This cost significant debugging time in this
   session (a fix appeared not to work, when actually the browser was still running pre-fix
   code) and will do the same to every future developer testing locally. Skip registration
   when `NODE_ENV=development`; PWA/offline behavior should be verified against a production
   build (`next build && next start`) instead.
   File: `apps/web/components/pwa/service-worker-registrar.tsx`.

## 7. Non-bugs investigated and ruled out (for the record)

- A `"Maximum update depth exceeded"` React exception observed once in the console while
  filling the "Report Issue" wizard's description textarea traced (via Next's
  `__nextjs_original-stack-frame` resolver) to a plain `onChange={(e) =>
  setDescription(e.target.value)}` — a completely standard controlled input with no effect
  loop possible. It coincided with the browser-automation tool dispatching an entire sentence
  as back-to-back synthetic keystrokes with no inter-keystroke pacing, something no real user
  can do. The request still submitted correctly afterward with the full, correct text. Not
  filed as a defect.
- A visually "ghosted"/translucent work-order modal and several full data-refetch cycles seen
  mid-session traced to **this session's own file edits** triggering Next.js Fast Refresh full
  page reloads on the open test tab while I was mid-verification — not an app bug.
- `npm run build` failing with `EPERM: ... query_engine-windows.dll.node` traced to Windows
  file-locking the Prisma engine DLL while `node --watch` (the API dev server) held it open;
  stopping the dev server before building resolved it. Not an app bug, but worth knowing for
  local Windows dev: don't run `npm run build` while `dev:api` is running against the same
  `node_modules/.prisma`.

## 8. What this session did NOT cover

Given the scope of a full 32-section audit (persona-by-persona action inventory, every route,
accessibility, responsive breakpoints, PM/inventory/fleet/safety journeys, fresh+upgrade DB
gates, backup/restore rehearsal, full database documentation set, legacy disposition audit,
CI/PR cycle) is multi-day/multi-person work, this single session focused on the highest-signal
path — the flagship Request→Work Order journey — found and fixed real, verified defects there,
and stopped short of the rest rather than fabricate coverage. Explicitly **not** done this
session:

- Full WO lifecycle (assign → start → complete → verify → close) with a live technician
  session; PM plan/occurrence/WO generation; inventory ledger/reversal/stock-count; fleet
  gate; accident/claims; safety/permit/LOTO gating; approvals/SoD; reliability RCA/CAPA;
  ERP dry-run; notifications; search — none of these were exercised live this session.
  (Their equivalent business logic **is** covered by the existing Jest integration suite,
  which passed — see Section 4 — but that is not the same as a live UI walkthrough.)
- Persona/navigation sweep beyond SUPERVISOR and MANAGER (requester/VIEWER, TECHNICIAN,
  INVENTORY_KEEPER, SECURITY_OFFICER/gate, ADMIN, SUPER_ADMIN as technical admin).
- Full backup/restore rehearsal (backup → restore to a separate DB → verify → API smoke
  test) — not performed against a real second `BACKUP_DATABASE_URL` target. Did run
  `npm run db:backup:resync -- --dry-run`, which is a *structural* self-check (reads every
  syncable model from the primary and validates it, without `BACKUP_DATABASE_URL`
  configured locally) — all 214 syncable models processed with zero real failures. The one
  row reporting `failedCount=57` is `RefreshToken`, which is correctly and intentionally
  classified `NEVER_REPLICATE` in `apps/api/src/database/replication-classification.ts`
  (session tokens must never be copied to a secondary store) — the script's own "failed"
  label for an intentional exclusion is a minor reporting-clarity nit worth a follow-up
  fix, not a defect in the replication logic itself.
- Accessibility (WCAG 2.2 AA) and responsive/mobile breakpoint testing.
- The remaining database documentation set: `docs/database/DOMAIN_OWNERSHIP.md`,
  `RELATIONSHIP_RULES.md`, `STATUS_CATALOG.md` (exists, not re-verified this session),
  `ENUM_CATALOG.md`, `INDEX_CATALOG.md`, `REPORTING_VIEWS.md`, `MIGRATION_RUNBOOK.md`.
  `DATABASE_OVERVIEW.md`, `DATA_DICTIONARY.md`, and `LEGACY_DISPOSITION.md` already exist
  from prior sessions and were not re-audited for staleness here.
- Legacy model disposition audit (FacilityIssue, MaintenanceSchedule, etc.) beyond what's
  already recorded in `docs/database/LEGACY_DISPOSITION.md`.
- A background-agent static audit for other dead-link-style bugs elsewhere in the app was
  launched but had not completed by the time this report was written; its findings, if any,
  should be triaged as a follow-up.

A background agent was in-flight when this document was written, auditing the rest of the
frontend for the same class of dead-link bug found in item 1 above (`href` pointing at a
non-existent dynamic route). See PR follow-up commits for its findings, if any were actionable.

## 9. External blockers (unchanged from prior session)

Per `docs/ENTERPRISE_FINAL_IMPLEMENTATION_REPORT.md`, still applicable:

- Live Bileeta ERP / SMTP / SMS / Entra credentials
- Power BI production row-level security
- Human UAT / business cutover approval
- Vercel / Cloudflare Workers preview deploy credentials

## 10. Verdict

**HANDOVER READY — EXTERNAL PRODUCTION GATES PENDING**, for the specific slice of the system
this session touched (Request→WO journey and the five fixes in Section 6), layered on top of
the prior session's PR #39 baseline. This is **not** a claim that the full 32-section
handover checklist is complete — Section 8 lists what still needs a follow-up pass before
that claim could honestly be made.

## 11. Local reference (for whoever continues this)

```
# from maintainpro/
npm run dev:api      # http://localhost:3000  (health: /health, /health/readiness)
npm run dev:web      # http://localhost:3001
```

Seeded personas (password `MaintainPro_Local2026!` for all):
`superadmin@maintainpro.local`, `admin@maintainpro.local`, `manager@maintainpro.local`,
`supervisor@maintainpro.local`, `tech@maintainpro.local`, `mechanic@maintainpro.local`,
`inventory@maintainpro.local`, `security@maintainpro.local`, `driver1/2/3@maintainpro.local`,
`cleaner@maintainpro.local`. No seeded `VIEWER`/requester-only or dedicated technical-admin
persona exists — `SUPER_ADMIN` covers technical administration today.

**Dev gotcha**: don't run `npm run build` while `npm run dev:api` is running — both touch
`node_modules/.prisma` and Windows will lock the query engine DLL (`EPERM` on rename). Stop
the dev server first.
