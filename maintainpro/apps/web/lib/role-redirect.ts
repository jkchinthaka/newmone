/**
 * Post-login landing routes for authenticated users.
 * Frontend UX only — backend RBAC remains authoritative for access control.
 */

/** Archived legacy FMS pending-requests workspace. Not a post-login destination. */
export const LEGACY_FMS_HOME_PATH = "/home";

export const DEFAULT_POST_LOGIN_REDIRECT = "/action-center";

/** App Router paths confirmed to exist today (2026-06-12 audit). */
export const EXISTING_POST_LOGIN_ROUTES = new Set<string>([
  "/action-center",
  "/admin",
  "/system-health",
  "/work-orders",
  "/fleet",
  "/fleet/gate",
  "/inventory",
  "/reports",
  "/compliance",
  "/assets",
  "/vehicles",
  "/facilities",
  "/utilities",
  "/notifications",
  "/settings",
  "/qr/report-issue",
  "/requests",
  "/maintenance/forecast"
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
 * Phase 1: CMMS/fleet focused — no farm/cleaning/billing landings.
 */
export const ROLE_POST_LOGIN_PREFERENCES: Record<string, readonly string[]> = {
  SUPER_ADMIN: ["/action-center", "/admin", "/system-health"],
  ADMIN: ["/action-center", "/admin"],
  MANAGER: ["/action-center", "/reports", "/work-orders"],
  OPERATIONS_MANAGER: ["/action-center", "/work-orders", "/reports"],
  FACILITY_MANAGER: ["/action-center", "/facilities", "/assets"],
  BUILDING_SUPERVISOR: ["/action-center", "/facilities", "/work-orders"],
  MAINTENANCE_SUPERVISOR: ["/action-center", "/work-orders"],
  TECHNICIAN: ["/action-center", "/work-orders"],
  MECHANIC: ["/action-center", "/work-orders"],
  CLEANER: ["/action-center"],
  SECURITY_OFFICER: ["/action-center", "/fleet/gate"],
  INVENTORY_KEEPER: ["/action-center", "/inventory"],
  STOREKEEPER: ["/action-center", "/inventory"],
  PROCUREMENT_OFFICER: ["/action-center", "/inventory"],
  FINANCE_APPROVER: ["/action-center", "/reports"],
  FINANCE: ["/action-center", "/reports"],
  VENDOR: ["/action-center"],
  REQUESTER: ["/action-center", "/requests"],
  VIEWER: ["/action-center", "/reports"],
  AUDITOR: ["/action-center", "/reports"],
  FLEET_MANAGER: ["/action-center", "/fleet"],
  COMPLIANCE_MANAGER: ["/action-center", "/compliance"],
  ASSET_MANAGER: ["/action-center", "/assets"],
  SUPERVISOR: ["/action-center", "/work-orders"],
  DRIVER: ["/action-center", "/fleet"],
  // Farm ops retired from product surface — land on Home; farm infrastructure via Assets later.
  FARM_OWNER: ["/action-center", "/assets"],
  FARM_MANAGER: ["/action-center", "/assets"],
  FIELD_SUPERVISOR: ["/action-center"],
  AGRONOMIST: ["/action-center"],
  VETERINARIAN: ["/action-center"],
  FARM_WORKER: ["/action-center"],
  IRRIGATION_OPERATOR: ["/action-center"],
  HARVEST_CREW: ["/action-center"]
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
