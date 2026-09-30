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
  Boxes,
  Bug,
  Building2,
  CalendarClock,
  ChartColumnBig,
  ChevronDown,
  ClipboardCheck,
  ClipboardList,
  Clock3,
  CreditCard,
  Database,
  Droplets,
  FileCheck2,
  Fuel,
  Gauge,
  HardDrive,
  Home,
  Layers,
  LayoutDashboard,
  Leaf,
  LifeBuoy,
  MapPin,
  Pin,
  PinOff,
  Plug,
  QrCode,
  Receipt,
  Rocket,
  ServerCog,
  Settings,
  ShieldCheck,
  ShieldAlert,
  SprayCan,
  Sprout,
  Sun,
  Tag,
  Tractor,
  Truck,
  UserCircle2,
  Users,
  Wallet,
  Activity,
  type LucideIcon
} from "lucide-react";

import {
  FULL_NAVIGATION_ROLES,
  getNavigationGroups,
  isNavItemActive,
  type NavBadgeKey,
  type NavCategory,
  type NavigationItem
} from "@/lib/navigation";
import {
  effectiveFavoriteIds,
  NAV_FAVORITES_CHANGED_EVENT,
  readCollapsedNavGroups,
  readFavoritePreference,
  hydrateFavoriteIds,
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
  Clock3,
  FileCheck2,
  ShieldCheck,
  ShieldAlert,
  AlertTriangle,
  Receipt,
  ChartColumnBig,
  BarChart3: ChartColumnBig,
  Droplets,
  Bot,
  Bug,
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
  Plug,
  Rocket,
  LifeBuoy,
  Home,
  Boxes,
  Truck,
  CalendarClock,
  UserCircle2,
  Activity
};

const GROUP_SURFACE: Record<
  NavCategory,
  { container: string; heading: string; active: string; idle: string }
> = {
  primary: {
    container: "",
    heading: "text-xs font-semibold uppercase tracking-[0.14em] text-slate-500",
    active: "bg-brand-100 font-semibold text-brand-900",
    idle: "text-slate-600 hover:bg-slate-100"
  },
  secondary: {
    container: "",
    heading: "text-xs font-semibold uppercase tracking-[0.14em] text-slate-500",
    active: "bg-brand-100 font-semibold text-brand-900",
    idle: "text-slate-600 hover:bg-slate-100"
  },
  workspace: {
    container: "rounded-xl border border-brand-200 bg-brand-50/60 p-2",
    heading: "text-xs font-semibold uppercase tracking-[0.14em] text-brand-700",
    active: "bg-brand-100 font-semibold text-brand-900",
    idle: "text-brand-900 hover:bg-brand-50"
  },
  core: {
    container: "",
    heading: "text-xs font-semibold uppercase tracking-[0.14em] text-slate-500",
    active: "bg-brand-100 font-semibold text-brand-900",
    idle: "text-slate-600 hover:bg-slate-100"
  },
  operations: {
    container: "",
    heading: "text-xs font-semibold uppercase tracking-[0.14em] text-slate-500",
    active: "bg-brand-100 font-semibold text-brand-900",
    idle: "text-slate-600 hover:bg-slate-100"
  },
  compliance: {
    container: "",
    heading: "text-xs font-semibold uppercase tracking-[0.14em] text-slate-500",
    active: "bg-brand-100 font-semibold text-brand-900",
    idle: "text-slate-600 hover:bg-slate-100"
  },
  reports: {
    container: "",
    heading: "text-xs font-semibold uppercase tracking-[0.14em] text-slate-500",
    active: "bg-brand-100 font-semibold text-brand-900",
    idle: "text-slate-600 hover:bg-slate-100"
  },
  admin: {
    container: "",
    heading: "text-xs font-semibold uppercase tracking-[0.14em] text-slate-500",
    active: "bg-brand-100 font-semibold text-brand-900",
    idle: "text-slate-600 hover:bg-slate-100"
  },
  cleaning: {
    container: "rounded-xl border border-emerald-200 bg-emerald-50 p-2",
    heading: "text-xs font-semibold uppercase tracking-[0.14em] text-emerald-700",
    active: "bg-emerald-100 font-semibold text-emerald-900",
    idle: "text-emerald-800 hover:bg-emerald-100"
  },
  farm: {
    container: "rounded-xl border border-amber-200 bg-amber-50 p-2",
    heading: "text-xs font-semibold uppercase tracking-[0.14em] text-amber-700",
    active: "bg-amber-100 font-semibold text-amber-900",
    idle: "text-amber-900 hover:bg-amber-100"
  },
  legacy: {
    container: "rounded-xl border border-slate-300 bg-slate-50 p-2",
    heading: "text-xs font-semibold uppercase tracking-[0.14em] text-slate-600",
    active: "bg-slate-200 font-semibold text-slate-900",
    idle: "text-slate-700 hover:bg-slate-200"
  }
};

type NavLinksProps = {
  onNavigate?: () => void;
  className?: string;
  compact?: boolean;
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
  onNavigate,
  compact = false
}: {
  item: NavigationItem;
  active: boolean;
  idleClass: string;
  activeClass: string;
  badgeCount?: number;
  isFavorite: boolean;
  onToggleFavorite: () => void;
  onNavigate?: () => void;
  compact?: boolean;
}) {
  const Icon = ICON_MAP[item.icon] ?? LayoutDashboard;

  return (
    <div className="group flex items-center gap-1">
      <Link
        href={item.href as Route}
        onClick={onNavigate}
        aria-current={toNavAriaCurrent(active)}
        title={item.label}
        className={`flex min-h-11 flex-1 items-center gap-2.5 rounded-lg px-2.5 text-sm transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600 ${
          compact ? "justify-center px-0" : ""
        } ${active ? activeClass : idleClass}`}
      >
        <Icon aria-hidden size={18} />
        {compact ? <span className="sr-only">{item.label}</span> : <span className="truncate">{item.label}</span>}
        {!compact && badgeCount != null ? <NavBadge count={badgeCount} /> : null}
      </Link>
      {compact ? null : (
        <button
          type="button"
          onClick={onToggleFavorite}
          className="inline-flex min-h-11 min-w-11 shrink-0 items-center justify-center rounded-md text-slate-400 opacity-100 transition hover:bg-slate-100 hover:text-brand-700 focus-visible:opacity-100 xl:opacity-0 xl:group-hover:opacity-100 xl:focus-visible:opacity-100"
          aria-label={isFavorite ? `Unpin ${item.label}` : `Pin ${item.label}`}
        >
          {isFavorite ? <PinOff size={14} /> : <Pin size={14} />}
        </button>
      )}
    </div>
  );
}

export function NavLinks({ onNavigate, className = "", compact = false }: NavLinksProps) {
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
    setFavoriteIds(hydrateFavoriteIds(readFavoritePreference(user.id)));
    setCollapsedGroups(readCollapsedNavGroups(user.id));

    const onFavoritesChanged = (event: Event) => {
      const changedUserId = (event as CustomEvent<string | null>).detail;
      if (changedUserId !== (user.id ?? null)) {
        return;
      }
      setFavoriteIds(hydrateFavoriteIds(readFavoritePreference(user.id)));
    };

    window.addEventListener(NAV_FAVORITES_CHANGED_EVENT, onFavoritesChanged);
    return () => window.removeEventListener(NAV_FAVORITES_CHANGED_EVENT, onFavoritesChanged);
  }, [user.id]);

  const groups = useMemo(
    () =>
      getNavigationGroups(roleName, {
        fullNavigation,
        permissions: user.permissions,
        enabledFeatures: user.enabledFeatures
      }),
    [fullNavigation, roleName, user.permissions, user.enabledFeatures]
  );

  const allItems = useMemo(() => groups.flatMap((group) => group.items), [groups]);
  const favoriteItems = useMemo(() => {
    const visible = new Map(allItems.map((item) => [item.id, item]));
    return effectiveFavoriteIds(
      favoriteIds,
      allItems.map((item) => item.id)
    )
      .map((id) => visible.get(id))
      .filter((item): item is NavigationItem => Boolean(item));
  }, [allItems, favoriteIds]);

  const showBadgeFetch = allItems.some((item) => item.badgeKey);
  const { badges } = useNavBadges(showBadgeFetch, roleName);

  const toggleGroup = (category: NavCategory) => {
    const currentlyCollapsed = collapsedGroups[category] ?? category !== "workspace";
    const next = {
      ...collapsedGroups,
      [category]: !currentlyCollapsed
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
          className={`min-h-11 rounded-lg border border-slate-200 bg-white text-left text-xs font-medium text-slate-700 hover:bg-slate-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600 ${compact ? "flex w-11 items-center justify-center px-0" : "w-full px-3 py-2"}`}
          aria-pressed={fullNavigation}
          aria-label={fullNavigation ? "Simplified navigation" : "Full navigation mode"}
        >
          {compact ? <Layers aria-hidden size={16} /> : fullNavigation ? "Simplified navigation" : "Full navigation mode"}
        </button>
      ) : null}

      {favoriteItems.length > 0 ? (
        <div>
          <p className={`px-2 text-xs font-semibold uppercase tracking-[0.14em] text-slate-500 ${compact ? "sr-only" : ""}`}>Favorites</p>
          <div className="mt-1 space-y-1">
            {favoriteItems.map((item) => (
              <NavItemLink
                key={`favorite-${item.id}`}
                item={item}
                active={isNavItemActive(pathname, item, search)}
                activeClass="bg-accent-100 font-semibold text-accent-700"
                idleClass="text-slate-700 hover:bg-amber-50"
                badgeCount={item.badgeKey ? badges[item.badgeKey as NavBadgeKey] : undefined}
                isFavorite
                onToggleFavorite={() => toggleFavorite(item.id)}
                onNavigate={onNavigate}
                compact={compact}
              />
            ))}
          </div>
        </div>
      ) : null}

      {groups.map((group) => {
        const surface = GROUP_SURFACE[group.category];
        const collapsed = compact ? false : collapsedGroups[group.category] ?? group.category !== "workspace";

        return (
          <div key={group.category} className={compact ? "" : surface.container}>
            {compact ? (
              <h2 className="sr-only">{group.label}</h2>
            ) : (
            <button
              type="button"
              onClick={() => toggleGroup(group.category)}
              className={`flex min-h-11 w-full items-center justify-between px-2 ${surface.heading}`}
              aria-expanded={!collapsed}
            >
              <span>{group.label}</span>
              <ChevronDown aria-hidden size={14} className={`transition ${collapsed ? "" : "rotate-180"}`} />
            </button>
            )}
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
                compact={compact}
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
