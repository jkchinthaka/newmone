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
      className={`sticky top-0 hidden h-screen shrink-0 flex-col border-r border-slate-200 bg-white xl:flex ${collapsed ? "w-20" : "w-[264px]"}`}
    >
      <div className="flex items-center justify-between gap-2 border-b border-slate-200 px-3 py-3">
        {collapsed ? <NelnaLogo size="sm" className="max-h-8 max-w-[48px]" /> : <AppBrandLockup logoSize="sm" compact />}
        <button
          type="button"
          onClick={onToggleCollapsed}
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          aria-expanded={!collapsed}
          className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-lg text-slate-600 hover:bg-slate-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600"
        >
          <PanelLeft aria-hidden size={18} />
        </button>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto px-2 py-3">
        <Suspense fallback={<p className="px-2 text-sm text-slate-500">Loading navigation...</p>}>
          <NavLinks compact={collapsed} />
        </Suspense>
      </div>
    </aside>
  );
}
