/**
 * Browser FG client uses `/fg/api/v1/...`. The App Router catch-all is
 * `app/fg/api/[...path]`, so the first segment is often `v1`. Strip it before
 * proxying to Django `/api/v1/...`.
 */
export function normalizeFgBffPath(path: readonly string[] | undefined): string[] {
  const segments = Array.isArray(path) ? [...path] : [];
  if (segments[0] === "v1") {
    return segments.slice(1);
  }
  return segments;
}

export function isFgBffSessionPath(path: readonly string[] | undefined): boolean {
  const segments = normalizeFgBffPath(path);
  return segments[0] === "session" && segments.length === 1;
}
