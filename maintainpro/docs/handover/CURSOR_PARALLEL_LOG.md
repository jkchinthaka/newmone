# Cursor parallel log

## 2026-10-22 — production local evidence disk

- Branch `fix/evidence-local-disk`; base `origin/develop` = `658ae0c2609fa50566925c277784f830e63650fe`.
- Isolated worktree: `C:/Users/chint/OneDrive/Pictures/newmone/maintainpro/.evidence-local-disk`; app in `maintainpro/`.
- Owner explicitly authorized this new branch/task after the previous session stopped on the original checkout's handover mismatch. AI_SESSION_HANDOVER.md is excluded by the current task and is untouched.
- Implemented opt-in production local storage, private absolute-root validation, write/delete + capacity readiness probes, safe UUID/MIME object layout, traversal/junction checks, streaming/provider size cap, signature checks. Existing terminal locks and idempotency preserved; SHA-256 added after review found it absent from the baseline.
- Ops runbook and backup mirror updated; upload-path inventory records asset-document and inspection follow-ups explicitly.
- Tests so far: API tsc 0 after private dependency correction; web tsc 0; 8 targeted Jest suites / 57 tests passed; tenant audit unapproved 0; RBAC 971 routes / violations 0. Initial env-test fixture failed on unrelated default mock integrations; fixed fixture to disabled ERP/billing, rerun passed. Initial API tsc used stale shared generated Prisma types; copied an existing current generated client into this worktree's ignored node_modules only. No schema change, migration, regeneration of shared client or database access.
- Remaining: final checks after last safety additions, independent qa-reviewer, commit/push branch, PR to develop (do not merge).
- No stack started, no listeners changed, no production server configuration changed. Excluded files untouched. No merge, tag, force-push, or main push.

Review correction: the baseline had byte equality checks, not SHA-256. This change adds SHA-256 sidecars for new files and verifies them on confirmation/download via provider reads. Legacy `evidence/` keys without a checksum remain readable; no automatic rewrite/backfill. Sidecars must be backed up and restored with content. Checksums detect byte corruption, not a malicious service account rewriting both files. No excluded schema change is needed.

Final verification: independent qa-reviewer PASS after fixing install-root detection without .git. Targeted Jest: 11 suites / 77 tests PASS (including production env opt-in, path rules, write failure, low disk warning, byte round-trip, checksum corruption, closed/cancelled 400, tenant download 404, health/deployment regressions). API and web tsc exit 0; tenant audit unapproved 0; RBAC 971 routes / violations 0. Backup PowerShell parse errors 0; backup/restore not executed. No database tests, Docker or live production deployment. No temporary 3060/3061 listeners found. Next: commit and push feature branch, open non-draft PR to develop, do not merge.

Delivery: implementation committed as `f7f75f14` and pushed only to `origin/fix/evidence-local-disk`. Non-draft PR https://github.com/jkchinthaka/newmone/pull/128 targets `develop`; no merge or auto-merge requested. Independent QA PASS and local gates recorded above; GitHub CI results are not claimed. This log-only checkpoint records delivery. Exact next action: owner reviews PR #128 and schedules production configuration/deployment separately. Production server and existing stacks remain unchanged.

## 2026-10-22 — asset documents and inspection evidence on the private disk

fix/asset-inspection-storage | DONE | fix/asset-inspection-storage | 3e2cba16 | https://github.com/jkchinthaka/newmone/pull/132 | API tsc 0; web tsc 0; web unit 367/0; Jest asset-inspection-storage 8 plus related evidence/planning 70; tenant unapproved 0; RBAC 972/0 | Stacked on #128 because that PR is still open. Local configured storage uses the work-order provider for new asset documents and inspection evidence. Non-local behaviour and existing records stay readable. No schema change, no database writes, no Docker, 3040/3041 untouched. Review export: docs/handover/review/asset-inspection-storage.md.
Access Studio files were not edited. This branch is `fix/grant-script-prod` from `origin/develop` `658ae0c2`.

## Production grant script

- `scripts/ops/grant-v103-permissions.ts` dry-runs unless `--apply` is passed.
- `--apply` requires `--confirm-database=` to equal the database name in `DATABASE_URL`.
- The database name `nelna` is refused before a client is opened, including dry-run.
- The script prints the planned KEEP and GRANT lines.
- Guard tests: `scripts/ops/grant-v103-guard.test.ts`, 4 passed.
- `docs/handover/GO_LIVE_RUNBOOK.md` post-deploy steps match that command.

API and web source were not changed. The guard test does not open a database.
Access Studio files were not edited. This branch is `docs/refresh-status` from `origin/develop` `658ae0c2`.

## Status documents

- `GO_LIVE_CHECKLIST.md`, `MAINTAINPRO_V1_MASTER_STATUS.md`, `PRODUCT_FINALIZATION_LEDGER.md`, and `DEPLOYMENT_READINESS_CHECKLIST.md` are marked historical and point at `docs/handover/FINAL_HANDOVER_2026-10-21.md`.
- `GO_LIVE_RUNBOOK.md` local service examples use API 3040 and web 3041, matching the IIS rewrite that was already on 3041.
- `DEPLOYMENT_RUNBOOK.md` keeps Docker `web:3001` as the container address and states the local Windows services are 3040 and 3041.
- The missing `FINAL_HANDOVER_2026-10-19.md` pointer in `CURSOR_MASTER_PROGRESS.md` now points at the 2026-10-21 handover. `docs/AI_SESSION_HANDOVER.md` still names the missing file and was left unchanged.
- `BACKLOG.md` marks My Jobs SQL pagination, assign retry, and closed-work-order evidence confirmation as fixed by pull request #115. The deferred audit outbox stays open.

No application source changed. No database was opened.
Access Studio files were not edited. This branch is `fix/broken-links` from `origin/develop` `658ae0c2`.

## Broken links

- Manager home KPI, PM compliance, and maintenance cost cards now open `/reports/operations` (PM keeps `?search=preventive`). `performance` and `financials` are not retained reports.
- The driver intelligence dashboard Reports link opens `/reports/operations`.
- Register asset opens the asset register drawer at `/assets?asset=<id>`.
- Asset tag CSV, XLSX, and QR downloads use `/api/backend/...`. The BFF treats CSV and spreadsheet responses as bytes, and the template responses set `Content-Disposition`.
- `apps/web/lib/__tests__/internal-routes.test.ts` checks that every role-home and navigation href matches an app page, and that role home does not link a removed report slug.

Gates: web `tsc --noEmit` exit 0. Web unit 369 passed, 0 failed. API `tsc --noEmit` exit 0. Jest `reporting-kpis-phase13.spec.ts` filtered to "MANAGER report cards": 1 passed. Database `maintainpro_e2e_cursor` was set for that Jest process and was not required by the test. `nelna` and `MaintainProDev` were not used.

fix/maintenance-cost-link | DONE | fix/maintenance-cost-link | ab89fa34 | 134 | API tsc 0; web tsc 0; web unit 371/0; Jest reporting-kpis-phase13 98; tenant 0; RBAC 971/0 | Stacked on #129. Maintenance Cost opens /maintenance/jobs. Hidden when the role cannot open work-order insights. Browser not opened. 3040/3041 untouched.
fix/meter-readings-paging | DONE | fix/meter-readings-paging | c6f2a4e0 | https://github.com/jkchinthaka/newmone/pull/133 | API tsc 0; web tsc 0; web unit 368/0; Jest meter-readings-paging + utilities-tenant-isolation 14; tenant 0; RBAC 972/0 | Branched from origin/develop. Optional mine/days/take on GET /utilities/readings. Latest reading per meter. Page no longer loads every reading for the selected meter. No schema change. 3040/3041 untouched. Browser not opened.
Access Studio files were not edited. Progress for this session is recorded here only.

## ui/meter-readings (pull request 127)

Worktree: `C:\Users\chint\AppData\Local\MaintainPro\worktrees\meter-readings`. Branch `ui/meter-readings` from `origin/develop` `658ae0c2`.

- The last-7 sparkline is an SVG with intrinsic width 280 and height 40. It is omitted when fewer than two finite points exist, and the record view also waits until history is ready.
- `sparklineBox` is covered by `apps/web/lib/__tests__/meter-readings-display.test.ts`.
- `screenshot-preview.tsx` moved from `apps/web/components/utilities/meter-readings/` to `scripts/fixtures/`. `scripts/meter-readings-screenshots.mjs` bundles that fixture.
- In-shell screenshots for admin and technician at 390 and 1440 (search, record, warning) are in `docs/handover/ui-redesign/meter-readings/`. The sparkline element measured 280×40. Temporary API `127.0.0.1:3060` and web `127.0.0.1:3061` used database `maintainpro_e2e_cursor` with Windows integrated authentication, then the processes were stopped. `nelna` and `MaintainProDev` were not used.

Gates: web `tsc --noEmit` exit 0. Web unit 371 passed, 0 failed. API source was not changed. The independent qa-reviewer could not start because of an unpaid Cursor invoice.

## #133 follow-up (Claude, 2026-10-22)
- Merged `ui/meter-readings` (#127) into this branch; the #127 redesign (search, record, warning, sparkline, avg per day) is kept. Merge #127 first.
- Record view loads the selected meter's own readings for all users with `GET /utilities/meters/:id/readings?take=50` (no `take` = unchanged response; 1–50 validated). Previous reading, avg per day and the last-7 sparkline come from that list.
- "My recent readings" uses `GET /utilities/readings?mine=true&days=7&take=50`; recent-meter cards use `GET /utilities/meters/latest-readings`. The page no longer loads every tenant reading.
- The meter details "Readings" row shows "50+ saved" when the bounded list is full.
- `mine` still matches `[by:<userId>]` in notes. A real `createdById` column on MeterReading would be more reliable (no schema change in this PR).
- Gates (cloud checkout): API tsc 0, web tsc 0, web unit 372/372, utilities/meter Jest 4 suites 26/26. Browser and DB tests not run here.
test/cleanup-specs | DONE | test/cleanup-specs | 84bee67a | 135 | API tsc 0; web tsc 0; web unit 367/0; Jest company-requester 1, nav-admin 5, inventory-mongo skipped 10; tenant 0; RBAC 971/0 | Save-mapping e2e not re-run: spec not in git, ports 3052/3053 already in use. 3040/3041 untouched. Historical 6/12 left as open items. Pull request https://github.com/jkchinthaka/newmone/pull/135.
