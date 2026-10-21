# Backlog

Recorded 2026-10-19. Neither item was coded in Block D. Each needs more than a one-hour safe change.

## My Jobs SQL pagination

Done on develop. `listMyJobs` counts in SQL and pages with `skip` / `take`. The old 500-row in-memory cap is gone.

## Deferred audit outbox

`PrismaService.$transaction` writes automatic audit rows after the business transaction commits. A crash or a failed `writeAudit` only logs a warning. The business change stays and the automatic audit row is missing. Explicit `auditLog.create` calls inside the business transaction are not part of this gap.

Plan:

1. Add an audit-outbox table written in the same transaction as the business change.
2. Flush that outbox after commit. On failure, leave the row pending.
3. Retry pending rows from a worker with a bounded attempt count. Do not drop a row on the first failure.
4. Test: forced flush failure still leaves a pending outbox row, and a retry writes the audit once.

fleet 404: not reproduced

Tenant switcher UI removed for phase 1. Restore from git history when a second company goes live.
Restore archive/fix--ux-confirmed-defects and archive/test--playwright-qa-suite into develop after go-live (conflict review needed).

Cleanup: `apps/api/test/nav-admin-remediation.integration.spec.ts` creates leftover "Nav admin" / "Nav other" tenants (`nav-admin-${stamp}` / `nav-other-${stamp}`) and does not delete them. Delete those fixtures after the spec, on disposable `maintainpro_e2e_*` databases only.

SQL deadlock/write conflict in WorkOrdersService.assign → auditLog.create seen once in Jest (maintenance-flow.integration). Add retry on SQL error 1205/3960 for audit writes; check under concurrent assign.

`confirmWorkOrderUpload` has no closed/cancelled lock (upload started before close, confirmed after). Create, upload-request, and byte-store reject CLOSED and CANCELLED. Confirm does not.
