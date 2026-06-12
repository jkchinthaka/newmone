"use client";

import Link from "next/link";
import { Bell, Building2, CreditCard, Menu, Search, UserCircle2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { MaintainProLogo } from "@/components/brand/maintainpro-logo";
import { useNotificationsSocket } from "@/hooks/use-notifications-socket";
import {
  clearAuthSession,
  updateStoredUserTenant
} from "@/lib/auth-storage";
import { apiClient } from "@/lib/api-client";
import { getActiveTenantId, setActiveTenantId } from "@/lib/tenant-context";
import { useCurrentUser } from "@/lib/use-current-user";
import {
  MOBILE_MENU_BUTTON_ID,
  MOBILE_NAV_DRAWER_ID,
  toAriaExpanded
} from "@/lib/accessibility";

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

type TopbarProps = {
  onOpenMobileNav?: () => void;
  onOpenCommandPalette?: () => void;
  mobileNavOpen?: boolean;
  mobileNavId?: string;
};

function formatUserLabel(email: string | null, role: string | null): string {
  if (email && role) {
    return `${email} · ${role.replace(/_/g, " ")}`;
  }

  if (email) {
    return email;
  }

  if (role) {
    return role.replace(/_/g, " ");
  }

  return "Signed in";
}

export function Topbar({
  onOpenMobileNav,
  onOpenCommandPalette,
  mobileNavOpen = false,
  mobileNavId = MOBILE_NAV_DRAWER_ID
}: TopbarProps) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const currentUser = useCurrentUser();

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
    onSuccess: (_payload, tenantId) => {
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

  async function logout() {
    try {
      await apiClient.post("/auth/logout", {});
    } catch {
      // Local logout should still complete if the API is temporarily unavailable.
    } finally {
      clearAuthSession();
      queryClient.clear();
      router.replace("/login");
    }
  }

  const selectedTenantId =
    tenantContextQuery.data?.activeTenant?.id ?? getActiveTenantId() ?? "";

  const userLabel = formatUserLabel(currentUser.email, currentUser.role);

  return (
    <header className="sticky top-0 z-20 border-b border-slate-200 bg-white/90 backdrop-blur">
      <div className="flex h-16 items-center justify-between gap-3 px-4 sm:px-6">
        <div className="flex min-w-0 items-center gap-3">
          <button
            type="button"
            id={MOBILE_MENU_BUTTON_ID}
            aria-label="Open navigation menu"
            aria-controls={mobileNavId}
            aria-expanded={toAriaExpanded(mobileNavOpen)}
            className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-lg border border-slate-200 text-slate-700 hover:bg-slate-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500 xl:hidden"
            onClick={onOpenMobileNav}
          >
            <Menu aria-hidden size={20} />
          </button>
          <div className="xl:hidden">
            <MaintainProLogo size="sm" />
          </div>
          <button
            type="button"
            aria-label="Open command palette"
            aria-keyshortcuts="Control+K Meta+K"
            className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500 sm:hidden"
            onClick={onOpenCommandPalette}
          >
            <Search aria-hidden size={18} />
          </button>
          <button
            type="button"
            aria-label="Open command palette"
            aria-keyshortcuts="Control+K Meta+K"
            className="hidden min-h-11 max-w-full items-center gap-2 overflow-hidden rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-500 hover:bg-slate-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500 sm:inline-flex lg:min-w-[14rem]"
            onClick={onOpenCommandPalette}
          >
            <Search aria-hidden size={16} />
            <span className="truncate">Search modules...</span>
            <kbd className="ml-auto hidden shrink-0 rounded border border-slate-200 bg-white px-1.5 py-0.5 text-[10px] font-medium text-slate-500 xl:inline">
              Ctrl K
            </kbd>
          </button>
        </div>
        <div className="flex min-w-0 items-center gap-2 sm:gap-3">
          <p
            className="hidden max-w-48 truncate text-xs text-slate-500 md:block lg:max-w-64"
            title={userLabel}
          >
            {userLabel}
          </p>
          <div className="hidden items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 sm:flex">
            <Building2 size={16} className="shrink-0 text-slate-500" />
            <select
              value={selectedTenantId}
              onChange={(event) => {
                const nextTenantId = event.target.value;
                if (!nextTenantId || nextTenantId === selectedTenantId) {
                  return;
                }
                switchTenantMutation.mutate(nextTenantId);
              }}
              className="max-w-40 bg-transparent text-sm text-slate-700 outline-none lg:max-w-48"
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
          <Link
            href="/billing"
            className="hidden items-center gap-1.5 rounded-full border border-slate-200 px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500 lg:inline-flex"
          >
            <CreditCard size={16} />
            <span>Billing</span>
          </Link>
          <Link
            href="/notifications"
            className="relative inline-flex min-h-11 min-w-11 items-center justify-center rounded-full border border-slate-200 text-slate-600 hover:bg-slate-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500"
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
            type="button"
            onClick={logout}
            className="inline-flex min-h-11 items-center gap-2 rounded-full border border-slate-200 px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500"
          >
            <UserCircle2 size={18} />
            <span className="hidden sm:inline">Logout</span>
          </button>
        </div>
      </div>
    </header>
  );
}
