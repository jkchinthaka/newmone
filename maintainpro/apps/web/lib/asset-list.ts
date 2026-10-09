export const ASSET_EMPTY = "No assets match these filters.";

export const ASSET_CONDITIONS = ["EXCELLENT", "GOOD", "FAIR", "POOR", "CRITICAL"] as const;

export const ASSET_STATUSES = ["ACTIVE", "INACTIVE", "UNDER_MAINTENANCE", "RETIRED", "DISPOSED"] as const;
export const ASSET_CATEGORIES = ["MACHINE", "EQUIPMENT", "VEHICLE", "INFRASTRUCTURE", "OTHER"] as const;
export const ASSET_SORT_FIELDS = ["assetTag", "name", "category", "status", "createdAt", "location", "lastServiceDate"] as const;

export type AssetListStatus = (typeof ASSET_STATUSES)[number] | "";
export type AssetListCategory = (typeof ASSET_CATEGORIES)[number] | "";
export type AssetListSort = (typeof ASSET_SORT_FIELDS)[number];

export type AssetListFilters = {
  search: string;
  status: AssetListStatus;
  category: AssetListCategory;
  location: string;
  departmentId: string;
  condition: string;
  sortBy: AssetListSort;
  sortOrder: "asc" | "desc";
  page: number;
  pageSize: number;
};

const PAGE_SIZES = new Set([25, 50, 100]);

export function assetFiltersFromSearch(params: URLSearchParams): AssetListFilters {
  const status = params.get("status") ?? "";
  const category = params.get("category") ?? "";
  const sortBy = params.get("sortBy") ?? "createdAt";
  const sortOrder = params.get("sortOrder") === "asc" ? "asc" : "desc";
  const page = Number(params.get("page"));
  const pageSize = Number(params.get("pageSize"));
  return {
    search: params.get("q") ?? "",
    status: (ASSET_STATUSES as readonly string[]).includes(status) ? (status as AssetListStatus) : "",
    category: (ASSET_CATEGORIES as readonly string[]).includes(category) ? (category as AssetListCategory) : "",
    location: params.get("location") ?? "",
    departmentId: params.get("departmentId") ?? "",
    condition: (ASSET_CONDITIONS as readonly string[]).includes(params.get("condition") ?? "") ? (params.get("condition") ?? "") : "",
    sortBy: (ASSET_SORT_FIELDS as readonly string[]).includes(sortBy) ? (sortBy as AssetListSort) : "createdAt",
    sortOrder,
    page: Number.isFinite(page) && page >= 1 ? Math.floor(page) : 1,
    pageSize: PAGE_SIZES.has(pageSize) ? pageSize : 25
  };
}

export function assetSearchFromFilters(filters: AssetListFilters, assetId?: string | null): string {
  const params = new URLSearchParams();
  if (filters.search.trim()) params.set("q", filters.search.trim());
  if (filters.status) params.set("status", filters.status);
  if (filters.category) params.set("category", filters.category);
  if (filters.location) params.set("location", filters.location);
  if (filters.departmentId) params.set("departmentId", filters.departmentId);
  if (filters.condition) params.set("condition", filters.condition);
  if (filters.sortBy !== "createdAt") params.set("sortBy", filters.sortBy);
  if (filters.sortOrder !== "desc") params.set("sortOrder", filters.sortOrder);
  if (filters.page > 1) params.set("page", String(filters.page));
  if (filters.pageSize !== 25) params.set("pageSize", String(filters.pageSize));
  if (assetId) params.set("asset", assetId);
  return params.toString();
}

export function assetHistoryHref(assetTag: string): string {
  const params = new URLSearchParams({ scope: "asset", q: assetTag });
  return `/maintenance/history?${params.toString()}`;
}

export function assetCreateWorkOrderHref(assetId: string, assetLabel?: string): string {
  const params = new URLSearchParams({ create: "1", assetId });
  const label = assetLabel?.trim();
  if (label) params.set("assetLabel", label);
  return `/maintenance/jobs?${params.toString()}`;
}

export function workOrderCreatePreset(params: URLSearchParams): { assetId: string; assetLabel: string } | null {
  if (params.get("create") !== "1") return null;
  return {
    assetId: params.get("assetId")?.trim() ?? "",
    assetLabel: params.get("assetLabel")?.trim() ?? ""
  };
}

export function assetNextAction(asset: {
  status: string;
  condition?: string | null;
  lastServiceDate?: string | null;
  nextServiceDate?: string | null;
  openWorkOrderCount?: number;
}, now = Date.now()): string {
  if (asset.status === "RETIRED") return "Retired";
  if (asset.status === "DISPOSED") return "Disposed";
  if (asset.status === "UNDER_MAINTENANCE" || (asset.openWorkOrderCount ?? 0) > 0) return "Under maintenance";
  if (asset.nextServiceDate) {
    const due = new Date(asset.nextServiceDate).getTime();
    if (Number.isFinite(due) && due < now) return "Service overdue";
    if (Number.isFinite(due) && due - now <= 14 * 24 * 60 * 60 * 1000) return "Service due soon";
  }
  if (!asset.lastServiceDate) return "No recent service";
  if (asset.condition === "CRITICAL" || asset.condition === "POOR") return "Needs attention";
  return "Active / no action";
}
