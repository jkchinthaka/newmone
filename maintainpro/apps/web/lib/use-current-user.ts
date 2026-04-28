"use client";

import { useEffect, useState } from "react";
import { USER_KEY } from "@/lib/auth-storage";

const HISTORY_VISIBLE_ROLES = new Set<string>(["SUPER_ADMIN", "ADMIN", "ASSET_MANAGER"]);

export interface CurrentUser {
  id: string | null;
  email: string | null;
  role: string | null;
  tenantId: string | null;
}

function readStoredUser(): CurrentUser {
  if (typeof window === "undefined") {
    return { id: null, email: null, role: null, tenantId: null };
  }

  try {
    const raw = window.localStorage.getItem(USER_KEY);
    if (!raw) return { id: null, email: null, role: null, tenantId: null };

    const parsed = JSON.parse(raw) as Record<string, unknown>;
    let role: string | null = null;
    if (typeof parsed.role === "string") {
      role = parsed.role;
    } else if (parsed.role && typeof parsed.role === "object") {
      const name = (parsed.role as Record<string, unknown>).name;
      if (typeof name === "string") role = name;
    }

    return {
      id: typeof parsed.id === "string" ? parsed.id : null,
      email: typeof parsed.email === "string" ? parsed.email : null,
      role,
      tenantId: typeof parsed.tenantId === "string" ? parsed.tenantId : null
    };
  } catch {
    return { id: null, email: null, role: null, tenantId: null };
  }
}

/** Lightweight, localStorage-backed current-user hook. */
export function useCurrentUser(): CurrentUser {
  const [user, setUser] = useState<CurrentUser>({
    id: null,
    email: null,
    role: null,
    tenantId: null
  });

  useEffect(() => {
    setUser(readStoredUser());
    const onStorage = () => setUser(readStoredUser());
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  return user;
}

export function canViewAuditHistory(role: string | null | undefined): boolean {
  return Boolean(role && HISTORY_VISIBLE_ROLES.has(role));
}
