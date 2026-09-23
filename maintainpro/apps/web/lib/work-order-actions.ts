import type { WorkOrderStatus } from "@/components/work-orders/types";

export const ALLOWED_STATUS_TRANSITIONS: Record<WorkOrderStatus, WorkOrderStatus[]> = {
  OPEN: ["PLANNED", "CANCELLED"],
  PLANNED: ["ASSIGNED", "CANCELLED"],
  ASSIGNED: ["IN_PROGRESS", "CANCELLED"],
  IN_PROGRESS: ["ON_HOLD", "TECHNICIAN_COMPLETED", "CANCELLED"],
  ON_HOLD: ["IN_PROGRESS", "CANCELLED"],
  TECHNICIAN_COMPLETED: ["VERIFIED", "REWORK_REQUIRED"],
  REWORK_REQUIRED: ["IN_PROGRESS", "CANCELLED"],
  VERIFIED: ["CLOSED"],
  CLOSED: [],
  COMPLETED: [],
  CANCELLED: [],
  OVERDUE: ["IN_PROGRESS", "ON_HOLD", "TECHNICIAN_COMPLETED", "ASSIGNED", "CANCELLED"]
};

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
  | "CANCEL";

export type WorkOrderActionDescriptor = {
  action: WorkOrderAction;
  label: string;
  targetStatus: WorkOrderStatus;
  requiresModal?: boolean;
};

const ACTIONS_BY_STATUS: Record<WorkOrderStatus, WorkOrderActionDescriptor[]> = {
  OPEN: [
    { action: "PLAN", label: "Plan Work", targetStatus: "PLANNED", requiresModal: true },
    { action: "CANCEL", label: "Cancel", targetStatus: "CANCELLED", requiresModal: true }
  ],
  PLANNED: [
    { action: "ASSIGN", label: "Assign", targetStatus: "ASSIGNED", requiresModal: true },
    { action: "PLAN", label: "Edit Plan", targetStatus: "PLANNED", requiresModal: true },
    { action: "CANCEL", label: "Cancel", targetStatus: "CANCELLED", requiresModal: true }
  ],
  ASSIGNED: [
    { action: "START", label: "Start Work", targetStatus: "IN_PROGRESS" },
    { action: "REASSIGN", label: "Reassign", targetStatus: "ASSIGNED", requiresModal: true },
    { action: "CANCEL", label: "Cancel", targetStatus: "CANCELLED", requiresModal: true }
  ],
  IN_PROGRESS: [
    { action: "HOLD", label: "Hold", targetStatus: "ON_HOLD", requiresModal: true },
    { action: "COMPLETE", label: "Complete", targetStatus: "TECHNICIAN_COMPLETED", requiresModal: true },
    { action: "CANCEL", label: "Cancel", targetStatus: "CANCELLED", requiresModal: true }
  ],
  ON_HOLD: [
    { action: "RESUME", label: "Resume", targetStatus: "IN_PROGRESS" },
    { action: "CANCEL", label: "Cancel", targetStatus: "CANCELLED", requiresModal: true }
  ],
  TECHNICIAN_COMPLETED: [
    { action: "VERIFY", label: "Verify", targetStatus: "VERIFIED", requiresModal: true },
    { action: "REWORK", label: "Return for Rework", targetStatus: "REWORK_REQUIRED", requiresModal: true }
  ],
  REWORK_REQUIRED: [
    { action: "RESUME", label: "Resume Rework", targetStatus: "IN_PROGRESS" },
    { action: "CANCEL", label: "Cancel", targetStatus: "CANCELLED", requiresModal: true }
  ],
  VERIFIED: [{ action: "CLOSE", label: "Close", targetStatus: "CLOSED", requiresModal: true }],
  CLOSED: [],
  COMPLETED: [],
  CANCELLED: [],
  OVERDUE: [
    { action: "ASSIGN", label: "Assign", targetStatus: "ASSIGNED", requiresModal: true },
    { action: "START", label: "Start Work", targetStatus: "IN_PROGRESS" },
    { action: "HOLD", label: "Hold", targetStatus: "ON_HOLD", requiresModal: true },
    { action: "COMPLETE", label: "Complete", targetStatus: "TECHNICIAN_COMPLETED", requiresModal: true },
    { action: "CANCEL", label: "Cancel", targetStatus: "CANCELLED", requiresModal: true }
  ]
};

export function getValidWorkOrderActions(status: string): WorkOrderActionDescriptor[] {
  return ACTIONS_BY_STATUS[(status as WorkOrderStatus) ?? "OPEN"] ?? [];
}

export function isAllowedKanbanDrop(from: string, to: string): boolean {
  if (from === to) {
    return false;
  }

  const blockedTargets = new Set<WorkOrderStatus>([
    "ON_HOLD",
    "TECHNICIAN_COMPLETED",
    "REWORK_REQUIRED",
    "CANCELLED",
    "PLANNED",
    "ASSIGNED",
    "VERIFIED",
    "CLOSED"
  ]);

  const normalizedFrom = from as WorkOrderStatus;
  const normalizedTo = to as WorkOrderStatus;
  if (blockedTargets.has(normalizedTo)) {
    return false;
  }

  const allowed = ALLOWED_STATUS_TRANSITIONS[normalizedFrom] ?? [];
  return allowed.includes(normalizedTo);
}
