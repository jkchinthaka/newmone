/**
 * Paged fleet registers (accidents, insurance claims, traffic fines).
 * The API returns `{ data: rows[], meta: { page, pageSize, total, totalPages } }` when `page` is sent;
 * older responses without `meta` fall back to the row count.
 */
export const REGISTER_PAGE_SIZES = [25, 50, 100] as const;
export const REGISTER_DEFAULT_PAGE_SIZE = 25;

export type RegisterPage<T> = {
  rows: T[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
};

type RegisterBody = { data?: unknown; meta?: { page?: unknown; pageSize?: unknown; total?: unknown; totalPages?: unknown } | null };

function positiveInt(value: unknown): number | null {
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? Math.floor(parsed) : null;
}

export function parseRegisterPage<T>(body: unknown, page: number, pageSize: number): RegisterPage<T> {
  const envelope = (body && typeof body === "object" ? body : {}) as RegisterBody;
  const data = envelope.data as unknown;
  const rows = (Array.isArray(data)
    ? data
    : data && typeof data === "object" && Array.isArray((data as { items?: unknown }).items)
      ? (data as { items: unknown[] }).items
      : []) as T[];
  const meta = envelope.meta ?? (data && typeof data === "object" ? (data as { meta?: RegisterBody["meta"] }).meta : null);
  const size = positiveInt(meta?.pageSize) || pageSize;
  const total = positiveInt(meta?.total) ?? rows.length;
  const totalPages = positiveInt(meta?.totalPages) || Math.max(1, Math.ceil(total / Math.max(1, size)));
  return { rows, page: positiveInt(meta?.page) || page, pageSize: size, total, totalPages };
}

/** Drop empty filter values so the query key and request stay stable. */
export function compactRegisterFilters(filters: Record<string, string | null | undefined>): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [key, value] of Object.entries(filters)) {
    const trimmed = value?.trim();
    if (trimmed) out[key] = trimmed;
  }
  return out;
}

/** Deep link to one record in its register page (`?id=` opens the record). */
export function registerRecordHref(register: "/accidents" | "/insurance-claims" | "/traffic-fines", id: string): string {
  return `${register}?id=${encodeURIComponent(id)}`;
}
