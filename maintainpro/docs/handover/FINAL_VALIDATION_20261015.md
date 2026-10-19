# Final validation before independent Claude QA — 2026-10-15

Validator: Claude Code CLI session (not the independent reviewer). **Not a QA verdict. Not self-approved.**
No commit, push, merge, deploy, credential change, or process restart.

## 1. Verified worktree state

| Item | Value |
| --- | --- |
| Worktree | `C:\Users\chint\AppData\Local\MaintainPro\worktrees\release-final-20261013` |
| Branch | `fix/enterprise-remediation-20261015` (checked out 2026-10-15 13:23; no upstream) |
| HEAD | `a79859dc560fa4b36dac8ec212fc2a490556ac10` (same commit as `release/maintainpro-final-consolidation-20261013`) |
| Uncommitted diff vs HEAD | 71 tracked files, +2485 / −985; 3 deletions (Action Center components); 40 untracked source/test/doc files |
| Baseline patch | `docs/handover/baseline-20261015-144850.patch` (sha256 `6a218fcb2a6e6e58ffb6435f336b5031bc6bbc3c5240dac3be039a9be61d416f`) |
| Baseline hashes | `baseline-20261015-144850.tracked.sha256` (68 files), `baseline-20261015-144850.untracked.sha256` (40 files) |
| Re-check at 15:21 | All baseline hashes match except `apps/web/tsconfig.json`. See §8. No other source file changed after the baseline. |

Not in scope and not integrated: OneDrive UX commit `99ec9d5b` (`fix/ux-confirmed-defects`). **Pending integration item.**

## 2. Gate results (disposable DB `maintainpro_e2e_final_20261015` on `localhost`, created, migrated, seeded for this run)

`MaintainProDev` and `nelna` were not used. `NODE_ENV=test`. Logs are in `docs/handover/evidence-20261015/`.

| Gate | Result |
| --- | --- |
| `npm run typecheck` (api + web) | exit 0 (re-run after the Prisma client repair in §8: exit 0) |
| `npm run lint` | exit 0 |
| Full API Jest `--runInBand` | **FAIL** — Suites 241 passed, 5 failed, 1 skipped (247). Tests 2092 passed, **12 failed**, 10 skipped (2114). |
| Disposable-SQL suites (assignment-transaction, company-requester, machine-lookup, deferred-audit-transactions, verified-stock) | 5/5 suites, 22/22 tests passed |
| Web unit (`npm run test -w @maintainpro/web`) | 275 passed, 0 failed |
| `audit:tenant` | 0 unapproved fail-open patterns |
| `audit:rbac` | violations=0, high_risk_todo=0 |
| `test:release` | exit 0 |
| `validate:e2e-no-mocks` | PASS, 27 real-stack files |
| `validate:e2e-safety` (MINIO_BUCKET unset) | 17 passed, 0 failed |
| `validate:secret-safety` | 12 passed, 0 failed |
| `validate:text-integrity` | 1 passed |
| `npm run build` | First attempt **failed** in `prisma generate` (engine DLL locked by the port-3000 API, PID 44724, this worktree). Then: shared-types + ui-components built; API `tsc -p tsconfig.build.json` exit 0; web `next build` exit 0 with `NEXT_PUBLIC_API_URL=http://127.0.0.1:3000/api` and `NEXT_DIST_DIR=.next-final-qa-20261015` (same URL style as CI). |

### Full API Jest failures (12) — all reproduce at baseline

| Suite | Tests | Cause |
| --- | --- | --- |
| `work-order-domain-d3-d5-lifecycle.integration.spec.ts` (real SQL) | 8 | `ConflictException: Work order version is required` — tests call `updateStatus` without `expectedVersion` |
| `work-orders-approval.spec.ts` | 1 | same |
| `work-order-d2-core.spec.ts` | 1 | same |
| `work-orders-status-transition.spec.ts` | 1 | same |
| `work-order-erp-stock-boundary.spec.ts` | 1 | `TypeError: Cannot read properties of undefined (reading 'create')` — the test's transaction mock has no `auditLog` after the part-request issue audit moved into the transaction |

The 11 version failures are stale tests. They also show that the new mandatory version breaks callers. See H-1 and H-2.

## 3. Playwright (release-candidate spec)

`docker info`: `failed to connect to the docker API at npipe:////./pipe/dockerDesktopLinuxEngine ... The system cannot find the file specified.` Docker was not installed or started.

Command, run twice from `apps/web`:
`npx playwright test --config playwright.full-stack.config.ts e2e-real/release-candidate.spec.ts --project=chromium-desktop`

| Run | Result |
| --- | --- |
| 1 | 6 failed — `page.goto: net::ERR_CONNECTION_REFUSED at http://127.0.0.1:18080/...`; E2E seed: `Can't reach database server at 127.0.0.1:14333` |
| 2 | identical |

**Blocker:** the full-stack config needs the Docker compose E2E stack (nginx on `127.0.0.1:18080`, SQL Server on `127.0.0.1:14333`, `.env.e2e`). None of them exist. `validate:e2e-safety` and `e2e-verify-isolation` passed inside global setup. No non-Docker path is supported: rebuilding nginx, BFF routing, and a SQL instance on 14333 by hand is the risky workaround that was ruled out. **Real-stack E2E: NOT EXECUTED.** The 12 failures above are infrastructure results, not product results.

Spec review (`e2e-real/release-candidate.spec.ts`, 6 tests):
- Real API through `/api/backend` BFF; no mocks.
- Uniqueness: the workforce test uses run id + project + worker + retry + pid + time. The work-order and request tests use the `E2E_RUN_ID` title, but they assert on the server-issued `woNumber` / `requestNumber`, so they repeat safely.
- Authorization: admin-a only, plus a cross-tenant 404 for admin-b. No technician, requester, or storekeeper role is exercised.
- Repeatability risk (Low): the request-menu test expects the new request on the first `/requests` page. It may page out after many runs on the same DB.
- Coverage gap (Medium): no test for My Jobs start, bulk status, inventory stock-out, machine search, requester access, supervisor verify, or verified stock. H-1, H-2 and H-3 would pass this spec.
- Style: the `import` on line 13 sits after a function declaration.

## 4. Audit integrity (RolePermission / UserSkill)

Code: `roles.service.ts` `syncRolePermissions` and `user-skills.util.ts` `replaceUserSkills` now run in an interactive `$transaction` and call `writeAuditTrail(tx, …)`. The audit row commits or rolls back with the business write.

Evidence on disposable SQL (`deferred-audit-transactions.spec.ts`, 10 tests passed):
- **Actor and tenant:** `actorId`, `actorEmail` and `actorRole` come from `requestContext`; `tenantId` comes from the role or user owner. The spec asserts `tenantId` and `actorId` on the rows.
- **Rollback:** "does not keep role-permission audits when the grant transaction rolls back" and the user-skill equivalent passed.
- **No duplicates:** "records one grant and one removal … without duplicates", "audits only the delta", and "audits a replaced user skill … does not duplicate it" passed.
- Seed paths (`seed.ts`) use their own sync helpers and write no audit, as intended.

Low notes:
- UserSkill replacement deletes and recreates every skill, so an unchanged skill gets a DELETE+CREATE audit pair on each save. RolePermission is delta-only.
- Calls made outside a request context get a null actor.

**Post-commit automatic audit durability (limitation, not resolved):** automatic Prisma-middleware audits inside a transaction are buffered (`prisma.service.ts`, `deferredAuditContext`) and flushed only after the transaction promise resolves.
- A crash between commit and flush loses those automatic rows.
- A flush failure is only logged with `logger.warn`, with no retry or outbox.
- Generic `createMany` stays unaudited.

Explicit `auditLog.create` / `writeAuditTrail(tx)` calls are not affected. **Residual risk is not zero.**

## 5. Remaining High / Medium findings

| ID | Sev | Finding | Evidence |
| --- | --- | --- | --- |
| H-1 | **High** | My Jobs **Start** always fails with 409. | `app/(dashboard)/work-orders/my/page.tsx:195` posts `{}` to `/work-orders/:id/start`. The controller passes `body.expectedVersion` (undefined) to `updateStatus`, which throws `Work order version is required` (`work-orders.service.ts:2376`). |
| H-2 | **High** | Every bulk status change fails per row. | `work-orders.service.ts` bulk loop (~4461) calls `updateStatus` without `expectedVersion`. The web bulk action (`work-orders-page.tsx:392`) will show "N failed: Work order version is required…". |
| H-3 | **High** | Inventory page **Stock out** always fails with 400. | `inventory-page.tsx:266` passes no `idempotencyKey`; `components/inventory/api.ts:100` forwards undefined. `inventory.service.ts:434` requires the key. |
| H-4 | **High** | Full API Jest is red (12 failures) and the real-SQL lifecycle suite cannot run. | §2. Doc 12's "38 passed" is contradicted (re-run: 37 passed, 1 failed). |
| M-1 | Medium | `/resume`, `/complete-technician` and `/hold` accept an optional version but now require it. Any client other than the work-orders page (offline replay, mobile PWA queue, scripts) will get 409. | controller 780–890 |
| M-2 | Medium | Stock-in still builds its ERP `eventId` from `Date.now()` when no key is sent, so a retry can make a second event. | `inventory.service.ts:366` |
| M-3 | Medium | Local dist-dir paths are committed into tracked `apps/web/tsconfig.json` (`.next-release-20261015`, `.next-dev-3001`), and the `.next-*` directories are not gitignored. They will ship in a commit unless removed. | tsconfig diff |
| M-4 | Medium | The release-candidate spec doesn't cover the new behaviour (§3). | |
| M-5 | Medium | The automatic-audit post-commit gap (§4). | |
| M-6 | Medium | My Jobs filtered rows are still capped at 500 in memory (P1-JOBS-001). | `work-order-queues.service.ts:703` |

## 6. Audit docs 12–15 cross-check

| Doc | Claim | Status |
| --- | --- | --- |
| 12 | Focused run: 4 suites passed, 38 passed, 0 failed | **CONTRADICTED** at baseline: 3 passed, 1 failed (`work-order-erp-stock-boundary`), 1 skipped; 37 passed, 1 failed |
| 12 | verified-stock SQL cases not executed | CONFIRMED for that run. This run executed them on disposable SQL: 2/2 passed. |
| 12 | Earlier full Jest (2044 passed) is historical | CONFIRMED historical. Current: 2092 passed, 12 failed. |
| 12 | Web unit 273 earlier | Superseded: 275 passed now |
| 12 | Playwright blocked, Docker pipe down | CONFIRMED |
| 13 | HOLD | CONFIRMED, with stronger reasons (H-1…H-4) |
| 13 | No independent QA PASS; no PR/CI | CONFIRMED |
| 13 | Live Bileeta not verified | CONFIRMED (not run) |
| 13 | Idempotency not mandatory everywhere | CONFIRMED (M-2) |
| 13 | My Jobs > 500 in memory | CONFIRMED |
| 13 | "Other work-order writes can still omit version" | **CONTRADICTED** in effect: every caller that reaches `updateStatus` must send it, and two of them don't (H-1, H-2) |
| 13 | UX commit not integrated | CONFIRMED |
| 13 | Full Jest and web typecheck not re-run | Now re-run: typecheck 0, Jest red |
| 14 | Stale-role JWT fixed (`jwt.strategy.ts`, `tenant-context.guard.ts`) | CONFIRMED in code; `jwt-strategy` and `tenant-context-fail-closed` specs pass |
| 14 | Status update requires version and uses CAS `updateMany` | CONFIRMED (`work-orders.service.ts:2376-2385`) |
| 14 | Page sends version on status, hold, tech-complete | CONFIRMED for `work-orders-page.tsx`; **not** for My Jobs start or bulk |
| 14 | Closed/legacy-completed edits need verifier + reason | CONFIRMED in code (`assertClosedRecordContentEditable`) |
| 14 | Stock issue requires `Idempotency-Key` | CONFIRMED (API). The web caller doesn't send it (H-3). |
| 14 | No "Stock deducted" text | CONFIRMED (grep: no match in api/web) |
| 14 | Rejects CLOSED without override | CONFIRMED (`inventory.service.ts:472`, also COMPLETED and CANCELLED) |
| 14 | Audit stored with outbox | CONFIRMED by code (`$transaction` at 484). Not separately tested in this run. |
| 14 | Part-request issue audit in transaction | CONFIRMED in code. Its unit test is stale (H-4). |
| 14 | My Jobs due/id order, SQL `assignedTotal`, 500 cap | CONFIRMED (`work-order-queues.service.ts:702-772`) |
| 15 | Live Bileeta, evidence upload, PM worker, browser lifecycle on 3023, Cursor reviewer | UNVERIFIED (not exercised) |
| 15 | Disposable SQL verified-stock not executed | Superseded: executed this run, passed |
| 15 | Docker Playwright blocked | CONFIRMED |
| 15 | SUPER_ADMIN membership rule, Bileeta over-issue policy | UNVERIFIED; open business decisions |

Open items carried from doc 14 ("left open on purpose"): UX branch merge (`99ec9d5b`); My Jobs SQL pagination; mandatory idempotency across ERP; live evidence storage and PM scheduler; commit, push and PR.
HOLD reasons carried from doc 13: no independent QA PASS; no PR or CI; live Bileeta unverified; idempotency not universal; My Jobs in-memory; version not universal; UX commit not integrated.

## 7. Deleted Action Center components

`components/action-center/{action-card,action-center-page,action-section}.tsx` have no remaining imports (grep over apps/packages). `maintenance-dashboard-page.tsx` defines its own local `ActionCard`. The `/action-center` route is now a `RoleLandingRedirect`. `lib/action-center.ts` and `lib/action-center-api.ts` are kept and still used by Workspace and Morning Briefing. The web build passes.

## 8. Side effects of this validation run (disclosed)

- `npm run build` ran `prisma generate`. It rewrote `node_modules/.prisma/client/index.{js,d.ts}` at 15:09 and failed on the locked engine DLL before the phase15 patch scripts ran, which broke the enum exports. **Repaired** by running `phase15-patch-prisma-enums.mjs`, `phase15-patch-prisma-types.mjs` and `phase15-loosen-types.mjs`; typecheck went back to exit 0. The port-3000 API (PID 44724) was not restarted. Its watcher watches `src` only, and it has the old client in memory.
- `next build` added `.next-final-qa-20261015/types/**/*.ts` to `apps/web/tsconfig.json`. That line was removed. The git blob is identical to the baseline (`d0ba8822`). Only the line-ending bytes differ, so the raw sha256 no longer matches the baseline. The `.next-final-qa-20261015` directory was deleted.
- Playwright overwrote the ignored `apps/web/test-results`, `e2e-real-report` and `e2e-real-results` directories. Any earlier run artifacts there are gone.
- Disposable DB `maintainpro_e2e_final_20261015` was created for this run and dropped afterwards (see handover).
- Ports 3000, 3001 (PID 55148/55948) and 3011 were not touched.

## 9. Files reviewed

`work-orders.service.ts` (updateStatus version gate, bulk loop, issuePartRequest audit), `work-orders.controller.ts` (start, hold, resume, complete-technician), `work-order-queues.service.ts`, `inventory.controller.ts`, `inventory.service.ts`, `roles.service.ts`, `user-skills.util.ts`, `audit-trail.util.ts`, `prisma.service.ts` (deferred audit), `jwt.strategy.ts`, `deferred-audit-transactions.spec.ts`, `work-order-domain-d3-d5-lifecycle.integration.spec.ts` (gating), `e2e-real/release-candidate.spec.ts`, `e2e-real/global-setup.ts`, `e2e-real/helpers/env.ts`, `playwright.full-stack.config.ts`, `web work-orders/api.ts`, `hooks.ts`, `work-orders-page.tsx`, `work-orders/my/page.tsx`, `inventory/api.ts`, `inventory-page.tsx`, `part-requests-panel.tsx`, `action-center/page.tsx`, `maintenance-dashboard-page.tsx`, `.github/workflows/{full-stack-e2e,pr-validation,release-validation}.yml`, `package.json` (root and web), `next.config.mjs`, `tsconfig.json`, audit docs 04, 12–15. Secret scan over the full baseline patch and all 40 untracked files.

## 10. Readiness for independent Claude QA

**Not ready for a PASS-seeking review.** The reviewer can be given this exact state, but H-1 to H-4 are reproducible defects and the gate is red. Recommended order:
1. Owner decides how to fix H-1/H-2: send the version from My Jobs and bulk, or make version optional for those dedicated endpoints.
2. Fix H-3: generate an idempotency key per stock-out dialog submit.
3. Update the 5 stale suites.
4. Remove the dist-dir entries from `tsconfig.json` and ignore `.next-*`.
5. Start Docker and run the release-candidate spec twice.
6. Then request independent QA.
