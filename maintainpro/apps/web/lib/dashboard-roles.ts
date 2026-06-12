import { extractRoleName } from "./role-redirect";

export type DashboardVariant =
  | "admin"
  | "management"
  | "technician"
  | "cleaner"
  | "inventory"
  | "driver"
  | "viewer"
  | "minimal";

const ADMIN_ROLES = new Set(["SUPER_ADMIN", "ADMIN"]);

const MANAGEMENT_ROLES = new Set([
  "MANAGER",
  "OPERATIONS_MANAGER",
  "SUPERVISOR",
  "MAINTENANCE_SUPERVISOR",
  "FLEET_MANAGER",
  "COMPLIANCE_MANAGER",
  "ASSET_MANAGER",
  "SECURITY_OFFICER",
  "FACILITY_MANAGER",
  "BUILDING_SUPERVISOR",
  "PROCUREMENT_OFFICER",
  "FINANCE_APPROVER"
]);

const TECHNICIAN_ROLES = new Set(["TECHNICIAN", "MECHANIC"]);
const CLEANER_ROLES = new Set(["CLEANER"]);
const INVENTORY_ROLES = new Set(["INVENTORY_KEEPER", "STOREKEEPER"]);
const DRIVER_ROLES = new Set(["DRIVER"]);
const VIEWER_ROLES = new Set(["VIEWER", "AUDITOR"]);

const FARM_ROLES = new Set([
  "FARM_OWNER",
  "FARM_MANAGER",
  "FIELD_SUPERVISOR",
  "AGRONOMIST",
  "VETERINARIAN",
  "FARM_WORKER",
  "IRRIGATION_OPERATOR",
  "HARVEST_CREW"
]);

export function normalizeDashboardRole(roleName: string | null | undefined): string | null {
  return extractRoleName(roleName);
}

export function resolveDashboardVariant(roleName: string | null | undefined): DashboardVariant {
  const role = normalizeDashboardRole(roleName);

  if (!role) {
    return "minimal";
  }

  if (ADMIN_ROLES.has(role)) {
    return "admin";
  }

  if (VIEWER_ROLES.has(role)) {
    return "viewer";
  }

  if (TECHNICIAN_ROLES.has(role)) {
    return "technician";
  }

  if (CLEANER_ROLES.has(role)) {
    return "cleaner";
  }

  if (INVENTORY_ROLES.has(role)) {
    return "inventory";
  }

  if (DRIVER_ROLES.has(role)) {
    return "driver";
  }

  if (MANAGEMENT_ROLES.has(role) || FARM_ROLES.has(role)) {
    return "management";
  }

  return "minimal";
}

export function dashboardShowsAdminSections(variant: DashboardVariant): boolean {
  return variant === "admin";
}

export function dashboardShowsSystemHealthSummary(variant: DashboardVariant): boolean {
  return variant === "admin";
}

export function dashboardShowsDriverIntelligence(variant: DashboardVariant): boolean {
  return variant === "admin";
}

export function dashboardShowsWorkOrdersSummary(variant: DashboardVariant): boolean {
  return variant === "admin" || variant === "management" || variant === "technician";
}

export function dashboardShowsInventorySummary(variant: DashboardVariant): boolean {
  return variant === "admin" || variant === "inventory";
}

export function dashboardShowsReportsSummary(variant: DashboardVariant): boolean {
  return variant === "admin" || variant === "management" || variant === "viewer";
}

export function dashboardIsReadOnly(variant: DashboardVariant): boolean {
  return variant === "viewer" || variant === "minimal";
}

export function getDashboardTitle(variant: DashboardVariant): string {
  switch (variant) {
    case "admin":
      return "Operations Dashboard";
    case "management":
      return "Operations Dashboard";
    case "technician":
      return "My Work Dashboard";
    case "cleaner":
      return "Cleaning Dashboard";
    case "inventory":
      return "Inventory Dashboard";
    case "driver":
      return "Driver Dashboard";
    case "viewer":
      return "Reports Overview";
    case "minimal":
    default:
      return "Dashboard";
  }
}

export function getDashboardDescription(variant: DashboardVariant): string {
  switch (variant) {
    case "admin":
      return "Live fleet intelligence, work order pressure, inventory signals, and system health in one view.";
    case "management":
      return "Operational work order status, report summaries, and quick links to your modules.";
    case "technician":
      return "Assigned work orders, overdue priorities, and quick access to your jobs.";
    case "cleaner":
      return "Quick access to cleaning tasks, issues, and visit workflows.";
    case "inventory":
      return "Stock levels, low-stock alerts, and procurement activity from live inventory data.";
    case "driver":
      return "Quick access to vehicles, fleet, and trip-related modules.";
    case "viewer":
      return "Read-only report summaries and operational visibility without mutation actions.";
    case "minimal":
    default:
      return "Welcome to MaintainPro. Use the links below to open modules available to your account.";
  }
}

export type WorkOrderDashboardStats = {
  total: number;
  open: number;
  inProgress: number;
  overdue: number;
  completed: number;
  assigned?: number;
};

type WorkOrderLike = {
  status: string;
  slaBreached?: boolean;
  technicianId?: string | null;
};

export function computeWorkOrderDashboardStats(
  orders: WorkOrderLike[],
  options?: { assignedUserId?: string | null }
): WorkOrderDashboardStats {
  const scoped =
    options?.assignedUserId != null
      ? orders.filter((order) => order.technicianId === options.assignedUserId)
      : orders;

  return {
    total: scoped.length,
    open: scoped.filter((row) => row.status === "OPEN").length,
    inProgress: scoped.filter((row) => row.status === "IN_PROGRESS").length,
    overdue: scoped.filter((row) => row.status === "OVERDUE" || row.slaBreached).length,
    completed: scoped.filter((row) => row.status === "COMPLETED").length,
    assigned: options?.assignedUserId ? scoped.length : undefined
  };
}

export function selectPriorityWorkOrders<T extends WorkOrderLike & { dueDate?: string | null; priority?: string; title?: string; woNumber?: string }>(
  orders: T[],
  limit = 5
): T[] {
  const priorityWeight: Record<string, number> = {
    CRITICAL: 4,
    HIGH: 3,
    MEDIUM: 2,
    LOW: 1
  };

  return [...orders]
    .filter((order) => order.status !== "COMPLETED" && order.status !== "CANCELLED")
    .sort((a, b) => {
      const overdueDelta = Number(Boolean(b.status === "OVERDUE" || b.slaBreached)) - Number(Boolean(a.status === "OVERDUE" || a.slaBreached));
      if (overdueDelta !== 0) {
        return overdueDelta;
      }

      const priorityDelta =
        (priorityWeight[b.priority ?? "LOW"] ?? 0) - (priorityWeight[a.priority ?? "LOW"] ?? 0);
      if (priorityDelta !== 0) {
        return priorityDelta;
      }

      const aDue = a.dueDate ? new Date(a.dueDate).getTime() : Number.MAX_SAFE_INTEGER;
      const bDue = b.dueDate ? new Date(b.dueDate).getTime() : Number.MAX_SAFE_INTEGER;
      return aDue - bDue;
    })
    .slice(0, limit);
}
