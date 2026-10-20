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
import { useQueryClient } from "@tanstack/react-query";

import { apiClient, getApiErrorMessage } from "@/lib/api-client";
import { clearAuthSession, clearStoredTokens, mergeStoredPublicUserProfile } from "@/lib/auth-storage";
import { getActiveTenantId, setActiveTenantId } from "@/lib/tenant-context";
import { loadTenantSession, type TenantMembershipSummary } from "@/lib/tenant-session-load";

export type { TenantMembershipSummary };

export type TenantSessionState =
  | "INITIALIZING"
  | "READY"
  | "NO_MEMBERSHIP"
  | "SELECTION_REQUIRED"
  | "RECOVERING"
  | "ACCESS_DENIED"
  | "SESSION_EXPIRED"
  | "ERROR";

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

/** Share one /auth/me probe across React strict-mode's double mount. */
let sessionProbe: Promise<void> | null = null;

export function TenantSessionProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const [state, setState] = useState<TenantSessionState>("INITIALIZING");
  const [tenantId, setTenantId] = useState<string | null>(null);
  const [memberships, setMemberships] = useState<TenantMembershipSummary[]>([]);
  const [error, setError] = useState<string | null>(null);

  // Cookie-session apps must not keep transitional localStorage JWTs around.
  useEffect(() => {
    clearStoredTokens();
  }, []);

  const refresh = useCallback(async () => {
    setError(null);
    setState((prev) => (prev === "READY" ? "RECOVERING" : "INITIALIZING"));

    const result = await loadTenantSession(apiClient, getActiveTenantId());
    if (result.kind === "session_expired") {
      clearAuthSession();
      setState("SESSION_EXPIRED");
      return;
    }
    if (result.kind === "error") {
      setError(result.message);
      setState("ERROR");
      return;
    }
    if (result.kind === "access_denied") {
      setError(result.message);
      setState("ACCESS_DENIED");
      return;
    }

    mergeStoredPublicUserProfile(result.profile);
    setMemberships(result.memberships);
    if (result.kind === "no_membership") {
      setActiveTenantId(null);
      setTenantId(null);
      setState("NO_MEMBERSHIP");
      return;
    }
    if (result.kind === "selection_required") {
      setActiveTenantId(null);
      setTenantId(null);
      setState("SELECTION_REQUIRED");
      return;
    }

    setActiveTenantId(result.tenantId);
    setTenantId(result.tenantId);
    setState("READY");
  }, []);

  const selectTenant = useCallback(async (nextTenantId: string) => {
    setError(null);
    try {
      await apiClient.post(`/tenants/${nextTenantId}/switch`);
      setActiveTenantId(nextTenantId);
      setTenantId(nextTenantId);
      queryClient.clear();
      setState("READY");
    } catch (err) {
      setError(getApiErrorMessage(err, "Unable to switch tenant"));
      setState("ACCESS_DENIED");
      throw err;
    }
  }, [queryClient]);

  useEffect(() => {
    const probe = sessionProbe ?? refresh();
    sessionProbe = probe;
    void probe.finally(() => {
      if (sessionProbe === probe) sessionProbe = null;
    });
    const onPageShow = (event: PageTransitionEvent) => {
      if (event.persisted) void refresh();
    };
    window.addEventListener("pageshow", onPageShow);
    return () => window.removeEventListener("pageshow", onPageShow);
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
