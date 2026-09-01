/**
 * Deterministic, non-guessing normalization helpers shared by every bulk
 * import adapter. Ambiguous input is always surfaced as a validation error
 * rather than silently coerced — see docs/BULK_IMPORT_ARCHITECTURE.md.
 */
import type { BulkImportFieldIssue } from "../bulk-import-adapter";

export function trimToNull(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  const text = String(value).trim();
  return text.length > 0 ? text : null;
}

export function requireTrimmedString(
  raw: Record<string, unknown>,
  key: string,
  issues: BulkImportFieldIssue[],
  label = key
): string | null {
  const value = trimToNull(raw[key]);
  if (!value) {
    issues.push({ field: key, code: "REQUIRED", message: `${label} is required` });
    return null;
  }
  return value;
}

/** Strict YYYY-MM-DD only — never guesses between DD/MM and MM/DD. */
export function parseStrictDate(raw: unknown): { value: Date | null; error?: string } {
  if (raw === null || raw === undefined || raw === "") {
    return { value: null };
  }
  if (raw instanceof Date) {
    return Number.isNaN(raw.getTime()) ? { value: null, error: "Invalid date" } : { value: raw };
  }
  const text = String(raw).trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(text)) {
    return { value: null, error: "Date must be in YYYY-MM-DD format" };
  }
  const parsed = new Date(`${text}T00:00:00.000Z`);
  if (Number.isNaN(parsed.getTime())) {
    return { value: null, error: "Invalid date" };
  }
  return { value: parsed };
}

export function parseIntegerValue(raw: unknown): { value: number | null; error?: string } {
  const result = parseNumberValue(raw);
  if (result.error || result.value === null) return result;
  if (!Number.isInteger(result.value)) {
    return { value: null, error: "Must be a whole number" };
  }
  return result;
}

export function parseNumberValue(raw: unknown): { value: number | null; error?: string } {
  if (raw === null || raw === undefined || raw === "") {
    return { value: null };
  }
  const parsed = typeof raw === "number" ? raw : Number(String(raw).replace(/,/g, "").trim());
  if (!Number.isFinite(parsed)) {
    return { value: null, error: "Must be a number" };
  }
  return { value: parsed };
}

/**
 * Case-insensitive alias match against a documented enum's own member names
 * only (e.g. "active"/"Active"/"ACTIVE" -> "ACTIVE"). Anything else is an
 * error, never a guess.
 */
export function normalizeEnumValue<T extends string>(
  raw: unknown,
  allowed: readonly T[]
): { value: T | null; error?: string } {
  const text = trimToNull(raw);
  if (!text) return { value: null };
  const upper = text.toUpperCase().replace(/[\s-]+/g, "_");
  const match = allowed.find((candidate) => candidate.toUpperCase() === upper);
  if (!match) {
    return { value: null, error: `Must be one of: ${allowed.join(", ")}` };
  }
  return { value: match };
}
