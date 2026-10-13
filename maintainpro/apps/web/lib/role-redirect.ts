/**
 * Post-login landing routes for authenticated users.
 * Frontend UX only — backend RBAC remains authoritative for access control.
 */

/** Archived legacy FMS pending-requests workspace. Not a post-login destination. */
export const LEGACY_FMS_HOME_PATH = "/home";

/** Retired product surface. Bookmarks redirect; it is never a landing destination. */
export const RETIRED_ACTION_CENTER_PATH = "/action-center";

/** Retired branded entry screen. Bookmarks use the same auth-aware entry as `/`. */
export const RETIRED_SPLASH_PATH = "/splash";

export const DEFAULT_POST_LOGIN_REDIRECT = "/notifications";

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
  "/work-orders/my",
  "/maintenance",
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
  SUPER_ADMIN: ["/admin", "/system-health", "/notifications"],
  ADMIN: ["/admin", "/notifications"],
  MANAGER: ["/maintenance", "/reports", "/work-orders", "/notifications"],
  OPERATIONS_MANAGER: ["/maintenance", "/work-orders", "/reports", "/notifications"],
  FACILITY_MANAGER: ["/facilities", "/assets", "/notifications"],
  BUILDING_SUPERVISOR: ["/facilities", "/work-orders", "/notifications"],
  MAINTENANCE_SUPERVISOR: ["/maintenance", "/work-orders", "/notifications"],
  TECHNICIAN: ["/work-orders/my", "/work-orders", "/notifications"],
  MECHANIC: ["/work-orders/my", "/work-orders", "/notifications"],
  CLEANER: ["/notifications"],
  SECURITY_OFFICER: ["/fleet/gate", "/notifications"],
  INVENTORY_KEEPER: ["/inventory", "/notifications"],
  STOREKEEPER: ["/inventory", "/notifications"],
  PROCUREMENT_OFFICER: ["/inventory", "/notifications"],
  FINANCE_APPROVER: ["/reports", "/notifications"],
  FINANCE: ["/reports", "/notifications"],
  VENDOR: ["/notifications"],
  REQUESTER: ["/notifications"],
  VIEWER: ["/reports", "/notifications"],
  AUDITOR: ["/reports", "/notifications"],
  FLEET_MANAGER: ["/fleet", "/notifications"],
  COMPLIANCE_MANAGER: ["/compliance", "/notifications"],
  ASSET_MANAGER: ["/assets", "/notifications"],
  SUPERVISOR: ["/work-orders", "/notifications"],
  DRIVER: ["/fleet", "/notifications"],
  // Farm ops retired from product surface — land on Assets, then notifications.
  FARM_OWNER: ["/assets", "/notifications"],
  FARM_MANAGER: ["/assets", "/notifications"],
  FIELD_SUPERVISOR: ["/notifications"],
  AGRONOMIST: ["/notifications"],
  VETERINARIAN: ["/notifications"],
  FARM_WORKER: ["/notifications"],
  IRRIGATION_OPERATOR: ["/notifications"],
  HARVEST_CREW: ["/notifications"]
};

function pathOnly(value: string): string {
  return value.split("?")[0]?.split("#")[0] ?? "";
}

export function isRetiredActionCenterPath(value: string | null | undefined): boolean {
  if (!value) return false;
  const path = pathOnly(value);
  return path === RETIRED_ACTION_CENTER_PATH || path.startsWith(`${RETIRED_ACTION_CENTER_PATH}/`);
}

export function isRetiredSplashPath(value: string | null | undefined): boolean {
  if (!value) return false;
  const path = pathOnly(value);
  return path === RETIRED_SPLASH_PATH || path.startsWith(`${RETIRED_SPLASH_PATH}/`);
}

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
    if (isRetiredActionCenterPath(path) || isRetiredSplashPath(path)) {
      continue;
    }
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

/**
 * Accept only same-app relative paths. Reject protocol-relative and external URLs.
 */
export function safeInternalReturnPath(value: string | null | undefined): string | null {
  if (!value) return null;
  const raw = value.trim();
  if (!raw.startsWith("/") || raw.startsWith("//") || raw.includes("\\") || raw.includes("://")) {
    return null;
  }

  let decoded = raw;
  try {
    decoded = decodeURIComponent(raw);
  } catch {
    return null;
  }

  // Browsers strip tab/CR/LF from URLs, so "/%09/evil.example" would become the
  // protocol-relative "//evil.example". Reject every control character.
  // eslint-disable-next-line no-control-regex
  if (/[\u0000-\u001f\u007f]/.test(decoded)) {
    return null;
  }

  if (!decoded.startsWith("/") || decoded.startsWith("//") || decoded.includes("\\") || decoded.includes("://")) {
    return null;
  }

  const path = decoded.split("?")[0]?.split("#")[0] ?? "";
  if (!path || path.includes("..")) return null;
  if (path === "/" || isRetiredActionCenterPath(path) || isRetiredSplashPath(path)) return null;

  const blocked = ["/login", "/forgot-password", "/reset-password", "/register", "/accept-invite"];
  if (blocked.some((prefix) => path === prefix || path.startsWith(`${prefix}/`))) {
    return null;
  }

  return decoded;
}

export function resolveSplashDestination(user: PostLoginUserLike, returnTo: string | null | undefined) {
  return safeInternalReturnPath(returnTo) ?? getPostLoginRedirect(user);
}
