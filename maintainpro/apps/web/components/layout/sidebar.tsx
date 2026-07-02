"use client";

import { Suspense } from "react";

import { AppBrandLockup } from "@/components/brand/app-brand-lockup";
import { NavLinks } from "@/components/layout/nav-links";

export function Sidebar() {
  return (
    <aside
      aria-label="Sidebar navigation"
      className="hidden w-72 shrink-0 border-r border-slate-200 bg-white xl:block"
    >
      <div className="border-b border-slate-200 p-5">
        <AppBrandLockup logoSize="sm" showTagline />
      </div>
      <div className="overflow-y-auto px-3 py-4">
        <Suspense fallback={<p className="px-2 text-sm text-slate-500">Loading navigation...</p>}>
          <NavLinks />
        </Suspense>
      </div>
    </aside>
  );
}
