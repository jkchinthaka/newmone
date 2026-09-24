/**
 * Web auth session storage.
 *
 * Security posture (same-origin BFF):
 * - Access and refresh JWTs are HttpOnly cookies set by `/api/backend` — never Web Storage.
 * - CSRF token is a readable cookie on the frontend origin for double-submit.
 * - User display profile (non-secret) may be cached in localStorage for navigation UX.
 * - `clearAuthSession()` clears profile + preferred tenant; cookies are cleared by logout BFF.
 */
export const ACCESS_TOKEN_KEY = "maintainpro_access_token";
export const USER_KEY = "maintainpro_user";
const LEGACY_REFRESH_TOKEN_KEY = "maintainpro_refresh_token";

export function clearStoredTokens() {
  if (typeof window === "undefined") return;
  localStorage.removeItem(ACCESS_TOKEN_KEY);
  localStorage.removeItem(LEGACY_REFRESH_TOKEN_KEY);
}

/**
 * Access tokens are cookie-only via the BFF. Kept for transitional callers;
 * always returns null so Authorization is not attached from Web Storage.
 */
export function getAccessToken(): string | null {
  if (typeof window === "undefined") return null;
  // Migrate away from legacy localStorage access tokens.
  localStorage.removeItem(ACCESS_TOKEN_KEY);
  localStorage.removeItem(LEGACY_REFRESH_TOKEN_KEY);
  return null;
}

export function setAuthSession(payload: {
  accessToken?: string;
  user?: unknown;
}) {
  if (typeof window === "undefined") return;
  clearStoredTokens();
  if (payload.user) {
    localStorage.setItem(USER_KEY, JSON.stringify(payload.user));
  }
}

/**
 * Merge non-secret profile fields from `/auth/me` into the cached user.
 * Never stores tokens, password hashes, or other secrets.
 */
export function mergeStoredPublicUserProfile(profile: unknown) {
  if (typeof window === "undefined" || !profile || typeof profile !== "object") {
    return;
  }

  const incoming = profile as Record<string, unknown>;
  const raw = localStorage.getItem(USER_KEY);
  let existing: Record<string, unknown> = {};
  if (raw) {
    try {
      existing = JSON.parse(raw) as Record<string, unknown>;
    } catch {
      existing = {};
    }
  }

  const next: Record<string, unknown> = { ...existing };

  if (typeof incoming.id === "string") {
    next.id = incoming.id;
  }
  if (typeof incoming.email === "string") {
    next.email = incoming.email;
  }
  if (typeof incoming.fullName === "string") {
    next.fullName = incoming.fullName;
  }
  if (typeof incoming.tenantId === "string" || incoming.tenantId === null) {
    next.tenantId = incoming.tenantId;
  }
  if (typeof incoming.role === "string") {
    next.role = incoming.role;
  } else if (incoming.role && typeof incoming.role === "object") {
    const roleObj = incoming.role as { name?: unknown };
    if (typeof roleObj.name === "string") {
      next.role = roleObj.name;
    }
  }
  if (Array.isArray(incoming.permissions)) {
    next.permissions = incoming.permissions.filter(
      (value): value is string => typeof value === "string" && value.trim().length > 0
    );
  }
  if (Array.isArray(incoming.enabledFeatures)) {
    next.enabledFeatures = incoming.enabledFeatures.filter(
      (value): value is string => typeof value === "string"
    );
  }

  localStorage.setItem(USER_KEY, JSON.stringify(next));
  window.dispatchEvent(new Event("maintainpro:user-updated"));
}

export function setAccessToken(_accessToken: string) {
  if (typeof window === "undefined") return;
  clearStoredTokens();
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
