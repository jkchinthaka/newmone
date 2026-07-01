export const WORK_ORDER_OPEN_TAB_STATUSES = ["OPEN"] as const;
export const WORK_ORDER_IN_PROGRESS_TAB_STATUSES = [
  "IN_PROGRESS",
  "ON_HOLD",
  "TECHNICIAN_COMPLETED",
  "REWORK_REQUIRED"
] as const;

export type WorkOrderBoardStatus =
  | (typeof WORK_ORDER_OPEN_TAB_STATUSES)[number]
  | (typeof WORK_ORDER_IN_PROGRESS_TAB_STATUSES)[number]
  | "COMPLETED"
  | "CANCELLED"
  | "OVERDUE";

export function isWorkOrderOpenTabStatus(status: string): boolean {
  return status === "OPEN";
}

export function isWorkOrderInProgressTabStatus(status: string): boolean {
  return (
    status === "IN_PROGRESS" ||
    status === "ON_HOLD" ||
    status === "TECHNICIAN_COMPLETED" ||
    status === "REWORK_REQUIRED"
  );
}

export function groupWorkOrdersByBoardTab<T extends { id: string; status: string }>(rows: T[]): {
  open: T[];
  inProgress: T[];
  closed: T[];
} {
  const open: T[] = [];
  const inProgress: T[] = [];
  const closed: T[] = [];

  rows.forEach((order) => {
    if (isWorkOrderOpenTabStatus(order.status)) {
      open.push(order);
      return;
    }

    if (isWorkOrderInProgressTabStatus(order.status)) {
      inProgress.push(order);
      return;
    }

    closed.push(order);
  });

  return { open, inProgress, closed };
}
