# Final handover 2026-10-19

Branch `fix/enterprise-remediation-20261015` at the release worktree. No commit. Reset of `MaintainProDev` is waiting for "OK reset".

## What changed

No product code in this pass. Docs added: this file and `SCHEMA_USAGE_AUDIT.md`.

Areas already on the branch, not re-coded here: vendor tax percent, shared schedule dates, admin user status guards, evidence, approvals inbox, and meter readings.

## Test evidence

API Jest, `NODE_ENV=test`, integrated security to `maintainpro_e2e_wo_verify` for both `DATABASE_URL` and `DISPOSABLE_SQLSERVER_URL`, `--maxWorkers=2 --silent`: 263 suites passed, 1 skipped (`inventory-disposable-mongo.spec.ts`), 2188 tests passed, 10 skipped, 0 failed, 30.3s.

Playwright chromium, workers=1, compose project `maintainpro-e2e-blockd20261019`, then `docker compose down` for that project only.

| Run | Result |
| --- | --- |
| Release candidate 1 | 6 passed |
| Release candidate 2 | 6 passed |
| Screen smoke | 6 passed (due date, tax 18%, evidence, approvals inbox, meter readings, admin user status) |

| Gate | Result |
| --- | --- |
| API `tsc --noEmit` | exit 0 |
| Web `tsc --noEmit` | exit 0 |
| Web unit | 330 passed, 0 failed |
| `audit:tenant` | pass, unapproved 0 |
| `audit:rbac` | pass |
| `test:release` | fail `EXP-SAFE-004`: `reports.service.ts` does not reference `neutralizeSpreadsheetValue`. Later selftests in that script did not run. |
| `validate:*` except image secrets | pass |
| `validate:image-secrets` | exit 2, the script requires an image argument |
| `npm run build` in API | exit 1. `prisma generate` could not replace `query_engine-windows.dll.node` while the API on port 3040 has it open. |
| `tsc -p tsconfig.build.json` after the existing Prisma enum patch scripts | exit 0 |
| Web `next build` with `NEXT_DIST_DIR=.next-blockd-20261019` and `NEXT_PUBLIC_API_URL=http://127.0.0.1:3040/api` | exit 0. A run without that public URL failed prerender. Tracked `apps/web/tsconfig.json` stayed clean. |
| Diff secret scan | no private key, cloud key, password assignment, or SQL connection string in the unstaged diff |

## DEFECT_STATUS

58 FIXED. 1 DEFERRED: `QA-FRESH-MAINT-028` (schedule board, owner decision).

## BACKLOG

See `docs/handover/BACKLOG.md`.

- My Jobs still loads at most 500 rows and pages in memory.
- Deferred audit still writes after commit and can miss the audit row.

## Database

Backup verified: `C:\MaintainProData\backups\MaintainProDev_before_reset_20261019.bak` (72,474,624 bytes). `RESTORE VERIFYONLY` reported the backup set valid.

Reset was not run. Waiting for "OK reset".

Planned after that reply:

- Drop and recreate `MaintainProDev`, then `prisma migrate deploy` (30 migration folders) until `migrate status` is up to date with 0 drift.
- Drop `maintainpro_e2e_fixround_20261015` and `maintainpro_e2e_machsearch`.
- Keep `maintainpro_e2e_wo_verify`.
- Do not touch `nelna`.
- Minimal idempotent seed only: tenant "Nelna Group", RBAC catalog, one SUPER_ADMIN and one ADMIN, password only in gitignored `.seed-password.local`, default tax 18, and existing maintenance category, SLA, reason, and fault-code seeds. No demo work orders, assets, extra users, or audit rows. `seed.ts` today still writes those demo rows, so it must be gated before it runs.
- Do not edit the canonical `.env`.

To point the app at the clean database yourself, set this line:

`DATABASE_URL=sqlserver://localhost:1433;database=MaintainProDev;integratedSecurity=true;trustServerCertificate=true;encrypt=true`

## Manual UAT by role

- Technician: My Jobs, start and hold a job, add a meter reading, upload a before photo, and confirm Admin Users stays closed.
- Supervisor or manager: plan and assign, return a job for correction, and approve one inbox row that you did not request.
- Inventory keeper: issue a part on an approved request and confirm the ERP quantity does not change.
- Admin: set the default tax rate, create a vendor quotation at 18%, deactivate a non-admin user, and confirm the last admin cannot be removed.
- Security officer: open the fleet gate and confirm work-order queues stay denied.
- Viewer: open reports and confirm create, approve, and user-status actions are absent.

## Phone QR

1. On the phone, open this app's login page and sign in.
2. Open Meter Readings and tap Scan QR, or open a work order, Evidence, and tap Scan with camera. Allow the camera.
3. Point the camera at the printed asset tag until the code fills the scanned id.
4. Tap Verify scan when you are on a work order.
5. Expected: the tag resolves to that asset in your tenant. A tag from another tenant, or a tag that does not match the work order asset, does not open that other asset.

## Commit plan

Do not run this until you approve. Base the pull request on `release/maintainpro-final-consolidation-20261013`, not `main`.

1. `fix: compute vendor invoice tax from the tenant percent`
2. `fix: use shared date fields for work order schedules`
3. `fix: guard admin user status, invite, and role changes`
4. `fix: keep evidence, approvals, and meter readings in the maintenance flow`
5. `test: keep the assignment rollback constraint on one work order`
6. `docs: record Block D evidence, backlog, and handover`

Suggested PR title: `Release candidate remediation for tax, dates, evidence, and approvals`.
