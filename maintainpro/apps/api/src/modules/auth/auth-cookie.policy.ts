/**
 * NestJS browser cookie ownership policy (Phase 2 closeout — Option A).
 *
 * Canonical browser authentication boundary:
 *   Browser -> Next.js /api/backend BFF -> NestJS API
 *
 * The Next.js BFF is the only issuer of browser session cookies:
 *   maintainpro_access, maintainpro_refresh, maintainpro_csrf
 *
 * NestJS returns accessToken/refreshToken in JSON for:
 *   - Trusted BFF (strips tokens before browser-visible responses)
 *   - Mobile / direct API clients (secure storage — not localStorage)
 *
 * NestJS must not Set-Cookie session cookies on login/register/refresh/tenant-switch.
 * Logout may clear residual Nest-era cookies with SameSite=Lax only.
 * SameSite=None is forbidden for Nest auth cookies (COOKIE-CLOSE-005).
 */
export const NEST_ISSUES_BROWSER_SESSION_COOKIES = false as const;

export const BROWSER_SESSION_COOKIE_NAMES = [
  "maintainpro_access",
  "maintainpro_refresh",
  "maintainpro_csrf"
] as const;

export const NEST_AUTH_COOKIE_SAME_SITE = "lax" as const;
