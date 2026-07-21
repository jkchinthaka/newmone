"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "sonner";

import { GlobalCommandPalette } from "@/components/layout/global-command-palette";
import { MobileBottomNav } from "@/components/layout/mobile-bottom-nav";
import { MobileNav } from "@/components/layout/mobile-nav";
import { NavigationRouteGuard } from "@/components/layout/navigation-route-guard";
import { Sidebar } from "@/components/layout/sidebar";
import { Topbar } from "@/components/layout/topbar";
import {
  TenantSessionProvider,
  useTenantSession
} from "@/lib/tenant-session";

function DashboardShell({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const { state, memberships, error, selectTenant, refresh } = useTenantSession();
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [commandPaletteOpen, setCommandPaletteOpen] = useState(false);

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
    router.replace("/login?reason=session_expired");
    return null;
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
              className="rounded-lg bg-slate-900 px-4 py-2 text-sm text-white"
              onClick={() => void refresh()}
            >
              Retry
            </button>
            <button
              type="button"
              className="rounded-lg border border-slate-300 px-4 py-2 text-sm text-slate-700"
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
                  onClick={() => void selectTenant(membership.tenantId)}
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
      <div className="flex min-h-screen">
        <Sidebar />
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
