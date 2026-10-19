import { safeInternalReturnPath } from "./role-redirect";

const PUBLIC_PATHS = ["/login", "/register", "/forgot-password", "/reset-password", "/accept-invite"];

export function isPublicAppPath(pathname: string): boolean {
  if (pathname === "/dev/identity") return true;
  return PUBLIC_PATHS.some((path) => pathname === path || pathname.startsWith(`${path}/`));
}

/** `/` and the retired splash screen resolve a session when one exists, otherwise login. */
export function isLegacyEntryPath(pathname: string): boolean {
  return pathname === "/" || pathname === "/splash" || pathname.startsWith("/splash/");
}

/** Login URL when the request has neither access nor refresh cookie. Null means allow. */
export function unauthenticatedLoginRedirect(
  pathname: string,
  search: string,
  hasSessionCookie: boolean
): string | null {
  if (isLegacyEntryPath(pathname)) {
    return hasSessionCookie ? null : "/login";
  }
  if (hasSessionCookie || isPublicAppPath(pathname)) return null;
  const params = new URLSearchParams({ reason: "session_expired" });
  const returnTo = safeInternalReturnPath(`${pathname}${search}`);
  if (returnTo) params.set("returnTo", returnTo);
  return `/login?${params.toString()}`;
}
