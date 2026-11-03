import type { WorkOrderDashboardStats } from "@/lib/dashboard-roles";
import type { WorkOrderQueueKey, WorkOrderQueueListResponse, WorkOrderQueueSummary } from "@/lib/work-order-queues-api";

/**
 * Dashboard work-order counts come from server aggregates, never from one page of rows.
 * (A page of 25 rows undercounts any tenant with more than 25 jobs.)
 */
function queueCount(summary: WorkOrderQueueSummary, key: WorkOrderQueueKey): number {
  const count = summary.queues?.find((queue) => queue.key === key)?.count;
  return typeof count === "number" && Number.isFinite(count) ? count : 0;
}

/** Company-wide counts from GET /work-orders/queues. */
export function workOrderCountsFromQueueSummary(summary: WorkOrderQueueSummary): WorkOrderDashboardStats {
  return {
    total: queueCount(summary, "all"),
    open: queueCount(summary, "open-requests"),
    inProgress: queueCount(summary, "in-progress"),
    overdue: summary.summary?.overdue ?? queueCount(summary, "overdue"),
    completed: queueCount(summary, "completed")
  };
}

/** Counts for one assignee, from a queue list response filtered by technicianId. */
export function workOrderCountsFromListSummary(
  list: Pick<WorkOrderQueueListResponse, "summary" | "total"> | undefined,
  completedTotal: number | undefined
): WorkOrderDashboardStats {
  const summary = list?.summary;
  const total = summary?.total ?? list?.total ?? 0;
  return {
    total,
    open: summary?.open ?? 0,
    inProgress: summary?.inProgress ?? 0,
    overdue: summary?.overdue ?? 0,
    completed: completedTotal ?? 0,
    assigned: total
  };
}
