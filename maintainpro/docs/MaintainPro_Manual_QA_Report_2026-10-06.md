# MaintainPro — Manual QA Report (continuation) — 2026-10-06

> **Rebuilt continuation.** The original interim file was not available to this session
> (not in the repo, PC not linked). Per the owner's instruction it was rebuilt from the
> findings supplied in chat. Numbering **QA-MANUAL-001 … 021 is preserved**; new findings
> start at **QA-MANUAL-022**. QA was **not** restarted from zero: the 37 routes already
> covered in the interim pass are not re-run except for regression.

| Item | Value |
| --- | --- |
| Canonical base | `main` @ `05db2bb0` |
| Fix branch | `fix/manual-qa-blockers` (commits listed in §11) — **not merged to main** |
| App under test | `http://localhost:3001` (owner's PC, `npm run dev`, DB `MaintainProDev`) |
| Tester | Claude (browser via Claude in Chrome; code/tests in a cloud clone of `main`) |
| Session status | **Pass 1 complete (blockers + regressions fixed in code). Pass 2 (live re-test + remaining modules) waiting for the owner to pull the branch and sign in.** |
| Verdict (current) | **FAIL — BLOCKING DEFECTS** (see §12). Not a production-readiness statement. |

---

## 1. Original defects and status

Status legend: **Fixed (code)** = fixed on `fix/manual-qa-blockers` with automated regression
tests, live browser re-test pending pull · **Not reproduced** · **Still failing** · **Open**.

| ID | Title | Severity | Status |
| --- | --- | --- | --- |
| QA-MANUAL-001 | Session refresh 409 causes false logout | Critical | **Fixed (code)** — root cause confirmed live, see §1.1 |
| QA-MANUAL-002 | Work Order create (Machinery) freezes after empty submit → More options | Critical | **Not reproduced** — see §1.2. Related UX defect logged as QA-MANUAL-022 |
| QA-MANUAL-003 … 021 | Interim findings. Exact ID ↔ title mapping was in the original file, which this session could not read. The regressions the owner listed are tracked below as R1–R8; please map each to its original ID when the original file is available. | — | see R1–R8 |

| Ref | Interim regression (original ID within 003–021) | Status |
| --- | --- | --- |
| R1 | Reports show raw enum values (`IN_PROGRESS`, `OUT_OF_STOCK`, `TECHNICIAN_COMPLETED`) | **Fixed (code)** — centralized `formatDisplayValue` / `toEnumOptions` in `lib/display-labels.ts`; applied to report filter options (status, category), table cells, chart axes/pie slices, exception rows/cards. Option values stay raw. |
| R2 | Management Intelligence shows `DOWNTIME HOURS LKR 0`, `REPEATED BREAKDOWNS LKR 1` | **Fixed (code)** — API cards carry `unit` (currency/hours/count/text); web formats by unit with a key-based fallback that never defaults to currency. Also fixed: High-cost assets/vehicles counts were shown as LKR; Top cost department amount was a bare number. |
| R3 | Report card deep links (PM Compliance, Downtime, Repeat Failures) don't open intended content | **Fixed (code)** — confirmed live: `/reports/assets?search=downtime` filtered the report to **0 assets, 0 vehicles**. Now `?focus=pm-compliance` (new PM Compliance card on Performance KPIs), `?focus=downtime` (highlights Downtime card, table sorted by downtime desc), `/reports/maintenance-exceptions?type=repeated-breakdowns` (opens that detail). URL is the source of truth → back/forward restore the view. |
| R4 | Evidence status shows `Complete` with no evidence | **Fixed (code)** — root cause: non-production storage waiver set `complete=true`, and the list mapped that to "Complete". One display status now (`Not required` / `Rejected` / `Complete` / `Missing` / `Waived (no storage)`) shared by list, detail, reports and exceptions. "Complete" only when before **and** after photos exist. Waived jobs do not block the Waiting-Evidence queue but reports count them as evidence absent. |
| R5 | Active PM plan with `No asset assigned` silently valid | **Fixed (code)** — such plans are returned with `dueState=INVALID` + `validityIssues=[NO_ASSET_ASSIGNED]`, shown in red with remediation text, counted in Needs Attention (+ `summary.invalid`), excluded from auto-WO (`PLAN_INVALID_NO_ASSET_ASSIGNED`), and cannot be saved as ACTIVE without an asset/vehicle. Pause remains allowed as a remediation path. No data was rewritten. |
| R6 | Active calendar PM shows no next due date | **Fixed (code)** — confirmed live (`QARTPOK165b43`, asset AST-9001, every 30 days → Next due "—", Needs Attention). Next due is now projected from last completion, else schedule start (`effectiveFrom`/`createdAt`), labelled "Calculated from schedule". See also QA-MANUAL-025. |
| R7 | System Health: disabled service shows `Operational` | **Fixed (code)** — confirmed live: Backup Replication badge "Operational" while Mode = Disabled. API now reports `disabled` (configured) / `unconfigured`; web guard `resolveDisplayCheckStatus` never shows Operational for a disabled service. |
| R8 | API accepts whitespace-only required strings (property name `" "`, profile first name `" "` stored as `""`) | **Fixed (code)** — reusable layer `common/validation/not-blank.ts`: global `NotBlankStringsPipe` (required strings, `@IsNotEmpty`, `@MinLength(>=1)`, nested DTOs/arrays) + `@IsNotBlank()` for PATCH fields. `PATCH /settings/profile` had **no DTO at all** (untyped body) — now `UpdateProfileSettingsDto`. Audit result → QA-MANUAL-024. |

### 1.1 QA-MANUAL-001 — root cause (reproduced live, deterministic)

Reproduced in the browser on `/maintenance/jobs` with network capture: two sequential
`POST /api/backend/auth/refresh` calls within the same second:

| # | Status | Body |
| --- | --- | --- |
| 1 | 201 | Token refreshed |
| 2 | **409** | `CONFLICT — A record with this dbo.RefreshToken already exists.` |
| 3 | 401 | `REFRESH_TOKEN_REUSED` (family revoked) |
| `GET /auth/me`, `GET /work-orders` afterwards | 200 | access cookie still valid |

Cause: the refresh JWT payload was `{sub, tenantId}` with second-granular `iat/exp`, so two
rotations in the same second signed **byte-identical** tokens → identical `tokenHash` →
unique index violation (P2002 → 409). The old token had already been claimed, leaving no
successor, so the next refresh was treated as reuse and revoked the family — the session
dies ~15 min later even though other calls still return 200. The web interceptor then treated
any refresh failure as expiry and redirected to `/login`, losing unsaved forms. The observed
production sequence (`/auth/me` 200 → `/auth/me` 401 → refresh 409 → login) is the BFF silent
refresh rotating A→B and a stale-cookie request then rotating B→C in the same second.

Fix: unique `jti` per refresh token; claim is released if the successor cannot be stored;
web single-flight refresh coordinator (one owner of rotation; requests sent before a
just-completed rotation reuse it); 409/429/CSRF/5xx/network = transient (retry once, never
redirect); redirect only when refresh is invalid **and** an independent `/auth/me` probe is
401; `TenantSessionProvider` no longer expires on transient 401s.
Tests: `auth-refresh-same-second.spec.ts` (fails on `main`, passes on branch),
`session-refresh-policy.test.ts`.

> Side effect of the reproduction: the admin browser session used for QA was revoked by the
> reuse detection (exactly the defect). Re-sign-in is required before Pass 2.

### 1.2 QA-MANUAL-002 — not reproduced

Route `/maintenance/jobs` → Create Work Order → Machinery → submit empty → More options,
with an in-page monitor (long-task observer, 100 ms heartbeat, console.error and fetch hooks,
DOM mutation counter):

| Step | Long tasks | Heartbeat | Console errors | Requests |
| --- | --- | --- | --- | --- |
| Empty submit | 0 | 13 / 1.27 s (normal) | 0 | 0 |
| More options (after Esc) | 0 | 20 / 2.08 s | 0 | 0 |
| Re-submit with More options open, then click More options position | 0 | 107 / 10.7 s | 0 | 0 |

No render loop, request loop, validation loop or blocking computation. The modal stayed
responsive and scrollable. Most likely the original freeze was the browser-automation
extension. **Status: NOT REPRODUCED.** A real UX defect was found on the same path → QA-MANUAL-022.

---

## 2. New defects (from QA-MANUAL-022)

| ID | Area | Severity | Finding | Status |
| --- | --- | --- | --- | --- |
| QA-MANUAL-022 | WO create modal | Medium | After an empty submit, native validation focuses the Machine/Asset combobox and **auto-opens its list over the form**. The list covers "More options"; a click aimed at More options **silently selected "Sample Asset 3" (AST-1003)**. Wrong asset can be attached without the user noticing. | Open (not in this branch's scope) |
| QA-MANUAL-023 | Maintenance Exceptions | Medium | Exception row "Open" linked to `/work-orders?open=<id>`; the WO page only reads `?wo=` → the job never opened. | **Fixed (code)** |
| QA-MANUAL-024 | API validation | High | Static audit: **210 `@Body()` parameters across 36 controllers** are typed `Partial<…>`, `Record<…>`, `any` or inline object types, so `ValidationPipe` (whitelist, forbidNonWhitelisted) and the new not-blank rule do not run on them. Example fixed: `PATCH /settings/profile`. | Open (partially fixed) |
| QA-MANUAL-025 | PM trigger engine | High | A calendar plan that was never completed computed due = `now + interval` on every evaluation, so it **could never become due** and auto-WO never fired. | **Fixed (code)** (`scheduleStartAt` baseline) |
| QA-MANUAL-026 | PM plan revise API | Medium (security/data) | `revisePmPlan` spreads the request body into `prisma.pmPlan.update` (mass assignment of any column, e.g. `nextDueAt`, `lastCompletionAt`, `autoCreateWorkOrder`). Only the asset rule was added here. | Open |
| QA-MANUAL-027 | PM "Evaluate due" | Low | Toast showed raw codes (`NOT_DUE`, `DUPLICATE_OPEN_WO`). | **Fixed (code)** (business messages) |
| QA-MANUAL-028 | Fraud Control → Exceptions links | Low | Fraud-control items link to `/reports/maintenance-exceptions` without `?type=`, so the user lands on the summary, not the item. | Open |
| QA-MANUAL-029 | Auth throttle | Low | `POST /auth/refresh` is throttled to 5/min per IP; bursts now degrade to "transient" (no logout) but still fail the request. Review limit vs. multi-tab use. | Open |

---

## 3. Remaining blocked areas

Blocked on: **owner pulls `fix/manual-qa-blockers`, restarts dev, and signs in.** The QA
session was revoked during the 001 reproduction and this session has no seed password
(`MAINTAINPRO_SEED_PASSWORD` lives only in the PC's `.env`).

1. Work Order create/edit/date/cost/status/evidence
2. Assets
3. Preventive Maintenance (live re-test of R5/R6/025)
4. Inspections
5. Fleet details
6. Stock counts
7. Suppliers
8. Admin users
9. Roles
10. Invitations
11. Accessibility
12. Responsive widths
13. Login/logout negative tests
14. Cross-role RBAC (needs each seeded role signed in)
15. Maintenance sections: Dashboard, Requests, Work Orders, Machinery/Service/Vehicle Jobs,
    Planning & Scheduling, PM, Inspections, Reliability, My Jobs, Vendors/External Repairs,
    Costs, Maintenance History, Approvals, Reports & Analytics — every button/action

## 4. Routes tested this session

| Route | Result |
| --- | --- |
| `/maintenance/jobs` (Create WO → Machinery → empty submit → More options) | No freeze; QA-MANUAL-022 |
| `/reports` | R1 confirmed (raw status/category options) |
| `/reports/assets?search=downtime` | R3 confirmed (0 rows) |
| `/reports/management-intelligence` | R2 confirmed |
| `/system-health` | R7 confirmed |
| `/maintenance/plans` | R5, R6 confirmed |

## 5. Workflows tested

Session refresh rotation (live), WO create modal validation path (live), report deep links
(live + unit), PM list/evaluate/revise (unit), evidence status (unit), whitespace validation (unit).

## 6. QA records created

None. No work orders, plans, users or assets were created or modified. The modal was cancelled.
Only refresh-token rows were written (by the 001 reproduction).

## 7. RBAC results

Not run this session (blocked, §3). Code note: report deep-link targets keep their existing
access matrix (`assertCanViewReportModule`); no permission was granted or widened.

## 8. Data-integrity results

- Evidence: list said "Complete" for jobs with zero photos (R4) — fixed semantics.
- PM: legacy ACTIVE plan `PM-2026-5807` has no asset → now flagged INVALID (not rewritten).
- Validation: whitespace-only required strings rejected at the API (R8); 210 untyped bodies remain (024).
- Refresh tokens: family revocation after a 409 collision (001) — fixed.

## 9. Console / network findings

- `POST /auth/refresh` 409 `dbo.RefreshToken already exists` → 401 `REFRESH_TOKEN_REUSED` (001).
- WO modal: 0 console errors, 0 requests, 0 long tasks during the 002 path.
- After session revocation: `GET /planning/pm-plans` 401 `AUTHENTICATION_REQUIRED` (expected consequence of 001 on `main`).

## 10. Accessibility / responsive results

Not run (blocked, §3). Changes made: focused report card gets `aria-current`; invalid PM
plan note uses `role="status"`.

## 11. Fix branch, tests and gates

Branch `fix/manual-qa-blockers` from `main@05db2bb0`:

| Commit | Content |
| --- | --- |
| `e4759c56` | QA-MANUAL-001 |
| `86300990` | R1–R8, QA-MANUAL-023/025/027 |
| (this doc) | report + handover |

| Gate (cloud clone, Linux) | Result |
| --- | --- |
| API typecheck / web typecheck / lint (alias) | PASS |
| Web tests (`tsx --test`) | PASS — 151/151 (was 128) |
| API Jest (full) | 227 suites passed, 3 skipped; **1 suite cannot run here**: `phase3-workflow.http-e2e` (and `phase4-compliance.http-e2e` when ordered first) need the real Prisma query engine — download from `binaries.prisma.sh` is blocked in this sandbox. **Re-run on the PC.** Tests: 1962 passed, 22 skipped, 1 env failure |
| Production build (`npm run build`, `NEXT_PUBLIC_API_URL` set) | PASS |
| Playwright | Not run (needs the running stack + sign-in) |
| Manual critical-path regression | Pending pull (§3) |

New/updated tests: `auth-refresh-same-second.spec.ts`, `not-blank-validation.spec.ts`,
`pm-plan-validity-next-due.spec.ts`, `evidence-display-status.spec.ts`,
`management-intelligence.spec.ts` (+units), `reporting-kpis-phase13.spec.ts` (hrefs),
`planning-phase08.spec.ts` (fixture now has an asset), web: `session-refresh-policy`,
`display-labels-enums`, `report-deep-links`, `management-intelligence-units`,
`system-health-status`, `role-home`.

## 12. Verdict

**FAIL — BLOCKING DEFECTS**

Reason: the blockers are fixed in code with regression tests, but none of the fixes has been
re-tested live yet, 14 areas plus cross-role RBAC remain untested, and QA-MANUAL-024 (210
unvalidated request bodies) is an open High. This is not a production-readiness statement.

## 13. Next action

1. Owner: pull the branch, restart `npm run dev`, sign in as admin, confirm.
2. Claude: live re-test of 001, 002, R1–R8, 023, 025; then the blocked areas in §3 in order;
   continue IDs from QA-MANUAL-030.
