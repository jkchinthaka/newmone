"use client";

import Link from "next/link";
import type { Route } from "next";
import { usePathname } from "next/navigation";
import { useMemo } from "react";

import { getVisibleNavigationItems } from "@/lib/navigation";
import { useCurrentUser } from "@/lib/use-current-user";

/** One Jobs menu item; the lanes and history are tabs here (only the ones this person may open). */
const LANES = [
  { id: "all-jobs", href: "/maintenance/jobs", label: "All" },
  { id: "machinery-jobs", href: "/maintenance/jobs/machinery", label: "Machinery" },
  { id: "service-jobs", href: "/maintenance/jobs/service", label: "Service" },
  { id: "vehicle-jobs", href: "/maintenance/jobs/vehicle", label: "Vehicle" },
  { id: "maintenance-history", href: "/maintenance/history", label: "History" }
] as const;

export function JobLaneTabs() {
  const pathname = usePathname();
  const user = useCurrentUser();
  const tabs = useMemo(() => {
    const allowed = new Set(getVisibleNavigationItems(user.role, { permissions: user.permissions }).map((item) => item.id));
    return LANES.filter((lane) => allowed.has(lane.id));
  }, [user.role, user.permissions]);
  if (tabs.length < 2) return null;
  return (
    <nav aria-label="Job lists" className="-mx-1 mb-3 overflow-x-auto px-1">
      <div className="inline-flex gap-1 rounded-xl bg-white p-1 ring-1 ring-slate-200">
        {tabs.map((tab) => {
          const active = pathname === tab.href;
          return (
            <Link
              key={tab.id}
              href={tab.href as Route}
              aria-current={active ? "page" : undefined}
              className={`inline-flex min-h-10 items-center whitespace-nowrap rounded-lg px-4 text-sm ${
                active ? "bg-brand-600 font-semibold text-white" : "text-slate-700 hover:bg-slate-100"
              }`}
            >
              {tab.label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
