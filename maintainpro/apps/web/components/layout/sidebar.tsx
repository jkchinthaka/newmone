"use client";

import { Suspense } from "react";
import { PanelLeft } from "lucide-react";

import { AppBrandLockup } from "@/components/brand/app-brand-lockup";
import { NelnaLogo } from "@/components/brand/nelna-logo";
import { NavLinks } from "@/components/layout/nav-links";

export function Sidebar({ collapsed = false, onToggleCollapsed }: { collapsed?: boolean; onToggleCollapsed?: () => void }) {
  return (
    <aside
      aria-label="Sidebar navigation"
      className={`sticky top-0 hidden h-screen shrink-0 flex-col bg-brand-900 text-white xl:flex ${collapsed ? "w-20" : "w-[248px]"}`}
    >
      <div className={`flex gap-2 border-b border-white/10 px-2 py-2 ${collapsed ? "flex-col items-center" : "flex-row items-center justify-between px-3"}`}>
        {collapsed ? <NelnaLogo decorative size="compact" /> : <AppBrandLockup logoSize="sm" variant="onDark" />}
        <button
          type="button"
          onClick={onToggleCollapsed}
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          aria-expanded={!collapsed}
          className="inline-flex min-h-10 min-w-10 items-center justify-center rounded-lg text-white/80 hover:bg-white/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-500"
        >
          <PanelLeft aria-hidden size={18} />
        </button>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto px-2 py-3">
        <Suspense fallback={<p className="px-2 text-sm text-slate-500">Loading navigation...</p>}>
          <NavLinks compact={collapsed} tone="inverse" />
        </Suspense>
      </div>
    </aside>
  );
}
