/**
 * Resolve a throttle/abuse-protection client identity behind MaintainPro's
 * reverse-proxy + BFF path without trusting spoofable client X-Forwarded-For.
 *
 * Production path: Browser → Nginx → Web BFF → API
 * Nginx sets X-Real-IP=$remote_addr; BFF forwards only a validated single IP.
 * API honors that header only when the immediate TCP peer is an internal hop.
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

export function resolveTrustedClientIp(req: {
  ip?: string;
  headers?: Record<string, string | string[] | undefined>;
  socket?: { remoteAddress?: string };
  connection?: { remoteAddress?: string };
}): string {
  const peer = normalizeIp(
    req.socket?.remoteAddress ?? req.connection?.remoteAddress ?? req.ip ?? ""
  );

  const realIp = sanitizeCanonicalClientIp(firstHeaderValue(req.headers?.["x-real-ip"]));
  if (realIp && peerLooksLikeTrustedProxyHop(peer)) {
    return realIp;
  }

  if (peer) {
    return peer;
  }

  return "unknown";
}

function firstHeaderValue(value: string | string[] | undefined): string | null {
  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : null;
  }
  if (Array.isArray(value) && value.length > 0) {
    const first = value[0]?.trim();
    return first && first.length > 0 ? first : null;
  }
  return null;
}

function normalizeIp(ip: string): string {
  const trimmed = ip.trim();
  if (trimmed.startsWith("::ffff:")) {
    return trimmed.slice("::ffff:".length);
  }
  return trimmed;
}

function peerLooksLikeTrustedProxyHop(peer: string): boolean {
  if (!peer) {
    return false;
  }
  if (peer === "127.0.0.1" || peer === "::1") {
    return true;
  }
  if (peer.startsWith("10.")) {
    return true;
  }
  if (peer.startsWith("192.168.")) {
    return true;
  }
  if (/^172\.(1[6-9]|2\d|3[0-1])\./.test(peer)) {
    return true;
  }
  const lower = peer.toLowerCase();
  return lower.startsWith("fc") || lower.startsWith("fd");
}
