export const INVENTORY_EMPTY = "No inventory items match these filters.";

/** Shown beside snapshot counts. Does not create or change stock. */
export const INVENTORY_QUANTITY_CAPTION =
  "Advisory available is the ERP snapshot minus maintenance reservations. Bileeta remains the stock authority.";

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

export function inventoryFreshnessLabel(
  input: { updatedAt?: string | null; lastMovementAt?: string | null },
  format: (value: Date) => string = (value) => value.toLocaleString()
): string {
  const movement = input.lastMovementAt ? new Date(input.lastMovementAt) : null;
  if (movement && !Number.isNaN(movement.getTime())) return `Last movement ${format(movement)}`;
  const updated = input.updatedAt ? new Date(input.updatedAt) : null;
  if (updated && !Number.isNaN(updated.getTime())) return `Record updated ${format(updated)}`;
  return "No movement time on this row";
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

function toFiniteNumber(value: unknown): number | null {
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (typeof value === "string" && value.trim() !== "") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

/** Coerces API Decimal strings ("1250.00") to numbers; anything non-numeric becomes the fallback. */
export function toPartNumber(value: unknown, fallback: number): number;
export function toPartNumber(value: unknown, fallback?: undefined): number | undefined;
export function toPartNumber(value: unknown, fallback?: number): number | undefined {
  return toFiniteNumber(value) ?? fallback;
}

/** Quantities can arrive as Decimal strings ("12.000"); coerce them so counts never render as text or "—". */
export function normalizePartRow<T extends Record<string, unknown>>(row: T): T {
  const next: Record<string, unknown> = { ...row };
  for (const key of ["quantityInStock", "reservedQuantity", "availableQuantity", "minStockLevel", "unitCost"]) {
    if (key in next) next[key] = toFiniteNumber(next[key]);
  }
  return next as T;
}

/**
 * Pagination for GET /inventory/parts. Reads `data.pagination`, then the envelope's `meta.total`
 * (being added server-side), so the pager is right whichever shape the API sends.
 */
export function partsPageMeta(
  body: unknown,
  page: number,
  pageSize: number,
  rowCount: number
): { page: number; pageSize: number; total: number; totalPages: number } {
  const envelope = body && typeof body === "object" ? (body as Record<string, unknown>) : {};
  const data = envelope.data && typeof envelope.data === "object" ? (envelope.data as Record<string, unknown>) : {};
  const pagination = data.pagination && typeof data.pagination === "object" ? (data.pagination as Record<string, unknown>) : {};
  const meta = envelope.meta && typeof envelope.meta === "object" ? (envelope.meta as Record<string, unknown>) : {};
  const total =
    toFiniteNumber(pagination.total) ?? toFiniteNumber(meta.total) ?? toFiniteNumber(data.total) ?? (page - 1) * pageSize + rowCount;
  const size = toFiniteNumber(pagination.pageSize) ?? toFiniteNumber(meta.pageSize) ?? pageSize;
  const safeSize = size && size > 0 ? size : pageSize;
  return {
    page: toFiniteNumber(pagination.page) ?? toFiniteNumber(meta.page) ?? page,
    pageSize: safeSize,
    total,
    totalPages: Math.max(1, Math.ceil(total / safeSize))
  };
}
