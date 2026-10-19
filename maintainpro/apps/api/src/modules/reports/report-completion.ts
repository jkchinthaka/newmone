import { WorkOrderStatus } from "@prisma/client";

/** Closed and verified jobs count as completed. Cancelled does not. */
export const REPORT_COMPLETED_STATUSES: WorkOrderStatus[] = [
  WorkOrderStatus.COMPLETED,
  WorkOrderStatus.CLOSED,
  WorkOrderStatus.VERIFIED
];

export function isReportCompleted(status: string | null | undefined) {
  return REPORT_COMPLETED_STATUSES.includes(status as WorkOrderStatus);
}

export function completionRate(completed: number, total: number) {
  if (total <= 0) return 0;
  return Number(((completed / total) * 100).toFixed(1));
}

export function sumAmounts(rows: Array<{ amount: number }>) {
  return rows.reduce((sum, row) => sum + row.amount, 0);
}
