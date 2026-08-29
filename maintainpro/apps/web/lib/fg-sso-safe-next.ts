/**
 * Open-redirect protection for the `next` query parameter on the FG SSO
 * handoff route. Only an already-relative /fg path is ever honored;
 * anything else (protocol-relative, absolute, or missing) falls back to
 * the FG root.
 */
export function safeFgNext(raw: string | null): string {
  const fallback = "/fg/";
  if (!raw) return fallback;
  const value = raw.trim();
  if (!value.startsWith("/fg")) return fallback;
  if (value.startsWith("//") || value.includes("://")) return fallback;
  return value;
}
