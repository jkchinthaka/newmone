import { ForbiddenException } from "@nestjs/common";
import { RoleName } from "@prisma/client";

import type { ReportModuleKey } from "./reports.service";

export const REPORT_MODULE_PERMISSION: Record<ReportModuleKey, string> = {
  operations: "reports.operations.view",
  financials: "reports.financials.view",
  "user-activity": "reports.user_activity.view",
  assets: "reports.assets.view",
  inventory: "reports.inventory.view",
  performance: "reports.performance.view",
  "system-logs": "reports.system_logs.view",
  "driver-intelligence": "reports.driver_intelligence.view",
  "fuel-analytics": "reports.fuel.view",
  "vehicle-cost-analytics": "reports.vehicle_cost.view"
};

export const REPORT_EXPORT_PERMISSION = "reports.export";
export const REPORT_MANAGEMENT_PERMISSION = "reports.management.view";
export const AUDIT_VIEW_PERMISSION = "audit.view";

/** Role fallback when JWT/DB permissions lack fine-grained report keys (backward compatible). */
const ROLE_MODULE_FALLBACK: Partial<Record<RoleName, ReportModuleKey[]>> = {
  SUPER_ADMIN: Object.keys(REPORT_MODULE_PERMISSION) as ReportModuleKey[],
  ADMIN: Object.keys(REPORT_MODULE_PERMISSION) as ReportModuleKey[],
  MANAGER: [
    "operations",
    "financials",
    "user-activity",
    "assets",
    "inventory",
    "performance",
    "driver-intelligence",
    "fuel-analytics",
    "vehicle-cost-analytics"
  ],
  OPERATIONS_MANAGER: [
    "operations",
    "assets",
    "inventory",
    "performance",
    "driver-intelligence",
    "fuel-analytics",
    "vehicle-cost-analytics"
  ],
  ASSET_MANAGER: [
    "operations",
    "assets",
    "inventory",
    "performance",
    "system-logs",
    "driver-intelligence",
    "fuel-analytics",
    "vehicle-cost-analytics"
  ],
  SUPERVISOR: ["operations", "assets", "inventory", "performance", "driver-intelligence"],
  FINANCE: ["financials", "inventory", "performance", "operations"],
  PROCUREMENT_OFFICER: ["inventory", "operations", "financials"],
  INVENTORY_KEEPER: ["inventory", "operations"],
  VIEWER: ["operations", "assets", "inventory", "performance"],
  TECHNICIAN: ["operations", "performance"],
  MECHANIC: ["operations", "performance"],
  DRIVER: ["driver-intelligence", "fuel-analytics"],
  FLEET_MANAGER: [
    "operations",
    "assets",
    "driver-intelligence",
    "fuel-analytics",
    "vehicle-cost-analytics",
    "performance"
  ]
};

export type ReportActorAccess = {
  role: RoleName | string;
  permissions?: string[] | null;
};

function permissionSet(actor: ReportActorAccess): Set<string> {
  return new Set((actor.permissions ?? []).filter(Boolean));
}

export function canViewReportModule(actor: ReportActorAccess, module: ReportModuleKey): boolean {
  if (actor.role === "SUPER_ADMIN") return true;
  const required = REPORT_MODULE_PERMISSION[module];
  const perms = permissionSet(actor);

  if (module === "system-logs") {
    return (
      perms.has(required) ||
      perms.has(AUDIT_VIEW_PERMISSION) ||
      ["ADMIN", "ASSET_MANAGER"].includes(String(actor.role))
    );
  }

  if (module === "financials") {
    if (["TECHNICIAN", "MECHANIC", "DRIVER", "CLEANER", "VIEWER", "INVENTORY_KEEPER"].includes(String(actor.role))) {
      return perms.has(required);
    }
  }

  if (perms.has(required)) return true;
  if (module === "financials") {
    if (
      perms.has("reports.view") &&
      ["ADMIN", "MANAGER", "FINANCE", "OPERATIONS_MANAGER", "PROCUREMENT_OFFICER", "ASSET_MANAGER"].includes(
        String(actor.role)
      )
    ) {
      return true;
    }
  } else if (perms.has("reports.view")) {
    return true;
  }

  const fallback = ROLE_MODULE_FALLBACK[actor.role as RoleName];
  return Boolean(fallback?.includes(module));
}

export function assertCanViewReportModule(actor: ReportActorAccess, module: ReportModuleKey) {
  if (!canViewReportModule(actor, module)) {
    throw new ForbiddenException(`Missing permission to view report module: ${module}`);
  }
}

export function assertCanExportReport(actor: ReportActorAccess, module: ReportModuleKey) {
  assertCanViewReportModule(actor, module);
  const perms = permissionSet(actor);
  const role = String(actor.role);
  const exportOk =
    actor.role === "SUPER_ADMIN" ||
    perms.has(REPORT_EXPORT_PERMISSION) ||
    (perms.has("reports.view") &&
      ["ADMIN", "MANAGER", "FINANCE", "OPERATIONS_MANAGER", "ASSET_MANAGER", "PROCUREMENT_OFFICER"].includes(role));
  if (!exportOk) {
    throw new ForbiddenException("Missing reports.export permission.");
  }
}

export type DashboardRoleVariant =
  | "admin"
  | "management"
  | "finance"
  | "procurement"
  | "asset_management"
  | "supervisor"
  | "technician"
  | "inventory"
  | "viewer"
  | "driver"
  | "cleaner"
  | "minimal";

export function resolveDashboardRoleVariant(role: string): DashboardRoleVariant {
  const normalized = role === "FINANCE_APPROVER" ? "FINANCE" : role;
  switch (normalized) {
    case "SUPER_ADMIN":
    case "ADMIN":
      return "admin";
    case "MANAGER":
    case "OPERATIONS_MANAGER":
    case "FLEET_MANAGER":
      return "management";
    case "FINANCE":
      return "finance";
    case "PROCUREMENT_OFFICER":
      return "procurement";
    case "ASSET_MANAGER":
      return "asset_management";
    case "SUPERVISOR":
      return "supervisor";
    case "TECHNICIAN":
    case "MECHANIC":
      return "technician";
    case "INVENTORY_KEEPER":
      return "inventory";
    case "VIEWER":
      return "viewer";
    case "DRIVER":
      return "driver";
    case "CLEANER":
      return "cleaner";
    default:
      return "minimal";
  }
}
