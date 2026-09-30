"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "sonner";

import { GlobalCommandPalette } from "@/components/layout/global-command-palette";
import { MobileBottomNav } from "@/components/layout/mobile-bottom-nav";
import { MobileNav } from "@/components/layout/mobile-nav";
import { NavigationRouteGuard } from "@/components/layout/navigation-route-guard";
import { NetworkStatusBanner } from "@/components/layout/network-status-banner";
import { Sidebar } from "@/components/layout/sidebar";
import { Topbar } from "@/components/layout/topbar";
import {
  TenantSessionProvider,
  useTenantSession
} from "@/lib/tenant-session";
import { safeInternalReturnPath } from "@/lib/role-redirect";

function DashboardShell({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const { state, memberships, error, selectTenant, refresh } = useTenantSession();
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [commandPaletteOpen, setCommandPaletteOpen] = useState(false);

  useEffect(() => {
    if (state === "SESSION_EXPIRED") {
      const current = `${window.location.pathname}${window.location.search}`;
      const returnTo = safeInternalReturnPath(current);
      const params = new URLSearchParams({ reason: "session_expired" });
      if (returnTo) params.set("returnTo", returnTo);
      router.replace(`/login?${params.toString()}`);
    }
  }, [router, state]);

  if (state === "INITIALIZING" || state === "RECOVERING") {
    return (
      <div
        className="grid min-h-screen place-items-center bg-slate-100 text-sm text-slate-600"
        role="status"
        aria-live="polite"
      >
        {state === "RECOVERING" ? "Recovering tenant session..." : "Verifying session and tenant..."}
      </div>
    );
  }

  if (state === "SESSION_EXPIRED") {
    return (
      <div
        className="grid min-h-screen place-items-center bg-slate-100 text-sm text-slate-600"
        role="status"
        aria-live="polite"
      >
        Session expired. Redirecting to sign in...
      </div>
    );
  }

  if (state === "NO_MEMBERSHIP" || state === "ACCESS_DENIED" || state === "ERROR") {
    return (
      <div className="grid min-h-screen place-items-center bg-slate-100 p-6">
        <div className="max-w-md rounded-2xl border border-slate-200 bg-white p-6 text-center shadow-sm">
          <h1 className="text-lg font-semibold text-slate-900">Tenant access required</h1>
          <p className="mt-2 text-sm text-slate-600">
            {error ??
              (state === "NO_MEMBERSHIP"
                ? "Your account has no active tenant memberships."
                : "Unable to initialize tenant context.")}
          </p>
          <div className="mt-4 flex justify-center gap-2">
            <button
              type="button"
              className="min-h-11 rounded-lg bg-slate-900 px-4 py-2 text-sm text-white"
              onClick={() => void refresh()}
            >
              Retry
            </button>
            <button
              type="button"
              className="min-h-11 rounded-lg border border-slate-300 px-4 py-2 text-sm text-slate-700"
              onClick={() => router.replace("/login")}
            >
              Sign in again
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (state === "SELECTION_REQUIRED") {
    return (
      <div className="grid min-h-screen place-items-center bg-slate-100 p-6">
        <div className="w-full max-w-lg rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h1 className="text-lg font-semibold text-slate-900">Select a tenant</h1>
          <p className="mt-2 text-sm text-slate-600">
            Choose an active organization to continue. Business mutations stay blocked until a tenant
            is selected.
          </p>
          <ul className="mt-4 space-y-2">
            {memberships.map((membership) => (
              <li key={membership.tenantId}>
                <button
                  type="button"
                  className="w-full rounded-xl border border-slate-200 px-4 py-3 text-left text-sm hover:border-slate-400"
                  onClick={() => void selectTenant(membership.tenantId).catch(() => undefined)}
                >
                  <span className="font-medium text-slate-900">
                    {membership.tenantName ?? membership.tenantId}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-100">
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-lg focus:bg-white focus:px-4 focus:py-3 focus:text-sm focus:font-semibold focus:text-slate-900 focus:outline focus:outline-2 focus:outline-offset-2 focus:outline-brand-500"
      >
        Skip to content
      </a>
      <NetworkStatusBanner />
      <div className="flex min-h-screen">
        <Sidebar collapsed={sidebarCollapsed} onToggleCollapsed={() => setSidebarCollapsed((current) => !current)} />
        <MobileNav open={mobileNavOpen} onClose={() => setMobileNavOpen(false)} />
        <div className="flex min-w-0 flex-1 flex-col">
          <Topbar
            mobileNavOpen={mobileNavOpen}
            onOpenCommandPalette={() => setCommandPaletteOpen(true)}
            onOpenMobileNav={() => setMobileNavOpen(true)}
          />
          <main id="main-content" className="flex-1 overflow-x-hidden p-4 pb-24 sm:p-6 xl:pb-6">
            <NavigationRouteGuard>{children}</NavigationRouteGuard>
          </main>
        </div>
      </div>
      <MobileBottomNav onOpenSearch={() => setCommandPaletteOpen(true)} />
      <GlobalCommandPalette open={commandPaletteOpen} onOpenChange={setCommandPaletteOpen} />
      <Toaster closeButton position="top-center" richColors duration={4_000} />
    </div>
  );
}

export default function DashboardLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 30_000,
            refetchOnWindowFocus: false
          }
        }
      })
  );

  return (
    <QueryClientProvider client={queryClient}>
      <TenantSessionProvider>
        <DashboardShell>{children}</DashboardShell>
      </TenantSessionProvider>
    </QueryClientProvider>
  );
}
