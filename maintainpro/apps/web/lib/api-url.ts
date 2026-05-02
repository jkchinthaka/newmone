function trimTrailingSlash(value: string) {
  return value.replace(/\/+$/, "");
}

function normalizeApiBaseUrl(value: string) {
  const trimmed = trimTrailingSlash(value.trim());
  return trimmed.endsWith("/api") ? trimmed : `${trimmed}/api`;
}

export const apiBaseUrl = normalizeApiBaseUrl(
  process.env.NEXT_PUBLIC_API_URL ??
    process.env.NEXT_PUBLIC_API_BASE_URL ??
    "http://localhost:3000/api"
);

export const apiOrigin = trimTrailingSlash(
  process.env.NEXT_PUBLIC_API_ORIGIN ?? apiBaseUrl.replace(/\/api$/, "")
);