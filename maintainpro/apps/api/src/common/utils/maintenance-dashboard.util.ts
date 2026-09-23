import { Priority, WorkOrderStatus } from "@prisma/client";

/** Non-terminal statuses counted as open maintenance load. */
export const DASHBOARD_OPEN_STATUSES: WorkOrderStatus[] = [
  WorkOrderStatus.OPEN,
  WorkOrderStatus.PLANNED,
  WorkOrderStatus.ASSIGNED,
  WorkOrderStatus.IN_PROGRESS,
  WorkOrderStatus.ON_HOLD,
  WorkOrderStatus.TECHNICIAN_COMPLETED,
  WorkOrderStatus.REWORK_REQUIRED,
  WorkOrderStatus.OVERDUE
];

export type DashboardKpiTone = "default" | "warn" | "critical";

export type DashboardQueueLink = {
  key: string;
  label: string;
  href: string;
  count: number;
  tone: DashboardKpiTone;
};

export function toneForCount(count: number, criticalThreshold = 0): DashboardKpiTone {
  if (count <= 0) return "default";
  if (criticalThreshold > 0 && count >= criticalThreshold) return "critical";
  return "warn";
}

/** Overdue = OVERDUE status or dueDate before `now` while still open. */
export function isDashboardOverdue(
  status: WorkOrderStatus,
  dueDate: Date | string | null | undefined,
  now: Date
): boolean {
  if (status === WorkOrderStatus.OVERDUE) return true;
  if (!dueDate) return false;
  if (!DASHBOARD_OPEN_STATUSES.includes(status)) return false;
  const due = dueDate instanceof Date ? dueDate : new Date(dueDate);
  return !Number.isNaN(due.getTime()) && due.getTime() < now.getTime();
}

export function isCriticalOpen(priority: Priority | string | null | undefined, status: WorkOrderStatus): boolean {
  if (!DASHBOARD_OPEN_STATUSES.includes(status)) return false;
  return priority === Priority.CRITICAL || priority === "CRITICAL";
}

export function buildAttentionQueues(input: {
  overdue: number;
  unplanned: number;
  unassigned: number;
  inProgress: number;
  onHold: number;
  verificationRequired: number;
  reworkRequired: number;
  critical: number;
  requestsOpen: number;
}): DashboardQueueLink[] {
  return [
    {
      key: "overdue",
      label: "Overdue",
      href: "/work-orders?smartView=overdue",
      count: input.overdue,
      tone: toneForCount(input.overdue, 1)
    },
    {
      key: "critical",
      label: "Critical open",
      href: "/work-orders?priority=CRITICAL",
      count: input.critical,
      tone: toneForCount(input.critical, 1)
    },
    {
      key: "verification",
      label: "Verification required",
      href: "/work-orders?smartView=supervisor-verification",
      count: input.verificationRequired,
      tone: toneForCount(input.verificationRequired)
    },
    {
      key: "rework",
      label: "Rework required",
      href: "/work-orders?status=REWORK_REQUIRED",
      count: input.reworkRequired,
      tone: toneForCount(input.reworkRequired)
    },
    {
      key: "unplanned",
      label: "Unplanned",
      href: "/work-orders?status=OPEN",
      count: input.unplanned,
      tone: toneForCount(input.unplanned)
    },
    {
      key: "unassigned",
      label: "Unassigned",
      href: "/work-orders?smartView=action-required",
      count: input.unassigned,
      tone: toneForCount(input.unassigned)
    },
    {
      key: "in-progress",
      label: "In progress",
      href: "/work-orders?status=IN_PROGRESS",
      count: input.inProgress,
      tone: "default"
    },
    {
      key: "on-hold",
      label: "On hold",
      href: "/work-orders?status=ON_HOLD",
      count: input.onHold,
      tone: toneForCount(input.onHold)
    },
    {
      key: "requests",
      label: "Requests awaiting action",
      href: "/requests",
      count: input.requestsOpen,
      tone: toneForCount(input.requestsOpen)
    }
  ];
}
