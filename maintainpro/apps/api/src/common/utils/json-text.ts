/**
 * Phase 15 — central JSON text helpers for SQL Server NVarChar(Max) snapshots / arrays.
 */
export function toJsonText(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  if (typeof value === "string") {
    // Already serialized — validate
    JSON.parse(value);
    return value;
  }
  return JSON.stringify(value);
}

export function parseJsonText<T = unknown>(raw: string | null | undefined, fallback: T): T {
  if (raw === null || raw === undefined || raw === "") return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

export function toStringArray(raw: unknown): string[] {
  if (Array.isArray(raw)) return raw.map(String);
  if (typeof raw === "string") return parseJsonText<string[]>(raw, []);
  return [];
}

export function stringArrayToText(values: string[] | null | undefined): string {
  return JSON.stringify(values ?? []);
}
