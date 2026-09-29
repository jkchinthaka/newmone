# MaintainPro — Product Finalization Ledger

Persistent record for the page-by-page finalization programme. **Read `AI_SESSION_HANDOVER.md`
first** (live state, blockers, exact next action), then this file, together with `git log origin/main`, `docs/BRANCH_CONSOLIDATION_2026-09-29.md`
and `docs/audit/FULL_SYSTEM_CONSISTENCY_AUDIT.md`.

Rules of the programme: one page / vertical slice per iteration; database → API → RBAC →
workflow → UI → tests → main. Never mark a page complete on visuals alone.

Authoritative facts (verified 2026-09-29 against code, not older docs):

- Primary database: **SQL Server** (`prisma/schema.prisma` `provider = "sqlserver"`), 25 migrations.
  Mongo / Flutter docs are historical. Supported client: Next.js web / PWA.
- `PermissionsGuard` resolves permissions from the **DB** (JWTs carry none). Any service-level
  permission decision must also load DB permissions (pattern: `withCurrentPermissions`, see
  `reports.service.ts` and `maintenance-requests.service.ts`) and use `hasCompatiblePermission`
  from `permissions.guard.ts` so legacy aliases behave the same in both layers.
- Nav items whose API needs a permission must declare `requiredPermissions` (the permission plus
  its guard aliases). Sessions always carry DB permissions (login and `/auth/me`).

---

## 1. Route inventory and classification (discovery, 2026-09-29)

194 `page.tsx` routes. Classification from code inspection, nav membership and prior audits.
"Needs validation" means: implemented and plausibly working, but not yet finalized under this
programme's gates.

| Area | Routes | Status | Notes |
| --- | --- | --- | --- |
| Home | `/action-center` (+ `/workspace`, `/dashboard`, `/home` redirects/legacy) | NEEDS VALIDATION | Canonical Home. `/dashboard`, `/workspace` redirect. |
| Maintenance dashboard | `/maintenance` | NEEDS VALIDATION / DUPLICATED | Overlaps Action Center; consolidation decision pending. |
| **Requests** | `/requests`, `/requests/[id]` | **VERIFIED — see §3.1** | Iteration 1. |
| Requests — create | `/requests/new`, `/qr/report-issue` (redirect) | NEEDS VALIDATION | Next candidate; roles without `maintenance_requests.create` can still reach it by URL. |
| Work Orders | `/maintenance/jobs` (+ `/machinery`, `/service`, `/vehicle` lanes), `/work-orders`, `/work-orders/my` | NEEDS VALIDATION / DUPLICATED | Same engine; two entry points (`/work-orders` vs `/maintenance/jobs`, titles "Work Orders" vs "All Jobs"). Queue predicates unified in `028ba871`; WO-02 (illegal kanban jumps) fixed via `isAllowedKanbanDrop`. |
| Planning / PM | `/maintenance/planning` (redirect), `/maintenance/plans`, `/maintenance/forecast`, `/maintenance/job-codes` | PARTIALLY IMPLEMENTED | Audit F-03 (soft PM occurrence uniqueness), F-05 (PM status machine) open. |
| Inspections / Reliability | `/maintenance/inspections*`, `/maintenance/reliability*` | NEEDS VALIDATION | Landed in `80d7f0d2`. |
| Costs / History | `/maintenance/costs`, `/maintenance/history`, `/reports/job-costing` | NEEDS VALIDATION | Costs rollup landed in PR #61. |
| Assets & Locations | `/assets`, `/assets/health`, `/admin/organization` (Facilities nav) | PARTIALLY IMPLEMENTED | Audit NAV-04 / RBAC-02: Facilities nav points to admin-only page. |
| Fleet | `/fleet`, `/fleet/gate`, `/vehicles*`, `/compliance`, `/accidents`, `/insurance-claims`, `/traffic-fines` | NEEDS VALIDATION | RBAC-03 live-map mismatch open. Gate override attestation ported (`1fc5d37f`). |
| Spare Parts | `/inventory*`, `/procurement*`, `/maintenance-supply` | PARTIALLY IMPLEMENTED | RBAC-01 nav vs API, F-07 unbounded parts fetch open. Bileeta ERP owns stock. |
| Approvals | `/approvals`, `/approvals/[id]`, `/admin/approvals` | NEEDS VALIDATION | |
| Reports | `/reports*` | NEEDS VALIDATION | DB-authoritative export gates (`b2b11cdc`). |
| Business Admin | `/admin`, `/admin/*` (27 pages), `/master-data*` | NEEDS VALIDATION | Config-consumption (e.g. job categories → WO selector) not yet verified per field. |
| Technical Admin | `/system-health`, `/erp*`, `/admin/integrations` (redirect) | NEEDS VALIDATION | ERP F-08 sandbox→mock open. |
| Account | `/notifications`, `/settings` | NEEDS VALIDATION | |
| Legacy FMS | `/machinery*`, `/service*`, `/vehicle*`, `/pending-requests`, `/home` | LEGACY | Kept for deep links. |
| Retired from product surface | `/farm/*`, `/cleaning/*`, `/fg/*`, `/billing`, `/predictive-ai`, `/qa/*`, `/delivery-readiness/*`, `/go-live/*`, `/post-go-live/*`, `/releases`, `/support/*`, `/operations/*`, `/change-requests` | OUT OF SCOPE | Per `ROUTE_AND_MODULE_DISPOSITION.md`; server RBAC still applies. |
| Vendor portal | `/vendor-portal` | NEEDS VALIDATION | |
| Auth | `/login`, `/register`, `/forgot-password`, `/accept-invite`, `/splash` | NEEDS VALIDATION | Return-path hardening `faba0ab7`. |

## 2. Prioritized backlog

1. ~~Requests list + detail~~ (iteration 1).
2. **Report issue** `/requests/new` — gate by `maintenance_requests.create`; business decision on
   whether TECHNICIAN / MECHANIC / DRIVER should report (they are in the API role list but hold no
   request permission in the seed).
3. **Work Orders** — consolidate `/work-orders` vs `/maintenance/jobs` entry points and titles;
   validate queue/list/kanban/my-jobs count agreement end to end.
4. **Preventive Maintenance** — PM occurrence → WO uniqueness (F-03) and plan status machine (F-05).
5. **Spare Parts** — nav vs API (RBAC-01), paginate parts catalogue (F-07).
6. **Assets & Locations** — Facilities entry point (NAV-04 / RBAC-02).
7. Home vs Maintenance Dashboard consolidation.
8. Fleet live map (RBAC-03), ERP sandbox mode (F-08).

---

## 3. Completed pages

### 3.1 Maintenance Requests — list and detail

| Field | Value |
| --- | --- |
| Routes | `/requests`, `/requests/[id]` |
| Baseline | `origin/main` @ `6264948f` |
| Branch | `maintainpro/finalization-iter-01` |
| Commits on main | `89533ac0` (whole slice; commit message wrongly says "test(vendors)…"), docs `7878eb56`, `52311b8f` |
| Merged to main | **Yes, by direct push** (2026-09-29T10:09Z, no PR; see handover "How iteration 01 reached main") |
| CI on main | PR Validation red (pre-existing Jest OOM since `d7456ab0`; fix in PR #62); Vercel / Cloudflare red since ≥ 2026-09-18 (config, unconfirmed) |
| Date | 2026-09-29 |
| Status | **PARTIALLY VERIFIED**: local gates pass; CI green pending PR #62; browser UAT pending user sign-in. Not VERIFIED COMPLETE. |

**API endpoints** (`maintenance-requests.controller.ts`): `GET /maintenance-requests`
(+ new `stage`), `GET /summary` (+ `mine`, returns `scope` and `capabilities`), `GET /:id`,
`POST /:id/{start-review,triage,approve,needs-information,respond,resume-review,reject,cancel,mark-duplicate,convert-to-work-order}`,
`GET /:id/duplicate-candidates`.

**Data dictionary** (`MaintenanceRequest`, table `MaintenanceRequest`, no schema change):
`status` NVARCHAR(64) (NEW → UNDER_REVIEW ⇄ NEEDS_INFORMATION → APPROVED → CONVERTED_TO_WO;
CLOSED / CANCELLED terminal; REJECTED legacy), `priority` (WO `Priority` values),
`reportedById` → User, target `assetId` / `vehicleId` / `functionalLocationId` (+ `siteId`,
`targetUnresolved`, `approximateLocation`), `workOrderId` (filtered unique, 1:1 WO),
`version` INT (optimistic concurrency — now used by every status write), timestamps
`reportedAt` / `reviewedAt` / `approvedAt` / `cancelledAt` / `convertedAt`, history in
`MaintenanceRequestHistory`, audit in `AuditLog` via `writeAuditTrail`.

**Permissions**: list/summary `maintenance_requests.view_own`; create/respond `…create`;
triage actions `…triage`; accept `…approve`; close `…reject`; convert `…convert`; cancel
`…cancel_own` (+ `…cancel_any` to cancel after review starts). Legacy `facility_issues.*` aliases
accepted in guard **and** service. SUPER_ADMIN / ADMIN bypass.

**Defects found and fixed**

| # | Defect | Fix |
| --- | --- | --- |
| R1 | Service permission checks read `req.user.permissions`, which is always empty (JWT has none), so decisions fell back to hard-coded role names: custom roles granted triage got 403, and revoking a permission had no effect for MANAGER etc. | Service loads DB permissions (`withCurrentPermissions`) and checks aliases with the guard's `hasCompatiblePermission`. |
| R2 | Status writes were read-validate-`update({where:{id}})`: concurrent actions overwrote each other (e.g. cancel landing after convert → CANCELLED request linked to a live WO). | `guardedUpdate` — `updateMany` on `id + tenantId + status + version`, 409 on conflict. Verified live: concurrent accept vs cancel → one 201, one 409, one history row. |
| R3 (audit REQ-01) | List offered requester "Cancel" in Under Review / Needs Information; API allows owner cancel only in New → guaranteed 403. | Server returns `allowedActions` per request (single rule source `requestAllowedActions`); UI renders only allowed actions and shows the reason when blocked. |
| R4 | "Not sure" requests could never be accepted: UI demanded a confirmed target but triage had no target picker. | Triage panel adds Machine / Vehicle / Location pickers (existing `EntityPicker` contracts). |
| R5 | `requestInformation`, `reject`, `markDuplicate` lacked the segregation-of-duties check the UI promised. | `assertNotSelfGoverned` added. |
| R6 | Nav showed Requests to ~40 roles; the API admits 11, and seeded TECHNICIAN / MECHANIC / DRIVER hold no request permission → 403 page. | Nav roles mirror API `READ_ROLES` and require the list permission (+ aliases). |
| R7 | Counters were not linked to the list and could not be reproduced by any filter; summary ignored "My requests". | Shared `stage` predicates (`requestStageFilter`) for counters and list; counters are buttons; summary follows the view scope. Verified live per stage. |
| R8 | "Reported from" filtered `createdAt` while the list shows / sorts `reportedAt`. | Filter uses `reportedAt`. |
| R9 | Native `window.prompt` dialogs; menus not closable by Escape / outside click. | `usePromptDialog` with validation; menu Escape / outside-click handling, ARIA menu roles. |
| R10 | Raw codes in UI (`START_REVIEW`, `UNDER_REVIEW →`, `VERY URGENT`, `HIGH`); status label "Approved" vs button "Accept". | `maintenance-request-ui.ts` label maps; server status label is now "Accepted". |
| R11 | Duplicate closure required typing a raw database id. | Pick the canonical request from the duplicate candidates. |
| R12 | Detail error state had no retry; page had no "what happens next". | Retry + back link; next-step banner from server actions. |

REQ-04 (concurrent convert) was already fixed on main (transactional claim + `mr-convert:<id>`
idempotency key) and has a test.

**Also fixed (pre-existing red tests on main, test-only):** `vendor-repair-controls.spec.ts` and
`maintenance-supply-phase09.spec.ts` lacked the `vendorContract` mock required since the
vendor-eligibility merge (#60); the blacklist test now asserts the eligibility engine's
`VENDOR_NOT_ASSIGNABLE` code. Reproduced failing on a clean `origin/main` worktree first.

**Validation evidence (2026-09-29, local)**

| Gate | Result |
| --- | --- |
| `npm run typecheck` / `npm run lint` | pass |
| `npm run test` (API jest) | 221 suites pass, 1 skipped; 1933 tests pass, 10 skipped, 0 failed |
| New `test/maintenance-requests-actions.spec.ts` | 16 / 16 |
| `test/maintenance-requests.spec.ts`, `request-lifecycle`, `permissions.guard`, `navigation` | pass |
| Web `npm test` (tsx) incl. new `maintenance-request-ui.test.ts` | 106 / 106 |
| Full build (CI env) | pass |
| Cold-cache API jest (CI-equivalent, 4 GB) | 221 suites / 1933 tests pass |
| GitHub PR Validation | red on `52311b8f` (OOM, pre-existing); re-run pending on PR #62 |
| Browser visual / responsive check | not run (needs user sign-in) |
| `npm run audit:rbac` | 951 routes, 0 violations |
| `npm run audit:tenant` | 0 unapproved |
| `npm run db:migrate:status` | 25 migrations, up to date (no migration in this slice) |
| Full-stack API smoke vs local dev stack (`MaintainProDev`) | 15 / 15: technician 403, per-stage counter = list total, My-view scope, owner/SoD `allowedActions`, real concurrent accept-vs-cancel race |

**Remaining / follow-ups**

- Business decision: grant `maintenance_requests.create` / `view_own` to TECHNICIAN, MECHANIC,
  DRIVER if they should report issues (not granted here — no permission widening for UX).
- `/requests/new` still reachable by URL for roles that cannot create (next iteration).
- `REJECTED` status is legacy and unreachable; left in the enum for historical rows.
- ASSET_MANAGER: previously could open request details through a hard-coded role fallback despite
  holding no request permission (the list already returned 403). Now consistent: no access unless
  granted.
