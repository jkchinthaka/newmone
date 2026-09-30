# AI Session Handover — MaintainPro

> **Mandatory for every AI session (Claude, Cursor, or other agents).**
> 1. At session start, read this file, then `docs/PRODUCT_FINALIZATION_LEDGER.md`, then run the
>    Git checks below **before changing anything**.
> 2. Update this file after every meaningful milestone (a fix verified, a test run, a commit,
>    a blocker found), not just at the end. Sessions can end without warning at a usage limit.
> 3. Keep unfinished work on the current feature branch. Never force-push, never discard or
>    reset someone else's changes, never push unvalidated code to `main`.

Start-of-session checks (run from repo root `C:/Dev/newmone`):

```bash
git fetch origin
git status -sb
git log --oneline -5
git reflog -5            # detect branch rewrites by other sessions
git stash list           # do not pop stashes you did not create
git worktree list
git log --oneline HEAD..origin/main   # has main moved?
```

---

## Current state

**Last updated:** 2026-09-30 ~12:40 IST. Phase 11 is in progress on `feature/phase-11-fleet-gate`. Live Map is retired. Gate-out and gate-in still need a signed-in pass. Do not start Phase 12. Do not merge into main.

| Item | Value |
| --- | --- |
| Current phase | 11 Fleet and gate — IN PROGRESS. Live Map is RETIRED / NOT PRODUCT SCOPE. |
| Next phase | Finish gate-out, gate-in, vehicle lifecycle, and compliance counts before Phase 12. |
| Local Git | `feature/phase-05-all-jobs`, fast-forwarded to Phase 04 `5f393d65`, then the jobs-board start. Do not merge directly into main. Not pushed. |
| `origin/main` | `0f355313`. PR **#62** merged (`Merge pull request #62`). `git diff HEAD...origin/main` has no file changes; the CI heap history was already in this branch. Do not merge this feature branch into main. |
| Working branch | `feature/phase-11-fleet-gate` (not pushed), created with `--no-track` from `feature/phase-10-preventive-maintenance` at `037495d2`. |
| Other worktrees | `C:/Dev/newmone-maintenance-costs`, `C:/Dev/newmone-vendor-eligibility`: already merged; leave alone |
| Stash | `stash@{0}` "pre-main-handover-20260929": not ours, do not pop or drop |
| Local dev stack | User's `npm run dev` in this tree (API :3000 `node --watch`, web :3001 `next dev`), DB `MaintainProDev` (local SQL Server) |

### How iteration 01 reached main (reconciled 2026-09-29)

- GitHub activity API: `push` to `refs/heads/main` by `jkchinthaka` at 2026-09-29T10:09:06Z,
  after = `52311b8f`. There is **no PR**, so iteration 01 never went through PR Validation before landing.
- Local `origin/main` reflog: `update by push` at 15:39:07 IST, then an IDE-style
  `fetch --prune --recurse-submodules=on-demand` 2 s later (VS Code / Cursor Sync pattern).
  The agent ran no `git push`. Contributing cause: the branch was created with
  `git switch -c … origin/main`, so its **upstream was `origin/main`** and any plain push or
  Sync from this checkout targeted `main`.
- **Mitigation:** upstream of `maintainpro/finalization-iter-01` removed. New branches must be
  created with `--no-track` and pushed with an explicit `origin <branch>`.
- History shape: `89533ac0` (message says "test(vendors)…" but contains the whole Requests
  slice plus the vendor test fix; tree identical to original `124e9fc5`), `7878eb56`, `52311b8f`.
  **Not rewritten.** Main is shared history now; no reset or force-push.

### CI / deployment status (investigated 2026-09-29)

| Check | Status on `52311b8f` | Since | Root cause | Fix |
| --- | --- | --- | --- | --- |
| PR Validation / validate-monorepo | failure (OOM in `npm run test`) | `d7456ab0` (PR #59, before iteration 01) | ts-jest type-checks every suite against ~34 MB Prisma `index.d.ts`; **cold cache** needs ~2.2 GB per suite, ~3.3 GB peak for full run; Node 20 runner default ~2 GB. Reproduced locally with `--no-cache` + 2 GB cap (same FATAL). | PR #62: `NODE_OPTIONS=--max-old-space-size=6144` on Jest jobs (pr-validation, release-validation, sqlserver gate step). Local cold run with 4 GB: 221 suites / 1933 tests pass, 135 s. **Verified: PR #62 validate-monorepo green.** |
| Vercel | failure | ≥ 2026-09-18 (all 40+ checked main commits) | **Unconfirmed** (agent cannot read logs: Vercel CLI and dashboard not signed in). Strong candidate: fail-closed guard in `apps/web/lib/api-url.ts` (added `9ac1da24`, 2026-09-17) throws when `NEXT_PUBLIC_API_URL` / `NEXT_PUBLIC_API_BASE_URL` is absent at build time. `npm run vercel:build` without it reproduces the failure; with it the build passes. | User: set `NEXT_PUBLIC_API_URL` (and `_BASE_URL`, `_ORIGIN`) in Vercel project env (Production + Preview) and redeploy, or share the build log. Do **not** remove the guard. |
| Cloudflare Workers Builds | failure | ≥ 2026-09-18 | **Unconfirmed**, no log access. `wrangler.jsonc` sets the API URL under `vars`, which are **runtime** vars; `NEXT_PUBLIC_*` must exist at **build** time → same guard likely fires. Local `cloudflare:build` can't confirm: OpenNext on Windows fails with unrelated `Could not resolve` errors inside Next (tool warns it is not Windows-compatible). | User: add the three `NEXT_PUBLIC_*` values as Workers Builds *build variables* (dashboard → Settings → Build), or share the build log. |
| Docker Image CI / Docker Build Check | success | — | — | — |
| full-stack-e2e | failure | every run checked back to `028ba871` (2026-09-24) | Registry denies anonymous pull of pinned MinIO images (`quay.io/minio/minio:RELEASE.2025-04-22T22-12-26Z`, `quay.io/minio/mc:…`): `unauthorized: access to the requested resource is not authorized` in "Build and start isolated E2E stack". External image availability, not app code. | Infra decision needed: mirror the images into a registry you control (e.g. GHCR), or switch the E2E storage service to another S3-compatible image. Not changed in PR #62. |

## Completed in iteration 1

Details and defect table: `PRODUCT_FINALIZATION_LEDGER.md` section E. Summary:

- **Database:** no schema change or migration. Existing `MaintenanceRequest.version` now used
  for optimistic concurrency.
- **API** (`apps/api/src/modules/maintenance-requests/`):
  - DB-resolved permissions (`withCurrentPermissions`) with guard-identical alias checks
    (`hasCompatiblePermission` exported from `common/guards/permissions.guard.ts`).
  - `guardedUpdate` on all 9 status writes (409 on conflict).
  - Per-request `allowedActions` (single rule source `requestAllowedActions` in `request-lifecycle.ts`).
  - SoD added to request-information / close / mark-duplicate.
  - List `stage` filter shared with the summary counters (`requestStageFilter`).
  - Summary accepts `?mine=true` and returns `scope` + `capabilities`.
  - Date filter on `reportedAt`; status label "Accepted".
- **RBAC:** Requests nav item mirrors API read roles and requires
  `maintenance_requests.view_own` (or `facility_issues.view` / `facility_issues.report`).
  No permissions were granted or widened.
- **Web:**
  - `app/(dashboard)/requests/page.tsx` and `[id]/page.tsx` rewritten around server actions.
  - New `lib/maintenance-request-ui.ts` (labels, next step, stage cards).
  - `lib/maintenance-requests-api.ts` types.
  - `lib/navigation.ts`.
- **Tests added/updated:**
  - `apps/api/test/maintenance-requests-actions.spec.ts` (new, 16).
  - `maintenance-requests.spec.ts` (mocks for guarded writes).
  - `navigation.spec.ts` (realistic permissions + hidden-for-technician case).
  - `apps/web/lib/__tests__/maintenance-request-ui.test.ts` (new, 11).
  - Pre-existing red tests on main fixed (test-only): `vendor-repair-controls.spec.ts` and
    `maintenance-supply-phase09.spec.ts` (missing `vendorContract` mock since PR #60).
- **Docs:** `PRODUCT_FINALIZATION_LEDGER.md` (route inventory, backlog, page record).

## Test results (actually executed, 2026-09-29)

| Command | Result |
| --- | --- |
| `npm run typecheck` / `npm run lint` | pass |
| `npm run test` (full API jest) | 221 suites passed, 1 skipped; 1933 passed, 10 skipped, 0 failed |
| `npm test` in `apps/web` | 106 / 106 |
| `npm run audit:rbac` | 951 routes, 0 violations |
| `npm run audit:tenant` | 0 unapproved |
| `npm run db:migrate:status` | 25 migrations, up to date |
| Full build (shared-types, ui-components, api `tsc`, web `next build` with `NEXT_PUBLIC_API_URL=http://localhost:3000/api` as in CI) | pass, run in a temporary worktree (since removed) |
| Live API smoke vs local dev stack (script: session scratchpad `requests-smoke.mjs`, reads seed password from `.env` without printing) | 15 / 15, incl. real concurrent accept-vs-cancel → one 201, one 409 |
| Browser visual / responsive / console check | **NOT RUN**: user will sign in manually; agent must not type passwords |
| Cold-cache API jest, 2 GB cap (CI reproduction) | OOM (same FATAL as CI) |
| Cold-cache API jest, 4 GB cap | 221 suites / 1933 tests pass, 10 skipped, 135 s, peak heap 3.25 GB |
| Security-sensitive Jest suites (CI step) | 4 suites / 32 tests pass |
| `npm run validate:secret-safety` | 12 passed, 0 failed |
| `vercel:build` without `NEXT_PUBLIC_API_URL` | fails: "Missing NEXT_PUBLIC_API_URL…" (guard) |
| `cloudflare:build` with env, on Windows | fails with OpenNext Windows path errors: inconclusive |
| CI on PR #62 (head `4a9a597b`) | **validate-monorepo pass** (OOM fixed), release-validate pass, fresh-sqlserver-migrate pass, build pass, docker-build pass; full-stack-e2e fail (pre-existing, see below); Vercel / Workers fail (pre-existing config) |

## Known environment gotchas

- **Never create a branch with `origin/main` as upstream** (`git switch -c x origin/main` does that).
  An IDE Sync then pushes straight to `main` (this happened on 2026-09-29). Use
  `git switch --no-track -c <branch> origin/main` and push with `git push -u origin <branch>`.
- API Jest on a cold ts-jest cache needs more than 2 GB of heap. If running with `--no-cache`
  or on a fresh machine, set `NODE_OPTIONS=--max-old-space-size=6144`.

- `npm run db:generate` fails with EPERM while the dev API runs (query-engine DLL locked). The
  JS client still regenerates, but the patch scripts are skipped, so `@prisma/client` enums
  disappear and ~100 jest suites fail. Fix: run
  `node scripts/phase15-patch-prisma-enums.mjs && node scripts/phase15-patch-prisma-types.mjs && node scripts/phase15-loosen-types.mjs`.
- Do not run `next build` in `apps/web` while the user's `next dev` is running (shared `.next`).
  Build in a temporary worktree placed inside `maintainpro/` so `node_modules` resolves, and set
  `NEXT_PUBLIC_API_URL`.
- Files check out as CRLF (`core.autocrlf=true`); scripted edits with LF anchors silently miss.
  Normalize the file to LF first (`sed -i 's/\r$//'`). Git re-normalizes on commit.

## Blockers / open decisions

Phase 02 local shell work is complete. The items below remain release or product decisions, not open shell defects.

1. **CI red on main** until PR #62 merges. PR #62's validate-monorepo is green; merge needs the
   user's approval. full-stack-e2e stays red (MinIO image pull, pre-existing) until the infra decision.
2. **Browser UAT for /requests and /requests/[id] not done.** The user signs in at
   `http://localhost:3001`; the agent must not type credentials.
3. **Vercel + Cloudflare deploys red since ≥ 2026-09-18.** Root cause not confirmed (no log
   access). Needs the user to check the build env vars or share logs (see table above).
4. Business decision: should TECHNICIAN / MECHANIC / DRIVER report issues? No permissions granted.
5. Iteration 01 landed on main without PR review, under a misleading commit message
   (`89533ac0`). Accepted as history; no rewrite.

## Exact next action for the next agent

Stay on `feature/phase-11-fleet-gate`. Do not start Phase 12.

Live Map is retired. `/fleet` shows the fleet overview and links to vehicles, gate, accidents, claims, fines, and compliance. It does not render a map. `GET /fleet/live-map` and `GET /fleet/street-view` are removed. `GpsLocation` rows are kept for vehicle history. `user-role-gating.test.ts` passed 9/9 after the live-map helper was removed.

Next action: validate gate-out, gate-in, duplicate movement rejection, maintenance blocks, and vehicle counts against SQL. Do not start live Bileeta integration. Do not restore Live Map.

ERP ownership is decided: Bileeta owns stock quantity. `SparePart.quantityInStock` is the ERP mirror. Approved work-order issue records `PartIssue`, cost, and a `PENDING` `DomainEventOutbox` row, and does not call the stock engine. `apps/api/test/work-order-erp-stock-boundary.spec.ts` passed 7/7. No inventory reset and no schema migration.

Next action: the disposable flow was started and stopped before any stock write. Logins for the technician and manager succeeded; `superadmin@maintainpro.local` returned 429, so no work order was issued and no quantity was changed. Spare part `cmu3ujhmi014xoalkr8pg8eq6` still had quantity 10 when the create was rejected for a missing asset. Wait for the login limit to clear, then create a corrective work order on an existing asset, assign `tech@maintainpro.local`, start it, request and approve one part, issue it as a different storekeeper, and confirm quantity 10 is unchanged, the work-order line cost moved, and the outbox row is `PENDING`. Completion is expected to stay blocked while evidence storage is unset. Do not retry logins until the 429 clears. Do not start Phase 08. Do not edit Live Map.

Side task 2026-09-30 (docs only, no schema change): `docs/DATABASE_REPO_MAP.md` now maps all 222 Prisma models to the code that uses them. 163 CORE, 53 RETIRED (Phase 01 domains still wired to API modules), 6 UNUSED (`OrganizationUnit`, `CustomFieldValue`, `EmployeeRosterEntry`, `VendorContact`, `RepairWarranty`, `UatScenarioExecution`). The live database was not inspected: the agent's DB read was blocked by the permission classifier. No table was dropped. Dropping the 6 unused models waits for the user to confirm live row counts and approve a migration.
Correction, same day: `OrganizationUnit` is read by the view `vw_rpt_dim_branch_site`, so it is CORE (164 CORE, 5 UNUSED). The user asked to drop the 5 unused tables. The agent removed them from `schema.prisma` (valid), but writing the drop migration was blocked by the permission classifier, so the schema edit was reverted. **Nothing is dropped; repo and DB unchanged.** If the user creates the migration themselves, the same change must also update UAT-SAFE-011 in `scripts/validate-e2e-uat-go-live-controls.mjs`, `scripts/test/uat-result-contract.selftest.mjs`, and `scripts/mongo-to-sqlserver/registry.ts` (see map section 4.2). The user pasted a SQL Server `sa` password in chat; the agent did not use it or store it. Recommend rotating it.
**Update, later same day: drop done.** The user confirmed the scope again. Migration `20260930090000_drop_unused_tables` removes the 5 models; it throws if any table has rows. It was applied to local `MaintainProDev` with `npm run db:migrate:deploy` (guard passed, so the tables were empty), and `db:migrate:status` is up to date (26 migrations). `migrate diff` DB→schema shows no mention of the 5 tables. The remaining drift is older: default-constraint names and NVARCHAR/DECIMAL bounds from the hardening migrations. It was not touched. UAT-SAFE-011 and `uat-result-contract.selftest.mjs` now check `UatEvidenceClass.FORMAL_BUSINESS_UAT` in `prisma-enums.ts`; the selftest had been failing before this change. Both pass, with 12/12 controls. `RepairWarranty` was removed from the Mongo registry.
Results: API typecheck pass. Full API jest has 218 suites passed and 4 failed (5 tests), all `this.prisma.workOrder.count is not a function` in `assertAssignedExecutor`. That comes from earlier Phase 07 commit `3cc8d649`, whose older test mocks lack `workOrder.count`; it is not from the drop. The failing suites are `work-orders-status-transition`, `work-orders-approval`, `work-orders-governance`, and `work-order-d2-core`. Web typecheck fails on `"unassigned"` / `"open-load"` missing from `WorkOrderQueueKey` in `apps/web/lib/work-order-queues-api.ts`, which was already committed (Phase 04/05, `5f393d65`). **Next action for Phase 07:** add `count` to those work-order mocks and add the two queue keys to the web type.

Done this pass: My Jobs view counts are the assigned totals, not the filtered list. Job links go to `/maintenance/jobs?wo=`. A technician or mechanic who starts, holds, or completes a job must be the assignee (`technicianId` or a non-removed assignee linked to the user). Admins and managers are not restricted that way. `my-jobs-view.spec.ts` and `work-order-lifecycle-phase06.spec.ts` passed (11 tests). `work-order-create-rbac.spec.ts` passed 7/7 after restoring `pendingQuantity`.

Phase 01 regression found during Phase 07, then fixed here: overlapping refresh used a token that had just been rotated, and the API revoked the whole refresh family (`REFRESH_TOKEN_REUSED` at 08:53:39 IST). A replay inside 15 seconds now issues a new token in the same family and does not revoke it. A replay after 15 seconds, or one whose successor is already revoked, still revokes the family. `auth-refresh-replay.spec.ts` 3/3. Redis being down did not cause the logout.

After the user signed in as `superadmin@maintainpro.local`, reload of `/work-orders/my` kept the session (`/auth/me` 200). Navigation to `/maintenance` and back to `/work-orders/my` stayed authenticated. My Jobs showed Active 0 because that admin has no assignments. Disposable execution UAT is still open. Evidence upload stays BLOCKED / NOT VERIFIED. Do not start Phase 08.

Live Map retirement is recorded for Phase 11 only. Do not change Fleet code until that phase.

Phase 05: `/work-orders?queue=unassigned` resolves to `/maintenance/jobs?queue=unassigned`. Technician list of my-tasks returned 200 with total 3. Technician create returned 403. Cleaner list returned 403. Admin open-load total was 24 before a later login was rate-limited (429). Queue view no longer prints a second count strip.

Phase 06: machinery, service, and vehicle routes all render the same board with `jobDomain`. Open-load lists previously matched the dashboard: 15, 3, and 6. A fresh signed-in browser pass was not repeated because the dashboard session had expired and the admin login was then rate-limited. No schema migration. No permission grant.

Phase 04 evidence: `unassigned` queue list total 19 while signed in as the seeded admin. API open-load 24, machinery 15, service 3, vehicle 6. `tech@maintainpro.local` dashboard 200 with inventory and approvals hidden; `cleaner@maintainpro.local` 403; `manager@maintainpro.local` 200. A later browser load of `/maintenance` redirected to login because the session had expired; the password was not entered. The dashboard request does not call readiness, so the Redis refusal does not hold those counts. No schema migration. No permission grant.

1. `feature/phase-03-action-center` contains Phase 01 through `4cf25f20` and `6f5dd56f`, layout `ae7f84dd`, Phase 02 `088d3cec`, plus unmerged `ci/jest-heap-oom`. Do not merge it directly into main and do not push it only to refresh hosting CI.
2. Legacy raw `TenantInvitation` rows were not rewritten. New invitations store a hash. Vercel, Cloudflare, Netlify, and MinIO stay under release readiness.
3. Phase 03 evidence is in `PRODUCT_FINALIZATION_LEDGER.md` section D. Web `lib/__tests__/action-center.test.ts` 24/24. API `action-center.spec.ts` and `work-order-queues.spec.ts` together 22/22. Browser, signed in as the seeded admin: overdue queue selected with 5 table rows; high-priority queue selected with 2 High rows and badge 2 (a concurrent summary can time out at 2.5s and flash 0, then recover); search "inventory" left only Inventory & procurement; facility zero card linked to `/facilities/reports`; `/dashboard` and `/workspace` landed on `/action-center`; document did not overflow at 390, 820, or 1440. No schema change. No permissions granted. Technicians cannot open the tenant-wide high-priority queue.
