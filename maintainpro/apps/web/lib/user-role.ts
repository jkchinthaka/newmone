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

export function getStoredRole(): DashboardRole {
  if (typeof window === "undefined") {
    return "VIEWER";
  }

  try {
    const raw = window.localStorage.getItem(USER_KEY);
    if (!raw) {
      return "VIEWER";
    }

    const parsed = JSON.parse(raw) as {
      role?: string | { name?: string | null } | null;
    };

    if (typeof parsed.role === "string" && parsed.role.trim()) {
      return parsed.role.trim();
    }

    if (parsed.role && typeof parsed.role === "object" && typeof parsed.role.name === "string" && parsed.role.name.trim()) {
      return parsed.role.name.trim();
    }

    return "VIEWER";
  } catch {
    return "VIEWER";
  }
}
