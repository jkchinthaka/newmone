"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const TABS: ReadonlyArray<{ label: string; href: string; match: (path: string) => boolean }> = [
  { label: "Settings", href: "/admin", match: (p) => p === "/admin" },
  { label: "Users", href: "/admin/users", match: (p) => p.startsWith("/admin/users") || p.startsWith("/admin/invitations") || p.startsWith("/admin/people") },
  { label: "Roles", href: "/admin/roles", match: (p) => p.startsWith("/admin/roles") },
  { label: "Approval rules", href: "/admin/approval-rules", match: (p) => p.startsWith("/admin/approval") },
  { label: "Master data", href: "/master-data", match: (p) => p.startsWith("/master-data") },
  { label: "Import data", href: "/admin/bulk-imports", match: (p) => p.startsWith("/admin/bulk-imports") }
];

/** One tab row for the main admin areas; every other admin page stays reachable from Settings. */
export function AdminTabs() {
  const pathname = usePathname() ?? "";
  return (
    <nav aria-label="Admin sections" className="mb-3 flex gap-5 overflow-x-auto border-b border-slate-200">
      {TABS.map((tab) => {
        const active = tab.match(pathname);
        return (
          <Link
            key={tab.href}
            href={tab.href as never}
            aria-current={active ? "page" : undefined}
            className={`-mb-px whitespace-nowrap border-b-2 px-1 py-2 text-sm ${active ? "border-blue-600 font-semibold text-slate-900" : "border-transparent text-slate-600 hover:text-slate-900"}`}
          >
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}
