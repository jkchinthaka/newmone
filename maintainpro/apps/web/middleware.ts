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
  matcher: ["/((?!_next/static|_next/image|api/|favicon.ico|favicon.svg|sw.js|manifest.webmanifest|brand/).*)"]
};
