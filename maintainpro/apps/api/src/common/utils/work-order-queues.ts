import { RoleName, WorkOrderStatus, WorkOrderVerificationStatus } from "@prisma/client";

import type { RiskSeverity } from "./maintenance-risk-score";

export const WORK_ORDER_QUEUE_KEYS = [
  "action-required",
  "my-tasks",
  "open-requests",
  "approved-planned",
  "assigned",
  "in-progress",
  "waiting-parts",
  "waiting-evidence",
  "technician-completed",
  "supervisor-verification",
  "rework-required",
  "overdue",
  "high-risk",
  "finance-vendor-pending",
  "triage",
  "completed",
  "cancelled",
  "all"
] as const;

export type WorkOrderQueueKey = (typeof WORK_ORDER_QUEUE_KEYS)[number];

export const WORK_ORDER_QUEUE_LABELS: Record<WorkOrderQueueKey, string> = {
  "action-required": "Action Required",
  "my-tasks": "My Tasks",
  "open-requests": "Open Requests",
  "approved-planned": "Approved / Planned",
  assigned: "Assigned",
  "in-progress": "In Progress",
  "waiting-parts": "Waiting Parts",
  "waiting-evidence": "Waiting Evidence",
  "technician-completed": "Technician Completed",
  "supervisor-verification": "Supervisor Verification",
  "rework-required": "Rework Required",
  overdue: "Overdue",
  "high-risk": "High Risk",
  "finance-vendor-pending": "Finance / Vendor Pending",
  triage: "Triage / Not Sure",
  completed: "Completed",
  cancelled: "Cancelled",
  all: "All"
};

export const OPERATIONAL_QUEUE_KEYS: WorkOrderQueueKey[] = WORK_ORDER_QUEUE_KEYS.filter(
  (key) => key !== "completed" && key !== "cancelled" && key !== "all"
);

export const ACTIVE_OPERATIONAL_STATUSES: WorkOrderStatus[] = [
  WorkOrderStatus.OPEN,
  WorkOrderStatus.IN_PROGRESS,
  WorkOrderStatus.ON_HOLD,
  WorkOrderStatus.TECHNICIAN_COMPLETED,
  WorkOrderStatus.REWORK_REQUIRED,
  WorkOrderStatus.OVERDUE
];

export const TERMINAL_STATUSES: WorkOrderStatus[] = [WorkOrderStatus.COMPLETED, WorkOrderStatus.CANCELLED];

export type WorkOrderActionRequiredType =
  | "approval_required"
  | "supervisor_verification"
  | "evidence_missing"
  | "qr_mismatch"
  | "parts_pending_approval"
  | "parts_waiting_issue"
  | "parts_pending_return"
  | "overdue"
  | "high_risk"
  | "rework_required"
  | "finance_vendor_pending"
  | "triage_classification";

export type WorkOrderActionRequiredItem = {
  type: WorkOrderActionRequiredType;
  label: string;
  actorRole?: string;
  severity: RiskSeverity;
};

const TECHNICIAN_ROLES = new Set<RoleName>([RoleName.TECHNICIAN, RoleName.MECHANIC]);
const SUPERVISOR_ROLES = new Set<RoleName>([RoleName.SUPERVISOR, RoleName.SECURITY_OFFICER]);
const MANAGER_ROLES = new Set<RoleName>([
  RoleName.MANAGER,
  RoleName.OPERATIONS_MANAGER,
  RoleName.ASSET_MANAGER,
  RoleName.FLEET_MANAGER
]);
const FINANCE_ROLES = new Set<RoleName>([RoleName.MANAGER, RoleName.OPERATIONS_MANAGER]);
const ADMIN_ROLES = new Set<RoleName>([RoleName.SUPER_ADMIN, RoleName.ADMIN]);
const INVENTORY_ROLES = new Set<RoleName>([RoleName.INVENTORY_KEEPER]);

export function resolveDefaultQueueForRole(role: RoleName | string | undefined): WorkOrderQueueKey {
  const r = role as RoleName;
  if (TECHNICIAN_ROLES.has(r)) return "my-tasks";
  if (SUPERVISOR_ROLES.has(r)) return "supervisor-verification";
  if (INVENTORY_ROLES.has(r)) return "waiting-parts";
  if (FINANCE_ROLES.has(r) && !ADMIN_ROLES.has(r) && !MANAGER_ROLES.has(r)) return "finance-vendor-pending";
  if (MANAGER_ROLES.has(r)) return "action-required";
  if (ADMIN_ROLES.has(r)) return "action-required";
  return "my-tasks";
}

export function roleCanAccessQueue(role: RoleName | string | undefined, queue: WorkOrderQueueKey): boolean {
  const r = role as RoleName;
  if (ADMIN_ROLES.has(r) || MANAGER_ROLES.has(r) || SUPERVISOR_ROLES.has(r)) return true;
  if (INVENTORY_ROLES.has(r)) {
    return ["waiting-parts", "my-tasks", "action-required", "assigned", "in-progress"].includes(queue);
  }
  if (FINANCE_ROLES.has(r)) {
    return ["finance-vendor-pending", "high-risk", "action-required", "completed", "cancelled"].includes(queue);
  }
  if (TECHNICIAN_ROLES.has(r)) {
    return !["all", "finance-vendor-pending", "supervisor-verification"].includes(queue);
  }
  return queue !== "all";
}

export function isWorkOrderOverdue(input: {
  status: WorkOrderStatus;
  dueDate?: Date | null;
  completedDate?: Date | null;
}, now = new Date()): boolean {
  if (TERMINAL_STATUSES.includes(input.status)) return false;
  if (input.status === WorkOrderStatus.OVERDUE) return true;
  if (!input.dueDate) return false;
  return input.dueDate.getTime() < now.getTime();
}

export function overdueDayCount(dueDate: Date | null | undefined, now = new Date()): number {
  if (!dueDate) return 0;
  const diff = now.getTime() - dueDate.getTime();
  return diff > 0 ? Math.ceil(diff / (24 * 60 * 60 * 1000)) : 0;
}

export function priorityWeight(priority: string): number {
  switch (priority) {
    case "CRITICAL":
      return 4;
    case "HIGH":
      return 3;
    case "MEDIUM":
      return 2;
    default:
      return 1;
  }
}

export function severityWeight(severity: RiskSeverity | undefined): number {
  switch (severity) {
    case "CRITICAL":
      return 4;
    case "HIGH":
      return 3;
    case "MEDIUM":
      return 2;
    default:
      return 1;
  }
}

export function isSupervisorVerificationPending(status: WorkOrderStatus, verificationStatus?: WorkOrderVerificationStatus | null) {
  return status === WorkOrderStatus.TECHNICIAN_COMPLETED && verificationStatus === WorkOrderVerificationStatus.PENDING;
}

export const SMART_VIEW_KEYS = [
  "my-tasks",
  "action-required",
  "overdue",
  "high-risk",
  "supervisor-verification",
  "waiting-parts",
  "waiting-evidence",
  "parts-pending-return",
  "rework-required",
  "triage",
  "completed-this-month",
  "cancelled-this-month",
  "created-today",
  "updated-today"
] as const;

export type SmartViewKey = (typeof SMART_VIEW_KEYS)[number];

export const SMART_VIEW_LABELS: Record<SmartViewKey, string> = {
  "my-tasks": "My Tasks",
  "action-required": "Action Required",
  overdue: "Overdue",
  "high-risk": "High Risk",
  "supervisor-verification": "Waiting Supervisor Verification",
  "waiting-parts": "Waiting Parts",
  "waiting-evidence": "Evidence Missing",
  "parts-pending-return": "Parts Pending Return",
  "rework-required": "Rework Required",
  triage: "Triage",
  "completed-this-month": "Completed This Month",
  "cancelled-this-month": "Cancelled This Month",
  "created-today": "Created Today",
  "updated-today": "Updated Today"
};
