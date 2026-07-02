export const DEFAULT_PAGE_SIZE = 20;
export const MAX_PAGE_SIZE = 100;
export const MAX_EXPORT_ROWS = 5000;

export function clampPageSize(value: unknown, fallback = DEFAULT_PAGE_SIZE, max = MAX_PAGE_SIZE): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 1) {
    return fallback;
  }
  return Math.min(max, Math.max(1, Math.floor(parsed)));
}

export function clampPage(value: unknown, fallback = 1): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 1) {
    return fallback;
  }
  return Math.floor(parsed);
}
