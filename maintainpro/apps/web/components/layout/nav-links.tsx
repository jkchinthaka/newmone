"use client";

import Link from "next/link";
import type { Route } from "next";
import { usePathname } from "next/navigation";
import {
  AlertTriangle,
  Archive,
  Bell,
  BellRing,
  Bot,
  Building2,
  ChartColumnBig,
  ClipboardCheck,
  ClipboardList,
  CreditCard,
  Database,
  Droplets,
  FileCheck2,
  Fuel,
  Gauge,
  HardDrive,
  Layers,
  LayoutDashboard,
  Leaf,
  MapPin,
  QrCode,
  Receipt,
  ServerCog,
  Settings,
  ShieldCheck,
  SprayCan,
  Sprout,
  Sun,
  Tag,
  Tractor,
  Users,
  Wallet,
  type LucideIcon
} from "lucide-react";

import {
  getNavigationGroups,
  isNavItemActive,
  type NavCategory,
  type NavigationItem
} from "@/lib/navigation";
import { toNavAriaCurrent } from "@/lib/accessibility";
import { extractRoleName } from "@/lib/role-redirect";
import { useCurrentUser } from "@/lib/use-current-user";

const ICON_MAP: Record<string, LucideIcon> = {
  LayoutDashboard,
  ServerCog,
  ClipboardList,
  HardDrive,
  Fuel,
  Gauge,
  Layers,
  ClipboardCheck,
  ShieldCheck,
  AlertTriangle,
  FileCheck2,
  Receipt,
  ChartColumnBig,
  Droplets,
  Bot,
  Database,
  Tag,
  Bell,
  BellRing,
  CreditCard,
  Settings,
  SprayCan,
  QrCode,
  MapPin,
  Tractor,
  Sprout,
  Leaf,
  Sun,
  Users,
  Wallet,
  Archive,
  Building2
};

const GROUP_SURFACE: Record<
  NavCategory,
  { container: string; heading: string; active: string; idle: string }
> = {
  core: {
    container: "",
    heading: "text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-500",
    active: "bg-brand-100 text-brand-800 ring-1 ring-brand-200",
    idle: "text-slate-600 hover:bg-slate-100"
  },
  operations: {
    container: "",
    heading: "text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-500",
    active: "bg-brand-100 text-brand-800 ring-1 ring-brand-200",
    idle: "text-slate-600 hover:bg-slate-100"
  },
  compliance: {
    container: "",
    heading: "text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-500",
    active: "bg-brand-100 text-brand-800 ring-1 ring-brand-200",
    idle: "text-slate-600 hover:bg-slate-100"
  },
  admin: {
    container: "",
    heading: "text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-500",
    active: "bg-brand-100 text-brand-800 ring-1 ring-brand-200",
    idle: "text-slate-600 hover:bg-slate-100"
  },
  cleaning: {
    container: "rounded-xl border border-emerald-200 bg-emerald-50 p-2",
    heading: "text-[10px] font-semibold uppercase tracking-[0.2em] text-emerald-700",
    active: "bg-emerald-600 text-white shadow-sm",
    idle: "text-emerald-800 hover:bg-emerald-100"
  },
  farm: {
    container: "rounded-xl border border-amber-200 bg-amber-50 p-2",
    heading: "text-[10px] font-semibold uppercase tracking-[0.2em] text-amber-700",
    active: "bg-amber-600 text-white shadow-sm",
    idle: "text-amber-900 hover:bg-amber-100"
  },
  legacy: {
    container: "rounded-xl border border-slate-300 bg-slate-50 p-2",
    heading: "text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-600",
    active: "bg-slate-700 text-white shadow-sm",
    idle: "text-slate-700 hover:bg-slate-200"
  }
};

type NavLinksProps = {
  onNavigate?: () => void;
  className?: string;
};

function NavItemLink({
  item,
  active,
  idleClass,
  activeClass,
  onNavigate
}: {
  item: NavigationItem;
  active: boolean;
  idleClass: string;
  activeClass: string;
  onNavigate?: () => void;
}) {
  const Icon = ICON_MAP[item.icon] ?? LayoutDashboard;

  return (
    <Link
      href={item.href as Route}
      onClick={onNavigate}
      aria-current={toNavAriaCurrent(active)}
      title={item.description}
      className={`flex min-h-11 items-center gap-2 rounded-lg px-3 py-2 text-sm transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500 ${
        active ? activeClass : idleClass
      }`}
    >
      <Icon aria-hidden size={16} />
      <span>{item.label}</span>
    </Link>
  );
}

export function NavLinks({ onNavigate, className = "" }: NavLinksProps) {
  const pathname = usePathname();
  const user = useCurrentUser();
  const roleName = extractRoleName({ role: user.role });
  const groups = getNavigationGroups(roleName);

  return (
    <nav aria-label="Main navigation" className={`space-y-4 ${className}`.trim()}>
      {groups.map((group) => {
        const surface = GROUP_SURFACE[group.category];

        return (
          <div key={group.category} className={surface.container}>
            <p className={`px-2 pt-1 ${surface.heading}`}>{group.label}</p>
            <div className="mt-1 space-y-1">
              {group.items.map((item) => (
                <NavItemLink
                  key={item.id}
                  item={item}
                  active={isNavItemActive(pathname, item)}
                  activeClass={surface.active}
                  idleClass={surface.idle}
                  onNavigate={onNavigate}
                />
              ))}
            </div>
          </div>
        );
      })}
    </nav>
  );
}
