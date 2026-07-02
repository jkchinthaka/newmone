"use client";

import Link from "next/link";
import type { Route } from "next";
import { usePathname } from "next/navigation";
import {
  BellRing,
  ClipboardList,
  Home,
  Search,
  UserCircle2,
  type LucideIcon
} from "lucide-react";

import { getMobileBottomNavItems } from "@/lib/navigation";
import { extractRoleName } from "@/lib/role-redirect";
import { useCurrentUser } from "@/lib/use-current-user";

const MOBILE_ICON_MAP: Record<string, LucideIcon> = {
  Home,
  BellRing,
  ClipboardList,
  Search,
  UserCircle2
};

type Props = {
  onOpenSearch?: () => void;
};

export function MobileBottomNav({ onOpenSearch }: Props) {
  const pathname = usePathname();
  const user = useCurrentUser();
  const roleName = extractRoleName({ role: user.role });
  const items = getMobileBottomNavItems(roleName);

  return (
    <nav
      aria-label="Quick navigation"
      className="fixed inset-x-0 bottom-0 z-40 border-t border-slate-200 bg-white/95 px-2 py-1 backdrop-blur xl:hidden"
    >
      <ul className={`grid gap-1`} style={{ gridTemplateColumns: `repeat(${items.length}, minmax(0, 1fr))` }}>
        {items.map((item) => {
          const baseHref = item.href.split("?")[0];
          const active =
            item.action !== "search" &&
            (pathname === baseHref || pathname.startsWith(`${baseHref}/`) || pathname.startsWith(item.href));
          const Icon = MOBILE_ICON_MAP[item.icon] ?? Home;

          if (item.action === "search") {
            return (
              <li key={item.id}>
                <button
                  type="button"
                  onClick={onOpenSearch}
                  className="flex min-h-12 w-full flex-col items-center justify-center gap-0.5 rounded-lg text-[11px] font-medium text-slate-600"
                >
                  <Search size={18} aria-hidden />
                  <span>Search</span>
                </button>
              </li>
            );
          }

          return (
            <li key={item.id}>
              <Link
                href={item.href as Route}
                className={`flex min-h-12 w-full flex-col items-center justify-center gap-0.5 rounded-lg text-[11px] font-medium ${
                  active ? "bg-brand-50 text-brand-800" : "text-slate-600"
                }`}
              >
                <Icon size={18} aria-hidden />
                <span>{item.label}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
