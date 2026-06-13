import { LEGACY_FMS_HOME_PATH } from "./role-redirect";

export type BreadcrumbItem = {
  label: string;
  href?: string;
};

export const LEGACY_FMS_BREADCRUMB_LABEL = "Legacy FMS Archive";

const REPORT_MODULE_LABELS: Record<string, string> = {
  operations: "Operations",
  financials: "Financials",
  "user-activity": "User Activity",
  assets: "Assets & Equipment",
  inventory: "Inventory & Parts",
  performance: "Performance KPIs",
  "system-logs": "System Logs",
  "driver-intelligence": "Driver Intelligence",
  "fuel-analytics": "Fuel Analytics",
  "vehicle-cost-analytics": "Vehicle Cost Analytics"
};

const STATIC_ROUTE_CRUMBS: Record<string, BreadcrumbItem[]> = {
  "/work-orders": [{ label: "Work Orders" }],
  "/assets": [{ label: "Assets" }],
  "/inventory": [{ label: "Inventory" }],
  "/procurement": [{ label: "Procurement" }],
  "/fleet": [{ label: "Fleet" }],
  "/vehicles": [{ label: "Vehicles" }],
  "/reports": [{ label: "Reports" }],
  "/system-health": [{ label: "System Health" }],
  "/admin": [{ label: "Admin Console" }],
  "/admin/users": [
    { label: "Admin Console", href: "/admin" },
    { label: "Users & Access" }
  ],
  "/admin/tenants": [
    { label: "Admin Console", href: "/admin" },
    { label: "Tenants" }
  ],
  "/admin/roles": [
    { label: "Admin Console", href: "/admin" },
    { label: "Roles & Permissions" }
  ],
  "/admin/invitations": [
    { label: "Admin Console", href: "/admin" },
    { label: "Invitations & Onboarding" }
  ],
  "/dashboard": [{ label: "Dashboard" }],
  "/action-center": [{ label: "Action Center" }],
  [LEGACY_FMS_HOME_PATH]: [{ label: LEGACY_FMS_BREADCRUMB_LABEL }]
};

type RoutePattern = {
  pattern: RegExp;
  build: (match: RegExpMatchArray) => BreadcrumbItem[];
};

const DYNAMIC_ROUTE_PATTERNS: RoutePattern[] = [
  {
    pattern: /^\/vehicles\/([^/]+)\/documents\/?$/,
    build: ([, id]) => [
      { label: "Vehicles", href: "/vehicles" },
      { label: "Vehicle Details", href: `/vehicles/${id}` },
      { label: "Documents" }
    ]
  },
  {
    pattern: /^\/vehicles\/([^/]+)\/?$/,
    build: ([, id]) => [
      { label: "Vehicles", href: "/vehicles" },
      { label: "Vehicle Details", href: `/vehicles/${id}` }
    ]
  },
  {
    pattern: /^\/reports\/([^/]+)\/?$/,
    build: ([, moduleSlug]) => [
      { label: "Reports", href: "/reports" },
      { label: formatReportModuleLabel(moduleSlug) }
    ]
  }
];

export function truncateBreadcrumbLabel(label: string, maxLength = 48): string {
  const trimmed = label.trim();
  if (trimmed.length <= maxLength) {
    return trimmed;
  }

  return `${trimmed.slice(0, maxLength - 1)}…`;
}

export function formatReportModuleLabel(slug: string): string {
  return REPORT_MODULE_LABELS[slug] ?? humanizeSegment(slug);
}

function humanizeSegment(value: string): string {
  return value
    .split("-")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function normalizePathname(pathname: string): string {
  const withoutQuery = pathname.split("?")[0]?.split("#")[0] ?? pathname;
  if (withoutQuery.length <= 1) {
    return withoutQuery;
  }

  return withoutQuery.endsWith("/") ? withoutQuery.slice(0, -1) : withoutQuery;
}

export function getBreadcrumbsForPath(pathname: string): BreadcrumbItem[] {
  const normalized = normalizePathname(pathname);

  for (const route of DYNAMIC_ROUTE_PATTERNS) {
    const match = normalized.match(route.pattern);
    if (match) {
      return finalizeItems(route.build(match));
    }
  }

  const staticItems = STATIC_ROUTE_CRUMBS[normalized];
  if (staticItems) {
    return finalizeItems(staticItems);
  }

  return [];
}

function finalizeItems(items: BreadcrumbItem[]): BreadcrumbItem[] {
  if (items.length === 0) {
    return items;
  }

  return items.map((item, index) => {
    const label = truncateBreadcrumbLabel(item.label);
    const isLast = index === items.length - 1;

    if (isLast) {
      return { label };
    }

    return {
      label,
      href: item.href
    };
  });
}

export function isPrimaryDashboardBreadcrumb(pathname: string): boolean {
  return normalizePathname(pathname) === "/dashboard";
}

export function usesLegacyHomeAsDashboard(items: BreadcrumbItem[]): boolean {
  return items.some(
    (item) =>
      item.label.toLowerCase() === "home" ||
      (item.href === LEGACY_FMS_HOME_PATH && item.label !== LEGACY_FMS_BREADCRUMB_LABEL)
  );
}

export function resolveBreadcrumbItems(
  pathname: string,
  overrides?: BreadcrumbItem[]
): BreadcrumbItem[] {
  if (overrides && overrides.length > 0) {
    return finalizeItems(overrides);
  }

  return getBreadcrumbsForPath(pathname);
}
