/**
 * Canonical registration display stays unchanged.
 * Search/duplicate detection uses a normalized key: uppercase, no spaces/hyphens/punct.
 */
export function normalizeRegistrationNo(value: string | null | undefined): string {
  return String(value ?? "")
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "");
}

/**
 * Build a Mongo/Prisma-friendly regex that matches registration variants.
 * Example: "WP B" / "wp-b" / "WPBF" → characters with optional separators between.
 */
export function registrationSearchPattern(query: string): string | null {
  const chars = normalizeRegistrationNo(query).split("");
  if (chars.length === 0) {
    return null;
  }
  return chars.map((c) => escapeRegex(c)).join("[\\s\\-]*");
}

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
