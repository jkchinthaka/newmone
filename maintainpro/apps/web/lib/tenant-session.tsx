"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode
} from "react";

import { apiClient, getApiErrorMessage } from "@/lib/api-client";
import { clearAuthSession } from "@/lib/auth-storage";
import { getActiveTenantId, setActiveTenantId } from "@/lib/tenant-context";

export type TenantSessionState =
  | "INITIALIZING"
  | "READY"
  | "NO_MEMBERSHIP"
  | "SELECTION_REQUIRED"
  | "RECOVERING"
  | "ACCESS_DENIED"
  | "SESSION_EXPIRED"
  | "ERROR";

export type TenantMembershipSummary = {
  tenantId: string;
  tenantName?: string | null;
  isActive?: boolean;
  membershipActive?: boolean;
};

type TenantSessionContextValue = {
  state: TenantSessionState;
  tenantId: string | null;
  memberships: TenantMembershipSummary[];
  error: string | null;
  refresh: () => Promise<void>;
  selectTenant: (tenantId: string) => Promise<void>;
  mutationsAllowed: boolean;
};

const TenantSessionContext = createContext<TenantSessionContextValue | null>(null);

function normalizeMemberships(payload: unknown): TenantMembershipSummary[] {
  if (!payload || typeof payload !== "object") {
    return [];
  }
  const root = payload as {
    memberships?: unknown;
    tenants?: unknown;
    items?: unknown;
  };
  const list = (root.memberships ?? root.tenants ?? root.items ?? payload) as unknown;
  if (!Array.isArray(list)) {
    return [];
  }

  const out: TenantMembershipSummary[] = [];
  for (const item of list) {
    if (!item || typeof item !== "object") continue;
    const row = item as Record<string, unknown>;
    const tenantFromNested =
      row.tenant && typeof row.tenant === "object"
        ? (row.tenant as { id?: string; name?: string; isActive?: boolean })
        : null;
    const tenantId =
      (typeof row.tenantId === "string" && row.tenantId) ||
      (typeof row.id === "string" && row.id) ||
      (typeof tenantFromNested?.id === "string" ? tenantFromNested.id : null);
    if (!tenantId) continue;

    out.push({
      tenantId,
      tenantName:
        (typeof row.tenantName === "string" && row.tenantName) ||
        (typeof tenantFromNested?.name === "string" ? tenantFromNested.name : null),
      isActive: row.isActive !== false && tenantFromNested?.isActive !== false,
      membershipActive:
        row.membershipActive !== false && row.active !== false && row.status !== "DISABLED"
    });
  }
  return out;
}

export function TenantSessionProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<TenantSessionState>("INITIALIZING");
  const [tenantId, setTenantId] = useState<string | null>(null);
  const [memberships, setMemberships] = useState<TenantMembershipSummary[]>([]);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setError(null);
    setState((prev) => (prev === "READY" ? "RECOVERING" : "INITIALIZING"));

    try {
      await apiClient.get("/auth/me");
    } catch (err) {
      const status = (err as { response?: { status?: number } })?.response?.status;
      if (status === 401) {
        clearAuthSession();
        setState("SESSION_EXPIRED");
        return;
      }
      setError(getApiErrorMessage(err, "Unable to verify session"));
      setState("ERROR");
      return;
    }

    try {
      const response = await apiClient.get("/tenants/me");
      const nextMemberships = normalizeMemberships(response.data?.data).filter(
        (item) => item.isActive !== false && item.membershipActive !== false
      );
      setMemberships(nextMemberships);

      if (nextMemberships.length === 0) {
        setActiveTenantId(null);
        setTenantId(null);
        setState("NO_MEMBERSHIP");
        return;
      }

      const preferred = getActiveTenantId();
      const preferredValid = preferred
        ? nextMemberships.find((item) => item.tenantId === preferred)
        : null;

      if (preferredValid) {
        setActiveTenantId(preferredValid.tenantId);
        setTenantId(preferredValid.tenantId);
        setState("READY");
        return;
      }

      if (nextMemberships.length === 1) {
        const only = nextMemberships[0];
        setActiveTenantId(only.tenantId);
        setTenantId(only.tenantId);
        setState("READY");
        return;
      }

      setActiveTenantId(null);
      setTenantId(null);
      setState("SELECTION_REQUIRED");
    } catch (err) {
      const status = (err as { response?: { status?: number } })?.response?.status;
      const code = String(
        (err as { response?: { data?: { error?: { code?: string } } } })?.response?.data?.error?.code ?? ""
      ).toUpperCase();
      if (status === 403 || code.includes("TENANT") || code.includes("MEMBERSHIP")) {
        setState("ACCESS_DENIED");
        setError(getApiErrorMessage(err, "Tenant access denied"));
        return;
      }
      setError(getApiErrorMessage(err, "Unable to load tenant memberships"));
      setState("ERROR");
    }
  }, []);

  const selectTenant = useCallback(async (nextTenantId: string) => {
    setError(null);
    setState("RECOVERING");
    try {
      await apiClient.post(`/tenants/${nextTenantId}/switch`);
      setActiveTenantId(nextTenantId);
      setTenantId(nextTenantId);
      setState("READY");
    } catch (err) {
      setError(getApiErrorMessage(err, "Unable to switch tenant"));
      setState("ACCESS_DENIED");
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const value = useMemo<TenantSessionContextValue>(
    () => ({
      state,
      tenantId,
      memberships,
      error,
      refresh,
      selectTenant,
      mutationsAllowed: state === "READY" && Boolean(tenantId)
    }),
    [state, tenantId, memberships, error, refresh, selectTenant]
  );

  return <TenantSessionContext.Provider value={value}>{children}</TenantSessionContext.Provider>;
}

export function useTenantSession(): TenantSessionContextValue {
  const ctx = useContext(TenantSessionContext);
  if (!ctx) {
    throw new Error("useTenantSession must be used within TenantSessionProvider");
  }
  return ctx;
}

/** Optional hook for components that may render outside the provider during migration. */
export function useOptionalTenantSession(): TenantSessionContextValue | null {
  return useContext(TenantSessionContext);
}
