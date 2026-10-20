/** Role lists match the seeded permission catalog for each part-request action. */
export const PART_REQUEST_VIEW_ROLES = [
  "SUPER_ADMIN",
  "ADMIN",
  "MANAGER",
  "OPERATIONS_MANAGER",
  "ASSET_MANAGER",
  "MECHANIC",
  "TECHNICIAN",
  "INVENTORY_KEEPER",
  "SUPERVISOR"
] as const;

export const PART_REQUEST_CREATE_ROLES = [
  "SUPER_ADMIN",
  "ADMIN",
  "MANAGER",
  "ASSET_MANAGER",
  "MECHANIC",
  "TECHNICIAN"
] as const;

export const PART_REQUEST_APPROVE_OPERATIONAL_ROLES = [
  "SUPER_ADMIN",
  "ADMIN",
  "MANAGER",
  "ASSET_MANAGER",
  "INVENTORY_KEEPER",
  "OPERATIONS_MANAGER"
] as const;

export const PART_REQUEST_APPROVE_FINANCE_ROLES = [
  "SUPER_ADMIN",
  "ADMIN",
  "MANAGER",
  "OPERATIONS_MANAGER"
] as const;

export const PART_REQUEST_REJECT_ROLES = [
  "SUPER_ADMIN",
  "ADMIN",
  "MANAGER",
  "ASSET_MANAGER",
  "OPERATIONS_MANAGER"
] as const;

export const PART_REQUEST_ISSUE_ROLES = [
  "SUPER_ADMIN",
  "ADMIN",
  "MANAGER",
  "INVENTORY_KEEPER",
  "OPERATIONS_MANAGER"
] as const;

export const PART_RETURN_CONFIRM_ROLES = [
  "SUPER_ADMIN",
  "ADMIN",
  "MANAGER",
  "INVENTORY_KEEPER",
  "OPERATIONS_MANAGER"
] as const;

export type PartRequestAction = "view" | "create" | "approve_operational" | "approve_finance" | "reject" | "issue" | "confirm_return";

const BY_ACTION: Record<PartRequestAction, readonly string[]> = {
  view: PART_REQUEST_VIEW_ROLES,
  create: PART_REQUEST_CREATE_ROLES,
  approve_operational: PART_REQUEST_APPROVE_OPERATIONAL_ROLES,
  approve_finance: PART_REQUEST_APPROVE_FINANCE_ROLES,
  reject: PART_REQUEST_REJECT_ROLES,
  issue: PART_REQUEST_ISSUE_ROLES,
  confirm_return: PART_RETURN_CONFIRM_ROLES
};

export function roleCanPartRequest(role: string, action: PartRequestAction) {
  return BY_ACTION[action].includes(role);
}

/** A return request only raises the pending quantity. Stock moves on confirm. */
export function stagePartReturn(line: { pendingReturnQuantity: number; returnedQuantity: number }, quantity: number) {
  return {
    pendingReturnQuantity: line.pendingReturnQuantity + quantity,
    returnedQuantity: line.returnedQuantity
  };
}
