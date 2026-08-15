/**
 * Canonical client IP for BFF → API throttle identity.
 * Nginx sets X-Real-IP to $remote_addr; the BFF forwards only a validated
 * single-IP value. Never treat comma-separated X-Forwarded-For as identity.
 */
import { isIP } from "node:net";

export function sanitizeCanonicalClientIp(
  raw: string | null | undefined
): string | null {
  if (typeof raw !== "string") {
    return null;
  }
  const trimmed = raw.trim();
  if (!trimmed || trimmed.includes(",") || trimmed.includes(" ")) {
    return null;
  }
  const normalized = normalizeIp(trimmed);
  if (isIP(normalized) === 0) {
    return null;
  }
  return normalized;
}

/**
 * Forward Nginx's canonical X-Real-IP to the upstream API when valid.
 * Invalid / multi-value / missing values are omitted (API falls back to peer).
 */
export function applyCanonicalClientIpHeader(
  headers: Headers,
  incomingXRealIp: string | null | undefined
): string | null {
  const canonical = sanitizeCanonicalClientIp(incomingXRealIp);
  if (canonical) {
    headers.set("X-Real-IP", canonical);
  }
  return canonical;
}

function normalizeIp(ip: string): string {
  if (ip.startsWith("::ffff:")) {
    return ip.slice("::ffff:".length);
  }
  return ip;
}
