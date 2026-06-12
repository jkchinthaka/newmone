"use client";

import { MaintainProLogo } from "@/components/brand/maintainpro-logo";
import { NavLinks } from "@/components/layout/nav-links";

export function Sidebar() {
  return (
    <aside
      aria-label="Sidebar navigation"
      className="hidden w-72 shrink-0 border-r border-slate-200 bg-white xl:block"
    >
      <div className="border-b border-slate-200 p-5">
        <MaintainProLogo showTagline size="sm" />
      </div>
      <div className="overflow-y-auto px-3 py-4">
        <NavLinks />
      </div>
    </aside>
  );
}
