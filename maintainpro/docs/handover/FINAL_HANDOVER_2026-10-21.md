# MaintainPro handover — 2026-10-21

This note is for the server team and the next developer. It does not assume the previous owner or an assistant is available. No passwords, tokens, or connection strings belong in this file or in git.

## 1. Status

The go-live release is tag **`v1.0.3`** on `main`. Visible login roles are SUPER_ADMIN, ADMIN, MANAGER, TECHNICIAN, SECURITY_OFFICER, and INVENTORY_KEEPER. Any of those roles can raise a maintenance request. A manager or admin approves it and assigns the approved open work order in one step. The technician starts, stores before and after photos, and marks complete. The manager verifies and closes. A technician cannot verify their own job. **`v1.0.0-golive` (`f0eba613`), `v1.0.1-golive` (`a1e80ed8`), and `v1.0.2-golive` stay in place and are not the current go-live release.** Do not deploy them.

The runbook and master-data note for this release are `maintainpro/docs/handover/GO_LIVE_RUNBOOK.md` and `GO_LIVE_MASTER_DATA.md` on `v1.0.3`. The flow note is `WO_FLOW_V103.md`.

## 2. Server and IT checklist

Do these in order on tag `v1.0.3`. Steps are in `maintainpro/docs/handover/GO_LIVE_RUNBOOK.md` and `GO_LIVE_MASTER_DATA.md`. Production web is `next start`. Never `next dev`.

1. **Server.** Runbook §1. Windows host, SQL Server Express, Node, and the release checkout.
2. **IIS ARR and `X-Real-IP`.** Runbook §12. The proxy in front of Next.js sets `X-Real-IP` to `{REMOTE_ADDR}` (one client address). Do not copy `X-Forwarded-For`. ARR’s forwarded-for option does not count. Allow server variable `HTTP_X_REAL_IP`. Same text is in `DEPLOYMENT_RUNBOOK.md` on that branch.
3. **Production `.env` (on the server, not in git).**
   - New JWT material: `JWT_SECRET`, or both `JWT_ACCESS_SECRET` and `JWT_REFRESH_SECRET`. Generate them on the server. Do not reuse a dev secret.
   - Database login is **not `sa`**. Use Windows auth or a dedicated SQL login that can use only the production database.
   - `STORAGE_LOCAL_ROOT`: directory for local uploads (the validated name; it is not `STORAGE_LOCAL_DIR`).
   - Decide modes before boot. Production rejects `mock` unless `ALLOW_MOCK_IN_PRODUCTION=true`.
     - `ERP_MODE`: `disabled`, `mock`, `sandbox`, `live` (default `mock`). `live` needs `ERP_API_URL` and `ERP_API_KEY`. `sandbox` needs `ERP_BASE_URL` and `ERP_API_KEY`.
     - `SMS_MODE`: `disabled`, `mock`, `live` (default `disabled`). `live` needs `SMS_API_URL`, `SMS_API_KEY`, `SMS_SENDER_ID`.
     - `PUSH_MODE`: `disabled`, `mock`, `live` (default `disabled`). `live` needs `PUSH_PROVIDER_API_URL` and `PUSH_PROVIDER_API_KEY`.
4. **Deploy.** Runbook §2, from `maintainpro/`: `npm ci`, then `npx prisma generate --schema ./prisma/schema.prisma`, then `node ./scripts/phase15-patch-prisma-enums.mjs`, `node ./scripts/phase15-patch-prisma-types.mjs`, `node ./scripts/phase15-loosen-types.mjs`, then `npm run build`, then `npx next start` in `apps/web`. Migrate with runbook §3. Seed with §4 only after the seed password is in a file outside git.
5. **Login burst.** Runbook §13. Eight logins in 60 seconds from distinct client addresses. Expect **0 × HTTP 429**. Eight logins that all show up as `127.0.0.1` mean `X-Real-IP` is not set. One address is still capped at 5 login/refresh requests per minute.
6. **Backup and a restore test.** Runbook §14. Express has no SQL Agent and a **10 GB per-database** cap. Schedule `scripts/ops/backup-maintainpro.ps1` with `schtasks` (Windows auth, `sqlcmd -E -C`). Restore one backup onto a **scratch** database and run `RESTORE VERIFYONLY`. Do not restore over production, and do not use `MaintainProDev` or `nelna` as that scratch target.
7. **Users and master data.** `GO_LIVE_MASTER_DATA.md`. Bulk import is only asset, department, job-code, supplier, and vehicle (`/admin/bulk-imports`). Spare parts: `/inventory/import`. Asset tags: `/admin/asset-tags`. Everything else is the admin screen in that note, or manual.
8. **Every week.** `sqlcmd -E -C` data-file size for the production database, plus free disk on the backup volume. Alert as the database approaches 10 GB.

Rollback is runbook §9: previous build, and a database restore only if a migration must be undone.

## 3. Next developer

| Item | Estimate |
| --- | --- |
| My Jobs SQL pagination (the list still pages in memory; see `docs/handover/BACKLOG.md`) | 1 day |
| Audit outbox so a crash cannot drop the automatic audit row (`BACKLOG.md`) | 1–2 days |
| Performance baseline | 2–3 days |
| Database index, orphan, and Float review | 1 day |
| QA-028 (`QA-FRESH-MAINT-028`, schedule board; was deferred for an owner decision) | 2–3 days |
| OneDrive commit `99ec9d5b` on `fix/ux-confirmed-defects` (UX defects). Review that commit and open a pull request. Do not add the untracked working tree with it. | 0.5 day |
| Low UI findings (6 Low rows from the 2026-10-20 REQUESTER and FINANCE route sweep) | 0.5–1 day |
| Branch cleanup down to `main`, `develop`, and `qa` after each pull request is merged or dropped | — |
| Access & Form Studio. Design only: `docs/handover/ACCESS_FORM_STUDIO_DESIGN.md`. No schema until the owner orders the slices. | 7–9 weeks |
| Unused Prisma models. Confirm each model has no caller, then remove it in its own pull request. | — |
| Prisma upgrade. Not before a stable release. | — |

Ship tag `v1.0.3`. Keep `v1.0.0-golive`, `v1.0.1-golive`, and `v1.0.2-golive`. Do not move those tags.

## 4. Run and test

Local run: `docs/handover/RUNNING_LOCALLY.md`. Coding uses `npm run dev` from `maintainpro/`. QA and UAT use `npm run start:qa`, not the file watcher.

| Tests | Where | Command |
| --- | --- | --- |
| API Jest | `maintainpro/apps/api/test/*.spec.ts` | from `apps/api`: `npx jest --config ./jest.config.cjs --maxWorkers=2` |
| Web unit | `maintainpro/apps/web/lib/__tests__` | from `apps/web`: `npm test` |
| Playwright | `maintainpro/apps/web/e2e` and `e2e-real` | from `apps/web`: `npm run test:e2e`; full stack: `npm run test:e2e:full-stack` |

Disposable Jest databases must be named `maintainpro_e2e_*`. Never point tests at `MaintainProDev`, `nelna`, or production.
