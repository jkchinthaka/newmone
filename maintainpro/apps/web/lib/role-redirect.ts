/**
 * Post-login landing routes for authenticated users.
 * Frontend UX only — backend RBAC remains authoritative for access control.
 */

/** Archived legacy FMS pending-requests workspace. Not a post-login destination. */
export const LEGACY_FMS_HOME_PATH = "/home";

export const DEFAULT_POST_LOGIN_REDIRECT = "/dashboard";

/** App Router paths confirmed to exist today (2026-06-12 audit). */
export const EXISTING_POST_LOGIN_ROUTES = new Set<string>([
  "/facilities",
  "/dashboard",
  "/admin",
  "/system-health",
  "/work-orders",
  "/cleaning",
  "/cleaning/issues",
  "/action-center",
  "/cleaning/scan",
  "/cleaning/visits",
  "/fleet",
  "/fleet/gate",
  "/inventory",
  "/procurement",
  "/reports",
  "/compliance",
  "/assets",
  "/vehicles",
  "/farm",
  "/billing",
  "/utilities",
  "/notifications",
  "/settings"
]);

export type PostLoginUserLike =
  | string
  | {
      role?: string | { name?: string | null } | null;
    }
  | null
  | undefined;

/**
 * Preferred landing paths per role (first existing route wins).
 * Missing routes fall back to `/dashboard` via `resolvePostLoginPath`.
 */
export const ROLE_POST_LOGIN_PREFERENCES: Record<string, readonly string[]> = {
  SUPER_ADMIN: ["/admin/overview", "/admin", "/system-health", DEFAULT_POST_LOGIN_REDIRECT],
  ADMIN: [DEFAULT_POST_LOGIN_REDIRECT],
  MANAGER: ["/dashboard/manager", DEFAULT_POST_LOGIN_REDIRECT],
  OPERATIONS_MANAGER: [DEFAULT_POST_LOGIN_REDIRECT],
  FACILITY_MANAGER: ["/facilities", "/cleaning/issues", "/action-center", DEFAULT_POST_LOGIN_REDIRECT],
  BUILDING_SUPERVISOR: ["/facilities", "/cleaning/issues", "/action-center", DEFAULT_POST_LOGIN_REDIRECT],
  MAINTENANCE_SUPERVISOR: ["/work-orders", DEFAULT_POST_LOGIN_REDIRECT],
  TECHNICIAN: ["/work-orders/my-jobs", "/work-orders", DEFAULT_POST_LOGIN_REDIRECT],
  MECHANIC: ["/work-orders/my-jobs", "/work-orders", DEFAULT_POST_LOGIN_REDIRECT],
  CLEANER: ["/cleaning/my-tasks", "/cleaning", DEFAULT_POST_LOGIN_REDIRECT],
  SECURITY_OFFICER: ["/fleet/gate", DEFAULT_POST_LOGIN_REDIRECT],
  INVENTORY_KEEPER: ["/inventory", DEFAULT_POST_LOGIN_REDIRECT],
  STOREKEEPER: ["/inventory", DEFAULT_POST_LOGIN_REDIRECT],
  PROCUREMENT_OFFICER: ["/procurement", DEFAULT_POST_LOGIN_REDIRECT],
  FINANCE_APPROVER: ["/budgets", "/approvals", DEFAULT_POST_LOGIN_REDIRECT],
  VENDOR: ["/vendor/dashboard", DEFAULT_POST_LOGIN_REDIRECT],
  REQUESTER: ["/requester/dashboard", "/requester", DEFAULT_POST_LOGIN_REDIRECT],
  VIEWER: ["/reports", DEFAULT_POST_LOGIN_REDIRECT],
  AUDITOR: ["/reports", DEFAULT_POST_LOGIN_REDIRECT],
  FLEET_MANAGER: ["/fleet", DEFAULT_POST_LOGIN_REDIRECT],
  COMPLIANCE_MANAGER: ["/compliance", DEFAULT_POST_LOGIN_REDIRECT],
  ASSET_MANAGER: ["/assets", DEFAULT_POST_LOGIN_REDIRECT],
  SUPERVISOR: ["/work-orders", DEFAULT_POST_LOGIN_REDIRECT],
  DRIVER: ["/vehicles", "/fleet", DEFAULT_POST_LOGIN_REDIRECT],
  FARM_OWNER: ["/farm", DEFAULT_POST_LOGIN_REDIRECT],
  FARM_MANAGER: ["/farm", DEFAULT_POST_LOGIN_REDIRECT],
  FIELD_SUPERVISOR: ["/farm", DEFAULT_POST_LOGIN_REDIRECT],
  AGRONOMIST: ["/farm", DEFAULT_POST_LOGIN_REDIRECT],
  VETERINARIAN: ["/farm", DEFAULT_POST_LOGIN_REDIRECT],
  FARM_WORKER: ["/farm", DEFAULT_POST_LOGIN_REDIRECT],
  IRRIGATION_OPERATOR: ["/farm", DEFAULT_POST_LOGIN_REDIRECT],
  HARVEST_CREW: ["/farm", DEFAULT_POST_LOGIN_REDIRECT]
};

export function extractRoleName(userOrRole: PostLoginUserLike): string | null {
  if (userOrRole == null) {
    return null;
  }

  if (typeof userOrRole === "string") {
    const trimmed = userOrRole.trim();
    return trimmed.length > 0 ? trimmed.toUpperCase() : null;
  }

  const role = userOrRole.role;

  if (typeof role === "string" && role.trim()) {
    return role.trim().toUpperCase();
  }

  if (
    role &&
    typeof role === "object" &&
    typeof role.name === "string" &&
    role.name.trim()
  ) {
    return role.name.trim().toUpperCase();
  }

  return null;
}

export function resolvePostLoginPath(preferredPaths: readonly string[]): string {
  for (const path of preferredPaths) {
    if (EXISTING_POST_LOGIN_ROUTES.has(path)) {
      return path;
    }
  }

  return DEFAULT_POST_LOGIN_REDIRECT;
}

export function getPostLoginRedirect(userOrRole: PostLoginUserLike): string {
  const roleName = extractRoleName(userOrRole);

  if (!roleName) {
    return DEFAULT_POST_LOGIN_REDIRECT;
  }

  const preferences =
    ROLE_POST_LOGIN_PREFERENCES[roleName] ?? [DEFAULT_POST_LOGIN_REDIRECT];

  return resolvePostLoginPath(preferences);
}
