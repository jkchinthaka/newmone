/**
 * Parts tab wording and role gates. Role lists mirror the API endpoint @Roles
 * (apps/api/src/modules/work-orders/part-request-access.ts and the parts line routes in
 * work-orders.controller.ts) so the UI hides buttons a role can never use.
 */

export type PartRequestUiAction =
  | "create"
  | "approve_operational"
  | "approve_finance"
  | "reject"
  | "issue"
  | "mark_used"
  | "request_return"
  | "confirm_return";

const ROLES_BY_ACTION: Record<PartRequestUiAction, readonly string[]> = {
  create: ["SUPER_ADMIN", "ADMIN", "MANAGER", "ASSET_MANAGER", "MECHANIC", "TECHNICIAN"],
  approve_operational: ["SUPER_ADMIN", "ADMIN", "MANAGER", "ASSET_MANAGER", "INVENTORY_KEEPER", "OPERATIONS_MANAGER"],
  approve_finance: ["SUPER_ADMIN", "ADMIN", "MANAGER", "OPERATIONS_MANAGER"],
  reject: ["SUPER_ADMIN", "ADMIN", "MANAGER", "ASSET_MANAGER", "OPERATIONS_MANAGER"],
  issue: ["SUPER_ADMIN", "ADMIN", "MANAGER", "INVENTORY_KEEPER", "OPERATIONS_MANAGER"],
  mark_used: ["SUPER_ADMIN", "ADMIN", "MECHANIC", "TECHNICIAN", "INVENTORY_KEEPER", "ASSET_MANAGER"],
  request_return: ["SUPER_ADMIN", "ADMIN", "MECHANIC", "TECHNICIAN", "INVENTORY_KEEPER", "ASSET_MANAGER"],
  confirm_return: ["SUPER_ADMIN", "ADMIN", "MANAGER", "INVENTORY_KEEPER", "OPERATIONS_MANAGER"]
};

export function canPartRequestAction(role: string | null | undefined, action: PartRequestUiAction): boolean {
  if (!role) return false;
  return ROLES_BY_ACTION[action].includes(role.trim());
}

/** Plain words for a part request status (no raw enum text). */
export function partRequestStatusLabel(status: string): string {
  switch (status) {
    case "PENDING_OPERATIONAL":
      return "Waiting for manager approval";
    case "PENDING_FINANCE":
      return "Waiting for finance approval";
    case "APPROVED":
      return "Ready to issue";
    case "PARTIALLY_ISSUED":
      return "Part issued, rest to come";
    case "ISSUED":
      return "Issued";
    case "REJECTED":
      return "Rejected";
    case "CANCELLED":
      return "Cancelled";
    default:
      return status.replace(/_/g, " ").toLowerCase().replace(/^\w/, (c) => c.toUpperCase());
  }
}

/** Plain words for an issued part line status. */
export function partLineStatusLabel(status: string): string {
  switch (status) {
    case "REQUESTED":
      return "Requested";
    case "APPROVED":
      return "Approved";
    case "RESERVED":
      return "Reserved";
    case "ISSUED":
      return "Issued";
    case "PARTIALLY_USED":
      return "Part used";
    case "USED":
      return "Used";
    case "PARTIALLY_RETURNED":
      return "Part returned";
    case "RETURNED":
      return "Returned";
    case "DAMAGED":
      return "Damaged";
    case "CLOSED":
      return "Done";
    default:
      return status.replace(/_/g, " ").toLowerCase().replace(/^\w/, (c) => c.toUpperCase());
  }
}

/** What happens next on a request, for people who cannot act on it themselves. */
export function partRequestNextStep(status: string): string | null {
  switch (status) {
    case "PENDING_OPERATIONAL":
      return "A manager must approve this request.";
    case "PENDING_FINANCE":
      return "Finance must approve this high-cost part.";
    case "APPROVED":
    case "PARTIALLY_ISSUED":
      return "The store will issue this part.";
    default:
      return null;
  }
}
