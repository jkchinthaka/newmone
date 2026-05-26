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
