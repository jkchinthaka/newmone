import type { WorkOrderStatus, WorkOrderApprovalStatus } from "@/components/work-orders/types";

export type WorkOrderVerificationStatus = "NOT_REQUIRED" | "PENDING" | "VERIFIED" | "REJECTED";

export const GOVERNANCE_MESSAGES = {
  supervisorRequired: "Supervisor verification required before closing.",
  reasonRequired: "Reason required for this action.",
  lockedAfterStart:
    "Due date and expected completion are locked because work has already started. Title, description, estimated cost, and estimated hours can still be edited.",
  partsReturnRequired: "Parts issued cannot be removed without return approval."
} as const;

const STARTED_STATUSES = new Set<WorkOrderStatus>([
  "IN_PROGRESS",
  "ON_HOLD",
  "TECHNICIAN_COMPLETED",
  "REWORK_REQUIRED",
  "COMPLETED",
  "OVERDUE"
]);

export function isWorkOrderStarted(status: WorkOrderStatus): boolean {
  return STARTED_STATUSES.has(status);
}

/** Visual tone only. Does not change lifecycle or approval data. */
export function workOrderStatusBadgeClass(status: string): string {
  switch (status) {
    case "CANCELLED":
    case "CLOSED":
    case "COMPLETED":
      return "border-slate-300 bg-slate-100 text-slate-900";
    case "ON_HOLD":
    case "REWORK_REQUIRED":
    case "OVERDUE":
      return "border-amber-400 bg-amber-50 text-amber-950";
    case "IN_PROGRESS":
    case "TECHNICIAN_COMPLETED":
    case "VERIFIED":
      return "border-sky-400 bg-sky-50 text-sky-950";
    default:
      return "border-brand-200 bg-brand-50 text-brand-900";
  }
}

/** Matches API `SUPERVISOR_ROLES`. The role named SUPERVISOR is not a verifier. */
const WORK_ORDER_VERIFIER_ROLES = new Set([
  "SUPER_ADMIN",
  "ADMIN",
  "MANAGER",
  "OPERATIONS_MANAGER",
  "ASSET_MANAGER"
]);

export function canVerifyWorkOrderRole(role: string | null | undefined): boolean {
  return Boolean(role && WORK_ORDER_VERIFIER_ROLES.has(role));
}

/** SUPERVISOR needs the explicit grant. work_orders.manage does not count. Managers stay role-based. */
export function canVerifyWorkOrder(input: {
  role?: string | null;
  permissions?: readonly string[] | null;
}): boolean {
  if (canVerifyWorkOrderRole(input.role)) {
    return true;
  }
  if (input.role !== "SUPERVISOR") {
    return false;
  }
  return (input.permissions ?? []).includes("work_orders.verify");
}

export function getLifecycleStageLabel(status: WorkOrderStatus): string {
  switch (status) {
    case "OPEN":
      return "Open / Requested";
    case "IN_PROGRESS":
      return "In progress";
    case "ON_HOLD":
      return "On hold";
    case "TECHNICIAN_COMPLETED":
      return "Technician completed — awaiting supervisor";
    case "REWORK_REQUIRED":
      return "Rework required";
    case "VERIFIED":
      return "Verified — ready to close";
    case "CLOSED":
      return "Closed";
    case "COMPLETED":
      return "Closed (legacy)";
    case "CANCELLED":
      return "Cancelled";
    case "OVERDUE":
      return "Overdue";
    default:
      return String(status).replaceAll("_", " ");
  }
}

export function getVerificationStatusLabel(status?: WorkOrderVerificationStatus | null): string {
  switch (status) {
    case "PENDING":
      return "Supervisor verification pending";
    case "VERIFIED":
      return "Supervisor verified";
    case "REJECTED":
      return "Supervisor rejected — rework required";
    case "NOT_REQUIRED":
    default:
      return "Verification not required";
  }
}

export function getApprovalStatusLabel(status?: WorkOrderApprovalStatus | null): string {
  switch (status) {
    case "PENDING":
      return "Awaiting approval";
    case "APPROVED":
      return "Approved";
    case "REJECTED":
      return "Rejected";
    default:
      return "Unknown";
  }
}

export type GovernanceExceptionSummary = {
  completedWithoutEvidence: number;
  closedWithoutSupervisorVerification: number;
  partsIssuedJobNotCompleted: number;
  repeatedAssetBreakdowns: number;
  highCostWorkOrders: number;
  cancelledWorkOrders: number;
  reopenedWorkOrders: number;
  editedAfterCompletion: number;
  generatedAt: string;
  notes: string[];
};
