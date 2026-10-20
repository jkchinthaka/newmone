# Backlog

Recorded 2026-10-19. Neither item was coded in Block D. Each needs more than a one-hour safe change.

## My Jobs SQL pagination

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
