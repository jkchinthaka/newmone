import { userScopedStorageKey } from "@/lib/user-scoped-storage";

/**
 * Remembers a person's last list filters (status, sort, page size) on this device.
 * Stored per company and per user (see user-scoped-storage) so a shared tablet never shows
 * the next person someone else's filters. Search text and page number are never remembered.
 * Every read and write is wrapped: private windows and blocked storage must not break a list.
 */
export function loadRememberedFilters<T extends Record<string, unknown>>(
  base: string,
  allowedKeys: readonly (keyof T & string)[]
): Partial<T> {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(userScopedStorageKey(base));
    const parsed = raw ? (JSON.parse(raw) as unknown) : null;
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return {};
    const source = parsed as Record<string, unknown>;
    const result: Record<string, unknown> = {};
    for (const key of allowedKeys) {
      const value = source[key];
      if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
        result[key] = value;
      } else if (Array.isArray(value) && value.every((item) => typeof item === "string")) {
        result[key] = value;
      }
    }
    return result as Partial<T>;
  } catch {
    return {};
  }
}

export function saveRememberedFilters(
  base: string,
  value: Record<string, unknown>,
  allowedKeys: readonly string[]
): void {
  if (typeof window === "undefined") return;
  try {
    const picked: Record<string, unknown> = {};
    for (const key of allowedKeys) {
      if (key in value) picked[key] = value[key];
    }
    window.localStorage.setItem(userScopedStorageKey(base), JSON.stringify(picked));
  } catch {
    // Storage can be blocked or full; the list keeps working without it.
  }
}
