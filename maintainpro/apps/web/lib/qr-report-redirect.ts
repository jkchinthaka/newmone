/** Context keys copied from a facility QR link onto the report form. */
export const QR_REPORT_CONTEXT_KEYS = [
  "assetTag",
  "tag",
  "assetId",
  "vehicleId",
  "siteId",
  "functionalLocationId",
  "qr"
] as const;

const REDIRECT_KEYS = new Set(["next", "returnto", "redirect", "url", "return", "continue"]);

function firstValue(value: string | string[] | undefined) {
  if (Array.isArray(value)) return value[0];
  return value;
}

function isUnsafeValue(value: string) {
  const trimmed = value.trim();
  return (
    trimmed.includes("://") ||
    trimmed.startsWith("//") ||
    trimmed.startsWith("\\\\") ||
    /[\r\n]/.test(trimmed)
  );
}

/**
 * QR entry always lands on /requests/new. Only internal target context is kept.
 * Redirect-shaped parameters are dropped so they cannot leave the app.
 */
export function buildQrReportIssueRedirect(
  searchParams?: Record<string, string | string[] | undefined>
): string {
  const qs = new URLSearchParams();
  for (const key of QR_REPORT_CONTEXT_KEYS) {
    const raw = firstValue(searchParams?.[key]);
    if (!raw?.trim() || isUnsafeValue(raw)) continue;
    qs.set(key, raw.trim());
  }
  for (const key of Object.keys(searchParams ?? {})) {
    if (REDIRECT_KEYS.has(key.toLowerCase())) {
      continue;
    }
  }
  const suffix = qs.toString();
  return suffix ? `/requests/new?${suffix}` : "/requests/new";
}
