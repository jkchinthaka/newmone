import type { WorkOrderStatus, WorkOrderApprovalStatus } from "@/components/work-orders/types";

export type WorkOrderVerificationStatus = "NOT_REQUIRED" | "PENDING" | "VERIFIED" | "REJECTED";

export const GOVERNANCE_MESSAGES = {
  supervisorRequired: "Supervisor verification required before closing.",
  reasonRequired: "Reason required for this action.",
  lockedAfterStart: "This work order is locked because work has already started.",
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
    case "COMPLETED":
      return "Closed";
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
