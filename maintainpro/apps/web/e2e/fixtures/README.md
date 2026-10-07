# QA-E2E fixtures

Automated data created by Playwright QA must use the `QA-E2E-` prefix
(for example `QA-E2E-WO-*`, `QA-E2E-REQ-*`, `QA-E2E-PM-*`).

Credentials come from `maintainpro/.env.e2e` (never commit). Auth storage
state is written to `apps/web/playwright/.auth/*.json` by `e2e/auth.setup.ts`.

Do not delete production-like records from cleanup helpers.
