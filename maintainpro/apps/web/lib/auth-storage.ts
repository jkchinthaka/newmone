export const ACCESS_TOKEN_KEY = "maintainpro_access_token";
export const REFRESH_TOKEN_KEY = "maintainpro_refresh_token";
export const USER_KEY = "maintainpro_user";

export function clearStoredTokens() {
  if (typeof window === "undefined") return;
  localStorage.removeItem(ACCESS_TOKEN_KEY);
  localStorage.removeItem(REFRESH_TOKEN_KEY);
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
  refreshToken?: string;
  user?: unknown;
}) {
  if (typeof window === "undefined") return;
  localStorage.setItem(ACCESS_TOKEN_KEY, payload.accessToken);
  if (payload.refreshToken) {
    localStorage.setItem(REFRESH_TOKEN_KEY, payload.refreshToken);
  } else {
    localStorage.removeItem(REFRESH_TOKEN_KEY);
  }
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
