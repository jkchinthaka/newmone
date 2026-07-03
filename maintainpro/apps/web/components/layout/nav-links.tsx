"use client";

import Link from "next/link";
import type { Route } from "next";
import { useEffect, useMemo, useState } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import {
  AlertTriangle,
  Archive,
  Bell,
  BellRing,
  Bot,
  Building2,
  ChartColumnBig,
  ChevronDown,
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
  Pin,
  PinOff,
  Plug,
  QrCode,
  Receipt,
  ServerCog,
  Settings,
  ShieldCheck,
  ShieldAlert,
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
  FULL_NAVIGATION_ROLES,
  getDefaultFavoriteNavIds,
  getNavigationGroups,
  isNavItemActive,
  type NavBadgeKey,
  type NavCategory,
  type NavigationItem
} from "@/lib/navigation";
import {
  readCollapsedNavGroups,
  readFavoriteNavIds,
  readFullNavigationMode,
  toggleFavoriteNavId,
  writeCollapsedNavGroups,
  writeFullNavigationMode
} from "@/lib/nav-favorites";
import { toNavAriaCurrent } from "@/lib/accessibility";
import { extractRoleName } from "@/lib/role-redirect";
import { useCurrentUser } from "@/lib/use-current-user";
import { useNavBadges } from "@/lib/use-nav-badges";

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
  ShieldAlert,
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
  Building2,
  Plug
};

const GROUP_SURFACE: Record<
  NavCategory,
  { container: string; heading: string; active: string; idle: string }
> = {
  workspace: {
    container: "rounded-xl border border-brand-200 bg-brand-50/60 p-2",
    heading: "text-[10px] font-semibold uppercase tracking-[0.2em] text-brand-700",
    active: "bg-brand-600 text-white shadow-sm",
    idle: "text-brand-900 hover:bg-brand-100"
  },
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
  reports: {
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

function NavBadge({ count }: { count: number }) {
  if (count <= 0) {
    return null;
  }

  return (
    <span className="ml-auto rounded-full bg-rose-600 px-2 py-0.5 text-[10px] font-semibold text-white">
      {count > 99 ? "99+" : count}
    </span>
  );
}

function NavItemLink({
  item,
  active,
  idleClass,
  activeClass,
  badgeCount,
  isFavorite,
  onToggleFavorite,
  onNavigate
}: {
  item: NavigationItem;
  active: boolean;
  idleClass: string;
  activeClass: string;
  badgeCount?: number;
  isFavorite: boolean;
  onToggleFavorite: () => void;
  onNavigate?: () => void;
}) {
  const Icon = ICON_MAP[item.icon] ?? LayoutDashboard;

  return (
    <div className="group flex items-center gap-1">
      <Link
        href={item.href as Route}
        onClick={onNavigate}
        aria-current={toNavAriaCurrent(active)}
        title={item.description}
        className={`flex min-h-11 flex-1 items-center gap-2 rounded-lg px-3 py-2 text-sm transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500 ${
          active ? activeClass : idleClass
        }`}
      >
        <Icon aria-hidden size={16} />
        <span className="truncate">{item.label}</span>
        {badgeCount != null ? <NavBadge count={badgeCount} /> : null}
      </Link>
      <button
        type="button"
        onClick={onToggleFavorite}
        className="rounded-md p-1 text-slate-400 opacity-0 transition hover:bg-slate-100 hover:text-brand-700 group-hover:opacity-100 focus-visible:opacity-100"
        aria-label={isFavorite ? `Unpin ${item.label}` : `Pin ${item.label}`}
      >
        {isFavorite ? <PinOff size={14} /> : <Pin size={14} />}
      </button>
    </div>
  );
}

export function NavLinks({ onNavigate, className = "" }: NavLinksProps) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const search = searchParams.toString();
  const user = useCurrentUser();
  const roleName = extractRoleName({ role: user.role });
  const [fullNavigation, setFullNavigation] = useState(false);
  const [favoriteIds, setFavoriteIds] = useState<string[]>([]);
  const [collapsedGroups, setCollapsedGroups] = useState<Record<string, boolean>>({});

  useEffect(() => {
    setFullNavigation(readFullNavigationMode());
    setFavoriteIds(readFavoriteNavIds(user.id));
    setCollapsedGroups(readCollapsedNavGroups(user.id));
  }, [user.id]);

  useEffect(() => {
    if (favoriteIds.length === 0 && user.id) {
      setFavoriteIds(getDefaultFavoriteNavIds(roleName));
    }
  }, [favoriteIds.length, roleName, user.id]);

  const groups = useMemo(
    () =>
      getNavigationGroups(roleName, {
        fullNavigation,
        permissions: user.permissions
      }),
    [fullNavigation, roleName, user.permissions]
  );

  const allItems = useMemo(() => groups.flatMap((group) => group.items), [groups]);
  const favoriteItems = useMemo(
    () =>
      favoriteIds
        .map((id) => allItems.find((item) => item.id === id))
        .filter((item): item is NavigationItem => Boolean(item)),
    [allItems, favoriteIds]
  );

  const showBadgeFetch = allItems.some((item) => item.badgeKey);
  const { badges } = useNavBadges(showBadgeFetch);

  const toggleGroup = (category: NavCategory) => {
    const next = {
      ...collapsedGroups,
      [category]: !collapsedGroups[category]
    };
    setCollapsedGroups(next);
    writeCollapsedNavGroups(user.id, next);
  };

  const toggleFavorite = (navId: string) => {
    const next = toggleFavoriteNavId(user.id, navId, favoriteIds);
    setFavoriteIds(next);
  };

  const canToggleFullNavigation = FULL_NAVIGATION_ROLES.has(roleName ?? "");

  return (
    <nav aria-label="Main navigation" className={`space-y-4 ${className}`.trim()}>
      {canToggleFullNavigation ? (
        <button
          type="button"
          onClick={() => {
            const next = !fullNavigation;
            setFullNavigation(next);
            writeFullNavigationMode(next);
          }}
          className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-left text-xs font-medium text-slate-700 hover:bg-slate-50"
        >
          {fullNavigation ? "Simplified navigation" : "Full navigation mode"}
        </button>
      ) : null}

      {favoriteItems.length > 0 ? (
        <div>
          <p className="px-2 text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-500">Favorites</p>
          <div className="mt-1 space-y-1">
            {favoriteItems.map((item) => (
              <NavItemLink
                key={`favorite-${item.id}`}
                item={item}
                active={isNavItemActive(pathname, item, search)}
                activeClass="bg-amber-100 text-amber-900 ring-1 ring-amber-200"
                idleClass="text-slate-700 hover:bg-amber-50"
                badgeCount={item.badgeKey ? badges[item.badgeKey as NavBadgeKey] : undefined}
                isFavorite
                onToggleFavorite={() => toggleFavorite(item.id)}
                onNavigate={onNavigate}
              />
            ))}
          </div>
        </div>
      ) : null}

      {groups.map((group) => {
        const surface = GROUP_SURFACE[group.category];
        const collapsed = collapsedGroups[group.category] ?? group.category !== "workspace";

        return (
          <div key={group.category} className={surface.container}>
            <button
              type="button"
              onClick={() => toggleGroup(group.category)}
              className={`flex w-full items-center justify-between px-2 pt-1 ${surface.heading}`}
              aria-expanded={!collapsed}
            >
              <span>{group.label}</span>
              <ChevronDown size={14} className={`transition ${collapsed ? "" : "rotate-180"}`} />
            </button>
            {!collapsed ? (
              <div className="mt-1 space-y-1">
                {group.items.map((item) => (
                  <NavItemLink
                    key={item.id}
                    item={item}
                    active={isNavItemActive(pathname, item, search)}
                    activeClass={surface.active}
                    idleClass={surface.idle}
                    badgeCount={item.badgeKey ? badges[item.badgeKey] : undefined}
                    isFavorite={favoriteIds.includes(item.id)}
                    onToggleFavorite={() => toggleFavorite(item.id)}
                    onNavigate={onNavigate}
                  />
                ))}
              </div>
            ) : null}
          </div>
        );
      })}
    </nav>
  );
}
