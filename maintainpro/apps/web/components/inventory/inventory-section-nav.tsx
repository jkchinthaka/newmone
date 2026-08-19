"use client";

import Link from "next/link";
import type { Route } from "next";
import { usePathname } from "next/navigation";

const LINKS = [
  { href: "/inventory", label: "Dashboard" },
  { href: "/inventory/movements", label: "Movements" },
  { href: "/inventory/daily", label: "Daily Inventory" },
  { href: "/inventory/import", label: "ERP / Excel Import" }
] as const;

export function InventorySectionNav() {
  const pathname = usePathname();

  return (
    <nav className="flex flex-wrap gap-2" aria-label="Inventory sections">
      {LINKS.map((link) => {
        const active = link.href === "/inventory" ? pathname === "/inventory" : pathname.startsWith(link.href);
        return (
          <Link
            key={link.href}
            href={link.href as Route}
            className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition ${
              active
                ? "border-brand-300 bg-brand-50 text-brand-800"
                : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
            }`}
          >
            {link.label}
          </Link>
        );
      })}
    </nav>
  );
}
