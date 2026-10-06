import type { ReportFilters } from "./types";

/**
 * Deep-link targets for report cards (?focus=<key>). The query parameter decides what the
 * report shows: which summary card is highlighted and how the detail table is sorted.
 * Keep keys in sync with the API summary card `key` values.
 */
export const REPORT_FOCUS_TARGETS: Record<
  string,
  { module: string; cardKey: string; sortBy?: string; sortDirection?: "asc" | "desc" }
> = {
  "pm-compliance": { module: "performance", cardKey: "pm-compliance" },
  downtime: { module: "assets", cardKey: "downtime", sortBy: "downtimeHours", sortDirection: "desc" }
};

export function resolveReportFocus(module: string, focus: string | null | undefined) {
  if (!focus) return null;
  const target = REPORT_FOCUS_TARGETS[focus];
  return target && target.module === module ? target : null;
}

/**
 * Apply the URL (search + focus) to report filters. Pure so back/forward navigation can
 * re-derive the view from the URL every time it changes.
 */
export function applyReportUrlState(
  base: ReportFilters,
  module: string,
  params: { get(name: string): string | null }
): ReportFilters {
  const next: ReportFilters = { ...base, search: params.get("search") ?? "" };
  const focus = resolveReportFocus(module, params.get("focus"));
  if (focus?.sortBy) {
    next.sortBy = focus.sortBy;
    next.sortDirection = focus.sortDirection ?? "desc";
    next.page = 1;
  }
  return next;
}
