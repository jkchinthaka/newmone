# test/cleanup-specs

Branched from `origin/develop`. Not stacked on #128 or #129.

`company-requester.integration.spec.ts` now deletes the requests, audit rows, users, department-requester roles, and `req-iso-*` tenant that the spec creates. Earlier leftovers of that same fixture shape on `maintainpro_e2e_wo_verify` were removed by the same cleanup. The seeded default tenant is not deleted. A department manager pointer and request-history actor are cleared only when they point at one of those fixture users.

`nav-admin-remediation.integration.spec.ts` already called `deleteDisposableTenants` for the two tenants it creates. The afterAll now skips blank ids. A follow-up count showed no `nav-admin-*` or `nav-other-*` tenants left.

`inventory-disposable-mongo.spec.ts` deletes the tenant's stock movements, idempotency rows, balances, parts, warehouses, and audit rows before the tenant. The suite was skipped: `DISPOSABLE_MONGO_URL` was not set.

Save-mapping e2e was not re-run. The spec is not in git (it exists only as untracked files in the golive-ops worktree). Ports 3052 and 3053 were already listening for other worktrees, so a temporary stack was not started. Ports 3040 and 3041 were not used. Historical 2026-10-20 result remains 6/12. Those failures were not treated as product fixes: manager storageState returned 403 on work-order create, assign, and cancel; complete, asset create, and user create returned 201 where that older spec expected 403.

Gates: API tsc 0. Web tsc 0. Web unit 367 passed. Jest company-requester 1 passed and nav-admin 5 passed on `maintainpro_e2e_wo_verify` with Windows integrated auth. Inventory mongo 10 skipped. Tenant audit unapproved 0. RBAC 971 routes, violations 0. qa-reviewer was not run.
