# Backlog

Recorded 2026-10-19. Refreshed 2026-10-22. Items fixed by pull request #115 are marked below. The deferred audit outbox is still open.

## My Jobs SQL pagination

Fixed by pull request #115 (`6d51f2b9`). `listMyJobs` pages in SQL with the same view filters and ordering, and the 500-row cap is gone.

## My Jobs SQL pagination (original note)

`listMyJobs` in `apps/api/src/modules/work-orders/work-order-queues.service.ts` loads at most 500 assigned rows, then filters, counts, and pages in memory. `assignedTotal` is a real SQL count. `capped` is true when the assignment count is above 500. Tab counts and `total` describe the capped set, so a technician with more than 500 jobs can miss rows and see short counts.

Plan:

1. Push view, status, priority, due, and search into the Prisma `where` (the same rules as `matchesMyJobView` and `matchesMyJobFilters`).
2. `count` and `findMany` with `skip` / `take` and `orderBy` matching `compareMyJobs`.
3. Compute the nine tab counts with SQL `count` queries, not from the page.
4. Remove the 500 cap. Keep `assignedTotal` as the unfiltered assignment count.
5. Add a disposable-SQL test with more than one page and a row that would have fallen past the old cap.

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

Cleanup: `nav-admin-remediation.integration.spec.ts` deletes only the `nav-admin-*` and `nav-other-*` tenants it creates, through `deleteDisposableTenants`, on `maintainpro_e2e_*` databases.

SQL deadlock/write conflict in WorkOrdersService.assign: fixed by pull request #115. `assign()` retries SQL Server 1205, snapshot write conflict 3960, and Prisma P2034.

`confirmWorkOrderUpload` closed/cancelled lock: fixed by pull request #115. Evidence upload confirmation is rejected on closed and cancelled work orders.
