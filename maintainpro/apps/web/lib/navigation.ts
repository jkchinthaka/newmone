/**
 * Centralized dashboard navigation — Phase 1 CMMS scope.
 * Primary nav: Home, Requests, Work Orders, Preventive Maintenance, Assets, Fleet, Spare Parts, Reports, Admin.
 * Frontend UX only — backend RBAC remains authoritative for API access.
 *
 * Retired from normal product surface (routes may remain for compatibility; not in primary nav):
 * Farm Operations, Cleaning workforce, SaaS Billing, Predictive AI,
 * QA/Delivery/Go-Live/Post-Go-Live business admin clutter.
 * FG Digital Records integration was removed from MaintainPro entirely.
 */

import { ADMIN_PAGE_API_GATES, NAV_ITEM_API_GATES, type NavApiGate } from "./nav-api-gates";
import { hasCompatiblePermission } from "./permission-aliases";
import {
  DEFAULT_POST_LOGIN_REDIRECT,
  EXISTING_POST_LOGIN_ROUTES,
  extractRoleName,
  getPostLoginRedirect,
  isRetiredActionCenterPath,
  isRetiredSplashPath,
  LEGACY_FMS_HOME_PATH,
  ROLE_POST_LOGIN_PREFERENCES,
  safeInternalReturnPath,
  type PostLoginUserLike
} from "./role-redirect";

export type NavActiveMatch = "exact" | "startsWith";

export type NavCategory =
  | "primary"
  | "secondary"
  | "workspace"
  | "core"
  | "operations"
  | "advanced"
  | "safety"
  | "compliance"
  | "reports"
  | "admin"
  | "cleaning"
  | "farm"
  | "legacy";

export type NavBadgeKey =
  | "my-tasks"
  | "waiting-parts"
  | "waiting-evidence"
  | "supervisor-verification"
  | "high-risk"
  | "triage"
  | "overdue"
  | "system-health"
  | "approvals";

export interface NavigationItem {
  id: string;
  label: string;
  href: string;
  icon: string;
  allowedRoles: readonly string[];
  requiredPermissions?: readonly string[];
  /** When set, item is hidden unless this tenant feature code is enabled */
  requiredFeature?: string;
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

/**
 * Mirrors the maintenance-requests API read roles (maintenance-requests.controller.ts READ_ROLES).
 * Visibility additionally requires the list permission below, so roles that would get a 403
 * (e.g. seeded TECHNICIAN / DRIVER without request permissions) do not see a dead menu entry.
 */
const REQUEST_ROLES = mergeRoles(
  ADMIN_ROLES,
  ["MANAGER", "SUPERVISOR", "ASSET_MANAGER", "VIEWER", "DRIVER"],
  TECHNICIAN_ROLES,
  FACILITY_ROLES
);

/** GET /maintenance-requests requires maintenance_requests.view_own or a guard alias of it. */
export const REQUEST_LIST_PERMISSIONS = [
  "maintenance_requests.view_own",
  "facility_issues.view",
  "facility_issues.report"
] as const;

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

/**
 * Domain job lanes (Machinery / Service / Vehicle) are planning views for managers.
 * Technicians and mechanics use My Jobs for the same work, so the lanes stay out of their menu.
 * Deep links under /maintenance/jobs/* still open for them through the Work Orders entry.
 */
const DOMAIN_JOB_LANE_ROLES = WO_ROLES.filter((role) => !(TECHNICIAN_ROLES as readonly string[]).includes(role));

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

// Keep this aligned with inventory parts read roles. Supervisor and technician get 403
// on the catalog, so the Spare Parts and ERP Mapping entries must not be shown to them.
const PARTS_ROLES = mergeRoles(
  ADMIN_ROLES,
  MANAGEMENT_ROLES,
  ASSET_ROLES,
  INVENTORY_ROLES,
  ["MECHANIC"]
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
  "/requests",
  "/requests/new",
  "/requests/mine",
  "/qr/report-issue",
  "/work-orders",
  "/work-orders/my",
  "/maintenance",
  "/maintenance/jobs",
  "/maintenance/jobs/machinery",
  "/maintenance/jobs/service",
  "/maintenance/jobs/vehicle",
  "/maintenance/planning",
  "/maintenance/inspections",
  "/maintenance/reliability",
  "/maintenance/costs",
  "/maintenance/history",
  "/maintenance/job-codes",
  "/maintenance/forecast",
  "/maintenance/plans",
  "/assets",
  "/assets/health",
  "/fleet",
  "/fleet/tyres",
  "/vehicles",
  "/vehicles/health",
  "/vehicles/costs",
  "/inventory",
  "/inventory/movements",
  "/inventory/unverified-issues",
  "/inventory/daily",
  "/inventory/stock-counts",
  "/inventory/import",
  "/inventory/erp-import",
  "/inventory/warranty",
  "/maintenance-supply",
  "/procurement",
  "/procurement/vendors",
  "/reports",
  "/reports/maintenance-exceptions",
  "/reports/fraud-control",
  "/reports/fraud-control/field-checks",
  "/reports/management-intelligence",
  "/admin",
  "/admin/organization",
  "/admin/asset-masters",
  "/admin/data-quality",
  "/admin/audit",
  "/admin/maintenance-config",
  "/admin/job-categories",
  "/admin/priority-sla",
  "/admin/fault-codes",
  "/admin/reason-codes",
  "/admin/config-history",
  "/admin/checklist-templates",
  "/admin/maintenance-templates",
  "/admin/feature-flags",
  "/admin/warranties",
  "/admin/reliability",
  "/admin/work-permits",
  "/admin/condition-monitoring",
  "/admin/integrations",
  "/admin/security",
  "/admin/users",
  "/admin/roles",
  "/admin/people",
  "/admin/invitations",
  "/admin/approvals",
  "/admin/approval-rules",
  "/admin/bulk-imports",
  "/approvals",
  "/vendor-portal",
  "/erp",
  "/erp/exceptions",
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
  "/utilities/readings",
  "/admin/assets/new",
  "/admin/vehicles/new",
  "/admin/asset-tags",
  "/operations/exceptions",
  LEGACY_FMS_HOME_PATH
]);

export const NAV_CATEGORY_LABELS: Record<NavCategory, string> = {
  primary: "Main",
  secondary: "Account",
  workspace: "Home",
  core: "Assets & Places",
  operations: "Daily Work",
  advanced: "Jobs",
  safety: "Reports & Analysis",
  compliance: "Fleet",
  reports: "Parts & Stock",
  admin: "Administration",
  cleaning: "Facility (retired)",
  farm: "Farm (retired)",
  legacy: "Archive"
};

export const ROLE_DEFAULT_FAVORITE_NAV_IDS: Record<string, readonly string[]> = {
  TECHNICIAN: ["my-jobs", "report-issue"],
  MECHANIC: ["my-jobs", "report-issue"],
  INVENTORY_KEEPER: ["spare-parts"],
  STOREKEEPER: ["spare-parts"],
  SUPERVISOR: ["all-jobs", "requests"],
  MAINTENANCE_SUPERVISOR: ["all-jobs", "preventive-maintenance"],
  MANAGER: ["reports", "all-jobs", "my-jobs"],
  OPERATIONS_MANAGER: ["reports", "all-jobs", "my-jobs"],
  SUPER_ADMIN: ["admin", "system-health"],
  ADMIN: ["admin"],
  // The fleet overview is hidden for security officers; they report problems through Requests.
  SECURITY_OFFICER: ["requests", "report-issue"],
  FLEET_MANAGER: ["fleet", "vehicle-jobs"],
  DRIVER: ["fleet"],
  VIEWER: ["reports"],
  ASSET_MANAGER: ["assets", "preventive-maintenance"]
};

export const FULL_NAVIGATION_ROLES = new Set<string>(["SUPER_ADMIN", "ADMIN"]);

/**
 * Enterprise navigation — Home, Maintenance, Assets, Fleet, ERP, Administration.
 * Domain job lanes share the unified Work Order engine (jobDomain filter).
 */
export const NAVIGATION_ITEMS: readonly NavigationItem[] = [
  {
    id: "maintenance-dashboard",
    label: "Dashboard",
    href: "/maintenance",
    icon: "LayoutDashboard",
    allowedRoles: WO_ROLES,
    category: "operations",
    description: "Open, late, and urgent jobs at a glance",
    mobilePriority: true,
    activeMatch: "exact"
  },
  {
    id: "report-issue",
    label: "Report a Problem",
    href: "/requests/new",
    icon: "AlertTriangle",
    allowedRoles: REQUEST_ROLES,
    requiredPermissions: ["maintenance_requests.create"],
    category: "operations",
    description: "Tell maintenance about a broken machine, vehicle, or building",
    activeMatch: "exact"
  },
  {
    id: "requests",
    label: "Requests",
    href: "/requests",
    icon: "FileCheck2",
    allowedRoles: REQUEST_ROLES,
    requiredPermissions: REQUEST_LIST_PERMISSIONS,
    category: "operations",
    description: "Report a problem and follow requests",
    mobilePriority: true,
    activeMatch: "startsWith"
  },
  {
    id: "my-requests",
    label: "My Requests",
    href: "/requests/mine",
    icon: "ClipboardCheck",
    allowedRoles: REQUEST_ROLES,
    requiredPermissions: ["maintenance_requests.create"],
    category: "operations",
    description: "Problems you reported",
    activeMatch: "exact"
  },
  {
    id: "my-jobs",
    label: "My Jobs",
    href: "/work-orders/my",
    icon: "ClipboardList",
    allowedRoles: mergeRoles(TECHNICIAN_ROLES, SUPERVISOR_ROLES, ["ADMIN", "MANAGER", "SUPER_ADMIN"]),
    category: "operations",
    description: "Jobs assigned to you",
    mobilePriority: true,
    activeMatch: "exact"
  },
  {
    id: "approvals",
    label: "Approvals",
    href: "/approvals",
    icon: "ClipboardCheck",
    allowedRoles: mergeRoles(SUPERVISOR_ROLES, ["ADMIN", "MANAGER", "SUPER_ADMIN", "OPERATIONS_MANAGER", "FINANCE", "FACILITY_MANAGER"]),
    requiredPermissions: ["approvals.view"],
    badgeKey: "approvals",
    category: "operations",
    description: "Items waiting for your approval",
    activeMatch: "startsWith"
  },
  {
    id: "all-jobs",
    label: "All Jobs",
    href: "/maintenance/jobs",
    icon: "ClipboardList",
    allowedRoles: WO_ROLES,
    category: "advanced",
    description: "All maintenance jobs",
    badgeKey: "my-tasks",
    mobilePriority: true,
    pinByDefaultForRoles: mergeRoles(TECHNICIAN_ROLES, SUPERVISOR_ROLES),
    activeMatch: "exact"
  },
  {
    id: "machinery-jobs",
    label: "Machinery Jobs",
    href: "/maintenance/jobs/machinery",
    icon: "HardDrive",
    allowedRoles: DOMAIN_JOB_LANE_ROLES,
    category: "advanced",
    description: "Machinery jobs: machines and equipment",
    activeMatch: "exact"
  },
  {
    id: "service-jobs",
    label: "Service Jobs",
    href: "/maintenance/jobs/service",
    icon: "Building2",
    allowedRoles: DOMAIN_JOB_LANE_ROLES,
    category: "advanced",
    description: "Service jobs: buildings, facilities and places",
    activeMatch: "exact"
  },
  {
    id: "vehicle-jobs",
    label: "Vehicle Jobs",
    href: "/maintenance/jobs/vehicle",
    icon: "Truck",
    allowedRoles: mergeRoles(DOMAIN_JOB_LANE_ROLES, FLEET_ROLES),
    category: "advanced",
    description: "Repair and service jobs for vehicles",
    activeMatch: "exact"
  },
  {
    id: "preventive-maintenance",
    label: "Scheduled Service",
    href: "/maintenance/plans",
    icon: "CalendarClock",
    allowedRoles: PM_ROLES,
    category: "advanced",
    description: "Planned service by date or usage",
    activeMatch: "startsWith"
  },
  {
    id: "inspections",
    label: "Inspections",
    href: "/maintenance/inspections",
    icon: "ClipboardCheck",
    allowedRoles: WO_ROLES,
    category: "advanced",
    description: "Planned checks and checklists",
    activeMatch: "startsWith"
  },
  {
    id: "meter-readings",
    label: "Meter Readings",
    href: "/utilities/readings",
    icon: "Gauge",
    allowedRoles: mergeRoles(ADMIN_ROLES, ["ASSET_MANAGER", "SUPERVISOR", "TECHNICIAN", "MECHANIC"]),
    category: "advanced",
    description: "Record water, power, and gas meter readings",
    activeMatch: "startsWith"
  },
  {
    id: "vendors-external",
    label: "Outside Repairs",
    href: "/procurement/vendors",
    icon: "Users",
    allowedRoles: mergeRoles(PARTS_ROLES, MANAGEMENT_ROLES, ADMIN_ROLES, PROCUREMENT_ROLES),
    category: "advanced",
    description: "Suppliers and outside repairs",
    activeMatch: "startsWith"
  },
  {
    id: "maintenance-history",
    label: "Job History",
    href: "/maintenance/history",
    icon: "Clock3",
    allowedRoles: WO_ROLES,
    category: "advanced",
    description: "Past work on a machine, vehicle, or place",
    activeMatch: "startsWith"
  },
  {
    id: "assets",
    label: "Machines & Equipment",
    href: "/assets",
    icon: "Boxes",
    allowedRoles: ASSET_NAV_ROLES,
    category: "core",
    description: "All machines and equipment",
    activeMatch: "startsWith"
  },
  {
    id: "fleet",
    label: "Vehicles",
    href: "/fleet",
    icon: "Truck",
    allowedRoles: FLEET_NAV_ROLES,
    requiredFeature: "FLEET",
    category: "core",
    description: "Vehicles and their status",
    activeMatch: "startsWith"
  },
  {
    id: "facilities",
    label: "Sites & Locations",
    href: "/admin/organization",
    icon: "Building2",
    allowedRoles: mergeRoles(ADMIN_ROLES, MANAGEMENT_ROLES, FACILITY_ROLES, ASSET_ROLES),
    category: "core",
    description: "Sites, buildings, and locations",
    activeMatch: "startsWith"
  },
  {
    id: "spare-parts",
    label: "Spare Parts",
    href: "/inventory",
    icon: "Layers",
    allowedRoles: PARTS_ROLES,
    category: "reports",
    description: "Parts and stock levels",
    activeMatch: "startsWith"
  },
  {
    id: "reports",
    label: "Reports",
    href: "/reports",
    icon: "BarChart3",
    allowedRoles: REPORT_ROLES,
    category: "safety",
    description: "Maintenance and fleet reports",
    activeMatch: "startsWith"
  },
  {
    id: "reliability",
    label: "Breakdowns & Causes",
    href: "/maintenance/reliability",
    icon: "Activity",
    allowedRoles: mergeRoles(SUPERVISOR_ROLES, MANAGEMENT_ROLES, ADMIN_ROLES),
    category: "safety",
    description: "Breakdowns, machine stopped time, and their causes",
    activeMatch: "startsWith"
  },
  {
    id: "admin",
    label: "Admin Console",
    href: "/admin",
    icon: "ShieldCheck",
    allowedRoles: ADMIN_ROLES,
    category: "admin",
    description: "Users, roles, and settings",
    activeMatch: "startsWith"
  },
  {
    id: "admin-asset-register",
    label: "Add Machine",
    href: "/admin/assets/new",
    icon: "Package",
    allowedRoles: ADMIN_ROLES,
    category: "admin",
    description: "Add a new machine or equipment",
    activeMatch: "exact"
  },
  {
    id: "admin-vehicle-register",
    label: "Add Vehicle",
    href: "/admin/vehicles/new",
    icon: "Truck",
    allowedRoles: ADMIN_ROLES,
    category: "admin",
    description: "Add a new vehicle",
    activeMatch: "exact"
  },
  {
    id: "admin-asset-tags",
    label: "Upload Asset Tags",
    href: "/admin/asset-tags",
    icon: "QrCode",
    allowedRoles: ADMIN_ROLES,
    category: "admin",
    description: "Upload and check asset tags",
    activeMatch: "exact"
  },
  {
    id: "erp-integration",
    label: "ERP Sync",
    href: "/erp",
    icon: "Database",
    allowedRoles: ADMIN_ROLES,
    category: "admin",
    description: "Match stock with the ERP system",
    activeMatch: "startsWith"
  },
  {
    id: "maintenance-supply",
    label: "ERP Part Codes",
    href: "/maintenance-supply",
    icon: "Layers",
    allowedRoles: PARTS_ROLES,
    category: "admin",
    description: "Parts linked to ERP codes, and tool returns",
    activeMatch: "exact"
  },
  {
    id: "system-health",
    label: "System Health",
    href: "/system-health",
    icon: "Activity",
    allowedRoles: ["SUPER_ADMIN"],
    category: "admin",
    description: "Check that system services are running",
    badgeKey: "system-health",
    activeMatch: "startsWith"
  },
  {
    id: "notifications",
    label: "Notifications",
    href: "/notifications",
    icon: "Bell",
    allowedRoles: HOME_ROLES,
    category: "secondary",
    description: "Your alerts and messages",
    activeMatch: "exact"
  },
  {
    id: "settings",
    label: "My Profile",
    href: "/settings",
    icon: "UserCircle2",
    allowedRoles: HOME_ROLES,
    category: "secondary",
    description: "Your name, password, and preferences",
    activeMatch: "startsWith"
  }
];

const NAV_CATEGORY_ORDER: NavCategory[] = [
  "workspace",
  "operations",
  "advanced",
  "core",
  "compliance",
  "reports",
  "safety",
  "admin",
  "secondary",
  "primary",
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
  "/admin/asset-masters": ["/admin"],
  "/admin/maintenance-config": ["/admin"],
  "/admin/job-categories": ["/admin"],
  "/admin/priority-sla": ["/admin"],
  "/admin/fault-codes": ["/admin"],
  "/admin/reason-codes": ["/admin"],
  "/admin/config-history": ["/admin"],
  "/admin/checklist-templates": ["/admin"],
  "/admin/maintenance-templates": ["/admin"],
  "/admin/feature-flags": ["/admin"],
  "/admin/warranties": ["/admin"],
  "/admin/reliability": ["/admin"],
  "/admin/work-permits": ["/admin"],
  "/admin/condition-monitoring": ["/admin"],
  "/admin/integrations": ["/admin"],
  "/admin/security": ["/admin"],
  "/admin/approvals": ["/admin"],
  "/admin/approval-rules": ["/admin"],
  "/admin/data-quality": ["/admin"],
  "/admin/audit": ["/admin"],
  "/requests/mine": ["/requests"],
  "/work-orders": ["/maintenance/jobs"],
  "/maintenance/job-codes": ["/maintenance"],
  "/maintenance/forecast": ["/maintenance/planning"],
  "/maintenance/plans": ["/maintenance"],
  "/vehicles": ["/fleet"],
  "/vehicles/health": ["/fleet"],
  "/vehicles/costs": ["/fleet"],
  "/fleet/tyres": ["/fleet"],
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

/**
 * Mirrors the API guards for the request that opens a page: @Roles (by role name) and
 * @Permissions (with the same aliases). SUPER_ADMIN still needs to be listed in @Roles,
 * exactly like the API RolesGuard.
 */
/** Role names the API knows (RoleName). Other names are tenant/custom labels the gates cannot judge. */
const API_ROLE_NAMES = new Set([
  "SUPER_ADMIN", "ADMIN", "OPERATIONS_MANAGER", "FLEET_MANAGER", "COMPLIANCE_MANAGER", "MANAGER",
  "TECHNICIAN", "MECHANIC", "ASSET_MANAGER", "INVENTORY_KEEPER", "PROCUREMENT_OFFICER", "FINANCE",
  "SUPERVISOR", "SECURITY_OFFICER", "CLEANER", "DRIVER", "VIEWER", "FARM_OWNER", "FARM_MANAGER",
  "FIELD_SUPERVISOR", "AGRONOMIST", "VETERINARIAN", "FARM_WORKER", "IRRIGATION_OPERATOR", "HARVEST_CREW",
  "FACILITY_MANAGER", "BUILDING_SUPERVISOR"
]);

export function navApiGateAllows(gate: NavApiGate, role: string | null | undefined, permissions: readonly string[]): boolean {
  if (!role) return false;
  if (!API_ROLE_NAMES.has(role)) return true;
  if (gate.roles.length > 0 && !gate.roles.includes(role)) return false;
  // ADMIN / SUPER_ADMIN hold every key in practice; the existing nav already skips their
  // permission checks. The @Roles part still applies (e.g. SUPER_ADMIN-only bulk imports).
  // Callers that build a menu without the user's keys (landing defaults, role previews)
  // only get the @Roles part; real sessions always carry keys, so the full check applies.
  if (FULL_NAVIGATION_ROLES.has(role) || gate.permissions.length === 0 || permissions.length === 0) return true;
  const granted = new Set(permissions.map((p) => p.trim()));
  return gate.permissions.every((permission) => hasCompatiblePermission(granted, permission, role));
}

/** Items granted by permission alone (any department role may report a problem). */
const PERMISSION_GRANTED_NAV_IDS = new Set(["requests", "my-requests", "report-issue"]);

/** Mirrors maintenance-requests.controller.ts TRIAGE_ROLES (role previews without permission keys). */
const REQUEST_TRIAGE_ROLES = new Set([
  "SUPER_ADMIN",
  "ADMIN",
  "MANAGER",
  "SUPERVISOR",
  "ASSET_MANAGER",
  "FACILITY_MANAGER",
  "BUILDING_SUPERVISOR"
]);

/**
 * Same rule as MaintenanceRequestsService.canViewAll: view_all or triage (with guard aliases).
 * Without permission keys (role previews) the triage role list decides.
 */
export function canViewAllRequests(roleName: string | null | undefined, permissions: readonly string[] = []): boolean {
  const normalized = normalizeNavigationRole(roleName);
  if (!normalized) return false;
  if (FULL_NAVIGATION_ROLES.has(normalized)) return true;
  if (permissions.length === 0) return REQUEST_TRIAGE_ROLES.has(normalized);
  const granted = new Set(permissions.map((p) => p.trim()));
  return (
    hasCompatiblePermission(granted, "maintenance_requests.view_all", normalized) ||
    hasCompatiblePermission(granted, "maintenance_requests.triage", normalized)
  );
}

export function isNavigationItemVisible(
  item: NavigationItem,
  roleName: string | null | undefined,
  permissions: readonly string[] = [],
  enabledFeatures?: readonly string[] | null
): boolean {
  const normalized = normalizeNavigationRole(roleName);

  if (!normalized) {
    return item.id === "notifications" || item.id === "settings";
  }

  if (!item.allowedRoles.includes(normalized)) {
    // Requests are granted by permission, not by department role. An authorized
    // Finance, Farm, or other employee must see the entry the API will allow.
    if (!PERMISSION_GRANTED_NAV_IDS.has(item.id)) {
      return false;
    }
  }

  if (item.requiredFeature && enabledFeatures != null && enabledFeatures.length > 0) {
    if (!enabledFeatures.includes(item.requiredFeature)) {
      return false;
    }
  }

  const apiGate = NAV_ITEM_API_GATES[item.id];
  if (apiGate && !navApiGateAllows(apiGate, normalized, permissions)) {
    return false;
  }

  if (item.requiredPermissions?.length) {
    const granted = new Set(permissions.map((p) => p.trim()));
    // Same alias rule as the API guard, so a MANAGER with work_orders.manage sees Approvals.
    const hasPermission = item.requiredPermissions.some((permission) =>
      hasCompatiblePermission(granted, permission, normalized)
    );
    if (!hasPermission && !FULL_NAVIGATION_ROLES.has(normalized)) {
      return false;
    }
  }

  return true;
}

export function getDefaultFavoriteNavIds(roleName: string | null | undefined): string[] {
  const normalized = normalizeNavigationRole(roleName);
  if (!normalized) {
    return ["notifications"];
  }

  const configured = ROLE_DEFAULT_FAVORITE_NAV_IDS[normalized];
  if (configured?.length) {
    return [...configured];
  }

  const pinned = NAVIGATION_ITEMS.filter((item) =>
    item.pinByDefaultForRoles?.includes(normalized)
  ).map((item) => item.id);

  return pinned.length > 0 ? pinned : ["notifications"];
}

export function getVisibleNavigationItems(
  roleName: string | null | undefined,
  options?: {
    fullNavigation?: boolean;
    permissions?: readonly string[];
    enabledFeatures?: readonly string[];
  }
): NavigationItem[] {
  const normalized = normalizeNavigationRole(roleName);
  const permissions = options?.permissions ?? [];
  const enabledFeatures = options?.enabledFeatures;

  const filtered = NAVIGATION_ITEMS.filter((item) => {
    const baseHref = item.href.split("?")[0];
    if (!EXISTING_NAV_ROUTES.has(baseHref)) {
      return false;
    }
    return isNavigationItemVisible(item, roleName, permissions, enabledFeatures);
  });
  const visible = collapseRequestEntries(filtered, roleName, permissions);

  if (visible.length > 0) {
    return visible;
  }

  const fallback = NAVIGATION_ITEMS.find((item) => item.id === "notifications");
  return fallback ? [fallback] : [];
}

/**
 * One Requests entry per person. The Requests page already has All / My / Triage tabs for
 * people who can see every request, and shows only your own requests otherwise, so a
 * separate "My requests" entry would open the same list. People who only see their own
 * requests get the entry labelled "My requests".
 */
function collapseRequestEntries(
  items: NavigationItem[],
  roleName: string | null | undefined,
  permissions: readonly string[]
): NavigationItem[] {
  const hasRequests = items.some((item) => item.id === "requests");
  if (!hasRequests) return items;
  const ownOnly = !canViewAllRequests(roleName, permissions);
  return items
    .filter((item) => item.id !== "my-requests")
    .map((item) =>
      item.id === "requests" && ownOnly
        ? { ...item, label: "My Requests", description: "Report a problem and follow your requests" }
        : item
    );
}

export function getNavigationGroups(
  roleName: string | null | undefined,
  options?: {
    fullNavigation?: boolean;
    permissions?: readonly string[];
    enabledFeatures?: readonly string[];
  }
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

  // FG Digital Records was removed from MaintainPro; deny all roles including admins.
  if (normalizedPath === "/fg" || normalizedPath.startsWith("/fg/")) {
    return false;
  }

  const isRetired = RETIRED_PATH_PREFIXES.some(
    (prefix) => normalizedPath === prefix || normalizedPath.startsWith(`${prefix}/`)
  );
  if (isRetired) {
    // Soft retire: only technical admins retain browser access for migration/ops.
    return FULL_NAVIGATION_ROLES.has(normalized ?? "");
  }

  const adminPageGate = ADMIN_PAGE_API_GATES[normalizedPath];
  if (adminPageGate && !navApiGateAllows(adminPageGate, normalized, permissions)) {
    return false;
  }

  if (normalizedPath === "/system-health" || normalizedPath.startsWith("/system-health/")) {
    return normalized === "SUPER_ADMIN";
  }

  if (
    normalizedPath === "/action-center" ||
    normalizedPath === "/dashboard" ||
    normalizedPath === "/workspace"
  ) {
    return true;
  }

  const visible = getVisibleNavigationItems(roleName, { permissions });

  if (visible.some((item) => isNavItemActive(normalizedPath, item))) {
    return true;
  }

  const aliases = ROUTE_ACCESS_ALIASES[normalizedPath];
  if (aliases?.some((alias) => visible.some((item) => isNavItemActive(alias, item)))) {
    return true;
  }

  if (normalizedPath === "/work-orders/my" || normalizedPath.startsWith("/work-orders/my/")) {
    return visible.some((item) => item.id === "my-jobs");
  }

  if (normalizedPath.startsWith("/work-orders")) {
    return visible.some((item) => item.id === "work-orders" || item.id === "all-jobs" || item.id === "my-jobs");
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
    return visible.some((item) => {
      const href = item.href.split("?")[0];
      return normalizedPath === href || normalizedPath.startsWith(`${href}/`);
    });
  }

  return FULL_NAVIGATION_ROLES.has(normalized ?? "");
}

export type MobileBottomNavItem = {
  id: string;
  label: string;
  href: string;
  icon: string;
  action?: "search";
  /** "exact" keeps a home tab such as /maintenance from lighting up on /maintenance/jobs. */
  activeMatch?: NavActiveMatch;
};

/** Short bottom-tab names for the nav item that is a role's login home. */
const MOBILE_HOME_TAB_LABELS: Record<string, string> = {
  "my-jobs": "My Jobs",
  "spare-parts": "Parts",
  "maintenance-dashboard": "Dashboard",
  "all-jobs": "Jobs",
  fleet: "Vehicles",
  assets: "Assets",
  reports: "Reports",
  admin: "Admin",
  requests: "Requests",
  notifications: "Alerts"
};

const JOB_NAV_IDS = new Set(["work-orders", "all-jobs", "my-jobs"]);

function mobileHomeTab(
  roleName: string | null | undefined,
  visible: readonly NavigationItem[]
): MobileBottomNavItem | null {
  const landing = getPostLoginRedirect(roleName ?? null).split("?")[0];
  const item = visible.find((entry) => entry.href.split("?")[0] === landing);
  if (!item) return null;
  return {
    id: item.id,
    label: MOBILE_HOME_TAB_LABELS[item.id] ?? item.label,
    href: item.href,
    icon: item.icon,
    activeMatch: item.activeMatch
  };
}

export function getMobileBottomNavItems(
  roleName: string | null | undefined,
  options?: { permissions?: readonly string[] }
): MobileBottomNavItem[] {
  const visible = getVisibleNavigationItems(roleName, { permissions: options?.permissions });
  const hasWorkOrders = visible.some((item) => JOB_NAV_IDS.has(item.id));
  const hasRequests = visible.some((item) => item.id === "requests");
  const hasAssets = visible.some((item) => item.id === "assets");
  const hasFleet = visible.some((item) => item.id === "fleet");
  const hasParts = visible.some((item) => item.id === "spare-parts");
  const hasReports = visible.some((item) => item.id === "reports");
  const hasAdmin = visible.some((item) => item.id === "admin");
  const hasSettings = visible.some((item) => item.id === "settings");
  const notifications = visible.find((item) => item.id === "notifications");
  const requestsHref = visible.find((item) => item.id === "requests")?.href ?? "/requests";
  const jobsHref =
    visible.find((item) => item.id === "all-jobs")?.href ??
    visible.find((item) => item.id === "my-jobs")?.href ??
    "/maintenance/jobs";

  const items: MobileBottomNavItem[] = [];

  // First tab is the page this role lands on after login (My Jobs, Inventory, Requests, ...).
  const home = mobileHomeTab(roleName, visible);
  if (home) {
    items.push(home);
    // Keep a jobs tab for roles whose home is not a job list (managers, stores).
    if (hasWorkOrders && !JOB_NAV_IDS.has(home.id)) {
      items.push({ id: "work-orders", label: "Jobs", href: jobsHref, icon: "ClipboardList" });
    }
  } else if (hasRequests && !hasWorkOrders) {
    items.push({ id: "requests", label: "Requests", href: requestsHref, icon: "AlertTriangle" });
  } else if (hasWorkOrders) {
    items.push({ id: "work-orders", label: "Jobs", href: jobsHref, icon: "ClipboardList" });
  } else if (hasAssets) {
    items.push({ id: "assets", label: "Assets", href: "/assets", icon: "Boxes" });
  } else if (hasFleet) {
    items.push({ id: "fleet", label: "Vehicles", href: "/fleet", icon: "Truck" });
  } else if (hasParts) {
    items.push({ id: "spare-parts", label: "Parts", href: "/inventory", icon: "Layers" });
  } else if (hasReports) {
    items.push({ id: "reports", label: "Reports", href: "/reports", icon: "BarChart3" });
  } else if (hasAdmin) {
    items.push({ id: "admin", label: "Admin", href: "/admin", icon: "ShieldCheck" });
  } else if (notifications) {
    items.push({ id: "notifications", label: "Alerts", href: notifications.href, icon: "Bell" });
  }

  items.push({ id: "search", label: "Search", href: "#", icon: "Search", action: "search" });
  items.push({
    id: "profile",
    label: "Profile",
    href: hasSettings ? "/settings" : notifications?.href ?? "/notifications",
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

  // Report issue has its own entry; keep Requests from lighting up beside it.
  if (itemPath === "/requests" && pathname === "/requests/new") {
    return false;
  }

  return pathname === itemPath || pathname.startsWith(`${itemPath}/`);
}

/**
 * True only when legacy `/home` appears as a primary destination.
 * Action Center is retired and must not be reintroduced as Home.
 */
export function hasPrimaryHomeNavItem(items: readonly NavigationItem[]): boolean {
  return items.some(
    (item) =>
      item.href === LEGACY_FMS_HOME_PATH ||
      (item.label === "Home" && item.href === LEGACY_FMS_HOME_PATH)
  );
}

/**
 * Permission-led landings tried after the role's own preferences, so custom roles (role names
 * are free text) still land on a dashboard they can open instead of the notifications list.
 */
const PERMISSION_LANDING_CANDIDATES = [
  "/maintenance",
  "/work-orders/my",
  "/maintenance/jobs",
  "/inventory",
  "/fleet",
  "/assets",
  "/requests",
  "/reports"
] as const;

/**
 * The dashboard this person opens after signing in: the first landing for their role that their
 * role and permissions can actually open, then a permission-based dashboard, then notifications.
 */
export function roleLandingPath(user: PostLoginUserLike, permissions: readonly string[] = []): string {
  const role = extractRoleName(user);
  const preferred = role ? ROLE_POST_LOGIN_PREFERENCES[role] ?? [] : [];
  const roleLanding = getPostLoginRedirect(user);
  const candidates = [...preferred, roleLanding, ...PERMISSION_LANDING_CANDIDATES];
  for (const path of candidates) {
    if (!EXISTING_POST_LOGIN_ROUTES.has(path) || isRetiredActionCenterPath(path) || isRetiredSplashPath(path)) continue;
    if (path === DEFAULT_POST_LOGIN_REDIRECT) continue;
    if (canAccessNavigationPath(path, role, permissions)) return path;
  }
  return DEFAULT_POST_LOGIN_REDIRECT;
}

/**
 * A link to one specific record (a request, a job, a vehicle...) that brought the person to the
 * sign-in page. Only these are honoured after sign-in; anything else goes to the role dashboard.
 */
export function isRecordDeepLink(target: string): boolean {
  const [pathname, query = ""] = target.split("#")[0].split("?");
  const params = new URLSearchParams(query);
  if (params.get("wo") || params.get("open")) return true;
  return /^\/(requests|vehicles|assets|utilities\/meters)\/(?!new$|mine$)[A-Za-z0-9_-]{6,}$/.test(pathname);
}

/**
 * Where to go after sign-in: always the role dashboard, except a link to a specific record that
 * this role can open (for example a job link from a notification email).
 */
export function resolveAuthorizedDestination(
  user: PostLoginUserLike,
  returnTo: string | null | undefined,
  permissions: readonly string[] = []
): string {
  const landing = roleLandingPath(user, permissions);
  const safe = safeInternalReturnPath(returnTo);
  if (!safe || !isRecordDeepLink(safe)) return landing;
  const path = safe.split("?")[0]?.split("#")[0] ?? "";
  if (!canAccessNavigationPath(path, extractRoleName(user), permissions)) {
    return landing;
  }
  return safe;
}
