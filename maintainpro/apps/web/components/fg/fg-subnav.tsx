"use client";

import Link from "next/link";
import type { Route } from "next";
import { usePathname } from "next/navigation";

const LINKS = [
  { href: "/fg", label: "Dashboard", match: (path: string) => path === "/fg" || path === "/fg/dashboard" },
  { href: "/fg/records", label: "Today's records", match: (path: string) => path.startsWith("/fg/records") },
  { href: "/fg/review", label: "Supervisor", match: (path: string) => path.startsWith("/fg/review") },
  { href: "/fg/qa", label: "QA", match: (path: string) => path.startsWith("/fg/qa") },
  { href: "/fg/history", label: "History", match: (path: string) => path.startsWith("/fg/history") || path.startsWith("/fg/reports") }
];

export function FgSubnav() {
  const pathname = usePathname() || "/fg";
  return (
    <nav aria-label="FG Digital Records" className="mb-5 flex flex-wrap gap-2">
      {LINKS.map((link) => {
        const active = link.match(pathname);
        return (
          <Link
            key={link.href}
            href={link.href as Route}
            className={`inline-flex min-h-11 items-center rounded-lg px-3 text-sm font-semibold ${
              active ? "bg-brand-600 text-white" : "border border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
            }`}
          >
            {link.label}
          </Link>
        );
      })}
    </nav>
  );
}
