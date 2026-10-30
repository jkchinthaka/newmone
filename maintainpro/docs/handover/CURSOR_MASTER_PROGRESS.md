# Cursor master progress

Worktree: `C:\Users\chint\AppData\Local\MaintainPro\worktrees\release-final-20261013`
Branch: `fix/enterprise-remediation-20261015`
HEAD: `a79859dc`
No commit, push, or merge.

## Phase 1 — Preflight and baseline

Status: DONE. Stopped for owner review of the baseline numbers.

Evidence (2026-10-16):

- Porcelain paths: 189. Tracked diff shortstat: 118 files changed, 3786 insertions, 1422 deletions. Untracked paths are in the porcelain list and are not in that shortstat.
- Baseline files: `docs/handover/baseline-cursor-20261016-105726.status.txt`, `.diffstat.txt`, `.sha256.txt` (189 hashes, including deleted markers).
- Canonical identity: web `release-final-20261013`, branch and SHA match, API target `http://127.0.0.1:3040/api`. API health HTTP 200. Ports 3000 and 3001 were not stopped.
- `npm run lint` (API and web `tsc --noEmit`): exit 0.
- Web unit: 316 passed, 0 failed.
- Full API Jest with `DATABASE_URL` and `DISPOSABLE_SQLSERVER_URL` pointed at `maintainpro_e2e_wo_verify`: 256 suites passed, 1 skipped, 2147 passed, 10 skipped, 0 failed, exit 0. The silent run did not print the skipped suite name. Earlier runs on this branch skipped `inventory-disposable-mongo` because `DISPOSABLE_MONGO_URL` is unset.

Next: owner OK, then Phase 2 vendor-invoice tax as a percentage. The owner named 18 on 2026-10-16.

## Phase 2 — Vendor repair tax percentage

Status: DONE.

- Tenant setting name: `Default tax rate %`. Seeded at 18 for existing tenants by migration `20261016120000_vendor_tax_rate_percent` on `maintainpro_e2e_wo_verify` only (227 settings, min 18, max 18). Editable at Admin → Maintenance config. Application code reads the stored value and does not substitute 18.
- Vendor invoices and quotations store `taxRatePercent`. The server computes tax and total. A client tax amount is ignored when a rate is sent. Legacy rows with only `taxAmount` keep those stored amounts; the display rate is derived.
- Quotation approval and the invoice-versus-quotation check use the computed total.
- Tax % is shown next to the tax amount on the vendor invoice and quotation list, including finance approve/reject. The maintenance cost report still uses the stored invoice total and has no separate tax column.
- Prisma Client was not regenerated. New columns are written and read with SQL so the running API process can keep its query engine.
- The same deploy also applied the already pending `20261016093000_meter_reading_timestamp_unique` on this disposable database.
- Tests: `vendor-tax.spec.ts` and `vendor-repair-controls.spec.ts` 14 passed. Web `vendor-tax.test.ts` passed.
- An earlier full run that omitted `DISPOSABLE_SQLSERVER_URL` was 249 suites passed, 5 skipped, 4 failed. It is not the green total. The four red suites were re-run alone with both database URLs set to `maintainpro_e2e_wo_verify`, `--runInBand`, exit 0, about 37s:
  - `users-tenant-isolation.spec.ts`: 2 passed. The create case that had exceeded 5s under load finished in 230ms.
  - `people-onboarding.spec.ts`: 14 passed. The accept-invite case finished in 244ms.
  - `work-order-domain-d3-d5-lifecycle.integration.spec.ts`: 13 passed. The machinery lifecycle finished in 723ms, including the beforeEach that had exceeded 5s.
  - `phase3-workflow.http-e2e.spec.ts`: 16 passed. The 403 case finished in 10ms.
- Classification: not caused by the tax-rate change. The 5s failures were worker and database starvation in the large parallel run. The work itself is not over 5s, so no test timeout was raised and no assertion was weakened.
- `phase3-workflow` assertion, test "returns 403 when creating a part request without permission": expected HTTP 403 and `createPartRequest` not called when the header is `unrelated.permission`. Under load the mock already had 1 call from the previous test (`partId: part-1`, `quantity: 2`, `reason: needed`, permissions `["part_requests.create"]`). Root cause: leftover mock history while the suite was saturated, not a permission change. In isolation that call count is 0.
- Full API Jest, both URLs set to `maintainpro_e2e_wo_verify`. The only skip is `inventory-disposable-mongo.spec.ts`.
  - Run 1: 257 suites passed, 1 skipped, 2154 tests passed, 10 skipped, 0 failed, 137542 ms, exit 0.
  - Run 2: 257 suites passed, 1 skipped, 2154 tests passed, 10 skipped, 0 failed, 197944 ms, exit 0.

## Phase 3 — Date and time pickers

- done: shared schedule helper; expected completion on or before due date; grey disabled days; blur normalises to dd MMM yyyy; visibleFieldMessage hides untouched errors.
- done: native date/time/datetime-local inputs replaced with DateField/TimeField/DateTimeField. Farm configs still say type date and render through farm-list-page. Management intelligence FilterField renders DateField. Payloads stay yyyy-mm-dd, HH:mm, or ISO.
- done: regression tests date-field-payload.test.ts (date, time, datetime) and form-feedback.test.ts.

## Phase 3B — Admin defects

- done: ADM-001 tenant ADMIN status route with own-account, SUPER_ADMIN, last-admin, and cross-tenant 404 guards; audit already written.
- done: ADM-002 update/remove 403 on SUPER_ADMIN targets.
- done: ADM-003 transactional delete, current-tenant membership only, 409 Deactivate instead, open statuses plus assignees.
- done: ADM-004 role-change audit.
- done: ADM-005 feature flag reason min 5, no generated reason.
- done: ADM-007 /admin/users?user=<id>.
- done: ADM-009 POST /users/invite no longer creates an active user.
- done: Security page System Health is SUPER_ADMIN only for other roles.
- done: admin-user-guards.spec.ts and work-order-validation.spec.ts passed in isolation (53 tests with the three load-flake suites).

## Block A gates

- web unit: 324 passed, 0 failed.
- typecheck and lint: exit 0 (lint is typecheck).
- full API Jest blockA4 runInBand: 258 passed, 1 skipped (inventory-disposable-mongo.spec.ts), 2161 passed, 10 skipped, 0 failed, exit 0.

## Phase 4 — Evidence

- done: journey asserts the completion gate "After photo is required before completion." when a before photo exists and storage is on.
- backlog: HTTP 413/415, cross-tenant 404, closed-work upload, duplicate clientGeneratedId.

## Phase 5 — Flow

- done: `apps/api/test/e2e-journeys/maintenance-flow.integration.spec.ts` on the disposable DB. Plan, assign, start, hold, resume, verify SoD, close, cancel with reason, emergency close with audit. 2 tests passed.
- backlog: part issue stock, vendor invoice row, PM auto WO HTTP, inspection, meter reading inside the same journey.

## Phase 6 — Reports

- done: `docs/handover/REPORTS_VERIFICATION.md`. Tax line matched.
- done: dashboard card counts compared with SQL `COUNT(*)` on `maintainpro_e2e_wo_verify` (tenant with the most work orders). Open work orders 5/5, machinery 3/3, service 1/1, vehicle 1/1, critical 0/0, overdue 0/0, open requests 1/1, pending approval requests 0/0, vendor invoices in review 0/0. Export files were not generated.

## Phase 7 — RBAC

- done: `docs/handover/RBAC_MATRIX.md` from decorators. 8 mismatches: SECURITY_OFFICER still listed on work-order routes while the service denies queues.
- done: QA-008 technician findOne scope. QA-009 security queue denial. QA-007 overdue auto WO due date.
- full API Jest blockB2 runInBand: 259 passed, 1 skipped (inventory-disposable-mongo.spec.ts), 0 failed. Typecheck/lint exit 0. Web unit 324 passed, 0 failed.

## Phase 8 — Pending Approvals

- done: `/admin/approvals` redirects to `/approvals`. Approval rules stay at `/admin/approval-rules`.
- done: inbox at `/approvals` with tabs and counts, search, priority, site, date range, oldest first, row fields, drawer, Approve / Reject / Return, mobile cards, empty state, skeletons, bulk approve for one type.
- done: server SoD, role amount limit, expectedVersion 409, Idempotency-Key, audit, requester notification, nav badge from the inbox total.
- tests: `approval-inbox.rules.spec.ts` and `approval-engine-phase07.spec.ts` 15 passed. Web inbox view 3 passed. Web unit 327 passed. API `tsc` and web `tsc` exit 0.
- full API Jest `--maxWorkers=2`, both database URLs on `maintainpro_e2e_wo_verify`, `NODE_ENV=test`: 259 passed, 1 skipped, 1 failed (`e2e-journeys/maintenance-flow.integration.spec.ts`, leftover labour session under parallel load). That suite alone `--runInBand`: 2 passed. Worker heap on the heavy suites was about 1.2 GB.

## Block E Tier 1

Status: DONE. No commit.

- 045, 038, 005, 037, 014, 013, 051, 030, 027, 026, 016 are FIXED in `DEFECT_STATUS.md`.
- SECURITY_OFFICER removed from the eight work-order read decorators. `roleCanAccessQueue` still denies that role.
- Journey uses its own technician user and employee. It passed inside the full `--maxWorkers=2` run.
- Full API Jest: 261 passed, 1 skipped (`inventory-disposable-mongo`), 2178 passed, 10 skipped, 0 failed, about 25s. Worker heap peak about 1.63 GB.
- Web unit: 328 passed, 0 failed. API `tsc` exit 0. Web `tsc` exit 0.

## Block E Tier 2

Status: DONE. No commit. 028 stays DEFERRED.

- Close returns the asset or vehicle when it is the last open job. Activity history includes plan, assign, hold, resume, part issue, verify, and close.
- Completion counts include CLOSED and VERIFIED. In-progress, unassigned, PM overdue, and cost cards share the queue helpers. `tier2-defects.spec.ts` 8 passed.
- Dashboard versus SQL on `maintainpro_e2e_wo_verify` matched. See `REPORTS_VERIFICATION.md`.
- Full API Jest `--maxWorkers=2` `NODE_ENV=test` on that database: 262 passed, 1 skipped, 2186 passed, 10 skipped, 0 failed, about 26s.
- Web unit 328 passed. API `tsc` exit 0. Web `tsc` exit 0.
- DEFECT_STATUS counts: FIXED 48, STILL PRESENT 10, DEFERRED 1, N/A 3.

## Block E Tier 3

Status: DONE. No commit. 028 stays DEFERRED. Block D not started.

- 041–044, 046, 047, 050, 052, 006, and 011 are FIXED.
- API tsc exit 0. Web tsc exit 0.
- Full API Jest `--maxWorkers=2`: 254 passed, 10 skipped, 2145 passed, 53 skipped, 0 failed, 29s.
- Web unit: 330 passed, 0 failed.

## Block D — Final validation

Status: RE-RUN 2026-10-19. No commit. Database reset is waiting for "OK reset".

- API Jest on `maintainpro_e2e_wo_verify`, integrated security, `--maxWorkers=2`: 263 passed, 1 skipped (`inventory-disposable-mongo`), 2188 passed, 10 skipped, 0 failed, 30.3s.
- Playwright chromium, workers=1. Release-candidate twice: 6 passed, 6 passed. Screen smoke: 6 passed. Compose project `maintainpro-e2e-blockd20261019` was stopped.
- `test:release` failed at `EXP-SAFE-004`. API `npm run build` failed because the running API locks the Prisma engine DLL. `tsc -p tsconfig.build.json` passed after the enum patch. Web build passed with `NEXT_DIST_DIR`.
- Backup: `C:\MaintainProData\backups\MaintainProDev_before_reset_20261019.bak` (72,474,624 bytes), verify-only passed. `MaintainProDev` was not dropped.
- Schema audit: `docs/handover/SCHEMA_USAGE_AUDIT.md`. Current handover: `docs/handover/FINAL_HANDOVER_2026-10-21.md`.

## Next

Wait for "OK reset" before recreating `MaintainProDev`. Wait for commit approval. Do not commit, push, or open a PR.

## Phase 9 — Carried-forward items

Status: NOT STARTED. Docker, skipped Mongo tests, My Jobs SQL pagination, audit outbox, phone QR scan, OneDrive commit `99ec9d5b`.

## Phase 10 — Final validation

Status: NOT STARTED. Stop before any commit.

## Pre go-live sweep 2026-10-19

Phase 0: PR #76 merged. PR #77 open; full-stack-e2e failed on mobile-smoke (hidden desktop row). Fix branch `fix/sweep-mobile-queue-open`. PR #82 diagnostics is open into release. Phases 1–7 not started.
2026-10-20 STEP2 chore/golive-final from origin/chore/golive-ops e37ee55f: rewrote GO_LIVE_MASTER_DATA from bulk-import adapters, added runbook IIS X-Real-IP, login burst, Express schtasks, build order, env modes; committed DEPLOYMENT_RUNBOOK X-Real-IP; MANUAL_SAVE_CHECK; fleet 404 not reproduced; no .env.test or start-*.bat tracked.

## Full-stack e2e fix 2026-10-19

Branch `fix/sweep-e2e-tenant`. Local `npm run test:e2e:full-stack` against the rebuilt stack on 127.0.0.1:18080: 128 passed. Jest `workforce-employees.spec.ts` 17 passed. Jest `work-order-evidence-governance.spec.ts` 10 passed. qa-reviewer could not be started (billing). `fix/sweep-approvals` stays unpushed.

2026-10-21 v1.0.2 tag `0cac1eb8` already on main. Downtime tab: unit 1 passed, web unit 346 passed, web tsc 0, register e2e 1 passed. Safety-card commit only; tag not moved.
2026-10-21 v1.0.3 flow: assign-from-open, six-role dropdown, grant script, next action, plain errors, legacy filters hidden. API tsc 0, web tsc 0, web unit 353 passed, assign/approval/legacy jest passed, audit tenant and rbac 0. Local full Jest still has pre-existing HTTP 401s that also fail on the release tree.
2026-10-21 wo-flow-v103 Playwright 1 passed (CSRF, asset request, one login per role, photo bytes, QR scan, labour hold). PR #104 merged to develop. PR #105 develop to main still running required checks.
2026-10-21 ui/foundation: dashboard primitives and status map added. Pages unchanged.
2026-10-21 ci/run-gates-on-develop: release-validate and full-stack-e2e also run on pull requests into develop. SQL Server gate stays path-filtered, not branch-filtered.
2026-10-21 ui/maintenance-dashboard: /maintenance restyle only. Web tsc 0, web unit 355 passed. Full-stack, uat-roles, and wo-flow not run (local DB is MaintainProDev).
2026-10-21 ui/maintenance-dashboard: light-only tokens, page title, and the quiet View all button. Not merged.
2026-10-21 ui/wo-drawer: drawer redesign polish (one save hint, tab underline, evidence copy, Colombo dates, mobile stepper). Local commit only.
