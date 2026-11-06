import { NextResponse, type NextRequest } from "next/server";

import { unauthenticatedLoginRedirect } from "./lib/protected-route";

export function middleware(request: NextRequest) {
  const hasSessionCookie = Boolean(
    request.cookies.get("maintainpro_access")?.value || request.cookies.get("maintainpro_refresh")?.value
  );
  const target = unauthenticatedLoginRedirect(request.nextUrl.pathname, request.nextUrl.search, hasSessionCookie);
  if (!target) return NextResponse.next();
  return NextResponse.redirect(new URL(target, request.url));
}

export const config = {
  matcher: [
    // Public PWA/static files must never be redirected to /login: icons, manifest, service worker and
    // the offline page are fetched before (or without) a session.
    "/((?!_next/static|_next/image|api/|favicon|apple-touch-icon|pwa-|offline\\.html|sw\\.js|manifest\\.webmanifest|brand/).*)"
  ]
};
