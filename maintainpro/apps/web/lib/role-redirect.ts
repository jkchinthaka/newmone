/**
 * Post-login landing routes for authenticated users.
 * Frontend UX only — backend RBAC remains authoritative for access control.
 */

/** Archived legacy FMS pending-requests workspace. Not a post-login destination. */
export const LEGACY_FMS_HOME_PATH = "/home";

export const DEFAULT_POST_LOGIN_REDIRECT = "/action-center";

/** App Router paths confirmed to exist today (2026-06-12 audit). */
export const EXISTING_POST_LOGIN_ROUTES = new Set<string>([
  "/facilities",
  "/workspace",
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
  SUPER_ADMIN: ["/action-center", "/admin", "/system-health", "/workspace"],
  ADMIN: ["/action-center", "/workspace", "/admin", "/dashboard"],
  MANAGER: ["/action-center", "/workspace", "/dashboard"],
  OPERATIONS_MANAGER: ["/action-center", "/workspace", "/dashboard"],
  FACILITY_MANAGER: ["/action-center", "/facilities", "/cleaning/issues", "/workspace"],
  BUILDING_SUPERVISOR: ["/action-center", "/facilities", "/cleaning/issues", "/workspace"],
  MAINTENANCE_SUPERVISOR: ["/action-center", "/work-orders", "/workspace"],
  TECHNICIAN: ["/action-center", "/workspace", "/work-orders"],
  MECHANIC: ["/action-center", "/workspace", "/work-orders"],
  CLEANER: ["/action-center", "/cleaning", "/workspace"],
  SECURITY_OFFICER: ["/action-center", "/fleet/gate", "/workspace"],
  INVENTORY_KEEPER: ["/action-center", "/inventory", "/workspace"],
  STOREKEEPER: ["/action-center", "/inventory", "/workspace"],
  PROCUREMENT_OFFICER: ["/action-center", "/procurement", "/workspace"],
  FINANCE_APPROVER: ["/action-center", "/reports", "/billing", "/workspace"],
  VENDOR: ["/action-center", DEFAULT_POST_LOGIN_REDIRECT],
  REQUESTER: ["/action-center", DEFAULT_POST_LOGIN_REDIRECT],
  VIEWER: ["/action-center", "/reports", DEFAULT_POST_LOGIN_REDIRECT],
  AUDITOR: ["/action-center", "/reports", DEFAULT_POST_LOGIN_REDIRECT],
  FLEET_MANAGER: ["/action-center", "/fleet", DEFAULT_POST_LOGIN_REDIRECT],
  COMPLIANCE_MANAGER: ["/action-center", "/compliance", DEFAULT_POST_LOGIN_REDIRECT],
  ASSET_MANAGER: ["/action-center", "/assets", DEFAULT_POST_LOGIN_REDIRECT],
  SUPERVISOR: ["/action-center", "/work-orders", DEFAULT_POST_LOGIN_REDIRECT],
  DRIVER: ["/action-center", "/vehicles", "/fleet", DEFAULT_POST_LOGIN_REDIRECT],
  FARM_OWNER: ["/action-center", "/farm", DEFAULT_POST_LOGIN_REDIRECT],
  FARM_MANAGER: ["/action-center", "/farm", DEFAULT_POST_LOGIN_REDIRECT],
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
