/**
 * Job order numbers are shown as "JO-…" everywhere, while the database keeps the stored
 * "WO-…" value (WorkOrder.woNumber stays unique and unchanged, and no relation uses it).
 *
 * - Output: every API response, error message, notification and export turns stored job
 *   numbers into the displayed form (displayJobNumbers / displayJobNumbersDeep).
 * - Input: a job number typed or scanned in the displayed form ("JO-2026-00012") is turned
 *   back into the stored form before searches and lookups (storedJobNumberInput).
 *
 * Only job-number shapes are touched: "WO-<year>-<sequence>" and the follow-up form "WO-FU-<id>".
 * Other codes that happen to start with "WO-" or "JO-" (an asset tag "WO-12", say) are left alone.
 */
export const DISPLAY_JOB_NUMBER_PREFIX = "JO-";
export const STORED_JOB_NUMBER_PREFIX = "WO-";

const STORED_JOB_NUMBER = /\bWO-(?=\d{4}-\d|FU-[A-Z0-9])/g;
const DISPLAYED_JOB_NUMBER = /\bJO-(?=\d{4}-\d|FU-[A-Z0-9])/gi;
/** Search boxes also take a partial number ("JO-2026", "jo-20"). */
const DISPLAYED_JOB_NUMBER_PARTIAL = /\bJO-(?=\d|FU-)/gi;

export function displayJobNumbers(text: string): string;
export function displayJobNumbers(text: string | null | undefined): string | null | undefined;
export function displayJobNumbers(text: string | null | undefined) {
  if (typeof text !== "string" || !text.includes(STORED_JOB_NUMBER_PREFIX)) return text;
  return text.replace(STORED_JOB_NUMBER, DISPLAY_JOB_NUMBER_PREFIX);
}

/** Converts every string inside plain objects and arrays. Other objects (Dates, Buffers) pass through. */
export function displayJobNumbersDeep<T>(value: T): T {
  if (typeof value === "string") return displayJobNumbers(value) as T;
  if (value === null || typeof value !== "object") return value;
  if (Array.isArray(value)) return value.map((entry) => displayJobNumbersDeep(entry)) as T;
  const proto = Object.getPrototypeOf(value);
  if (proto !== Object.prototype && proto !== null) return value;
  const out: Record<string, unknown> = {};
  for (const [key, entry] of Object.entries(value as Record<string, unknown>)) out[key] = displayJobNumbersDeep(entry);
  return out as T;
}

/** Turns a displayed job number back into the stored one. `partial` is for search boxes. */
export function storedJobNumberInput(text: string, options: { partial?: boolean } = {}): string {
  if (!/jo-/i.test(text)) return text;
  return text.replace(options.partial ? DISPLAYED_JOB_NUMBER_PARTIAL : DISPLAYED_JOB_NUMBER, STORED_JOB_NUMBER_PREFIX);
}

/** Query parameters that hold free search text (partial job numbers allowed). */
const SEARCH_QUERY_KEYS = new Set(["search", "q", "query", "searchTerm", "term", "keyword", "assetQuery"]);
/** Query or body fields that hold one job reference (a full number or an id). */
const REFERENCE_KEYS = new Set(["code", "woNumber", "workOrderNumber", "workOrderId", "jobNumber", "reference"]);

/**
 * Rewrites displayed job numbers in the request's search and reference fields, in place, so
 * every search and lookup keeps querying the stored value. Free text in bodies is not touched.
 */
export function normalizeJobNumberInput(request: { query?: unknown; body?: unknown } | null | undefined) {
  if (!request) return;
  const query = request.query;
  if (query && typeof query === "object") {
    const record = query as Record<string, unknown>;
    for (const key of Object.keys(record)) {
      const value = record[key];
      if (typeof value !== "string") continue;
      const next = SEARCH_QUERY_KEYS.has(key)
        ? storedJobNumberInput(value, { partial: true })
        : REFERENCE_KEYS.has(key)
          ? storedJobNumberInput(value)
          : value;
      if (next !== value) record[key] = next;
    }
  }
  const body = request.body;
  if (body && typeof body === "object" && !Array.isArray(body)) {
    const record = body as Record<string, unknown>;
    for (const key of [...REFERENCE_KEYS, "search", "q"]) {
      const value = record[key];
      if (typeof value !== "string") continue;
      const next = storedJobNumberInput(value, { partial: key === "search" || key === "q" });
      if (next !== value) record[key] = next;
    }
  }
}
