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

**Last updated:** 2026-09-29 ~19:15 IST. `/splash` is locally verified on `feature/phase-01-login`. The next CONTINUE is the Phase 01 cross-page audit, not Phase 02.

Phase 00 compared the tracking files with `git fetch` and the tree. Requests iteration 01 is **already on `origin/main` at `52311b8f`**. It must not be reimplemented. Active local phase is now 01.

| Item | Value |
| --- | --- |
| Current phase | 01 Login, session, invitation onboarding |
| Current page | `/splash` — LOCAL DEVELOPMENT COMPLETE |
| Next page | Phase 01 cross-page audit — do not start Phase 02 until that audit is done |
| Local Git | `feature/phase-01-login`. Still based on unmerged `ci/jest-heap-oom` at `4c41d269`. Ancestors include `04dc017c` and `8e999fde`. Do not merge this branch straight to main. Not pushed. |
| `origin/main` | `52311b8f`. Contains iteration 01 (`89533ac0`) + handover docs (`7878eb56`, `52311b8f`). **Arrived by direct push, not a PR.** |
| Working branch | `ci/jest-heap-oom` (pushed, tracks `origin/ci/jest-heap-oom`), PR **#62** → `main`, not merged |
| Old branch | `maintainpro/finalization-iter-01` @ `52311b8f` = `main`; upstream unset; can be deleted later |
| Uncommitted changes | tracking files only, until the local docs commit that follows `8e999fde` |
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

The next CONTINUE runs the Phase 01 cross-page audit across login, forgot-password, accept-invite, register, and splash. Do not start Phase 02 during that pass.

1. This branch still contains unmerged `ci/jest-heap-oom` at `4c41d269` and `0e5ec73c`. Do not merge it directly into main.
2. Vercel, Cloudflare, and Netlify stay under release readiness.
