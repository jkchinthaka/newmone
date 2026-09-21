/**
 * Array-valued columns such as `Part.images` / `Vehicle.images` are stored as JSON
 * **strings** in prisma/schema.prisma (`String @default("[]") @db.NVarChar(Max)`) and
 * reach the client unparsed. Indexing that string (`images[0]`) yields the character
 * `"["`, which the browser then requests as a URL — one 404 per row. Normalize at the
 * API boundary instead, so UI types stay honest.
 */
export function parseUrlList(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.filter((entry): entry is string => typeof entry === "string" && entry.trim().length > 0);
  }

  if (typeof value !== "string") {
    return [];
  }

  const trimmed = value.trim();
  if (!trimmed || trimmed === "[]") {
    return [];
  }

  if (trimmed.startsWith("[")) {
    try {
      return parseUrlList(JSON.parse(trimmed));
    } catch {
      return [];
    }
  }

  // Legacy rows store comma / newline separated URLs. Anything that is not a usable
  // image URL is dropped here so callers never paint a junk token into <img src>.
  return trimmed
    .split(/\r?\n|,/)
    .map((chunk) => chunk.trim())
    .filter((chunk) => isRenderableImageUrl(chunk));
}

/**
 * True for values that are safe to hand to an <img src> — anything else (a stray
 * `"["`, a bare filename, a `javascript:` URL) must render the placeholder instead.
 */
export function isRenderableImageUrl(value: unknown): value is string {
  if (typeof value !== "string") {
    return false;
  }

  const trimmed = value.trim();
  if (trimmed.length < 2) {
    return false;
  }

  return (
    trimmed.startsWith("/") ||
    trimmed.startsWith("data:image/") ||
    trimmed.startsWith("https://") ||
    trimmed.startsWith("http://")
  );
}

/** First usable image URL from a raw (possibly JSON-string) column value. */
export function firstRenderableImageUrl(value: unknown): string | null {
  return parseUrlList(value).find((entry) => isRenderableImageUrl(entry)) ?? null;
}
