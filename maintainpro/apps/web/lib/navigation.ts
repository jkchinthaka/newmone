/**
 * Centralized dashboard navigation configuration.
 * Frontend UX only — backend RBAC remains authoritative for route access.
 */

import { LEGACY_FMS_HOME_PATH } from "./role-redirect";

export type NavActiveMatch = "exact" | "startsWith";

export type NavCategory =
  | "core"
  | "operations"
  | "compliance"
  | "admin"
  | "cleaning"
  | "farm"
  | "legacy";

export interface NavigationItem {
  id: string;
  label: string;
  href: string;
  icon: string;
  allowedRoles: readonly string[];
  category: NavCategory;
  description?: string;
  legacy?: boolean;
  activeMatch?: NavActiveMatch;
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
  ASSET_ROLES
);

/** Confirmed App Router paths (2026-06-12 audit). */
export const EXISTING_NAV_ROUTES = new Set<string>([
  "/facilities",
  "/dashboard",
  "/action-center",
  "/admin",
  "/system-health",
  "/work-orders",
  "/assets",
  "/fleet",
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
  core: "Overview",
  operations: "Operations",
  compliance: "Compliance & Safety",
  admin: "Administration",
  cleaning: "Cleaning Management",
  farm: "Farm Operations",
  legacy: "Archived"
};

export const NAVIGATION_ITEMS: readonly NavigationItem[] = [
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
    id: "action-center",
    label: "Action Center",
    href: "/action-center",
    icon: "BellRing",
    allowedRoles: ACTION_CENTER_ROLES,
    category: "core",
    description: "Role-aware operational priorities and attention items",
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
    category: "admin"
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
      ADMIN_ROLES
    ),
    category: "core"
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
    allowedRoles: ADMIN_ROLES,
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
    allowedRoles: ADMIN_ROLES,
    category: "legacy",
    description: "Read-only archived workspace. Use the main dashboard for current operations.",
    legacy: true,
    activeMatch: "exact"
  }
];

const NAV_CATEGORY_ORDER: NavCategory[] = [
  "core",
  "operations",
  "compliance",
  "admin",
  "cleaning",
  "farm",
  "legacy"
];

export function normalizeNavigationRole(roleName: string | null | undefined): string | null {
  if (!roleName) {
    return null;
  }

  const trimmed = roleName.trim();
  return trimmed.length > 0 ? trimmed.toUpperCase() : null;
}

export function isNavigationItemVisible(
  item: NavigationItem,
  roleName: string | null | undefined
): boolean {
  const normalized = normalizeNavigationRole(roleName);

  if (!normalized) {
    return item.id === "dashboard";
  }

  return item.allowedRoles.includes(normalized);
}

export function getVisibleNavigationItems(
  roleName: string | null | undefined
): NavigationItem[] {
  const visible = NAVIGATION_ITEMS.filter((item) => {
    if (!EXISTING_NAV_ROUTES.has(item.href)) {
      return false;
    }

    return isNavigationItemVisible(item, roleName);
  });

  if (visible.length > 0) {
    return visible;
  }

  const dashboard = NAVIGATION_ITEMS.find((item) => item.id === "dashboard");
  return dashboard ? [dashboard] : [];
}

export function getNavigationGroups(roleName: string | null | undefined): NavigationGroup[] {
  const visibleItems = getVisibleNavigationItems(roleName);

  return NAV_CATEGORY_ORDER.map((category) => ({
    category,
    label: NAV_CATEGORY_LABELS[category],
    items: visibleItems.filter((item) => item.category === category)
  })).filter((group) => group.items.length > 0);
}

export function isNavItemActive(pathname: string, item: NavigationItem): boolean {
  const match =
    item.activeMatch ?? (item.href === "/dashboard" ? "exact" : "startsWith");

  if (match === "exact") {
    return pathname === item.href;
  }

  return pathname === item.href || pathname.startsWith(`${item.href}/`);
}

export function hasPrimaryHomeNavItem(items: NavigationItem[]): boolean {
  return items.some(
    (item) =>
      !item.legacy &&
      (item.href === LEGACY_FMS_HOME_PATH || item.label.toLowerCase() === "home")
  );
}
