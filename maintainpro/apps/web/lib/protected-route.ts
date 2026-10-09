import { safeInternalReturnPath } from "./role-redirect";

const PUBLIC_PATHS = ["/login", "/register", "/forgot-password", "/reset-password", "/accept-invite", "/splash"];

export function isPublicAppPath(pathname: string): boolean {
  if (pathname === "/") return true;
  return PUBLIC_PATHS.some((path) => pathname === path || pathname.startsWith(`${path}/`));
}

/** Login URL when the request has neither access nor refresh cookie. Null means allow. */
export function unauthenticatedLoginRedirect(
  pathname: string,
  search: string,
  hasSessionCookie: boolean
): string | null {
  if (hasSessionCookie || isPublicAppPath(pathname)) return null;
  const params = new URLSearchParams({ reason: "session_expired" });
  const returnTo = safeInternalReturnPath(`${pathname}${search}`);
  if (returnTo) params.set("returnTo", returnTo);
  return `/login?${params.toString()}`;
}
