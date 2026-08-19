"use client";

import Link from "next/link";
import { Bell, CreditCard, Menu, Search, UserCircle2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { NelnaLogo } from "@/components/brand/nelna-logo";
import { TenantSwitcher } from "@/components/layout/tenant-switcher";
import { PRODUCT_NAME } from "@/lib/branding";
import { useNotificationsSocket } from "@/hooks/use-notifications-socket";
import { clearAuthSession } from "@/lib/auth-storage";
import { apiClient } from "@/lib/api-client";
import { getVisibleNavigationItems } from "@/lib/navigation";
import { extractRoleName } from "@/lib/role-redirect";
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

export const TOPBAR_UNREAD_QUERY_KEY = ["notifications", "unread-count"] as const;

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
  const roleName = extractRoleName({ role: currentUser.role });
  const canViewBilling = getVisibleNavigationItems(roleName, { permissions: currentUser.permissions }).some(
    (item) => item.id === "billing"
  );

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
          <div className="flex min-w-0 items-center gap-2 xl:hidden">
            <NelnaLogo size="sm" />
            <span className="truncate text-sm font-semibold tracking-tight text-slate-900">
              {PRODUCT_NAME}
            </span>
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
            <span className="truncate">Search modules or records...</span>
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
          <TenantSwitcher className="hidden sm:flex" />
          {canViewBilling ? (
            <Link
              href="/billing"
              className="hidden items-center gap-1.5 rounded-full border border-slate-200 px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500 lg:inline-flex"
            >
              <CreditCard size={16} />
              <span>Billing</span>
            </Link>
          ) : null}
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
