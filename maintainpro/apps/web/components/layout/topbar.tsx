"use client";

import Link from "next/link";
import { Bell, Building2, CreditCard, Search, UserCircle2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { useNotificationsSocket } from "@/hooks/use-notifications-socket";
import {
  clearAuthSession,
  setAccessToken,
  updateStoredUserTenant
} from "@/lib/auth-storage";
import { apiClient } from "@/lib/api-client";
import { getActiveTenantId, setActiveTenantId } from "@/lib/tenant-context";

type NotificationsEnvelope = {
  data?: {
    items?: unknown[];
  };
  meta?: {
    total?: number;
  };
};

type TenantContextEnvelope = {
  data?: {
    activeTenant?: {
      id: string;
      name: string;
      slug: string;
      isActive: boolean;
    } | null;
    memberships?: Array<{
      tenantId: string;
      tenantName: string;
      tenantSlug: string;
      membershipRole: string;
      isActive: boolean;
    }>;
  };
};

type TenantSwitchEnvelope = {
  data?: {
    accessToken?: string;
    tenant?: {
      id: string;
      name: string;
      slug: string;
      isActive: boolean;
    };
  };
};

export const TOPBAR_UNREAD_QUERY_KEY = ["notifications", "unread-count"] as const;
export const TOPBAR_TENANT_QUERY_KEY = ["tenants", "context"] as const;

export function Topbar() {
  const router = useRouter();
  const queryClient = useQueryClient();

  const unreadQuery = useQuery({
    queryKey: TOPBAR_UNREAD_QUERY_KEY,
    queryFn: async () => {
      const response = await apiClient.get<NotificationsEnvelope>("/notifications", {
        params: {
          status: "UNREAD",
          page: 1,
          pageSize: 1
        }
      });

      return Number(response.data.meta?.total ?? response.data.data?.items?.length ?? 0);
    },
    refetchInterval: 30_000,
    staleTime: 10_000
  });

  const tenantContextQuery = useQuery({
    queryKey: TOPBAR_TENANT_QUERY_KEY,
    queryFn: async () => {
      const response = await apiClient.get<TenantContextEnvelope>("/tenants/me");
      return response.data.data;
    },
    staleTime: 15_000
  });

  const switchTenantMutation = useMutation({
    mutationFn: async (tenantId: string) => {
      const response = await apiClient.post<TenantSwitchEnvelope>(
        `/tenants/${tenantId}/switch`
      );
      return response.data.data;
    },
    onSuccess: (payload, tenantId) => {
      if (payload?.accessToken) {
        setAccessToken(payload.accessToken);
      }

      setActiveTenantId(tenantId);
      updateStoredUserTenant(tenantId);

      queryClient.invalidateQueries();
      toast.success("Tenant switched successfully");
    },
    onError: (error: unknown) => {
      if (error && typeof error === "object" && "message" in error) {
        toast.error(String((error as { message: string }).message));
        return;
      }
      toast.error("Failed to switch tenant");
    }
  });

  useNotificationsSocket((payload) => {
    queryClient.invalidateQueries({ queryKey: TOPBAR_UNREAD_QUERY_KEY });

    if (payload && typeof payload === "object" && "title" in payload) {
      const title = (payload as Record<string, unknown>).title;
      if (typeof title === "string" && title.trim()) {
        toast.info(title);
      }
    }
  });

  function logout() {
    clearAuthSession();
    router.replace("/login");
  }

  const selectedTenantId =
    tenantContextQuery.data?.activeTenant?.id ?? getActiveTenantId() ?? "";

  return (
    <header className="sticky top-0 z-20 border-b border-slate-200 bg-white/90 backdrop-blur">
      <div className="flex h-16 items-center justify-between gap-4 px-4 sm:px-6">
        <div className="hidden items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-500 lg:flex">
          <Search size={16} />
          <span>Search assets, work orders, vehicles...</span>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5">
            <Building2 size={16} className="text-slate-500" />
            <select
              value={selectedTenantId}
              onChange={(event) => {
                const nextTenantId = event.target.value;
                if (!nextTenantId || nextTenantId === selectedTenantId) {
                  return;
                }
                switchTenantMutation.mutate(nextTenantId);
              }}
              className="max-w-48 bg-transparent text-sm text-slate-700 outline-none"
              aria-label="Switch organization"
              disabled={switchTenantMutation.isPending}
            >
              <option value="">Select organization</option>
              {(tenantContextQuery.data?.memberships ?? []).map((membership) => (
                <option key={membership.tenantId} value={membership.tenantId}>
                  {membership.tenantName}
                </option>
              ))}
            </select>
          </div>
          <a
            href="/billing"
            className="hidden items-center gap-1.5 rounded-full border border-slate-200 px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-100 sm:inline-flex"
          >
            <CreditCard size={16} />
            <span>Billing</span>
          </a>
          <Link
            href="/notifications"
            className="relative rounded-full border border-slate-200 p-2 text-slate-600 hover:bg-slate-100"
            aria-label="Open notifications"
          >
            <Bell size={18} />
            {(unreadQuery.data ?? 0) > 0 ? (
              <span className="absolute -right-1 -top-1 min-w-5 rounded-full bg-rose-500 px-1.5 text-center text-[10px] font-semibold text-white">
                {(unreadQuery.data ?? 0) > 99 ? "99+" : unreadQuery.data}
              </span>
            ) : null}
          </Link>
          <button
            onClick={logout}
            className="flex items-center gap-2 rounded-full border border-slate-200 px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-100"
          >
            <UserCircle2 size={18} />
            <span>Logout</span>
          </button>
        </div>
      </div>
    </header>
  );
}
