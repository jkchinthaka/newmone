import { Priority, WorkOrderStatus } from "@prisma/client";

import { TERMINAL_STATUSES } from "./work-order-queues";

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

/** Same terminal set as the overdue work-order queue. */
const OVERDUE_EXCLUDED_STATUSES: WorkOrderStatus[] = TERMINAL_STATUSES;

/**
 * Overdue matches the overdue queue: OVERDUE status, or a due date before `now`
 * on a job that is not closed, cancelled, or completed.
 */
export function isDashboardOverdue(
  status: WorkOrderStatus,
  dueDate: Date | string | null | undefined,
  now: Date
): boolean {
  if (OVERDUE_EXCLUDED_STATUSES.includes(status)) return false;
  if (status === WorkOrderStatus.OVERDUE) return true;
  if (!dueDate) return false;
  const due = dueDate instanceof Date ? dueDate : new Date(dueDate);
  return !Number.isNaN(due.getTime()) && due.getTime() < now.getTime();
}

/** Prisma where fragment. Combine with tenantId so the card count matches `/work-orders?filter=overdue`. */
export function dashboardOverdueWhere(now: Date) {
  return {
    OR: [
      { status: WorkOrderStatus.OVERDUE },
      {
        dueDate: { lt: now },
        status: { notIn: OVERDUE_EXCLUDED_STATUSES }
      }
    ]
  };
}

const PRIORITY_RANK: Record<string, number> = { CRITICAL: 0, HIGH: 1 };

export function compareDashboardPriorityWork<
  T extends {
    status: WorkOrderStatus | string;
    priority: string | null;
    dueDate: Date | string | null;
    woNumber: string;
  }
>(left: T, right: T, now: Date): number {
  const overdueDelta =
    Number(isDashboardOverdue(right.status as WorkOrderStatus, right.dueDate, now)) -
    Number(isDashboardOverdue(left.status as WorkOrderStatus, left.dueDate, now));
  if (overdueDelta !== 0) return overdueDelta;
  const priorityDelta = (PRIORITY_RANK[left.priority ?? ""] ?? 9) - (PRIORITY_RANK[right.priority ?? ""] ?? 9);
  if (priorityDelta !== 0) return priorityDelta;
  const leftDue = left.dueDate ? new Date(left.dueDate).getTime() : Number.POSITIVE_INFINITY;
  const rightDue = right.dueDate ? new Date(right.dueDate).getTime() : Number.POSITIVE_INFINITY;
  if (leftDue !== rightDue) return leftDue - rightDue;
  return left.woNumber.localeCompare(right.woNumber);
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
      href: "/work-orders?filter=overdue",
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
      href: "/work-orders?filter=verification-required",
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
      href: "/work-orders?filter=unassigned",
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
