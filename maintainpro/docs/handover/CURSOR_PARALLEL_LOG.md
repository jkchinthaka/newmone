# Cursor parallel log

Access Studio files were not edited. This branch is `fix/grant-script-prod` from `origin/develop` `658ae0c2`.

## Production grant script

- `scripts/ops/grant-v103-permissions.ts` dry-runs unless `--apply` is passed.
- `--apply` requires `--confirm-database=` to equal the database name in `DATABASE_URL`.
- The database name `nelna` is refused before a client is opened, including dry-run.
- The script prints the planned KEEP and GRANT lines.
- Guard tests: `scripts/ops/grant-v103-guard.test.ts`, 4 passed.
- `docs/handover/GO_LIVE_RUNBOOK.md` post-deploy steps match that command.

API and web source were not changed. The guard test does not open a database.
