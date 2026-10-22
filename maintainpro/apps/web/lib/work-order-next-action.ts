export type WorkOrderNextAction = {
  id: "assign" | "start" | "complete" | "verify-close" | "close" | "send-back";
  label: string;
  disabledReason?: string;
};

const VERIFIER_ROLES = new Set(["SUPER_ADMIN", "ADMIN", "MANAGER", "OPERATIONS_MANAGER", "ASSET_MANAGER"]);
const TECH_ROLES = new Set(["TECHNICIAN", "MECHANIC"]);

export function primaryWorkOrderAction(input: {
  status: string;
  role?: string | null;
  approvalStatus?: string | null;
}): WorkOrderNextAction | null {
  const role = input.role ?? "";
  const verifier = VERIFIER_ROLES.has(role);
  const tech = TECH_ROLES.has(role);
  if (input.status === "OPEN" && verifier) {
    if (input.approvalStatus === "PENDING" || input.approvalStatus === "REJECTED") {
      return {
        id: "assign",
        label: "Assign technician",
        disabledReason: "Approve this work order before assigning a technician."
      };
    }
    return { id: "assign", label: "Assign technician" };
  }
  if (input.status === "ASSIGNED" && tech) return { id: "start", label: "Start job" };
  if (input.status === "IN_PROGRESS" && tech) return { id: "complete", label: "Mark complete" };
  if (input.status === "TECHNICIAN_COMPLETED" && verifier) return { id: "verify-close", label: "Verify & close" };
  // Verified but not closed yet, e.g. the close step needed a reason for a high-priority job.
  if (input.status === "VERIFIED" && verifier) return { id: "close", label: "Close job" };
  if (input.status === "REWORK_REQUIRED" && tech) return { id: "start", label: "Start job" };
  return null;
}

export function canManageWorkOrders(role?: string | null): boolean {
  const name = role ?? "";
  return VERIFIER_ROLES.has(name) || TECH_ROLES.has(name);
}

/** Rework is a secondary action while the job is waiting for verification. */
export function secondaryWorkOrderActions(input: {
  status: string;
  role?: string | null;
}): WorkOrderNextAction[] {
  if (input.status === "TECHNICIAN_COMPLETED" && VERIFIER_ROLES.has(input.role ?? "")) {
    return [{ id: "send-back", label: "Send back" }];
  }
  return [];
}

export const LEGACY_WORK_ORDER_STATUSES = new Set(["COMPLETED", "OVERDUE"]);

export function selectableWorkOrderStatuses<T extends string>(statuses: readonly T[]): T[] {
  return statuses.filter((status) => !LEGACY_WORK_ORDER_STATUSES.has(status));
}
