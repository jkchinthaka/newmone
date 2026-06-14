"use client";

import { useEffect, useState } from "react";
import { USER_KEY } from "@/lib/auth-storage";

const HISTORY_VISIBLE_ROLES = new Set<string>(["SUPER_ADMIN", "ADMIN", "ASSET_MANAGER"]);
const HISTORY_VIEW_PERMISSION = "audit.view";

export interface CurrentUser {
  id: string | null;
  email: string | null;
  role: string | null;
  tenantId: string | null;
  permissions: string[];
}

function readStoredUser(): CurrentUser {
  if (typeof window === "undefined") {
    return { id: null, email: null, role: null, tenantId: null, permissions: [] };
  }

  try {
    const raw = window.localStorage.getItem(USER_KEY);
    if (!raw) return { id: null, email: null, role: null, tenantId: null, permissions: [] };

    const parsed = JSON.parse(raw) as Record<string, unknown>;
    let role: string | null = null;
    if (typeof parsed.role === "string") {
      role = parsed.role;
    } else if (parsed.role && typeof parsed.role === "object") {
      const name = (parsed.role as Record<string, unknown>).name;
      if (typeof name === "string") role = name;
    }

    const directPermissions = Array.isArray(parsed.permissions)
      ? parsed.permissions.filter((value): value is string => typeof value === "string")
      : [];

    const rolePermissions =
      parsed.role &&
      typeof parsed.role === "object" &&
      Array.isArray((parsed.role as Record<string, unknown>).permissions)
        ? ((parsed.role as Record<string, unknown>).permissions as unknown[])
            .map((entry) => {
              if (typeof entry === "string") {
                return entry;
              }

              if (entry && typeof entry === "object" && typeof (entry as { key?: unknown }).key === "string") {
                return (entry as { key: string }).key;
              }

              return null;
            })
            .filter((value): value is string => typeof value === "string")
        : [];

    const permissions = [...new Set([...directPermissions, ...rolePermissions].map((value) => value.trim()).filter(Boolean))];

    return {
      id: typeof parsed.id === "string" ? parsed.id : null,
      email: typeof parsed.email === "string" ? parsed.email : null,
      role,
      tenantId: typeof parsed.tenantId === "string" ? parsed.tenantId : null,
      permissions
    };
  } catch {
    return { id: null, email: null, role: null, tenantId: null, permissions: [] };
  }
}

/** Lightweight, localStorage-backed current-user hook. */
export function useCurrentUser(): CurrentUser {
  const [user, setUser] = useState<CurrentUser>(() => readStoredUser());

  useEffect(() => {
    setUser(readStoredUser());
    const onStorage = () => setUser(readStoredUser());
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  return user;
}

export function canViewAuditHistoryForUser(user: Pick<CurrentUser, "role" | "permissions"> | null | undefined): boolean {
  if (!user) {
    return false;
  }

  if (Array.isArray(user.permissions) && user.permissions.includes(HISTORY_VIEW_PERMISSION)) {
    return true;
  }

  return Boolean(user.role && HISTORY_VISIBLE_ROLES.has(user.role));
}
