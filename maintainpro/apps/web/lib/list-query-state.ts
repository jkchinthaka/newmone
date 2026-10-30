/**
 * Shared rules for server-paged lists that poll in the background.
 *
 * - A failed background poll must not wipe rows the user is looking at.
 * - Polling keeps going after a failure (the next poll may succeed), but pauses
 *   while the tab is hidden so phones on slow networks do not burn requests.
 * - Page numbers are clamped once the server says how many pages exist.
 */

export type ListErrorPresentation = "none" | "full" | "banner";

/** Full error only when there is nothing to show; otherwise keep rows and show a small banner. */
export function listErrorPresentation(input: { isError: boolean; hasData: boolean }): ListErrorPresentation {
  if (!input.isError) return "none";
  return input.hasData ? "banner" : "full";
}

/** react-query options for a list that refreshes itself. Keeps polling after an error; pauses on hidden tabs. */
export function backgroundPollingOptions(intervalMs: number) {
  return {
    refetchInterval: intervalMs,
    refetchIntervalInBackground: false
  } as const;
}

export function totalPagesFor(total: number, pageSize: number): number {
  if (!Number.isFinite(total) || total <= 0) return 1;
  return Math.max(1, Math.ceil(total / Math.max(1, pageSize)));
}

/** Page to show after data arrives. Returns the same page when it is still in range. */
export function clampPage(page: number, total: number, pageSize: number): number {
  const safe = Number.isFinite(page) && page >= 1 ? Math.floor(page) : 1;
  return Math.min(safe, totalPagesFor(total, pageSize));
}

/** Reads a pagination total from `meta.total` (or `total`) when the server sends one. */
export function readServerTotal(payload: unknown, fallback: number): number {
  if (!payload || typeof payload !== "object") return fallback;
  const record = payload as Record<string, unknown>;
  const meta = record.meta && typeof record.meta === "object" ? (record.meta as Record<string, unknown>) : null;
  const candidate = meta?.total ?? record.total;
  const numeric = typeof candidate === "string" ? Number(candidate) : candidate;
  return typeof numeric === "number" && Number.isFinite(numeric) && numeric >= 0 ? numeric : fallback;
}

/**
 * Hands out request ids so a slow, older response cannot overwrite a newer one.
 * Each `begin()` aborts the previous request's controller.
 */
export function createRequestSequencer() {
  let latest = 0;
  let controller: AbortController | null = null;
  return {
    begin() {
      controller?.abort();
      controller = typeof AbortController === "undefined" ? null : new AbortController();
      latest += 1;
      return { id: latest, signal: controller?.signal };
    },
    isLatest(id: number) {
      return id === latest;
    },
    cancel() {
      controller?.abort();
      controller = null;
      latest += 1;
    }
  };
}

export function isAbortError(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const record = error as { name?: unknown; code?: unknown };
  return record.name === "AbortError" || record.name === "CanceledError" || record.code === "ERR_CANCELED";
}
