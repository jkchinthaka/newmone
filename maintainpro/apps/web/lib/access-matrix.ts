export type AccessOverrideEffect = "GRANT" | "DENY";

export type AccessMatrixCell = "Inherited" | "Granted" | "Denied" | "Not granted";

/** Role grant with no override is Inherited while the studio is on. DENY wins over the role and over GRANT. */
export function accessMatrixCell(
  roleHasKey: boolean,
  effect: AccessOverrideEffect | null,
  studioOn: boolean
): AccessMatrixCell {
  if (!studioOn) {
    return roleHasKey ? "Granted" : "Not granted";
  }
  if (effect === "DENY") return "Denied";
  if (effect === "GRANT") return "Granted";
  if (roleHasKey) return "Inherited";
  return "Not granted";
}

/**
 * Catalog keys that a user grant does not fully unlock.
 * Each one still has a role check inside a service listed in
 * docs/handover/access/service-role-checks.md.
 */
export const ROLE_LIMITED_PERMISSION_KEYS = [
  "approvals.view",
  "fleet.manage",
  "inventory.manage",
  "inventory.stock_issue",
  "reports.management.view",
  "reports.view.cost",
  "reports.view.maintenance",
  "vendor.manage",
  "work_orders.close",
  "work_orders.manage",
  "work_orders.verify"
] as const;

const roleLimited = new Set<string>(ROLE_LIMITED_PERMISSION_KEYS);

export function isRoleLimitedPermission(key: string): boolean {
  return roleLimited.has(key);
}
