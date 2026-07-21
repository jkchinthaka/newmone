/** Shared form -> API payload conversion helpers. Never send NaN or accidental empty IDs. */

export function toOptionalString(value: unknown): string | undefined {
  if (value === null || value === undefined) return undefined;
  const trimmed = String(value).trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

export function toRequiredString(value: unknown, fieldName = "value"): string {
  const result = toOptionalString(value);
  if (!result) {
    throw new Error(`${fieldName} is required`);
  }
  return result;
}

export function toOptionalNumber(value: unknown): number | undefined {
  if (value === null || value === undefined) return undefined;
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : undefined;
  }
  const raw = String(value).trim();
  if (!raw) return undefined;
  const parsed = Number(raw);
  return Number.isFinite(parsed) ? parsed : undefined;
}

export function toRequiredNumber(value: unknown, fieldName = "value"): number {
  const result = toOptionalNumber(value);
  if (result === undefined) {
    throw new Error(`${fieldName} is required`);
  }
  return result;
}

export function toOptionalInteger(value: unknown): number | undefined {
  const result = toOptionalNumber(value);
  if (result === undefined) return undefined;
  if (!Number.isInteger(result)) return undefined;
  return result;
}

export function toOptionalDate(value: unknown): string | undefined {
  const raw = toOptionalString(value);
  if (!raw) return undefined;
  const date = new Date(raw);
  if (Number.isNaN(date.getTime())) return undefined;
  return raw.includes("T") ? date.toISOString() : raw;
}

export function toOptionalDateTime(value: unknown): string | undefined {
  const raw = toOptionalString(value);
  if (!raw) return undefined;
  const date = new Date(raw);
  if (Number.isNaN(date.getTime())) return undefined;
  return date.toISOString();
}

export function toOptionalId(value: unknown): string | undefined {
  const raw = toOptionalString(value);
  if (!raw || raw === "null" || raw === "undefined") return undefined;
  return raw;
}

export function toNullableId(value: unknown): string | null | undefined {
  if (value === null) return null;
  return toOptionalId(value);
}

export function removeUndefined<T extends Record<string, unknown>>(value: T): Partial<T> {
  const out: Record<string, unknown> = {};
  for (const [key, entry] of Object.entries(value)) {
    if (entry !== undefined) {
      out[key] = entry;
    }
  }
  return out as Partial<T>;
}

export function removeEmptyStrings<T extends Record<string, unknown>>(value: T): Partial<T> {
  const out: Record<string, unknown> = {};
  for (const [key, entry] of Object.entries(value)) {
    if (typeof entry === "string" && entry.trim().length === 0) {
      continue;
    }
    out[key] = entry;
  }
  return out as Partial<T>;
}