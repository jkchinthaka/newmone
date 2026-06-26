/**
 * Web auth session storage.
 *
 * Security posture:
 * - Access JWT is stored in localStorage for Bearer API calls (XSS exposure — mitigate with CSP and input hygiene).
 * - Refresh token is HttpOnly cookie-only on the API; not stored in Web Storage.
 * - User display profile (non-secret) is cached in localStorage for navigation/dashboard UX.
 * - `clearAuthSession()` removes token, user, and active tenant on logout/session expiry.
 */
export const ACCESS_TOKEN_KEY = "maintainpro_access_token";
export const USER_KEY = "maintainpro_user";
const LEGACY_REFRESH_TOKEN_KEY = "maintainpro_refresh_token";

export function clearStoredTokens() {
  if (typeof window === "undefined") return;
  localStorage.removeItem(ACCESS_TOKEN_KEY);
  localStorage.removeItem(LEGACY_REFRESH_TOKEN_KEY);
}

export function getAccessToken() {
  if (typeof window === "undefined") return null;
  const token = localStorage.getItem(ACCESS_TOKEN_KEY);
  if (!token || token.trim().length === 0) {
    return null;
  }

  return token;
}

export function setAuthSession(payload: {
  accessToken: string;
  user?: unknown;
}) {
  if (typeof window === "undefined") return;
  localStorage.setItem(ACCESS_TOKEN_KEY, payload.accessToken);
  // Refresh token is cookie-only (HttpOnly) and should never be stored in Web Storage.
  localStorage.removeItem(LEGACY_REFRESH_TOKEN_KEY);
  if (payload.user) {
    localStorage.setItem(USER_KEY, JSON.stringify(payload.user));
  }
}

export function setAccessToken(accessToken: string) {
  if (typeof window === "undefined") return;
  if (accessToken && accessToken.trim().length > 0) {
    localStorage.setItem(ACCESS_TOKEN_KEY, accessToken);
  } else {
    localStorage.removeItem(ACCESS_TOKEN_KEY);
  }
}

export function updateStoredUserTenant(tenantId: string | null) {
  if (typeof window === "undefined") return;

  const raw = localStorage.getItem(USER_KEY);
  if (!raw) {
    return;
  }

  try {
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    parsed.tenantId = tenantId;
    localStorage.setItem(USER_KEY, JSON.stringify(parsed));
  } catch {
    // Keep current user payload untouched when local storage content is malformed.
  }
}

export function clearAuthSession() {
  if (typeof window === "undefined") return;
  clearStoredTokens();
  localStorage.removeItem(USER_KEY);
  localStorage.removeItem("maintainpro_active_tenant");
}
