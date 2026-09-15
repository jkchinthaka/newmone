/**
 * Centralized dashboard navigation — Phase 1 CMMS scope.
 * Primary nav: Home, Requests, Work Orders, Preventive Maintenance, Assets, Fleet, Spare Parts, Reports, Admin.
 * Frontend UX only — backend RBAC remains authoritative for API access.
 *
 * Retired from normal product surface (routes may remain for compatibility; not in primary nav):
 * Farm Operations, Cleaning workforce, FG product UI, SaaS Billing, Predictive AI,
 * QA/Delivery/Go-Live/Post-Go-Live business admin clutter.
 */

import { LEGACY_FMS_HOME_PATH } from "./role-redirect";

export type NavActiveMatch = "exact" | "startsWith";

export type NavCategory =
  | "primary"
  | "secondary"
  | "workspace"
  | "core"
  | "operations"
  | "compliance"
  | "reports"
  | "admin"
  | "cleaning"
  | "farm"
  | "legacy";

export type NavBadgeKey =
  | "action-center"
  | "my-tasks"
  | "waiting-parts"
  | "waiting-evidence"
  | "supervisor-verification"
  | "high-risk"
  | "triage"
  | "overdue"
  | "system-health";

export interface NavigationItem {
  id: string;
  label: string;
  href: string;
  icon: string;
  allowedRoles: readonly string[];
  requiredPermissions?: readonly string[];
  category: NavCategory;
  description?: string;
  legacy?: boolean;
  activeMatch?: NavActiveMatch;
  badgeKey?: NavBadgeKey;
  mobilePriority?: boolean;
  pinByDefaultForRoles?: readonly string[];
}

export interface NavigationGroup {
  category: NavCategory;
  label: string;
  items: NavigationItem[];
}

const ADMIN_ROLES = ["SUPER_ADMIN", "ADMIN"] as const;
const MANAGEMENT_ROLES = [
  "SUPER_ADMIN",
  "ADMIN",
  "MANAGER",
  "OPERATIONS_MANAGER"
] as const;
const SUPERVISOR_ROLES = ["MAINTENANCE_SUPERVISOR", "SUPERVISOR"] as const;
const TECHNICIAN_ROLES = ["TECHNICIAN", "MECHANIC"] as const;
const FACILITY_ROLES = ["FACILITY_MANAGER", "BUILDING_SUPERVISOR"] as const;
const SECURITY_ROLES = ["SECURITY_OFFICER"] as const;
const INVENTORY_ROLES = ["INVENTORY_KEEPER", "STOREKEEPER"] as const;
const PROCUREMENT_ROLES = ["PROCUREMENT_OFFICER"] as const;
const FINANCE_ROLES = ["FINANCE", "FINANCE_APPROVER"] as const;
const READ_ONLY_ROLES = ["VIEWER", "AUDITOR"] as const;
const DRIVER_ROLES = ["DRIVER"] as const;
const FLEET_ROLES = ["FLEET_MANAGER"] as const;
const COMPLIANCE_ROLES = ["COMPLIANCE_MANAGER"] as const;
const ASSET_ROLES = ["ASSET_MANAGER"] as const;
const REQUESTER_ROLES = ["REQUESTER", "VENDOR"] as const;
/** Cleaning ops retired from product surface; role still needs Home access. */
const CLEANER_ROLES = ["CLEANER"] as const;
/** Farm ops retired; roles land on Home / Assets for infrastructure maintenance. */
const FARM_INFRA_ROLES = [
  "FARM_OWNER",
  "FARM_MANAGER",
  "FIELD_SUPERVISOR",
  "AGRONOMIST",
  "VETERINARIAN",
  "FARM_WORKER",
  "IRRIGATION_OPERATOR",
  "HARVEST_CREW"
] as const;

function mergeRoles(...groups: ReadonlyArray<readonly string[]>): readonly string[] {
  return [...new Set(groups.flat())];
}

const HOME_ROLES = mergeRoles(
  ADMIN_ROLES,
  MANAGEMENT_ROLES,
  SUPERVISOR_ROLES,
  TECHNICIAN_ROLES,
  FACILITY_ROLES,
  SECURITY_ROLES,
  INVENTORY_ROLES,
  PROCUREMENT_ROLES,
  READ_ONLY_ROLES,
  DRIVER_ROLES,
  FLEET_ROLES,
  COMPLIANCE_ROLES,
  ASSET_ROLES,
  FINANCE_ROLES,
  REQUESTER_ROLES,
  CLEANER_ROLES,
  FARM_INFRA_ROLES
);

const REQUEST_ROLES = mergeRoles(
  HOME_ROLES,
  TECHNICIAN_ROLES,
  SUPERVISOR_ROLES,
  MANAGEMENT_ROLES,
  FACILITY_ROLES,
  READ_ONLY_ROLES
);

const WO_ROLES = mergeRoles(
  ADMIN_ROLES,
  MANAGEMENT_ROLES,
  SUPERVISOR_ROLES,
  TECHNICIAN_ROLES,
  ASSET_ROLES,
  FLEET_ROLES,
  FACILITY_ROLES,
  INVENTORY_ROLES
);

const PM_ROLES = mergeRoles(ADMIN_ROLES, MANAGEMENT_ROLES, SUPERVISOR_ROLES, ASSET_ROLES, TECHNICIAN_ROLES);

const ASSET_NAV_ROLES = mergeRoles(
  ADMIN_ROLES,
  MANAGEMENT_ROLES,
  SUPERVISOR_ROLES,
  ASSET_ROLES,
  TECHNICIAN_ROLES,
  FACILITY_ROLES,
  READ_ONLY_ROLES
);

const FLEET_NAV_ROLES = mergeRoles(
  ADMIN_ROLES,
  MANAGEMENT_ROLES,
  FLEET_ROLES,
  DRIVER_ROLES,
  SECURITY_ROLES,
  COMPLIANCE_ROLES,
  TECHNICIAN_ROLES,
  READ_ONLY_ROLES
);

const PARTS_ROLES = mergeRoles(
  ADMIN_ROLES,
  MANAGEMENT_ROLES,
  INVENTORY_ROLES,
  PROCUREMENT_ROLES,
  TECHNICIAN_ROLES,
  SUPERVISOR_ROLES
);

const REPORT_ROLES = mergeRoles(
  ADMIN_ROLES,
  MANAGEMENT_ROLES,
  SUPERVISOR_ROLES,
  FLEET_ROLES,
  ASSET_ROLES,
  FINANCE_ROLES,
  COMPLIANCE_ROLES,
  READ_ONLY_ROLES
);

/** Routes still valid for redirects / deep links (not all appear in primary nav). */
export const EXISTING_NAV_ROUTES = new Set<string>([
  "/action-center",
  "/workspace",
  "/dashboard",
  "/qr/report-issue",
  "/work-orders",
  "/maintenance/job-codes",
  "/maintenance/forecast",
  "/assets",
  "/assets/health",
  "/fleet",
  "/fleet/gate",
  "/vehicles",
  "/vehicles/health",
  "/vehicles/costs",
  "/inventory",
  "/inventory/movements",
  "/inventory/daily",
  "/inventory/import",
  "/inventory/erp-import",
  "/inventory/warranty",
  "/procurement",
  "/procurement/vendors",
  "/reports",
  "/reports/maintenance-exceptions",
  "/reports/fraud-control",
  "/reports/management-intelligence",
  "/admin",
  "/admin/organization",
  "/erp",
  "/system-health",
  "/settings",
  "/notifications",
  "/master-data",
  "/master-data/employees",
  "/master-data/departments",
  "/compliance",
  "/accidents",
  "/insurance-claims",
  "/traffic-fines",
  "/facilities",
  "/utilities",
  "/operations/exceptions",
  LEGACY_FMS_HOME_PATH
]);

export const NAV_CATEGORY_LABELS: Record<NavCategory, string> = {
  primary: "Main",
  secondary: "Account",
  workspace: "Home",
  core: "Overview",
  operations: "Operations",
  compliance: "Compliance",
  reports: "Reports",
  admin: "Admin",
  cleaning: "Facility (retired)",
  farm: "Farm (retired)",
  legacy: "Archive"
};

export const ROLE_DEFAULT_FAVORITE_NAV_IDS: Record<string, readonly string[]> = {
  TECHNICIAN: ["home", "work-orders"],
  MECHANIC: ["home", "work-orders"],
  INVENTORY_KEEPER: ["home", "spare-parts"],
  STOREKEEPER: ["home", "spare-parts"],
  SUPERVISOR: ["home", "work-orders", "requests"],
  MAINTENANCE_SUPERVISOR: ["home", "work-orders", "preventive-maintenance"],
  MANAGER: ["home", "reports", "work-orders"],
  OPERATIONS_MANAGER: ["home", "reports", "work-orders"],
  SUPER_ADMIN: ["home", "admin", "system-health"],
  ADMIN: ["home", "admin", "system-health"],
  SECURITY_OFFICER: ["home", "fleet"],
  FLEET_MANAGER: ["home", "fleet", "work-orders"],
  DRIVER: ["home", "fleet"],
  VIEWER: ["home", "reports"],
  ASSET_MANAGER: ["home", "assets", "preventive-maintenance"]
};

export const FULL_NAVIGATION_ROLES = new Set<string>(["SUPER_ADMIN", "ADMIN"]);

/**
 * Phase 1 primary navigation — CMMS / Fleet focused.
 * Queue shortcuts live under Home (Action Center), not as competing top-level items.
 */
export const NAVIGATION_ITEMS: readonly NavigationItem[] = [
  {
    id: "home",
    label: "Home",
    href: "/action-center",
    icon: "Home",
    allowedRoles: HOME_ROLES,
    category: "primary",
    description: "Role-aware priorities (replaces Workspace / Dashboard / Action Center top-level split)",
    badgeKey: "action-center",
    mobilePriority: true,
    pinByDefaultForRoles: HOME_ROLES,
    activeMatch: "exact"
  },
  {
    id: "requests",
    label: "Requests",
    href: "/qr/report-issue",
    icon: "AlertTriangle",
    allowedRoles: REQUEST_ROLES,
    category: "primary",
    description: "Report a Maintenance Request",
    mobilePriority: true,
    activeMatch: "startsWith"
  },
  {
    id: "work-orders",
    label: "Work Orders",
    href: "/work-orders",
    icon: "ClipboardList",
    allowedRoles: WO_ROLES,
    category: "primary",
    description: "Executable maintenance work",
    badgeKey: "my-tasks",
    mobilePriority: true,
    pinByDefaultForRoles: mergeRoles(TECHNICIAN_ROLES, SUPERVISOR_ROLES),
    activeMatch: "startsWith"
  },
  {
    id: "preventive-maintenance",
    label: "Preventive Maintenance",
    href: "/maintenance/forecast",
    icon: "CalendarClock",
    allowedRoles: PM_ROLES,
    category: "primary",
    description: "Planned / triggered maintenance",
    activeMatch: "startsWith"
  },
  {
    id: "assets",
    label: "Assets",
    href: "/assets",
    icon: "Boxes",
    allowedRoles: ASSET_NAV_ROLES,
    category: "primary",
    description: "Asset register and health",
    activeMatch: "startsWith"
  },
  {
    id: "fleet",
    label: "Fleet",
    href: "/fleet",
    icon: "Truck",
    allowedRoles: FLEET_NAV_ROLES,
    category: "primary",
    description: "Vehicles, gate, and fleet operations",
    activeMatch: "startsWith"
  },
  {
    id: "spare-parts",
    label: "Spare Parts",
    href: "/inventory",
    icon: "Layers",
    allowedRoles: PARTS_ROLES,
    category: "primary",
    description: "Maintenance parts usage and reservations (Bileeta owns official stock)",
    activeMatch: "startsWith"
  },
  {
    id: "reports",
    label: "Reports",
    href: "/reports",
    icon: "BarChart3",
    allowedRoles: REPORT_ROLES,
    category: "primary",
    description: "Maintenance and fleet reports",
    activeMatch: "startsWith"
  },
  {
    id: "admin",
    label: "Admin",
    href: "/admin",
    icon: "ShieldCheck",
    allowedRoles: ADMIN_ROLES,
    category: "primary",
    description: "Maintenance administration",
    activeMatch: "startsWith"
  },
  {
    id: "notifications",
    label: "Notifications",
    href: "/notifications",
    icon: "Bell",
    allowedRoles: HOME_ROLES,
    category: "secondary",
    activeMatch: "exact"
  },
  {
    id: "settings",
    label: "My Profile",
    href: "/settings",
    icon: "UserCircle2",
    allowedRoles: HOME_ROLES,
    category: "secondary",
    activeMatch: "startsWith"
  },
  {
    id: "system-health",
    label: "Technical Admin",
    href: "/system-health",
    icon: "Activity",
    allowedRoles: ADMIN_ROLES,
    category: "secondary",
    description: "API, DB, queue, integrations — not business Admin",
    badgeKey: "system-health",
    activeMatch: "startsWith"
  },
  {
    id: "erp-integration",
    label: "ERP & Spare Parts Sync",
    href: "/erp",
    icon: "Database",
    allowedRoles: ADMIN_ROLES,
    category: "secondary",
    description: "Bileeta mapping and reconciliation",
    activeMatch: "startsWith"
  }
];

const NAV_CATEGORY_ORDER: NavCategory[] = [
  "primary",
  "secondary",
  "workspace",
  "core",
  "operations",
  "compliance",
  "reports",
  "admin",
  "cleaning",
  "farm",
  "legacy"
];

const ROUTE_ACCESS_ALIASES: Record<string, readonly string[]> = {
  "/admin/users": ["/admin"],
  "/admin/people": ["/admin"],
  "/admin/roles": ["/admin"],
  "/admin/tenants": ["/admin"],
  "/admin/invitations": ["/admin"],
  "/admin/bulk-imports": ["/admin"],
  "/admin/organization": ["/admin"],
  "/workspace": ["/action-center"],
  "/dashboard": ["/action-center"],
  "/maintenance": ["/action-center"],
  "/maintenance/job-codes": ["/maintenance/forecast"],
  "/vehicles": ["/fleet"],
  "/vehicles/health": ["/fleet"],
  "/vehicles/costs": ["/fleet"],
  "/fleet/gate": ["/fleet"],
  "/procurement": ["/inventory"],
  "/procurement/vendors": ["/inventory"],
  "/reports/fraud-control": ["/reports"],
  "/reports/management-intelligence": ["/reports"],
  "/reports/maintenance-exceptions": ["/reports"],
  "/assets/health": ["/assets"],
  "/master-data/employees": ["/admin"],
  "/master-data/departments": ["/admin"],
  "/compliance": ["/fleet"],
  "/accidents": ["/fleet"],
  "/insurance-claims": ["/fleet"],
  "/traffic-fines": ["/fleet"],
  "/facilities": ["/assets"],
  "/utilities": ["/assets"],
  "/operations/exceptions": ["/reports"]
};

/** Paths retired from normal product access (except SUPER_ADMIN/ADMIN full override). */
const RETIRED_PATH_PREFIXES = [
  "/farm",
  "/cleaning",
  "/billing",
  "/predictive-ai",
  "/qa",
  "/delivery-readiness",
  "/go-live",
  "/post-go-live",
  "/releases",
  "/support",
  "/machinery",
  "/vehicle",
  "/service",
  "/pending-requests",
  "/home"
] as const;

export function normalizeNavigationRole(roleName: string | null | undefined): string | null {
  if (!roleName) {
    return null;
  }
  const trimmed = roleName.trim();
  return trimmed.length > 0 ? trimmed.toUpperCase() : null;
}

export function isNavigationItemVisible(
  item: NavigationItem,
  roleName: string | null | undefined,
  permissions: readonly string[] = []
): boolean {
  const normalized = normalizeNavigationRole(roleName);

  if (!normalized) {
    return item.id === "home";
  }

  if (!item.allowedRoles.includes(normalized)) {
    return false;
  }

  if (item.requiredPermissions?.length) {
    const granted = new Set(permissions.map((p) => p.trim()));
    const hasPermission = item.requiredPermissions.some((permission) => granted.has(permission));
    if (!hasPermission && !FULL_NAVIGATION_ROLES.has(normalized)) {
      return false;
    }
  }

  return true;
}

export function getDefaultFavoriteNavIds(roleName: string | null | undefined): string[] {
  const normalized = normalizeNavigationRole(roleName);
  if (!normalized) {
    return ["home"];
  }

  const configured = ROLE_DEFAULT_FAVORITE_NAV_IDS[normalized];
  if (configured?.length) {
    return [...configured];
  }

  const pinned = NAVIGATION_ITEMS.filter((item) =>
    item.pinByDefaultForRoles?.includes(normalized)
  ).map((item) => item.id);

  return pinned.length > 0 ? pinned : ["home"];
}

export function getVisibleNavigationItems(
  roleName: string | null | undefined,
  options?: { fullNavigation?: boolean; permissions?: readonly string[] }
): NavigationItem[] {
  const normalized = normalizeNavigationRole(roleName);
  const permissions = options?.permissions ?? [];

  const visible = NAVIGATION_ITEMS.filter((item) => {
    const baseHref = item.href.split("?")[0];
    if (!EXISTING_NAV_ROUTES.has(baseHref)) {
      return false;
    }
    return isNavigationItemVisible(item, roleName, permissions);
  });

  if (visible.length > 0) {
    return visible;
  }

  const fallback = NAVIGATION_ITEMS.find((item) => item.id === "home");
  return fallback ? [fallback] : [];
}

export function getNavigationGroups(
  roleName: string | null | undefined,
  options?: { fullNavigation?: boolean; permissions?: readonly string[] }
): NavigationGroup[] {
  const visibleItems = getVisibleNavigationItems(roleName, options);

  return NAV_CATEGORY_ORDER.map((category) => ({
    category,
    label: NAV_CATEGORY_LABELS[category],
    items: visibleItems.filter((item) => item.category === category)
  })).filter((group) => group.items.length > 0);
}

export function canAccessNavigationPath(
  pathname: string,
  roleName: string | null | undefined,
  permissions: readonly string[] = []
): boolean {
  if (
    pathname === "/login" ||
    pathname === "/register" ||
    pathname.startsWith("/forgot-password") ||
    pathname.startsWith("/accept-invite")
  ) {
    return true;
  }

  const normalized = normalizeNavigationRole(roleName);
  const normalizedPath = pathname.split("?")[0];

  // FG SSO bridge must remain reachable for external FG system handoff.
  if (normalizedPath.startsWith("/fg/sso")) {
    return true;
  }
  if (normalizedPath === "/fg" || normalizedPath.startsWith("/fg/")) {
    return (
      permissions.includes("fg.access") ||
      FULL_NAVIGATION_ROLES.has(normalized ?? "")
    );
  }

  const isRetired = RETIRED_PATH_PREFIXES.some(
    (prefix) => normalizedPath === prefix || normalizedPath.startsWith(`${prefix}/`)
  );
  if (isRetired) {
    // Soft retire: only technical admins retain browser access for migration/ops.
    return FULL_NAVIGATION_ROLES.has(normalized ?? "");
  }

  const visible = getVisibleNavigationItems(roleName, { permissions });

  if (visible.some((item) => isNavItemActive(normalizedPath, item))) {
    return true;
  }

  const aliases = ROUTE_ACCESS_ALIASES[normalizedPath];
  if (aliases?.some((alias) => visible.some((item) => isNavItemActive(alias, item)))) {
    return true;
  }

  if (normalizedPath.startsWith("/work-orders")) {
    return visible.some((item) => item.id === "work-orders");
  }

  if (normalizedPath.startsWith("/admin")) {
    return visible.some((item) => item.id === "admin");
  }

  if (normalizedPath.startsWith("/inventory") || normalizedPath.startsWith("/procurement")) {
    return visible.some((item) => item.id === "spare-parts");
  }

  if (normalizedPath.startsWith("/fleet") || normalizedPath.startsWith("/vehicles")) {
    return visible.some((item) => item.id === "fleet");
  }

  if (normalizedPath.startsWith("/reports")) {
    return visible.some((item) => item.id === "reports");
  }

  if (normalizedPath.startsWith("/maintenance")) {
    return visible.some((item) => item.id === "preventive-maintenance" || item.id === "home");
  }

  return FULL_NAVIGATION_ROLES.has(normalized ?? "");
}

export type MobileBottomNavItem = {
  id: string;
  label: string;
  href: string;
  icon: string;
  action?: "search";
};

export function getMobileBottomNavItems(
  roleName: string | null | undefined,
  options?: { permissions?: readonly string[] }
): MobileBottomNavItem[] {
  const visible = getVisibleNavigationItems(roleName, { permissions: options?.permissions });
  const hasWorkOrders = visible.some((item) => item.id === "work-orders");
  const hasRequests = visible.some((item) => item.id === "requests");
  const hasAssets = visible.some((item) => item.id === "assets");
  const hasSettings = visible.some((item) => item.id === "settings");
  const homeHref = visible.find((item) => item.id === "home")?.href ?? "/action-center";
  const requestsHref = visible.find((item) => item.id === "requests")?.href ?? "/qr/report-issue";

  const items: MobileBottomNavItem[] = [
    { id: "home", label: "Home", href: homeHref, icon: "Home" }
  ];

  // Requester-heavy roles: surface Requests; technicians/supervisors: Work Orders.
  if (hasRequests && !hasWorkOrders) {
    items.push({ id: "requests", label: "Requests", href: requestsHref, icon: "AlertTriangle" });
  } else if (hasWorkOrders) {
    items.push({ id: "work-orders", label: "Work Orders", href: "/work-orders", icon: "ClipboardList" });
  } else if (hasAssets) {
    items.push({ id: "assets", label: "Assets", href: "/assets", icon: "Boxes" });
  }

  items.push({ id: "search", label: "Search", href: "#", icon: "Search", action: "search" });
  items.push({
    id: "profile",
    label: "Profile",
    href: hasSettings ? "/settings" : homeHref,
    icon: "UserCircle2"
  });

  return items;
}

export function isNavItemActive(pathname: string, item: NavigationItem, search = ""): boolean {
  const [itemPath, itemQuery = ""] = item.href.split("?");
  const match = item.activeMatch ?? "startsWith";

  if (itemQuery) {
    const params = new URLSearchParams(itemQuery);
    const current = new URLSearchParams(search.startsWith("?") ? search.slice(1) : search);
    const pathMatches = pathname === itemPath || pathname.startsWith(`${itemPath}/`);
    if (!pathMatches) {
      return false;
    }
    for (const [key, value] of params.entries()) {
      if (current.get(key) !== value) {
        return false;
      }
    }
    return true;
  }

  if (match === "exact") {
    return pathname === itemPath;
  }

  return pathname === itemPath || pathname.startsWith(`${itemPath}/`);
}

/**
 * True only when legacy `/home` appears as a primary Home destination.
 * Phase 1 Home is `/action-center` (label "Home") — that must not trip this check.
 */
export function hasPrimaryHomeNavItem(items: readonly NavigationItem[]): boolean {
  return items.some(
    (item) =>
      item.href === LEGACY_FMS_HOME_PATH ||
      (item.label === "Home" && item.href === LEGACY_FMS_HOME_PATH)
  );
}
