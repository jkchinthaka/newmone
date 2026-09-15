import { BadRequestException } from "@nestjs/common";
import { WorkOrderStatus } from "@prisma/client";

import { isTerminalWorkOrderStatus } from "../../common/utils/work-order-governance";

export { isTerminalWorkOrderStatus };

/**
 * Phase 6 canonical lifecycle (UI labels):
 * OPEN → PLANNED → ASSIGNED → IN_PROGRESS → ON_HOLD → Completed → VERIFIED → CLOSED
 *
 * DB mapping for "Completed": TECHNICIAN_COMPLETED (legacy name kept for API/test compatibility).
 * Legacy COMPLETED rows = historically closed; treat as CLOSED for terminal checks.
 * OVERDUE is derived (dueAt < now && !terminal), not a primary transition target.
 */

export const HOLD_REASON_CODES = [
  "WAITING_PARTS",
  "WAITING_VENDOR",
  "WAITING_PRODUCTION",
  "WAITING_APPROVAL",
  "WAITING_TOOL",
  "WAITING_ACCESS",
  "SAFETY_HOLD",
  "OTHER"
] as const;

export type HoldReasonCode = (typeof HOLD_REASON_CODES)[number];

export const DEFAULT_FAILURE_CODES = [
  { code: "ELECTRICAL", name: "Electrical" },
  { code: "MECHANICAL", name: "Mechanical" },
  { code: "LEAK", name: "Leak" },
  { code: "OVERHEATING", name: "Overheating" },
  { code: "NO_POWER", name: "No Power" },
  { code: "ABNORMAL_NOISE", name: "Abnormal Noise" },
  { code: "STRUCTURAL", name: "Structural Damage" }
] as const;

export const DEFAULT_CAUSE_CODES = [
  { code: "WEAR", name: "Wear" },
  { code: "POOR_LUBRICATION", name: "Poor Lubrication" },
  { code: "OVERLOAD", name: "Overload" },
  { code: "LOOSE_CONNECTION", name: "Loose Connection" },
  { code: "CONTAMINATION", name: "Contamination" },
  { code: "OPERATOR_DAMAGE", name: "Operator Damage" },
  { code: "AGE", name: "Age" },
  { code: "UNKNOWN", name: "Unknown" }
] as const;

export const DEFAULT_REMEDY_CODES = [
  { code: "ADJUSTED", name: "Adjusted" },
  { code: "REPAIRED", name: "Repaired" },
  { code: "REPLACED", name: "Replaced" },
  { code: "CLEANED", name: "Cleaned" },
  { code: "LUBRICATED", name: "Lubricated" },
  { code: "REWIRED", name: "Rewired" },
  { code: "CALIBRATED", name: "Calibrated" },
  { code: "TEMPORARY_REPAIR", name: "Temporary Repair" }
] as const;

/** Statuses that end the executable lifecycle */
export function isOverdueCondition(input: {
  dueAt?: Date | null;
  status: WorkOrderStatus;
  now?: Date;
}): boolean {
  if (!input.dueAt || isTerminalWorkOrderStatus(input.status)) return false;
  const now = input.now ?? new Date();
  return input.dueAt.getTime() < now.getTime();
}

export function humanWorkOrderStatus(status: WorkOrderStatus): string {
  const labels: Partial<Record<WorkOrderStatus, string>> = {
    OPEN: "Open",
    PLANNED: "Planned",
    ASSIGNED: "Assigned",
    IN_PROGRESS: "In Progress",
    ON_HOLD: "On Hold",
    TECHNICIAN_COMPLETED: "Completed",
    REWORK_REQUIRED: "Return for Correction",
    COMPLETED: "Closed (Legacy)",
    VERIFIED: "Verified",
    CLOSED: "Closed",
    CANCELLED: "Cancelled",
    OVERDUE: "Overdue (Legacy)"
  };
  return labels[status] ?? status.replaceAll("_", " ");
}

export function assertValidHoldReason(code: string, notes?: string | null) {
  if (!(HOLD_REASON_CODES as readonly string[]).includes(code)) {
    throw new BadRequestException(`Invalid hold reason code: ${code}`);
  }
  if (code === "OTHER" && (!notes || notes.trim().length < 3)) {
    throw new BadRequestException("Hold notes are required when reason is OTHER");
  }
}

/** Phase 7 approval hooks — no-op until rules exist */
export type WorkOrderApprovalHookContext = {
  workOrderId: string;
  action: "START" | "REOPEN" | "CLOSE_CORRECTION" | "HIGH_COST" | "VENDOR";
  actorId: string;
};

export function workOrderApprovalExtensionPoint(_ctx: WorkOrderApprovalHookContext): {
  required: boolean;
  reason?: string;
} {
  // Phase 7 wires real ApprovalRule evaluation here.
  return { required: false };
}
