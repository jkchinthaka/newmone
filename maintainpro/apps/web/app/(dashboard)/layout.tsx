"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "sonner";

import { GlobalCommandPalette } from "@/components/layout/global-command-palette";
import { MobileNav } from "@/components/layout/mobile-nav";
import { Sidebar } from "@/components/layout/sidebar";
import { Topbar } from "@/components/layout/topbar";
import { apiClient } from "@/lib/api-client";
import { setActiveTenantId } from "@/lib/tenant-context";

export default function DashboardLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  const router = useRouter();
  const [ready, setReady] = useState(false);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [commandPaletteOpen, setCommandPaletteOpen] = useState(false);
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

  useEffect(() => {
    async function validateSession() {
      try {
        const response = await apiClient.get<{ data?: { tenantId?: string | null } }>(
          "/auth/me"
        );

        const tenantId = response.data?.data?.tenantId;
        setActiveTenantId(typeof tenantId === "string" && tenantId.trim().length > 0 ? tenantId : null);

        setReady(true);
      } catch {
        router.replace("/login");
      }
    }

    validateSession();
  }, [router]);

  if (!ready) {
    return (
      <div
        className="grid min-h-screen place-items-center bg-slate-100 text-sm text-slate-600"
        role="status"
        aria-live="polite"
      >
        Verifying session...
      </div>
    );
  }

  return (
    <QueryClientProvider client={queryClient}>
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
            <main id="main-content" className="flex-1 overflow-x-hidden p-4 sm:p-6">
              {children}
            </main>
          </div>
        </div>
      </div>
      <GlobalCommandPalette open={commandPaletteOpen} onOpenChange={setCommandPaletteOpen} />
      <Toaster closeButton position="top-center" richColors duration={4_000} />
    </QueryClientProvider>
  );
}
