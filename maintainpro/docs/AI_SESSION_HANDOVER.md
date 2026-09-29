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

**Last updated:** 2026-09-29 (Claude Code session, iteration 1)

| Item | Value |
| --- | --- |
| Current page | Maintenance Requests — list `/requests` and detail `/requests/[id]` |
| Status | **PARTIALLY VERIFIED**: code complete, all automated gates pass; browser visual/responsive check and integration into `main` pending |
| Branch | `maintainpro/finalization-iter-01` (local only, **not pushed**) |
| Branch HEAD | `7878eb56` (docs: handover protocol), on top of `89533ac0` (Requests slice); 2 commits ahead of `origin/main` @ `6264948f` |
| Uncommitted changes | only this SHA update to the handover itself, if not yet committed |
| Other worktrees | `C:/Dev/newmone-maintenance-costs` (`feature/maintenance-costs`), `C:/Dev/newmone-vendor-eligibility` (`feature/vendor-eligibility`): both already merged to main; leave alone |
| Stash | `stash@{0}` "pre-main-handover-20260929": not ours, do not pop or drop |
| Local dev stack | User runs `npm run dev` from this tree (API :3000 with `node --watch`, web :3001 `next dev`) against local SQL Server `MaintainProDev`. It hot-reloads branch changes. |

### Branch history warning

The branch was rewritten by another process during iteration 1. The reflog shows two `reset`s
after our commits, then commit `89533ac0`. Its **tree is identical** to our original commit
`124e9fc5` (verified with `git diff 124e9fc5 89533ac0` = empty), but it squashed two commits
into one under the misleading message "test(vendors): add vendorContract mocks…". It actually
contains the whole Requests slice. Original commits are still in the reflog: `9aced764`
(vendor test fix) and `124e9fc5` (requests feature). **Asked the user who did this; no answer
yet.** Do not rewrite again without the user's go-ahead. When opening the PR, use a correct
title/description (or squash-merge with the feature title).

## Completed in iteration 1

Details and defect table: `PRODUCT_FINALIZATION_LEDGER.md` §3.1. Summary:

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
| Browser visual / responsive / console check | **NOT RUN**: no browser session; agent must not type passwords |

## Known environment gotchas

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

1. Branch rewrite by an unknown process (see above): need user confirmation before pushing.
2. Browser check needs the user to sign in at `http://localhost:3001` (e.g. as the seeded manager).
3. Business decision: should TECHNICIAN / MECHANIC / DRIVER report issues? (API role list includes
   them; seed grants no request permission; nav now hides Requests from them.)

## Exact next action for the next agent

1. Run the start-of-session checks. If HEAD is no longer `89533ac0` or the tree changed, stop and
   report to the user.
2. If the user has signed in at `localhost:3001`, verify `/requests` and `/requests/<id>`:
   - desktop, then tablet ~820px and phone ~390px widths (no horizontal scroll);
   - console free of errors; network calls `GET /api/maintenance-requests?…` and `/summary` succeed;
   - counter cards filter the list; action menu closes with Escape.
   Record results here.
3. With the user's confirmation on the branch history: push `maintainpro/finalization-iter-01`
   (no force), open a PR to `main` titled "feat(requests): finalize request list and detail with
   server-driven actions" (end the body with the Claude Code attribution line), wait for CI, then merge.
   Record the merge SHA in the ledger §3.1 and here.
4. Start iteration 2: **Report issue `/requests/new`** (ledger §2 item 2) on a new branch from the
   updated `origin/main`.
