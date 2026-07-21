function trimTrailingSlash(value: string) {
  return value.replace(/\/+$/, "");
}

function normalizeApiBaseUrl(value: string) {
  const trimmed = trimTrailingSlash(value.trim());
  return trimmed.endsWith("/api") ? trimmed : `${trimmed}/api`;
}

/**
 * Direct NestJS API base (used by the BFF upstream and by explicit opt-out).
 */
export const upstreamApiBaseUrl = normalizeApiBaseUrl(
  process.env.NEXT_PUBLIC_API_URL ??
    process.env.NEXT_PUBLIC_API_BASE_URL ??
    "https://newmone.onrender.com/api"
);

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
