# Release candidate QA evidence — 2026-10-13

This file is an uncommitted evidence package. It is not a QA verdict and it is not release approval.

## P1–P4 stabilization (2026-10-13, not a verdict)

Disposable database `maintainpro_e2e_release_p5` was migrated, seeded, used for the lifecycle suite and the full API Jest suite, then dropped. `MaintainProDev` was not modified. `nelna` is not on this instance.

| Check | Result |
|---|---|
| Seeded linked employees | EMP-0001 and EMP-0002 `availabilityStatus=AVAILABLE` |
| Lifecycle suite | 11 passed, 0 failed |
| Full API Jest | 240 suites passed, 1 skipped; 2044 tests passed, 10 skipped, 0 failed |
| Web unit tests | 254 passed, 0 failed, 0 skipped (Node 24) |
| API and web `tsc --noEmit` | exit 0 |
| `npm run test:release` | exit 0 |
| `validate:e2e-no-mocks` | 27 files, exit 0 |
| `validate:e2e-safety` | 17 passed, 0 failed |
| Playwright | NOT EXECUTED. Docker daemon is down |
| Node 20 web-test runtime | NOT EXECUTED. This machine has Node 24. Discovery no longer uses a shell `**` glob |

Legacy employees whose `availabilityStatus` is blank were not updated. That correction still needs separate approval.

## Final pre-QA validation (Claude CLI session, 2026-10-13, not a verdict)

State: branch `release/maintainpro-final-consolidation-20261013`, HEAD `a79859dc560fa4b36dac8ec212fc2a490556ac10`, 26 tracked changes (23 modified, 3 deleted Action Center components) and 8 untracked files. Product diff was byte-identical before and after this session. Fingerprints (sha256), docs excluded: tracked `git diff --binary` `bbe6c5f8…f566c`; untracked file hashes `bdc630b8…9fe3`. `node_modules` is a symlink to the `integration-rehearsal` worktree. The generated Prisma client comes from an identical `schema.prisma`.

Disposable DBs only: `maintainpro_e2e_final_144627` and `maintainpro_e2e_final_lc_144942` on local `SQLEXPRESS` (Windows auth). Both were migrated, then seeded with a random throwaway password that was not recorded, then dropped. `nelna` is not on this instance. `MaintainProDev` was not used and still exists.

| Check | Result |
|---|---|
| API `tsc --noEmit` / web `tsc --noEmit` | exit 0 / exit 0 |
| Web unit (`npm run test`, Node 24) | 254 passed, 0 failed, 0 skipped |
| Full API Jest (disposable DB) | 238 suites passed, 1 failed, 1 skipped; 2030 tests passed, 11 failed, 10 skipped |
| `npm run test:release` | exit 0 |
| `validate:e2e-no-mocks` | 27 files, exit 0 |
| `validate:e2e-safety` | 17 passed, 0 failed |
| Playwright `e2e-real/release-candidate.spec.ts` | NOT EXECUTED: Docker daemon down |

The only failing suite is `work-order-domain-d3-d5-lifecycle.integration.spec.ts`. The skipped suite is `inventory-disposable-mongo.spec.ts` (`DISPOSABLE_MONGO_URL` unset).

### Findings for the reviewer

- **HIGH — seeded and legacy blank-availability employees cannot be assigned.** On a clean migrated and seeded DB, the lifecycle suite failed 6 of 11 with `Employee availability is unknown and cannot be assigned` (`work-orders.service.ts:1578`). `workforce-seed.ts` never sets `availabilityStatus`. The column default is `''`. H1/H3 now reject `''`, and `listEmployeesByDesignation` hides it. Every `db:seed` environment is affected, and so is every existing production row with blank availability (the remediation note says these were not migrated). This contradicts the earlier H6 note "domain lifecycle 11 passed". A data backfill or a seed fix needs an owner decision. The CI full-stack gate is likely unaffected: `e2e-seed.mjs` creates no Employee for `tech-a`, so `assign()` auto-creates one as `AVAILABLE`.
- **MEDIUM (test isolation) — full Jest depends on DB state.** `deferred-audit-transactions.spec.ts` and `assignment-transaction.integration.spec.ts` leave 17 `E2E …` tenants behind. The lifecycle suite's unordered `tenant.findFirst()` then picks one of them and fails all 11 tests in `beforeAll`. That spec also runs against any `DATABASE_URL` with no `nelna`/`MaintainProDev` guard.
- **MEDIUM, PLAUSIBLE — the new CI "Web unit tests" step may fail on GitHub.** The script is `tsx --test lib/__tests__/**/*.test.ts`. Linux `sh` passes that pattern literally because there are no subdirectories. CI uses Node 20, and `--test` gained glob expansion only in Node 21. Locally Node 24 expanded it. Not run on Node 20.
- **MEDIUM — the role-permission audit volume can exceed the transaction timeout.** `syncRolePermissions` deletes and recreates every link and writes one audit row per link, sequentially, in an interactive transaction with Prisma's default 5 s timeout. Measured on the disposable DB: ADMIN with 197 permissions wrote 393 audit rows in 528 ms locally. A remote DB at about 13 ms round trip would pass 5 s and the role save would fail. Unchanged permissions are also logged as DELETE+CREATE.
- **LOW (test gap)** — The "role-permission grant rolls back" test fails on `createMany` before any explicit audit row is written. It therefore does not prove that audit rows roll back. The user-skill rollback test does prove it.

### Audit-integrity evidence

Verified in the full Jest run: `deferred-audit-transactions.spec.ts` PASS (10 tests). The explicit `RolePermission` and `UserSkill` rows are written through the same `tx` (`writeAuditTrail(tx, …)`). Actor comes from `requestContext`, and tenant comes from the role or the user's tenant. The tests assert `actorId` and `tenantId`. There are no duplicates because interactive transactions skip the before-image prefetch, so the automatic `deleteMany` writes no DELETE, and `createMany` is never auto-audited. That protection depends on the prefetch rule. Enabling interactive prefetch later would duplicate DELETE audits.

### Residual risk (not zero)

Automatic middleware audits for transactional writes flush after commit, outside the transaction. A crash or a failed audit insert after commit loses that row. A failure is logged as a warning and is not retried or queued. Only explicit `auditLog.create` / `writeAuditTrail(tx, …)` rows are atomic with the business change. `createMany` remains unaudited except where an explicit audit was added.

### Real-stack E2E blocker

The supported path is the Docker Compose E2E stack: nginx at `127.0.0.1:18080`, `COMPOSE_PROJECT_NAME=maintainpro-e2e-*`, and `.env.e2e`. The guard in `scripts/lib/e2e-guards.mjs` enforces it. The Docker daemon is not running (`dockerDesktopLinuxEngine` pipe missing), `.env.e2e` is absent, and ports 3000, 3011, 3022 and 18080 were not listening. A non-Docker setup would mean hand-building nginx, API and web and faking the compose identity. That was not attempted. To unblock: the owner starts Docker Desktop, then the E2E stack, then runs the spec twice on the same `maintainpro_e2e_*` database.

Spec review (`e2e-real/release-candidate.spec.ts`): it uses only real `/api/backend` calls and no route mocks. Workforce fixtures are unique per run, project, worker, retry, pid and time, and server-generated WO and request numbers are used as locators, so the spec should be repeatable. Authorization coverage is admin-a plus one cross-tenant 404 (admin-b). No non-admin RBAC negative is covered. Server-side `addAssignee` rejection is covered only by Jest. CI runs the spec in both `chromium-desktop` and `mobile-smoke` (Pixel 5). The mobile layout of the work-order search and Assignment tab is unverified. One style nit: an `import` statement appears after a function declaration.

## H3 and H4 (uncommitted, not re-reviewed)

Workforce Master creation stores `AVAILABLE` only when the field is omitted, matching `PeopleService.parseAvailability`. Blank and unknown values are rejected. Existing blank employee rows were not migrated. Legacy assignment validates the assignee before updating `technicianId`. `ON_LEAVE` still uses the manager leave override. `validate:e2e-no-mocks` and `validate:e2e-safety` exited 0. Playwright `e2e-real/release-candidate.spec.ts` no longer mocks the workforce API and was not executed.

## H1 and H2 remediation (uncommitted, not re-reviewed)

The product owner authorized Claude CLI as the independent reviewer. Claude's review of `a79859dc` was FAIL. The working tree now contains the H1 eligibility fix and the H2 CI, Playwright, and release-self-test wiring. HEAD is still `a79859dc`. That commit-before-PASS exception was not rewritten. GitHub has not run the new workflow steps. `e2e-real/release-candidate.spec.ts` was added and not executed locally. Ready for a fresh Claude CLI review of the working tree. Not a PASS.

## Snapshot

- Worktree: `C:\Users\chint\AppData\Local\MaintainPro\worktrees\release-final-20261013`
- Branch: `release/maintainpro-final-consolidation-20261013`
- No upstream
- Snapshot: `a79859dc560fa4b36dac8ec212fc2a490556ac10`
- Parent / `origin/main`: `4d3946574bf2b450773c3549692880a98f89b1cc`
- Message: `checkpoint: release candidate worktree snapshot 20261013 including untracked source`
- Diff: `git diff 4d3946574bf2b450773c3549692880a98f89b1cc a79859dc560fa4b36dac8ec212fc2a490556ac10`
- `git diff 4d394657 HEAD --check`: exit 0
- Not pushed. `origin/main` was not updated.

## Governance exception

`AGENTS.md` allows a feature-branch commit only after the latest `qa-reviewer` verdict is PASS. This snapshot was created before any such verdict. The reviewer launch returned an unpaid-invoice billing error and produced neither PASS nor FAIL (agent id `5d6e337d-e69e-4571-b5eb-29dddf7e66c9`). The reviewer was not retried. This commit is a local checkpoint, not a reviewed delivery commit.

## Uncommitted files preserved

On top of `a79859dc`:

- `maintainpro/docs/AI_SESSION_HANDOVER.md` (QA-pending note)
- `maintainpro/docs/RELEASE_CANDIDATE_QA_EVIDENCE_20261013.md` (this file)

Product source in the snapshot was not edited for this package.

Earlier integration checkpoint, tracked files only, including the three deletions below: `refs/keep/integration-rehearsal-20261013` = `124b7a9b5c30db2de2206c9684fe13edcc30197f`. The integration worktree `rehearsal/three-workstream-20261012` still has that uncommitted work. It was not reset.

## Snapshot completeness gap

These three tracked deletions are in the integration worktree and in `124b7a9b`, and they are absent from `a79859dc` because checking out a tree does not delete files that the tree omits:

- `maintainpro/apps/web/components/action-center/action-card.tsx`
- `maintainpro/apps/web/components/action-center/action-center-page.tsx`
- `maintainpro/apps/web/components/action-center/action-section.tsx`

The Action Center routes in the snapshot redirect away from that UI. The unused component files remain in the snapshot. They were not deleted during this evidence step.

## Secret and artifact scan

154 paths: 103 modified, 51 added, 0 deleted. No `.env`, credential file, private key, database file, SQL backup, `node_modules`, `.next`, or `render.yaml`.

The only environment files are examples. Each changes `DATABASE_REPLICATION_ENABLED` from `true` to `false` and adds the comment that replication stays off until an owner approves it. `render.yaml` was not modified. No SQL password or System Health permission change is in the snapshot.

## Integration history

All source worktrees were at `4d394657` with uncommitted work. The candidate was copied from the integration rehearsal, which already combined the UX, performance, and pilot readiness edits plus the later navigation, reports, work-order, and tenant-switcher fixes. Those other worktrees were not overwritten.

Not included:

- `origin/fix/manual-qa-blockers` (`6616b7d7`) and `origin/test/playwright-qa-suite` (`5b6263ae`). Their refresh-409 client is older than `REFRESH_TOKEN_ROTATED` already on `main`.
- PR #71, `fix/ci-release-e2e-gates`, still open and conflicting.
- The rehearsal branch was not merged into `main`.

## Tests actually run on this worktree

From `maintainpro/apps/web`:

```text
npx tsx --test lib/__tests__/work-order-overview-edit.test.ts lib/__tests__/stabilization.test.ts lib/__tests__/entry-landing.test.ts lib/__tests__/report-workspace.test.ts lib/__tests__/role-redirect.test.ts lib/__tests__/protected-route.test.ts lib/__tests__/work-order-queue-nav.test.ts
```

Result: 46 passed, 0 failed.

From `maintainpro/apps/api`:

```text
npx jest --config ./jest.config.cjs test/navigation.spec.ts test/role-redirect.spec.ts --runInBand
```

Result: 2 suites, 39 passed.

```text
npx tsc --noEmit --pretty false --incremental false
```

Web exit 0. API exit 0.

No full Jest suite, no Playwright run, and no production build were run for this snapshot.

## Browser evidence

Signed-in checks were made on port 3022, which serves the integration rehearsal, the source that was copied. This worktree did not get its own web server. Port 3011 still serves the older UX tree. Port 3000 was not restarted, so the workforce role-fallback edit is in source and is not proven loaded in the running API.

Readiness on 2026-10-13: primary SQL Server operational (`nelna`). Overall status `degraded` because Redis queue health timed out and object storage is degraded. Email, SMS, and push disabled. ERP mock.

## Business requirements the reviewer should judge

- Action Center is removed from navigation and its pages redirect. Aggregation libraries may remain. The three component files above are still in this commit.
- `/` and `/splash` without a session go to `/login`. A session cookie resolves a role destination.
- Role destinations stay inside authorized routes. External, protocol-relative, splash, Action Center, and unauthorized return paths fall back.
- Maintenance Forecast leaves the menu. `/maintenance/forecast` and `/maintenance/planning` redirect to `/maintenance/plans` when that path is allowed, otherwise they say the page is unavailable. Forecast APIs and PM records stay.
- Maintenance Costs leaves the menu and work-order links. `/maintenance/costs` redirects to Reports only when that role can open Reports.
- The simplified-navigation control is gone. The sidebar is the permission-filtered menu.
- Reports title is "Reports". Retained tabs: Operations, User Activity, Assets & Equipment, Inventory & Parts, and System Logs for roles that may see logs. Financials, Performance KPIs, Driver Intelligence, Fuel Analytics, Vehicle Cost Analytics, Decision Signals, and Data Coverage are not shown. Their APIs stay. Pins are limited to 4 per tenant and user.
- A hidden zero-size request action trigger does not open a second menu.
- Workforce designation choices come from loaded employees. Clearing the filter restores the broader list. The server match includes the linked role when a designation query is sent.
- Work-order overview opens read-only. Save is available only while editing and only when the draft is valid and dirty. Other tabs do not save the overview. After start, due date and expected completion stay locked; title, description, estimated cost, and hours can still be edited.
- Work-order search keeps the newer draft when an older URL echo returns.
- A single tenant membership does not show the organization switcher. Two or more memberships still do.
- Bileeta remains the inventory stock authority. Local quantity is not the stock source of truth.

## Known limitations

- Page-load timing was not measured. Repeat evidence and activity fetches are skipped only inside one open drawer.
- Mobile request menu, outside click, non-admin roles, exports, fleet gate, inventory issue, and write paths were not exercised for this package.
- Most modules in `FUNCTIONAL_VERIFICATION_MATRIX.md` remain not tested end to end.
- Historical PASS WITH CONDITIONS does not approve `a79859dc`.

## Environment and policy blockers

- No `qa-reviewer` PASS or FAIL exists for this snapshot.
- `render.yaml` still enables replication. Example env files set it false. Owner decision is open. Do not change `render.yaml` until that decision is recorded.
- Do not change SQL credentials or System Health authorization.
- Production email, SMS, push, and live ERP are not approved.
- Redis and object storage are degraded in the local readiness check.
- No restore-rehearsal evidence is recorded.

## Reviewer authorization

The Git gate in `AGENTS.md` is a binary PASS from `qa-reviewer` (`.cursor/agents/qa-reviewer.md`). The role label "`qa-reviewer` / Claude" does not authorize a separate Claude CLI session to replace that verdict. The agent file's fallback is Cursor's compatible model for the same subagent, not an external CLI transcript. Claude CLI was not run and is not a substitute unless the owner explicitly authorizes that named review as the `qa-reviewer` verdict for this exact snapshot.

## File inventory (154)

### Examples and ignore (4)

- `maintainpro/.env.docker.example`
- `maintainpro/.env.production.example`
- `maintainpro/.gitignore`
- `maintainpro/apps/api/.env.example`

### API (14)

- `maintainpro/apps/api/src/config/env.validation.ts`
- `maintainpro/apps/api/src/database/replication.config.ts`
- `maintainpro/apps/api/src/health.service.ts`
- `maintainpro/apps/api/src/modules/maintenance-config/maintenance-dashboard.controller.ts`
- `maintainpro/apps/api/src/modules/notifications/notification-uat.service.ts`
- `maintainpro/apps/api/src/modules/workforce/workforce-employees.service.ts`
- `maintainpro/apps/api/src/modules/workforce/workforce-planning.service.ts`
- `maintainpro/apps/api/test/command-palette.spec.ts`
- `maintainpro/apps/api/test/health-integration-modes.spec.ts`
- `maintainpro/apps/api/test/mobile-pwa.spec.ts`
- `maintainpro/apps/api/test/navigation.spec.ts`
- `maintainpro/apps/api/test/phase-02-responsive-pwa.spec.ts`
- `maintainpro/apps/api/test/reporting-kpis-phase13.spec.ts`
- `maintainpro/apps/api/test/role-redirect.spec.ts`

### Web routes and styles (20)

- `maintainpro/apps/web/app/(auth)/login/page.tsx`
- `maintainpro/apps/web/app/(dashboard)/action-center/page.tsx`
- `maintainpro/apps/web/app/(dashboard)/dashboard/page.tsx`
- `maintainpro/apps/web/app/(dashboard)/layout.tsx`
- `maintainpro/apps/web/app/(dashboard)/maintenance/costs/page.tsx`
- `maintainpro/apps/web/app/(dashboard)/maintenance/forecast/page.tsx`
- `maintainpro/apps/web/app/(dashboard)/maintenance/history/page.tsx`
- `maintainpro/apps/web/app/(dashboard)/maintenance/jobs/page.tsx`
- `maintainpro/apps/web/app/(dashboard)/maintenance/planning/page.tsx`
- `maintainpro/apps/web/app/(dashboard)/maintenance/plans/page.tsx`
- `maintainpro/apps/web/app/(dashboard)/notifications/page.tsx`
- `maintainpro/apps/web/app/(dashboard)/procurement/vendors/page.tsx`
- `maintainpro/apps/web/app/(dashboard)/requests/page.tsx`
- `maintainpro/apps/web/app/(dashboard)/settings/page.tsx`
- `maintainpro/apps/web/app/(dashboard)/vehicles/page.tsx`
- `maintainpro/apps/web/app/(dashboard)/work-orders/my/page.tsx`
- `maintainpro/apps/web/app/(dashboard)/workspace/page.tsx`
- `maintainpro/apps/web/app/globals.css`
- `maintainpro/apps/web/app/page.tsx`
- `maintainpro/apps/web/app/splash/page.tsx`

### Web components

- `maintainpro/apps/web/components/admin/admin-console-page.tsx`
- `maintainpro/apps/web/components/assets/assets-management-page.tsx`
- `maintainpro/apps/web/components/assets/assets-table.tsx`
- `maintainpro/apps/web/components/auth/session-entry.tsx`
- `maintainpro/apps/web/components/dashboard/morning-briefing.tsx`
- `maintainpro/apps/web/components/enterprise-ops/enterprise-queue-page.tsx`
- `maintainpro/apps/web/components/fleet/fleet-gate-panel.tsx`
- `maintainpro/apps/web/components/fleet/fleet-workspace.tsx`
- `maintainpro/apps/web/components/inventory/inventory-control-page.tsx`
- `maintainpro/apps/web/components/layout/mobile-bottom-nav.tsx`
- `maintainpro/apps/web/components/layout/mobile-nav.tsx`
- `maintainpro/apps/web/components/layout/nav-links.tsx`
- `maintainpro/apps/web/components/layout/navigation-route-guard.tsx`
- `maintainpro/apps/web/components/layout/role-landing-redirect.tsx`
- `maintainpro/apps/web/components/layout/tenant-switcher.tsx`
- `maintainpro/apps/web/components/layout/topbar.tsx`
- `maintainpro/apps/web/components/maintenance/maintenance-dashboard-page.tsx`
- `maintainpro/apps/web/components/maintenance/retired-forecast-redirect.tsx`
- `maintainpro/apps/web/components/operational/queue-tab-bar.tsx`
- `maintainpro/apps/web/components/reports/report-module-page.tsx`
- `maintainpro/apps/web/components/reports/reports-dashboard-page.tsx`
- `maintainpro/apps/web/components/ui/breadcrumbs.tsx`
- `maintainpro/apps/web/components/ui/data-table.tsx`
- `maintainpro/apps/web/components/ui/entity-picker.tsx`
- `maintainpro/apps/web/components/work-orders/work-order-assignees-panel.tsx`
- `maintainpro/apps/web/components/work-orders/work-order-detail-tabs.tsx`
- `maintainpro/apps/web/components/work-orders/work-order-editor-modal.tsx`
- `maintainpro/apps/web/components/work-orders/work-order-queue-panel.tsx`
- `maintainpro/apps/web/components/work-orders/work-order-table.tsx`
- `maintainpro/apps/web/components/work-orders/work-orders-page.tsx`
- `maintainpro/apps/web/components/workspace/workspace-page.tsx`

### Web libraries, tests, e2e, and config

- `maintainpro/apps/web/e2e/auth.spec.ts`
- `maintainpro/apps/web/e2e/signed-in-responsive.spec.ts`
- `maintainpro/apps/web/e2e/staging-uat-002.spec.ts`
- `maintainpro/apps/web/e2e/staging-uat.spec.ts`
- `maintainpro/apps/web/lib/__tests__/breadcrumbs.test.ts`
- `maintainpro/apps/web/lib/__tests__/data-table-mobile.test.ts`
- `maintainpro/apps/web/lib/__tests__/entry-landing.test.ts`
- `maintainpro/apps/web/lib/__tests__/focus-trap.test.ts`
- `maintainpro/apps/web/lib/__tests__/gate-operations.test.ts`
- `maintainpro/apps/web/lib/__tests__/inventory-control.test.ts`
- `maintainpro/apps/web/lib/__tests__/maintenance-request-ui.test.ts`
- `maintainpro/apps/web/lib/__tests__/mobile-nav-stack.test.ts`
- `maintainpro/apps/web/lib/__tests__/my-job-filters.test.ts`
- `maintainpro/apps/web/lib/__tests__/notification-inbox.test.ts`
- `maintainpro/apps/web/lib/__tests__/overlay-dismiss.test.ts`
- `maintainpro/apps/web/lib/__tests__/pm-plan-list.test.ts`
- `maintainpro/apps/web/lib/__tests__/protected-route.test.ts`
- `maintainpro/apps/web/lib/__tests__/report-workspace.test.ts`
- `maintainpro/apps/web/lib/__tests__/safe-return-path.test.ts`
- `maintainpro/apps/web/lib/__tests__/stabilization.test.ts`
- `maintainpro/apps/web/lib/__tests__/tenant-session-load.test.ts`
- `maintainpro/apps/web/lib/__tests__/work-order-overview-edit.test.ts`
- `maintainpro/apps/web/lib/__tests__/work-order-queue-nav.test.ts`
- `maintainpro/apps/web/lib/breadcrumbs.ts`
- `maintainpro/apps/web/lib/command-palette.ts`
- `maintainpro/apps/web/lib/data-table-mobile.ts`
- `maintainpro/apps/web/lib/gate-operations.ts`
- `maintainpro/apps/web/lib/inventory-control.ts`
- `maintainpro/apps/web/lib/maintenance-request-ui.ts`
- `maintainpro/apps/web/lib/my-job-filters.ts`
- `maintainpro/apps/web/lib/navigation.ts`
- `maintainpro/apps/web/lib/notification-inbox.ts`
- `maintainpro/apps/web/lib/overlay-dismiss.ts`
- `maintainpro/apps/web/lib/pm-plan-list.ts`
- `maintainpro/apps/web/lib/protected-route.ts`
- `maintainpro/apps/web/lib/pwa-metadata.ts`
- `maintainpro/apps/web/lib/report-workspace.ts`
- `maintainpro/apps/web/lib/request-row-menu.ts`
- `maintainpro/apps/web/lib/role-redirect.ts`
- `maintainpro/apps/web/lib/tenant-session-load.ts`
- `maintainpro/apps/web/lib/tenant-session.tsx`
- `maintainpro/apps/web/lib/use-focus-trap.ts`
- `maintainpro/apps/web/lib/use-nav-badges.ts`
- `maintainpro/apps/web/lib/work-order-governance.ts`
- `maintainpro/apps/web/lib/work-order-overview-edit.ts`
- `maintainpro/apps/web/lib/work-order-queue-nav.ts`
- `maintainpro/apps/web/lib/workforce-designations.ts`
- `maintainpro/apps/web/next.config.mjs`

### Docs (16)

- `maintainpro/docs/AI_SESSION_HANDOVER.md`
- `maintainpro/docs/CONTROLLED_PILOT_TECHNICAL_READINESS.md`
- `maintainpro/docs/FUNCTIONAL_VERIFICATION_MATRIX.md`
- `maintainpro/docs/INTEGRATION_REHEARSAL_20261012.md`
- `maintainpro/docs/PERFORMANCE_BASELINE_AND_OPTIMIZATION.md`
- `maintainpro/docs/UI_UX_ACCESSIBILITY_REPORT.md`
- `maintainpro/docs/UI_UX_AUDIT_MATRIX.md`
- `maintainpro/docs/UI_UX_COMPLETION_MATRIX.md`
- `maintainpro/docs/UI_UX_COMPONENT_INVENTORY.md`
- `maintainpro/docs/UI_UX_FINAL_VALIDATION.md`
- `maintainpro/docs/UI_UX_HUMAN_UAT.md`
- `maintainpro/docs/UI_UX_REDESIGN_ROADMAP.md`
- `maintainpro/docs/UI_UX_REGRESSION_TEST_REPORT.md`
- `maintainpro/docs/UI_UX_RESPONSIVE_TEST_REPORT.md`
- `maintainpro/docs/UI_UX_ROLE_WORKFLOW_REPORT.md`
- `maintainpro/docs/UI_UX_STANDARDS_2026.md`

### Scripts (20)

- `maintainpro/scripts/perf/measure-api-direct.mjs`
- `maintainpro/scripts/perf/measure-api.mjs`
- `maintainpro/scripts/perf/measure-auth-nav.mjs`
- `maintainpro/scripts/perf/measure-client.mjs`
- `maintainpro/scripts/perf/measure-data.mjs`
- `maintainpro/scripts/perf/measure-jobs-after.mjs`
- `maintainpro/scripts/perf/measure-nav.mjs`
- `maintainpro/scripts/perf/measure-prod.mjs`
- `maintainpro/scripts/perf/measure-queue.mjs`
- `maintainpro/scripts/perf/measure-queues.mjs`
- `maintainpro/scripts/perf/measure-warm.mjs`
- `maintainpro/scripts/perf/probe-login-status.mjs`
- `maintainpro/scripts/perf/probe-nav.mjs`
- `maintainpro/scripts/perf/queue-shape.mjs`
- `maintainpro/scripts/perf/rehearsal-findings.mjs`
- `maintainpro/scripts/perf/rehearsal-nav.mjs`
- `maintainpro/scripts/perf/rehearsal-search-r02c.mjs`
- `maintainpro/scripts/perf/rehearsal-search-race.mjs`
- `maintainpro/scripts/perf/rehearsal-search.mjs`
- `maintainpro/scripts/test/pilot-stack-guard.selftest.mjs`
- `maintainpro/scripts/test/replication-config.selftest.ts`
