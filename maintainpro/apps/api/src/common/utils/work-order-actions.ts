import { WorkOrderStatus } from "@prisma/client";

import { ALLOWED_STATUS_TRANSITIONS } from "./work-order-governance";

/**
 * Canonical D2 business actions mapped to lifecycle targets.
 * Frontend should render these instead of a free-form status select.
 */
export type WorkOrderAction =
  | "PLAN"
  | "ASSIGN"
  | "REASSIGN"
  | "START"
  | "HOLD"
  | "RESUME"
  | "COMPLETE"
  | "VERIFY"
  | "REWORK"
  | "CLOSE"
  | "CANCEL"
  | "REOPEN";

export type WorkOrderActionDescriptor = {
  action: WorkOrderAction;
  targetStatus: WorkOrderStatus;
  label: string;
  requiresReason?: boolean;
  requiresPayload?: boolean;
};

const ACTION_BY_STATUS: Partial<Record<WorkOrderStatus, WorkOrderActionDescriptor[]>> = {
  [WorkOrderStatus.OPEN]: [
    { action: "PLAN", targetStatus: WorkOrderStatus.PLANNED, label: "Plan Work", requiresPayload: true },
    { action: "CANCEL", targetStatus: WorkOrderStatus.CANCELLED, label: "Cancel", requiresReason: true }
  ],
  [WorkOrderStatus.PLANNED]: [
    { action: "ASSIGN", targetStatus: WorkOrderStatus.ASSIGNED, label: "Assign", requiresPayload: true },
    { action: "PLAN", targetStatus: WorkOrderStatus.PLANNED, label: "Edit Plan", requiresPayload: true },
    { action: "CANCEL", targetStatus: WorkOrderStatus.CANCELLED, label: "Cancel", requiresReason: true }
  ],
  [WorkOrderStatus.ASSIGNED]: [
    { action: "START", targetStatus: WorkOrderStatus.IN_PROGRESS, label: "Start Work" },
    { action: "REASSIGN", targetStatus: WorkOrderStatus.ASSIGNED, label: "Reassign", requiresReason: true, requiresPayload: true },
    { action: "CANCEL", targetStatus: WorkOrderStatus.CANCELLED, label: "Cancel", requiresReason: true }
  ],
  [WorkOrderStatus.IN_PROGRESS]: [
    { action: "HOLD", targetStatus: WorkOrderStatus.ON_HOLD, label: "Hold", requiresReason: true },
    { action: "COMPLETE", targetStatus: WorkOrderStatus.TECHNICIAN_COMPLETED, label: "Complete", requiresPayload: true }
  ],
  [WorkOrderStatus.ON_HOLD]: [
    { action: "RESUME", targetStatus: WorkOrderStatus.IN_PROGRESS, label: "Resume" }
  ],
  [WorkOrderStatus.TECHNICIAN_COMPLETED]: [
    { action: "VERIFY", targetStatus: WorkOrderStatus.VERIFIED, label: "Verify" },
    { action: "REWORK", targetStatus: WorkOrderStatus.REWORK_REQUIRED, label: "Return for Rework", requiresReason: true }
  ],
  [WorkOrderStatus.REWORK_REQUIRED]: [
    { action: "RESUME", targetStatus: WorkOrderStatus.IN_PROGRESS, label: "Resume Rework" }
  ],
  [WorkOrderStatus.VERIFIED]: [
    { action: "CLOSE", targetStatus: WorkOrderStatus.CLOSED, label: "Close" }
  ],
  [WorkOrderStatus.CLOSED]: [],
  [WorkOrderStatus.COMPLETED]: [],
  [WorkOrderStatus.CANCELLED]: []
};

export function getValidWorkOrderActions(status: WorkOrderStatus): WorkOrderActionDescriptor[] {
  return ACTION_BY_STATUS[status] ?? [];
}

export function isAllowedKanbanDrop(from: WorkOrderStatus, to: WorkOrderStatus): boolean {
  if (from === to) return false;
  // Drag must never skip payload-bearing actions
  const payloadRequired = new Set<WorkOrderStatus>([
    WorkOrderStatus.ON_HOLD,
    WorkOrderStatus.TECHNICIAN_COMPLETED,
    WorkOrderStatus.REWORK_REQUIRED,
    WorkOrderStatus.CANCELLED,
    WorkOrderStatus.PLANNED,
    WorkOrderStatus.ASSIGNED,
    WorkOrderStatus.VERIFIED,
    WorkOrderStatus.CLOSED
  ]);
  if (payloadRequired.has(to)) {
    return false;
  }
  const allowed = ALLOWED_STATUS_TRANSITIONS[from] ?? [];
  return allowed.includes(to);
}

export function deriveReadiness(input: {
  status: WorkOrderStatus;
  hasTechnician: boolean;
  plannedStartAt?: Date | null;
  dueDate?: Date | null;
  approvalOk: boolean;
  safetyOk?: boolean;
  partsBlocked?: boolean;
}): { state: "READY" | "BLOCKED"; blockers: string[] } {
  const blockers: string[] = [];
  if (input.status === WorkOrderStatus.OPEN) {
    blockers.push("Planning incomplete");
  }
  if (
    input.status === WorkOrderStatus.PLANNED ||
    (input.status === WorkOrderStatus.OPEN && !input.hasTechnician)
  ) {
    if (!input.hasTechnician) blockers.push("Assignment incomplete");
  }
  if (!input.approvalOk) blockers.push("Required approval incomplete");
  if (input.safetyOk === false) blockers.push("Safety readiness incomplete");
  if (input.partsBlocked) blockers.push("Required parts not ready");
  if (input.status === WorkOrderStatus.ASSIGNED && !input.hasTechnician) {
    blockers.push("Primary technician missing");
  }
  return {
    state: blockers.length === 0 && input.status === WorkOrderStatus.ASSIGNED ? "READY" : blockers.length ? "BLOCKED" : "READY",
    blockers
  };
}
