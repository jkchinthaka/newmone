import { workOrderRecordHref } from "./operational-deep-link";

export const MAINTENANCE_HISTORY_EMPTY = "No maintenance history matches these filters.";

export type HistoryListState = {
  q: string;
  scope: "" | "asset" | "vehicle";
  status: "" | "COMPLETED" | "CLOSED" | "CANCELLED";
  from: string;
  to: string;
  category: string;
  technician: string;
  vendor: string;
  priority: string;
  costMin: string;
  costMax: string;
  type: string;
  location: string;
  page: number;
  pageSize: 25 | 50 | 100;
};

const PAGE_SIZES = new Set([25, 50, 100]);

export function historyStateFromSearch(params: URLSearchParams): HistoryListState {
  const page = Number(params.get("page"));
  const pageSize = Number(params.get("pageSize"));
  const status = params.get("status") ?? "";
  const scope = params.get("scope") ?? "";
  return {
    q: params.get("q") ?? "",
    scope: scope === "asset" || scope === "vehicle" ? scope : "",
    status: status === "COMPLETED" || status === "CLOSED" || status === "CANCELLED" ? status : "",
    from: params.get("from") ?? "",
    to: params.get("to") ?? "",
    category: params.get("category") ?? "",
    technician: params.get("technician") ?? "",
    vendor: params.get("vendor") ?? "",
    priority: params.get("priority") ?? "",
    costMin: params.get("costMin") ?? "",
    costMax: params.get("costMax") ?? "",
    type: params.get("type") ?? "",
    location: params.get("location") ?? "",
    page: Number.isFinite(page) && page >= 1 ? Math.floor(page) : 1,
    pageSize: PAGE_SIZES.has(pageSize) ? (pageSize as 25 | 50 | 100) : 25
  };
}

export function historyListParams(state: HistoryListState): Record<string, string | number> {
  const params: Record<string, string | number> = {
    page: state.page,
    pageSize: state.pageSize
  };
  if (state.q.trim().length >= 2) params.q = state.q.trim();
  if (state.scope) params.scope = state.scope;
  if (state.status) params.status = state.status;
  if (state.from) params.from = state.from;
  if (state.to) params.to = state.to;
  if (state.category.trim()) params.category = state.category.trim();
  if (state.technician.trim()) params.technician = state.technician.trim();
  if (state.vendor.trim()) params.vendor = state.vendor.trim();
  if (state.priority) params.priority = state.priority;
  if (state.costMin) params.costMin = state.costMin;
  if (state.costMax) params.costMax = state.costMax;
  if (state.type) params.type = state.type;
  if (state.location.trim()) params.location = state.location.trim();
  return params;
}

export function historyRecordHref(id: string): string {
  return workOrderRecordHref(id, "history");
}

export function historyHasFilters(state: HistoryListState): boolean {
  return Boolean(
    state.q ||
      state.scope ||
      state.status ||
      state.from ||
      state.to ||
      state.category ||
      state.technician ||
      state.vendor ||
      state.priority ||
      state.costMin ||
      state.costMax ||
      state.type ||
      state.location
  );
}
