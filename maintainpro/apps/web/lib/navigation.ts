/**
 * Centralized dashboard navigation configuration.
 * Frontend UX only — backend RBAC remains authoritative for route access.
 */

import { LEGACY_FMS_HOME_PATH } from "./role-redirect";
import { LEGACY_FMS_ARCHIVE_ROLES } from "./legacy-fms-access";

export type NavActiveMatch = "exact" | "startsWith";

export type NavCategory =
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
const CLEANING_ROLES = ["CLEANER"] as const;
const FACILITY_ROLES = ["FACILITY_MANAGER", "BUILDING_SUPERVISOR"] as const;
const SECURITY_ROLES = ["SECURITY_OFFICER"] as const;
const INVENTORY_ROLES = ["INVENTORY_KEEPER", "STOREKEEPER"] as const;
const PROCUREMENT_ROLES = ["PROCUREMENT_OFFICER"] as const;
const FINANCE_ROLES = ["FINANCE_APPROVER"] as const;
const READ_ONLY_ROLES = ["VIEWER", "AUDITOR"] as const;
const DRIVER_ROLES = ["DRIVER"] as const;
const FARM_ROLES = [
  "FARM_OWNER",
  "FARM_MANAGER",
  "FIELD_SUPERVISOR",
  "AGRONOMIST",
  "VETERINARIAN",
  "FARM_WORKER",
  "IRRIGATION_OPERATOR",
  "HARVEST_CREW"
] as const;
const FLEET_ROLES = ["FLEET_MANAGER"] as const;
const COMPLIANCE_ROLES = ["COMPLIANCE_MANAGER"] as const;
const ASSET_ROLES = ["ASSET_MANAGER"] as const;

function mergeRoles(...groups: ReadonlyArray<readonly string[]>): readonly string[] {
  return [...new Set(groups.flat())];
}

const DASHBOARD_ROLES = mergeRoles(
  ADMIN_ROLES,
  MANAGEMENT_ROLES,
  SUPERVISOR_ROLES,
  SECURITY_ROLES,
  READ_ONLY_ROLES,
  FARM_ROLES,
  FACILITY_ROLES,
  FLEET_ROLES,
  COMPLIANCE_ROLES,
  ASSET_ROLES
);

const ACTION_CENTER_ROLES = mergeRoles(
  ADMIN_ROLES,
  MANAGEMENT_ROLES,
  SUPERVISOR_ROLES,
  TECHNICIAN_ROLES,
  CLEANING_ROLES,
  FACILITY_ROLES,
  SECURITY_ROLES,
  INVENTORY_ROLES,
  PROCUREMENT_ROLES,
  READ_ONLY_ROLES,
  DRIVER_ROLES,
  FARM_ROLES,
  FLEET_ROLES,
  COMPLIANCE_ROLES,
  ASSET_ROLES,
  FINANCE_ROLES
);

/** Confirmed App Router paths (2026-06-12 audit). */
export const EXISTING_NAV_ROUTES = new Set<string>([
  "/facilities",
  "/facilities/reports",
  "/workspace",
  "/dashboard",
  "/action-center",
  "/admin",
  "/system-health",
  "/work-orders",
  "/assets",
  "/fleet",
  "/fleet/gate",
  "/inventory",
  "/procurement",
  "/compliance",
  "/reports",
  "/vehicles",
  "/settings",
  "/notifications",
  "/billing",
  "/utilities",
  "/predictive-ai",
  "/master-data",
  "/master-data/employees",
  "/accidents",
  "/insurance-claims",
  "/traffic-fines",
  "/maintenance/job-codes",
  "/cleaning",
  "/cleaning/scan",
  "/cleaning/visits",
  "/cleaning/sign-off",
  "/cleaning/analytics",
  "/cleaning/issues",
  "/cleaning/locations",
  "/farm",
  "/farm/fields",
  "/farm/crops",
  "/farm/harvest",
  "/farm/livestock",
  "/farm/irrigation",
  "/farm/spray-logs",
  "/farm/soil-tests",
  "/farm/weather",
  "/farm/workers",
  "/farm/attendance",
  "/farm/finance",
  "/farm/traceability",
  LEGACY_FMS_HOME_PATH
]);

export const NAV_CATEGORY_LABELS: Record<NavCategory, string> = {
  workspace: "Workspace",
  core: "Overview",
  operations: "Operations",
  compliance: "Control & Compliance",
  reports: "Reports & Analytics",
  admin: "Administration",
  cleaning: "Facility Management",
  farm: "Farm Operations",
  legacy: "Archive"
};

const WORKSPACE_ROLES = ACTION_CENTER_ROLES;

export const ROLE_DEFAULT_FAVORITE_NAV_IDS: Record<string, readonly string[]> = {
  TECHNICIAN: ["my-tasks", "waiting-evidence", "action-center"],
  MECHANIC: ["my-tasks", "waiting-evidence", "action-center"],
  INVENTORY_KEEPER: ["inventory", "waiting-parts", "action-center"],
  STOREKEEPER: ["inventory", "waiting-parts", "action-center"],
  SUPERVISOR: ["supervisor-verification", "action-center", "high-risk-queue"],
  MAINTENANCE_SUPERVISOR: ["supervisor-verification", "action-center", "high-risk-queue"],
  MANAGER: ["high-risk-queue", "action-center", "reports"],
  OPERATIONS_MANAGER: ["high-risk-queue", "action-center", "reports"],
  SUPER_ADMIN: ["system-health", "admin-console", "action-center"],
  ADMIN: ["system-health", "admin-console", "action-center"],
  SECURITY_OFFICER: ["fleet-gate", "action-center"],
  FACILITY_MANAGER: ["facilities", "cleaning-issues", "action-center"],
  FARM_MANAGER: ["farm-dashboard", "action-center"]
};

export const FULL_NAVIGATION_ROLES = new Set<string>(["SUPER_ADMIN", "ADMIN"]);

export const NAVIGATION_ITEMS: readonly NavigationItem[] = [
  {
    id: "my-workspace",
    label: "My Workspace",
    href: "/workspace",
    icon: "LayoutDashboard",
    allowedRoles: WORKSPACE_ROLES,
    category: "workspace",
    description: "Role-based shortcuts for your daily work",
    mobilePriority: true,
    activeMatch: "exact"
  },
  {
    id: "action-center",
    label: "Action Center",
    href: "/action-center",
    icon: "BellRing",
    allowedRoles: ACTION_CENTER_ROLES,
    category: "workspace",
    description: "Role-aware operational priorities and attention items",
    badgeKey: "action-center",
    mobilePriority: true,
    pinByDefaultForRoles: mergeRoles(TECHNICIAN_ROLES, SUPERVISOR_ROLES, MANAGEMENT_ROLES, INVENTORY_ROLES),
    activeMatch: "exact"
  },
  {
    id: "my-tasks",
    label: "My Tasks",
    href: "/work-orders?queue=my-tasks",
    icon: "ClipboardList",
    allowedRoles: mergeRoles(TECHNICIAN_ROLES, SUPERVISOR_ROLES),
    category: "workspace",
    description: "Work orders assigned to you",
    badgeKey: "my-tasks",
    pinByDefaultForRoles: TECHNICIAN_ROLES,
    mobilePriority: true
  },
  {
    id: "waiting-parts",
    label: "Waiting Parts",
    href: "/work-orders?queue=waiting-parts",
    icon: "Layers",
    allowedRoles: mergeRoles(TECHNICIAN_ROLES, SUPERVISOR_ROLES, INVENTORY_ROLES, MANAGEMENT_ROLES),
    category: "workspace",
    badgeKey: "waiting-parts",
    pinByDefaultForRoles: INVENTORY_ROLES
  },
  {
    id: "waiting-evidence",
    label: "Evidence Needed",
    href: "/work-orders?queue=waiting-evidence",
    icon: "FileCheck2",
    allowedRoles: mergeRoles(TECHNICIAN_ROLES, SUPERVISOR_ROLES, MANAGEMENT_ROLES),
    category: "workspace",
    badgeKey: "waiting-evidence",
    pinByDefaultForRoles: TECHNICIAN_ROLES
  },
  {
    id: "supervisor-verification",
    label: "Pending Verification",
    href: "/work-orders?queue=supervisor-verification",
    icon: "ClipboardCheck",
    allowedRoles: mergeRoles(SUPERVISOR_ROLES, MANAGEMENT_ROLES, ADMIN_ROLES),
    category: "workspace",
    badgeKey: "supervisor-verification",
    pinByDefaultForRoles: SUPERVISOR_ROLES
  },
  {
    id: "high-risk-queue",
    label: "High Risk",
    href: "/work-orders?queue=high-risk",
    icon: "ShieldAlert",
    allowedRoles: mergeRoles(MANAGEMENT_ROLES, SUPERVISOR_ROLES, ADMIN_ROLES),
    category: "workspace",
    badgeKey: "high-risk",
    pinByDefaultForRoles: MANAGEMENT_ROLES
  },
  {
    id: "triage-queue",
    label: "Triage Queue",
    href: "/work-orders?queue=triage",
    icon: "AlertTriangle",
    allowedRoles: mergeRoles(MANAGEMENT_ROLES, SUPERVISOR_ROLES, ADMIN_ROLES),
    category: "workspace",
    badgeKey: "triage"
  },
  {
    id: "dashboard",
    label: "Dashboard",
    href: "/dashboard",
    icon: "LayoutDashboard",
    allowedRoles: DASHBOARD_ROLES,
    category: "core",
    activeMatch: "exact"
  },
  {
    id: "admin-console",
    label: "Admin Console",
    href: "/admin",
    icon: "ShieldCheck",
    allowedRoles: ADMIN_ROLES,
    category: "admin",
    description: "Platform administration and readiness overview",
    activeMatch: "startsWith"
  },
  {
    id: "system-health",
    label: "System Health",
    href: "/system-health",
    icon: "ServerCog",
    allowedRoles: ADMIN_ROLES,
    category: "admin",
    badgeKey: "system-health"
  },
  {
    id: "work-orders",
    label: "Work Orders",
    href: "/work-orders",
    icon: "ClipboardList",
    allowedRoles: mergeRoles(
      MANAGEMENT_ROLES,
      SUPERVISOR_ROLES,
      TECHNICIAN_ROLES,
      ASSET_ROLES
    ),
    category: "operations"
  },
  {
    id: "assets",
    label: "Assets",
    href: "/assets",
    icon: "HardDrive",
    allowedRoles: mergeRoles(
      MANAGEMENT_ROLES,
      SUPERVISOR_ROLES,
      TECHNICIAN_ROLES,
      ASSET_ROLES
    ),
    category: "operations"
  },
  {
    id: "fleet-gate",
    label: "Gate",
    href: "/fleet/gate",
    icon: "ShieldCheck",
    allowedRoles: mergeRoles(SECURITY_ROLES, ADMIN_ROLES, MANAGEMENT_ROLES, FLEET_ROLES),
    category: "operations",
    activeMatch: "startsWith"
  },
  {
    id: "fleet",
    label: "Fleet",
    href: "/fleet",
    icon: "Fuel",
    allowedRoles: mergeRoles(
      MANAGEMENT_ROLES,
      SECURITY_ROLES,
      DRIVER_ROLES,
      FLEET_ROLES
    ),
    category: "operations"
  },
  {
    id: "vehicles",
    label: "Vehicles",
    href: "/vehicles",
    icon: "Gauge",
    allowedRoles: mergeRoles(
      MANAGEMENT_ROLES,
      DRIVER_ROLES,
      ASSET_ROLES,
      FLEET_ROLES,
      TECHNICIAN_ROLES
    ),
    category: "operations"
  },
  {
    id: "inventory",
    label: "Inventory",
    href: "/inventory",
    icon: "Layers",
    allowedRoles: mergeRoles(MANAGEMENT_ROLES, INVENTORY_ROLES, PROCUREMENT_ROLES),
    category: "operations"
  },
  {
    id: "procurement",
    label: "Procurement",
    href: "/procurement",
    icon: "ClipboardCheck",
    allowedRoles: mergeRoles(MANAGEMENT_ROLES, INVENTORY_ROLES, PROCUREMENT_ROLES),
    category: "operations"
  },
  {
    id: "compliance",
    label: "Compliance",
    href: "/compliance",
    icon: "ShieldCheck",
    allowedRoles: mergeRoles(MANAGEMENT_ROLES, COMPLIANCE_ROLES, ADMIN_ROLES),
    category: "compliance"
  },
  {
    id: "accidents",
    label: "Accidents",
    href: "/accidents",
    icon: "AlertTriangle",
    allowedRoles: mergeRoles(MANAGEMENT_ROLES, COMPLIANCE_ROLES, ADMIN_ROLES),
    category: "compliance"
  },
  {
    id: "insurance-claims",
    label: "Insurance Claims",
    href: "/insurance-claims",
    icon: "FileCheck2",
    allowedRoles: mergeRoles(MANAGEMENT_ROLES, COMPLIANCE_ROLES, ADMIN_ROLES),
    category: "compliance"
  },
  {
    id: "traffic-fines",
    label: "Traffic Fines",
    href: "/traffic-fines",
    icon: "Receipt",
    allowedRoles: mergeRoles(MANAGEMENT_ROLES, COMPLIANCE_ROLES, ADMIN_ROLES, FLEET_ROLES),
    category: "compliance"
  },
  {
    id: "reports",
    label: "Reports",
    href: "/reports",
    icon: "ChartColumnBig",
    allowedRoles: mergeRoles(
      MANAGEMENT_ROLES,
      SUPERVISOR_ROLES,
      READ_ONLY_ROLES,
      COMPLIANCE_ROLES,
      ADMIN_ROLES,
      FINANCE_ROLES
    ),
    category: "reports"
  },
  {
    id: "maintenance-exceptions",
    label: "Maintenance Exceptions",
    href: "/reports/maintenance-exceptions",
    icon: "ShieldAlert",
    allowedRoles: mergeRoles(MANAGEMENT_ROLES, SUPERVISOR_ROLES, ADMIN_ROLES, INVENTORY_ROLES, FINANCE_ROLES),
    category: "reports",
    description: "Fraud monitoring, exception dashboard, and maintenance KPIs"
  },
  {
    id: "utilities",
    label: "Utilities",
    href: "/utilities",
    icon: "Droplets",
    allowedRoles: mergeRoles(MANAGEMENT_ROLES, ADMIN_ROLES, FACILITY_ROLES),
    category: "operations"
  },
  {
    id: "predictive-ai",
    label: "AI Assistant",
    href: "/predictive-ai",
    icon: "Bot",
    allowedRoles: mergeRoles(MANAGEMENT_ROLES, ADMIN_ROLES),
    category: "admin"
  },
  {
    id: "master-data",
    label: "Master Data",
    href: "/master-data",
    icon: "Database",
    allowedRoles: mergeRoles(ADMIN_ROLES, ["MANAGER"]),
    category: "admin"
  },
  {
    id: "job-codes",
    label: "Job Codes",
    href: "/maintenance/job-codes",
    icon: "Tag",
    allowedRoles: mergeRoles(MANAGEMENT_ROLES, SUPERVISOR_ROLES, ADMIN_ROLES),
    category: "operations"
  },
  {
    id: "notifications",
    label: "Notifications",
    href: "/notifications",
    icon: "Bell",
    allowedRoles: DASHBOARD_ROLES,
    category: "admin"
  },
  {
    id: "billing",
    label: "Billing",
    href: "/billing",
    icon: "CreditCard",
    allowedRoles: mergeRoles(ADMIN_ROLES, FINANCE_ROLES),
    category: "admin"
  },
  {
    id: "settings",
    label: "Settings",
    href: "/settings",
    icon: "Settings",
    allowedRoles: mergeRoles(ADMIN_ROLES, MANAGEMENT_ROLES),
    category: "admin"
  },
  {
    id: "facilities",
    label: "Facilities",
    href: "/facilities",
    icon: "Building2",
    allowedRoles: mergeRoles(
      ADMIN_ROLES,
      MANAGEMENT_ROLES,
      FACILITY_ROLES,
      SUPERVISOR_ROLES,
      READ_ONLY_ROLES
    ),
    category: "cleaning",
    description: "Property, building, floor, and room hierarchy",
    activeMatch: "startsWith"
  },
  {
    id: "facilities-reports",
    label: "Facility Reports",
    href: "/facilities/reports",
    icon: "BarChart3",
    allowedRoles: mergeRoles(
      ADMIN_ROLES,
      MANAGEMENT_ROLES,
      FACILITY_ROLES,
      SUPERVISOR_ROLES,
      READ_ONLY_ROLES
    ),
    category: "cleaning",
    description: "Hierarchy and issue KPI summary",
    activeMatch: "exact"
  },
  {
    id: "cleaning-overview",
    label: "Overview",
    href: "/cleaning",
    icon: "SprayCan",
    allowedRoles: mergeRoles(CLEANING_ROLES, FACILITY_ROLES, MANAGEMENT_ROLES, ADMIN_ROLES),
    category: "cleaning"
  },
  {
    id: "cleaning-issues",
    label: "Facility Issues",
    href: "/cleaning/issues",
    icon: "Bell",
    allowedRoles: mergeRoles(CLEANING_ROLES, FACILITY_ROLES, MANAGEMENT_ROLES, ADMIN_ROLES),
    category: "cleaning"
  },
  {
    id: "cleaning-scan",
    label: "Scan QR",
    href: "/cleaning/scan",
    icon: "QrCode",
    allowedRoles: mergeRoles(CLEANING_ROLES, FACILITY_ROLES, MANAGEMENT_ROLES, ADMIN_ROLES),
    category: "cleaning"
  },
  {
    id: "cleaning-visits",
    label: "Visits",
    href: "/cleaning/visits",
    icon: "ClipboardCheck",
    allowedRoles: mergeRoles(CLEANING_ROLES, FACILITY_ROLES, MANAGEMENT_ROLES, ADMIN_ROLES),
    category: "cleaning"
  },
  {
    id: "cleaning-sign-off",
    label: "Sign-off Queue",
    href: "/cleaning/sign-off",
    icon: "ClipboardCheck",
    allowedRoles: mergeRoles(CLEANING_ROLES, FACILITY_ROLES, MANAGEMENT_ROLES, ADMIN_ROLES),
    category: "cleaning"
  },
  {
    id: "cleaning-analytics",
    label: "Analytics",
    href: "/cleaning/analytics",
    icon: "ChartColumnBig",
    allowedRoles: mergeRoles(FACILITY_ROLES, MANAGEMENT_ROLES, ADMIN_ROLES),
    category: "cleaning"
  },
  {
    id: "cleaning-locations",
    label: "Locations",
    href: "/cleaning/locations",
    icon: "MapPin",
    allowedRoles: mergeRoles(FACILITY_ROLES, MANAGEMENT_ROLES, ADMIN_ROLES),
    category: "cleaning"
  },
  {
    id: "farm-dashboard",
    label: "Farm Dashboard",
    href: "/farm",
    icon: "Tractor",
    allowedRoles: mergeRoles(FARM_ROLES, ADMIN_ROLES, ["MANAGER"]),
    category: "farm"
  },
  {
    id: "farm-fields",
    label: "Fields & Map",
    href: "/farm/fields",
    icon: "MapPin",
    allowedRoles: mergeRoles(FARM_ROLES, ADMIN_ROLES),
    category: "farm"
  },
  {
    id: "farm-crops",
    label: "Crops",
    href: "/farm/crops",
    icon: "Sprout",
    allowedRoles: mergeRoles(FARM_ROLES, ADMIN_ROLES),
    category: "farm"
  },
  {
    id: "farm-harvest",
    label: "Harvest",
    href: "/farm/harvest",
    icon: "Leaf",
    allowedRoles: mergeRoles(FARM_ROLES, ADMIN_ROLES),
    category: "farm"
  },
  {
    id: "farm-livestock",
    label: "Livestock",
    href: "/farm/livestock",
    icon: "Tractor",
    allowedRoles: mergeRoles(FARM_ROLES, ADMIN_ROLES),
    category: "farm"
  },
  {
    id: "farm-irrigation",
    label: "Irrigation",
    href: "/farm/irrigation",
    icon: "Droplets",
    allowedRoles: mergeRoles(FARM_ROLES, ADMIN_ROLES),
    category: "farm"
  },
  {
    id: "farm-spray-logs",
    label: "Spray Logs",
    href: "/farm/spray-logs",
    icon: "SprayCan",
    allowedRoles: mergeRoles(FARM_ROLES, ADMIN_ROLES),
    category: "farm"
  },
  {
    id: "farm-soil-tests",
    label: "Soil Tests",
    href: "/farm/soil-tests",
    icon: "Layers",
    allowedRoles: mergeRoles(FARM_ROLES, ADMIN_ROLES),
    category: "farm"
  },
  {
    id: "farm-weather",
    label: "Weather",
    href: "/farm/weather",
    icon: "Sun",
    allowedRoles: mergeRoles(FARM_ROLES, ADMIN_ROLES),
    category: "farm"
  },
  {
    id: "farm-workers",
    label: "Workers",
    href: "/farm/workers",
    icon: "Users",
    allowedRoles: mergeRoles(FARM_ROLES, ADMIN_ROLES),
    category: "farm"
  },
  {
    id: "farm-attendance",
    label: "Attendance",
    href: "/farm/attendance",
    icon: "ClipboardCheck",
    allowedRoles: mergeRoles(FARM_ROLES, ADMIN_ROLES),
    category: "farm"
  },
  {
    id: "farm-finance",
    label: "Finance",
    href: "/farm/finance",
    icon: "Wallet",
    allowedRoles: mergeRoles(FARM_ROLES, ADMIN_ROLES),
    category: "farm"
  },
  {
    id: "farm-traceability",
    label: "Traceability",
    href: "/farm/traceability",
    icon: "QrCode",
    allowedRoles: mergeRoles(FARM_ROLES, ADMIN_ROLES),
    category: "farm"
  },
  {
    id: "legacy-fms-archive",
    label: "Legacy FMS Archive",
    href: LEGACY_FMS_HOME_PATH,
    icon: "Archive",
    allowedRoles: LEGACY_FMS_ARCHIVE_ROLES,
    category: "legacy",
    description: "Admin-only read-only archived workspace. Use Work Orders for current maintenance history.",
    legacy: true,
    activeMatch: "exact"
  }
];

const NAV_CATEGORY_ORDER: NavCategory[] = [
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
  "/admin/roles": ["/admin"],
  "/admin/tenants": ["/admin"],
  "/admin/invitations": ["/admin"],
  "/reports/job-costing": ["/reports"],
  "/master-data/employees": ["/master-data"]
};

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
    return item.id === "my-workspace" || item.id === "action-center";
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
    return ["action-center"];
  }

  const configured = ROLE_DEFAULT_FAVORITE_NAV_IDS[normalized];
  if (configured?.length) {
    return [...configured];
  }

  const pinned = NAVIGATION_ITEMS.filter(
    (item) => item.pinByDefaultForRoles?.includes(normalized)
  ).map((item) => item.id);

  return pinned.length > 0 ? pinned : ["action-center"];
}

export function getVisibleNavigationItems(
  roleName: string | null | undefined,
  options?: { fullNavigation?: boolean; permissions?: readonly string[] }
): NavigationItem[] {
  const normalized = normalizeNavigationRole(roleName);
  const permissions = options?.permissions ?? [];
  const fullNavigation = Boolean(options?.fullNavigation && normalized && FULL_NAVIGATION_ROLES.has(normalized));

  const visible = NAVIGATION_ITEMS.filter((item) => {
    const baseHref = item.href.split("?")[0];
    if (!EXISTING_NAV_ROUTES.has(baseHref)) {
      return false;
    }

    if (!isNavigationItemVisible(item, roleName, permissions)) {
      return false;
    }

    if (!fullNavigation && normalized && !FULL_NAVIGATION_ROLES.has(normalized)) {
      if (item.category === "legacy") {
        return false;
      }
    }

    return true;
  });

  if (visible.length > 0) {
    return visible;
  }

  const fallback = NAVIGATION_ITEMS.find((item) => item.id === "action-center");
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
    pathname.startsWith("/forgot-password")
  ) {
    return true;
  }

  const visible = getVisibleNavigationItems(roleName, { permissions });
  const normalizedPath = pathname.split("?")[0];

  if (visible.some((item) => isNavItemActive(normalizedPath, item))) {
    return true;
  }

  const aliases = ROUTE_ACCESS_ALIASES[normalizedPath];
  if (aliases?.some((alias) => visible.some((item) => isNavItemActive(alias, item)))) {
    return true;
  }

  if (normalizedPath.startsWith("/work-orders")) {
    return visible.some((item) => item.href.startsWith("/work-orders") || item.id === "my-tasks");
  }

  if (normalizedPath.startsWith("/admin")) {
    return visible.some((item) => item.href === "/admin" || item.href.startsWith("/admin"));
  }

  if (normalizedPath.startsWith("/farm")) {
    return visible.some((item) => item.category === "farm");
  }

  if (normalizedPath.startsWith("/cleaning") || normalizedPath.startsWith("/facilities")) {
    return visible.some((item) => item.category === "cleaning");
  }

  return FULL_NAVIGATION_ROLES.has(normalizeNavigationRole(roleName) ?? "");
}

export type MobileBottomNavItem = {
  id: string;
  label: string;
  href: string;
  icon: string;
  action?: "search";
};

export function getMobileBottomNavItems(roleName: string | null | undefined): MobileBottomNavItem[] {
  const visible = getVisibleNavigationItems(roleName);
  const hasWorkOrders = visible.some((item) => item.id === "work-orders" || item.id === "my-tasks");
  const hasSettings = visible.some((item) => item.id === "settings");

  const homeHref = visible.find((item) => item.id === "action-center")?.href ?? "/action-center";
  const tasksHref = visible.find((item) => item.id === "my-tasks")?.href ?? "/work-orders";

  const items: MobileBottomNavItem[] = [
    { id: "home", label: "Home", href: homeHref, icon: "Home" },
    { id: "actions", label: "Actions", href: "/action-center", icon: "BellRing" }
  ];

  if (hasWorkOrders) {
    items.push({ id: "create", label: "Jobs", href: tasksHref, icon: "ClipboardList" });
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
  const match = item.activeMatch ?? (itemPath === "/dashboard" ? "exact" : "startsWith");

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

export function hasPrimaryHomeNavItem(items: NavigationItem[]): boolean {
  return items.some(
    (item) =>
      !item.legacy &&
      (item.href === LEGACY_FMS_HOME_PATH || item.label.toLowerCase() === "home")
  );
}
