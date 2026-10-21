"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { Route } from "next";

const LINKS = [
  { href: "/admin/maintenance-config", title: "General" },
  { href: "/admin/job-categories", title: "Job categories" },
  { href: "/admin/priority-sla", title: "Priority & SLA" },
  { href: "/admin/approval-rules", title: "Approval rules" },
  { href: "/admin/reason-codes", title: "Reason codes" },
  { href: "/admin/fault-codes", title: "Fault codes" },
  { href: "/admin/work-permits", title: "Work permits" }
] as const;

export function MaintenanceSettingsNav() {
  const pathname = usePathname();
  return (
    <nav aria-label="Maintenance settings" className="rounded-card border border-slate-200 bg-white p-2 shadow-card">
      <ul className="grid gap-1">
        {LINKS.map((link) => {
          const active = pathname === link.href;
          return (
            <li key={link.href}>
              <Link
                href={link.href as Route}
                aria-current={active ? "page" : undefined}
                className={`flex min-h-11 items-center rounded-md px-3 text-sm ${active ? "bg-brand-600 font-medium text-white" : "text-slate-700 hover:bg-slate-50"}`}
              >
                {link.title}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
