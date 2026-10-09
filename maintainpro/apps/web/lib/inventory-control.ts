export const INVENTORY_EMPTY = "No inventory items match these filters.";

export type InventoryControlState = {
  q: string;
  stock: "" | "out";
  category: string;
  supplierId: string;
  location: string;
  mapped: "" | "yes" | "no";
  sortBy: "name" | "partNumber" | "quantityInStock" | "updatedAt";
  sortDir: "asc" | "desc";
  partId: string;
  page: number;
  pageSize: number;
};

const PAGE_SIZES = new Set([25, 50, 100]);
const SORTS = new Set(["name", "partNumber", "quantityInStock", "updatedAt"]);

export function inventoryControlFromSearch(params: URLSearchParams): InventoryControlState {
  const stock = params.get("stock") ?? "";
  const mapped = params.get("mapped") ?? "";
  const sortBy = params.get("sortBy") ?? "updatedAt";
  const page = Number(params.get("page"));
  const pageSize = Number(params.get("pageSize"));
  return {
    q: params.get("q") ?? "",
    stock: stock === "out" ? "out" : "",
    category: params.get("category") ?? "",
    supplierId: params.get("supplierId") ?? "",
    location: params.get("location") ?? "",
    mapped: mapped === "yes" || mapped === "no" ? mapped : "",
    sortBy: SORTS.has(sortBy) ? (sortBy as InventoryControlState["sortBy"]) : "updatedAt",
    sortDir: params.get("sortDir") === "asc" ? "asc" : "desc",
    partId: params.get("part") ?? "",
    page: Number.isFinite(page) && page > 0 ? page : 1,
    pageSize: PAGE_SIZES.has(pageSize) ? pageSize : 25
  };
}

export function inventoryControlSearch(state: InventoryControlState): string {
  const params = new URLSearchParams();
  if (state.q) params.set("q", state.q);
  if (state.stock) params.set("stock", state.stock);
  if (state.category) params.set("category", state.category);
  if (state.supplierId) params.set("supplierId", state.supplierId);
  if (state.location) params.set("location", state.location);
  if (state.mapped) params.set("mapped", state.mapped);
  if (state.sortBy !== "updatedAt") params.set("sortBy", state.sortBy);
  if (state.sortDir === "asc") params.set("sortDir", "asc");
  if (state.partId) params.set("part", state.partId);
  if (state.page > 1) params.set("page", String(state.page));
  if (state.pageSize !== 25) params.set("pageSize", String(state.pageSize));
  return params.toString();
}

export function inventoryNextAction(part: {
  erpCode?: string | null;
  quantityInStock?: number | null;
  lastMovementAt?: string | null;
  now?: Date;
}): string {
  if (!part.erpCode?.trim()) return "Mapping required";
  if ((part.quantityInStock ?? 0) <= 0) return "Check ERP stock";
  const now = part.now ?? new Date();
  if (!part.lastMovementAt) return "No recent movement";
  if (now.getTime() - new Date(part.lastMovementAt).getTime() > 60 * 24 * 60 * 60 * 1000) return "No recent movement";
  return "Ready";
}
