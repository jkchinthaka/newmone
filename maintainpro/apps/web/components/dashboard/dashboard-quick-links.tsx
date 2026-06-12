import Link from "next/link";
import type { Route } from "next";
import { ArrowRight } from "lucide-react";

import { getVisibleNavigationItems } from "@/lib/navigation";
import { normalizeDashboardRole } from "@/lib/dashboard-roles";

import { DashboardSection } from "./dashboard-section";

type DashboardQuickLinksProps = {
  roleName: string | null;
  title?: string;
  description?: string;
};

export function DashboardQuickLinks({
  roleName,
  title = "Quick links",
  description = "Open modules available to your role."
}: DashboardQuickLinksProps) {
  const normalizedRole = normalizeDashboardRole(roleName);
  const links = getVisibleNavigationItems(normalizedRole).filter(
    (item) => item.href !== "/dashboard" && !item.legacy
  );

  if (links.length === 0) {
    return null;
  }

  return (
    <DashboardSection title={title} description={description}>
      <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
        {links.map((item) => (
          <Link
            key={item.id}
            href={item.href as Route}
            className="group flex items-start justify-between gap-3 rounded-lg border border-slate-200 bg-slate-50 px-3 py-3 text-sm text-slate-700 transition hover:border-brand-200 hover:bg-brand-50 hover:text-brand-800"
          >
            <span>
              <span className="font-semibold text-slate-900 group-hover:text-brand-900">{item.label}</span>
              {item.description ? (
                <span className="mt-1 block text-xs text-slate-500 group-hover:text-brand-700">{item.description}</span>
              ) : null}
            </span>
            <ArrowRight size={16} className="mt-0.5 shrink-0 opacity-60" aria-hidden="true" />
          </Link>
        ))}
      </div>
    </DashboardSection>
  );
}
