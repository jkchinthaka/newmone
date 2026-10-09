import { historyRecordHref } from "./maintenance-history";

export const REPORT_EMPTY = "No report data matches the selected filters.";

export const OPERATIONS_COMPLETION_RATE_DEFINITION =
  "Completion rate is COMPLETED jobs divided by all jobs created in the selected date range. CLOSED and CANCELLED stay in the denominator and are not counted as completed.";

export const REPORT_WORKSPACE_MODULES = [
  { slug: "operations", label: "Work orders" },
  { slug: "assets", label: "Assets and fleet" },
  { slug: "performance", label: "Performance" },
  { slug: "financials", label: "Financial" }
] as const;

export type WorkspaceModule = (typeof REPORT_WORKSPACE_MODULES)[number]["slug"];

const FINANCIAL_REPORT_ROLES = new Set([
  "SUPER_ADMIN",
  "ADMIN",
  "MANAGER",
  "FINANCE",
  "OPERATIONS_MANAGER",
  "PROCUREMENT_OFFICER",
  "ASSET_MANAGER"
]);

export function visibleWorkspaceModules(role: string | null, permissions: readonly string[] = []) {
  const canSeeFinancials =
    role === "SUPER_ADMIN" ||
    permissions.includes("reports.financials.view") ||
    (role != null && FINANCIAL_REPORT_ROLES.has(role));
  return REPORT_WORKSPACE_MODULES.filter((item) => item.slug !== "financials" || canSeeFinancials);
}

export function workspaceModuleFromSearch(value: string | null): WorkspaceModule {
  return REPORT_WORKSPACE_MODULES.some((item) => item.slug === value) ? (value as WorkspaceModule) : "operations";
}

export function reportRowHref(row: Record<string, string | number | null>): string | null {
  const id = row.workOrderId;
  if (typeof id === "string" && id.trim()) return historyRecordHref(id);
  return null;
}
