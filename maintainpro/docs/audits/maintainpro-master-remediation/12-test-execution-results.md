# 12 Test execution results

Commands were run in `maintainpro/apps/api` of the release worktree.

## This session

`npx jest --config ./jest.config.cjs --runInBand --forceExit test/work-orders-governance.spec.ts test/work-order-erp-stock-boundary.spec.ts test/verified-stock.integration.spec.ts test/jwt-strategy.spec.ts test/tenant-context-fail-closed.spec.ts`

Result: 4 suites reported passed, 38 tests passed, 0 failed.

`verified-stock.integration.spec.ts` uses `describe.skip` unless `DISPOSABLE_SQLSERVER_URL` names a `maintainpro_e2e_*` database. That variable was not set. Those SQL cases are **NOT EXECUTED**, even though Jest marks the file passed.

Earlier the same day, with `DATABASE_URL` rewritten to `maintainpro_e2e_wo_verify`: full API Jest 2044 passed, 27 skipped, 3 suites skipped. That run was before the stale-role and required-version changes. It is historical and does not cover this diff.

Web unit suite earlier today: 273 passed. That run was also before the status payload change.

## Not executed for this diff

- Full API Jest after the version requirement.
- Web unit tests and `tsc` after the type change.
- Playwright and browser lifecycle. Docker engine pipe was down. Port 3023 proxies to the MaintainProDev API on port 3000.
- Live Bileeta, evidence upload, and preventive-maintenance worker.
- Independent QA. The last reviewer attempt stopped on an unpaid Cursor invoice.
