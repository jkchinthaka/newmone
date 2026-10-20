# 04 Critical defect register

| ID | Severity | Status | Evidence |
| --- | --- | --- | --- |
| P0-AUTH-001 | P0 | Fixed in this branch, unit-tested | Stale JWT `SUPER_ADMIN` was trusted. `JwtStrategy.validate` now returns the current `User.role.name`. `TenantContextGuard` reloads that role before membership decisions. Demoted token test denies tenant access. Disabled account returns unauthorized. |
| P0-WO-001 | P0 | Fixed earlier on this tree, retested | Generic `updateStatus` and bulk cannot set `VERIFIED` or `CLOSED`. Dedicated verify and close remain. Governance spec 18 passed. |
| P0-WO-002 | P0 | Fixed earlier, retested | Technician and mechanic cannot cancel. Management cancel still requires a reason. |
| P0-STOCK-001 | P0 | Partial, not re-proved on SQL this session | `verified-stock-availability.ts` and `work-order-erp-stock-boundary.spec.ts` exist. Boundary spec passed. `verified-stock.integration.spec.ts` did not run: `DISPOSABLE_SQLSERVER_URL` was unset, so Jest skipped it. Live Bileeta confirmation was not executed. |
| P0-IDEM-001 | P0 | Partially resolved | `stockOut` now requires an idempotency key, rejects a reused key with a different payload, and writes the audit row in the same transaction as the outbox. `issuePartRequest` writes its audit in the same transaction as the issue. A missing key is no longer replaced with `Date.now()`. Live ERP confirmation and crash-between-commit-and-worker tests were not run. |
| P0-FINAL-001 | P0 | Fixed for content update, unit-tested | `assertClosedRecordContentEditable` blocks `CLOSED` and legacy `COMPLETED` edits unless a verifier supplies a correction reason of at least 3 characters. `CANCELLED` stays editable, matching the earlier product decision. |
| P1-CONC-001 | P1 | Fixed on generic status update | `updateStatus` now requires `expectedVersion` and writes with `updateMany` where `id` and `version` match. Missing version is 409 after business-rule checks. UI status, hold, and technician-complete payloads send `workOrder.version`. Other mutation paths can still omit version. |
| P1-JOBS-001 | P1 | Open | My Jobs still loads up to 500 rows and filters in memory (`work-order-queues.service.ts`). |
| P1-EVID-001 | P1 | Unverified | Live upload URL was not exercised. |
| P1-PM-001 | P1 | Unverified | Scheduler execution was not run. |

A current `SUPER_ADMIN` may still enter an active tenant without a membership row. That is the existing platform-admin rule, now tied to the database role. Requiring a membership row for every super-admin tenant switch needs a separate business decision.
