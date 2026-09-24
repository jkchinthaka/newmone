import { USER_KEY } from "@/lib/auth-storage";

export type DashboardRole =
  | "SUPER_ADMIN"
  | "ADMIN"
  | "MANAGER"
  | "ASSET_MANAGER"
  | "SUPERVISOR"
  | "MECHANIC"
  | "DRIVER"
  | "VIEWER"
  | string;

export const VEHICLE_READ_ROLES: DashboardRole[] = [
  "SUPER_ADMIN",
  "ADMIN",
  "MANAGER",
  "ASSET_MANAGER",
  "SUPERVISOR",
  "MECHANIC",
  "DRIVER",
  "VIEWER"
];

export const VEHICLE_WRITE_ROLES: DashboardRole[] = [
  "SUPER_ADMIN",
  "ADMIN",
  "MANAGER",
  "ASSET_MANAGER"
];

export const VEHICLE_DELETE_ROLES: DashboardRole[] = ["SUPER_ADMIN", "ADMIN"];

/**
 * Mirrors the API guard on GET /inventory/analytics/* —
 * `@Roles("SUPER_ADMIN", "ADMIN", "ASSET_MANAGER", "MECHANIC")` + `@Permissions("inventory.manage")`.
 * Calling those routes without the grant returns 403, so the client must not request them.
 */
export const INVENTORY_ANALYTICS_ROLES: DashboardRole[] = [
  "SUPER_ADMIN",
  "ADMIN",
  "ASSET_MANAGER",
  "MECHANIC"
];

export const INVENTORY_MANAGE_PERMISSION = "inventory.manage";

/**
 * Mirrors POST /work-orders create RBAC:
 * `@Roles(SUPER_ADMIN, ADMIN, MANAGER, OPERATIONS_MANAGER, ASSET_MANAGER)`
 * + `@Permissions("work_orders.manage")`.
 * TECHNICIAN / MECHANIC / SUPERVISOR are intentionally excluded.
 */
export const WORK_ORDER_CREATE_ROLES: DashboardRole[] = [
  "SUPER_ADMIN",
  "ADMIN",
  "MANAGER",
  "OPERATIONS_MANAGER",
  "ASSET_MANAGER"
];

export const WORK_ORDERS_MANAGE_PERMISSION = "work_orders.manage";

/**
 * Whether the session may open the direct Create Work Order form / call POST /work-orders.
 * Role must match the API create allow-list; permission must be present when the
 * cached profile from `/auth/me` includes a permissions list. Empty permissions
 * with an allow-listed role still gates UI on role only (PermissionsGuard resolves
 * grants from DB), matching inventory analytics UX.
 */
export function canCreateWorkOrder(
  role?: string | null,
  permissions?: readonly string[] | null
): boolean {
  const resolvedRole = (role ?? getStoredRole()).trim();
  if (!WORK_ORDER_CREATE_ROLES.includes(resolvedRole)) {
    return false;
  }

  if (resolvedRole === "SUPER_ADMIN") {
    return true;
  }

  const resolvedPermissions = permissions ?? getStoredPermissions();
  if (resolvedPermissions.length === 0) {
    return true;
  }

  return resolvedPermissions.includes(WORK_ORDERS_MANAGE_PERMISSION);
}

/**
 * Mirrors @Roles on GET /fleet/live-map. Note the sibling routes /fleet/alerts and
 * /fleet/geofences additionally allow MANAGER, so a manager can open the fleet page but
 * cannot read live positions — requesting them anyway only yields 403.
 */
export const FLEET_LIVE_MAP_ROLES: DashboardRole[] = [
  "SUPER_ADMIN",
  "ADMIN",
  "ASSET_MANAGER",
  "SUPERVISOR"
];

type StoredUserRole = {
  name?: string | null;
  permissions?: Array<{ key?: string | null } | string>;
};

type StoredUserPayload = {
  role?: string | StoredUserRole | null;
  permissions?: string[];
};

function readStoredUser(): StoredUserPayload | null {
  if (typeof window === "undefined") {
    return null;
  }

  try {
    const raw = window.localStorage.getItem(USER_KEY);
    if (!raw) {
      return null;
    }

    return JSON.parse(raw) as StoredUserPayload;
  } catch {
    return null;
  }
}

export function getStoredRole(): DashboardRole {
  const parsed = readStoredUser();
  if (!parsed) {
    return "VIEWER";
  }

  if (typeof parsed.role === "string" && parsed.role.trim()) {
    return parsed.role.trim();
  }

  if (
    parsed.role &&
    typeof parsed.role === "object" &&
    typeof parsed.role.name === "string" &&
    parsed.role.name.trim()
  ) {
    return parsed.role.name.trim();
  }

  return "VIEWER";
}

export function getStoredPermissions(): string[] {
  const parsed = readStoredUser();
  if (!parsed) {
    return [];
  }

  const direct = Array.isArray(parsed.permissions)
    ? parsed.permissions.filter((value): value is string => typeof value === "string")
    : [];

  const rolePermissions =
    parsed.role && typeof parsed.role === "object" && Array.isArray(parsed.role.permissions)
      ? parsed.role.permissions
          .map((entry) => {
            if (typeof entry === "string") {
              return entry;
            }

            if (entry && typeof entry === "object" && typeof entry.key === "string") {
              return entry.key;
            }

            return null;
          })
          .filter((value): value is string => typeof value === "string")
      : [];

  return [...new Set([...direct, ...rolePermissions].map((value) => value.trim()).filter(Boolean))];
}

export function hasStoredPermission(permissionKey: string): boolean {
  return getStoredPermissions().includes(permissionKey);
}

/**
 * Can this session read live fleet positions without being rejected by the API?
 * Mirrors `@Roles` on GET /fleet/live-map (MANAGER is intentionally excluded).
 */
export function canReadFleetLiveMap(): boolean {
  return FLEET_LIVE_MAP_ROLES.includes(getStoredRole());
}

/**
 * Can this session read inventory analytics without being rejected by the API?
 * Role is authoritative; the permission list is only used when the stored session
 * actually carries one (the API's PermissionsGuard can still resolve grants from the
 * DB, so an empty local list must not hide the widgets from an allowed role).
 */
export function canReadInventoryAnalytics(): boolean {
  const role = getStoredRole();
  if (!INVENTORY_ANALYTICS_ROLES.includes(role)) {
    return false;
  }

  const permissions = getStoredPermissions();
  return permissions.length === 0 || permissions.includes(INVENTORY_MANAGE_PERMISSION);
}
