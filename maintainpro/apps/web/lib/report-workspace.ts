import { historyRecordHref } from "./maintenance-history";

export const REPORT_EMPTY = "No report data matches the selected filters.";

export const REPORT_PAGE_TITLE = "Reports";

export const REPORT_PAGE_DESCRIPTION = "View and export verified operational records.";

export const REPORT_PIN_LIMIT = 4;

/** Stable ids. Display labels are not stored. */
export const RETAINED_REPORTS = [
  { slug: "operations", label: "Operations", description: "Job records for the selected dates." },
  { slug: "user-activity", label: "User Activity", description: "User accounts and the audit actions they performed." },
  { slug: "assets", label: "Assets & Equipment", description: "Asset and equipment maintenance records." },
  { slug: "inventory", label: "Inventory & Parts", description: "Parts and stock movement records." },
  { slug: "system-logs", label: "System Logs", description: "Audit log records, including security-related changes." }
] as const;

export type RetainedReportSlug = (typeof RETAINED_REPORTS)[number]["slug"];

export const REMOVED_REPORT_SLUGS = [
  "financials",
  "performance",
  "driver-intelligence",
  "fuel-analytics",
  "vehicle-cost-analytics"
] as const;

const ROLE_FALLBACK: Record<string, readonly RetainedReportSlug[]> = {
  SUPER_ADMIN: ["operations", "user-activity", "assets", "inventory", "system-logs"],
  ADMIN: ["operations", "user-activity", "assets", "inventory", "system-logs"],
  MANAGER: ["operations", "user-activity", "assets", "inventory"],
  OPERATIONS_MANAGER: ["operations", "assets", "inventory"],
  ASSET_MANAGER: ["operations", "assets", "inventory", "system-logs"],
  SUPERVISOR: ["operations", "assets", "inventory"],
  FINANCE: ["operations", "inventory"],
  FINANCE_APPROVER: ["operations", "inventory"],
  PROCUREMENT_OFFICER: ["inventory", "operations"],
  INVENTORY_KEEPER: ["inventory", "operations"],
  STOREKEEPER: ["inventory", "operations"],
  VIEWER: ["operations", "assets", "inventory"],
  AUDITOR: ["operations", "assets", "inventory"],
  TECHNICIAN: ["operations"],
  MECHANIC: ["operations"],
  FLEET_MANAGER: ["operations", "assets"]
};

export function isRetainedReportSlug(value: string | null | undefined): value is RetainedReportSlug {
  return RETAINED_REPORTS.some((item) => item.slug === value);
}

/**
 * Mirrors the API report-access rules for the five retained modules.
 * Removed modules are never visible in the product UI.
 */
export function canViewRetainedReport(
  role: string | null | undefined,
  permissions: readonly string[] = [],
  slug: string
): boolean {
  if (!isRetainedReportSlug(slug)) return false;
  const normalized = role?.trim().toUpperCase() ?? "";
  if (normalized === "SUPER_ADMIN") return true;
  const granted = new Set(permissions);

  if (slug === "system-logs") {
    return (
      granted.has("reports.system_logs.view") ||
      granted.has("audit.view") ||
      normalized === "ADMIN" ||
      normalized === "ASSET_MANAGER"
    );
  }

  const permissionKey: Record<Exclude<RetainedReportSlug, "system-logs">, string> = {
    operations: "reports.operations.view",
    "user-activity": "reports.user_activity.view",
    assets: "reports.assets.view",
    inventory: "reports.inventory.view"
  };
  if (granted.has(permissionKey[slug])) return true;
  if (granted.has("reports.view")) return true;
  return Boolean(ROLE_FALLBACK[normalized]?.includes(slug));
}

export function visibleReportModules(role: string | null | undefined, permissions: readonly string[] = []) {
  return RETAINED_REPORTS.filter((item) => canViewRetainedReport(role, permissions, item.slug));
}

export function reportModuleFromSearch(
  value: string | null | undefined,
  role: string | null | undefined,
  permissions: readonly string[] = []
): RetainedReportSlug {
  const visible = visibleReportModules(role, permissions);
  if (value && visible.some((item) => item.slug === value)) return value as RetainedReportSlug;
  return visible[0]?.slug ?? "operations";
}

export function reportModuleHref(
  slug: RetainedReportSlug,
  focus?: { search?: string; status?: string; category?: string; from?: string; to?: string }
): string {
  const params = new URLSearchParams({ module: slug });
  if (focus?.search) params.set("search", focus.search);
  if (focus?.status) params.set("status", focus.status);
  if (focus?.category) params.set("category", focus.category);
  if (focus?.from) params.set("from", focus.from);
  if (focus?.to) params.set("to", focus.to);
  return `/reports?${params.toString()}`;
}

export function reportRowHref(row: Record<string, string | number | null>): string | null {
  const id = row.workOrderId;
  if (typeof id === "string" && id.trim()) return historyRecordHref(id);
  return null;
}

export type ReportPinResult =
  | { ok: true; pins: RetainedReportSlug[] }
  | { ok: false; reason: "limit" | "unavailable"; pins: RetainedReportSlug[] };

export function reportPinStorageKey(userId: string | null | undefined, tenantId: string | null | undefined): string {
  const user = userId?.trim() || "anonymous";
  const tenant = tenantId?.trim() || "none";
  return `maintainpro_report_pins:${tenant}:${user}`;
}

export function parseReportPins(raw: string | null): RetainedReportSlug[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    const pins: RetainedReportSlug[] = [];
    for (const entry of parsed) {
      if (typeof entry === "string" && isRetainedReportSlug(entry) && !pins.includes(entry)) {
        pins.push(entry);
      }
      if (pins.length >= REPORT_PIN_LIMIT) break;
    }
    return pins;
  } catch {
    return [];
  }
}

export function readReportPins(
  userId: string | null | undefined,
  tenantId: string | null | undefined,
  storage?: Storage | null
): RetainedReportSlug[] {
  if (!storage) return [];
  return parseReportPins(storage.getItem(reportPinStorageKey(userId, tenantId)));
}

export function visiblePinnedReports(
  pins: readonly string[],
  role: string | null | undefined,
  permissions: readonly string[] = []
): RetainedReportSlug[] {
  return pins.filter((slug): slug is RetainedReportSlug => canViewRetainedReport(role, permissions, slug)).slice(0, REPORT_PIN_LIMIT);
}

export function pinReport(
  pins: readonly RetainedReportSlug[],
  slug: string,
  role: string | null | undefined,
  permissions: readonly string[] = []
): ReportPinResult {
  const current = visiblePinnedReports(pins, role, permissions);
  if (!canViewRetainedReport(role, permissions, slug)) {
    return { ok: false, reason: "unavailable", pins: current };
  }
  if (current.includes(slug as RetainedReportSlug)) return { ok: true, pins: current };
  if (current.length >= REPORT_PIN_LIMIT) return { ok: false, reason: "limit", pins: current };
  return { ok: true, pins: [...current, slug as RetainedReportSlug] };
}

export function unpinReport(pins: readonly RetainedReportSlug[], slug: string): RetainedReportSlug[] {
  return pins.filter((item) => item !== slug);
}

export function writeReportPins(
  userId: string | null | undefined,
  tenantId: string | null | undefined,
  pins: readonly RetainedReportSlug[],
  storage?: Storage | null
): void {
  storage?.setItem(reportPinStorageKey(userId, tenantId), JSON.stringify(pins.slice(0, REPORT_PIN_LIMIT)));
}
