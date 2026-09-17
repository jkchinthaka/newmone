/**
 * Direct NestJS API base (used by the BFF upstream and by explicit opt-out).
 *
 * Production builds must set NEXT_PUBLIC_API_URL or NEXT_PUBLIC_API_BASE_URL.
 * Silent fallback to a hosted production API is forbidden.
 */
function resolveUpstreamApiBaseUrl(): string {
  const configured =
    process.env.NEXT_PUBLIC_API_URL?.trim() || process.env.NEXT_PUBLIC_API_BASE_URL?.trim() || "";

  if (configured) {
    return configured;
  }

  if (process.env.NODE_ENV === "production") {
    throw new Error(
      "Missing NEXT_PUBLIC_API_URL (or NEXT_PUBLIC_API_BASE_URL). Production builds must not fall back to a hardcoded API host."
    );
  }

  // Explicit local development default only — never a remote production host.
  return "http://localhost:3000/api";
}

function trimTrailingSlash(value: string) {
  return value.replace(/\/+$/, "");
}

function normalizeApiBaseUrl(value: string) {
  const trimmed = trimTrailingSlash(value.trim());
  return trimmed.endsWith("/api") ? trimmed : `${trimmed}/api`;
}

export const upstreamApiBaseUrl = normalizeApiBaseUrl(resolveUpstreamApiBaseUrl());

/**
 * Browser and same-origin clients call the Next.js BFF so session cookies stay
 * on the frontend origin. Set NEXT_PUBLIC_USE_BFF=false only for special cases
 * that must talk to Nest directly (and then cookie auth will not work cross-origin).
 */
export const apiBaseUrl =
  process.env.NEXT_PUBLIC_USE_BFF === "false" ? upstreamApiBaseUrl : "/api/backend";

export const apiOrigin = trimTrailingSlash(
  process.env.NEXT_PUBLIC_API_ORIGIN ?? upstreamApiBaseUrl.replace(/\/api$/, "")
);
