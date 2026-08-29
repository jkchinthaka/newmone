import { NextRequest, NextResponse } from "next/server";

import { resolveBffUpstreamApiBase } from "@/lib/bff-upstream-url";
import { safeFgNext } from "@/lib/fg-sso-safe-next";
import { cookiesShouldBeSecure, resolvePublicWebOrigin } from "@/lib/runtime-security-config";
import { readSessionCookies } from "@/lib/session-cookies";

const FG_SSO_ASSERTION_COOKIE = "fg_sso_assertion";

/**
 * MaintainPro → FG SSO handoff.
 * Requires MaintainPro access cookie; mints short-lived assertion via Nest;
 * stores assertion in Path=/fg HttpOnly cookie; redirects to FG consume or native UI.
 *
 * All redirect targets are built from the externally-configured FRONTEND_URL
 * (via resolvePublicWebOrigin), never from `request.nextUrl.origin`. Behind a
 * reverse proxy, `request.nextUrl.origin` reflects the Next.js process's own
 * internal bind address (e.g. http://localhost:3001), not the address a real
 * browser can reach — using it here previously sent every handoff redirect
 * to an address unreachable outside the container network.
 */
export async function GET(request: NextRequest) {
  let publicOrigin: string;
  try {
    publicOrigin = resolvePublicWebOrigin();
  } catch (error) {
    // Fail closed: never fall back to request.nextUrl.origin, an inbound
    // Host/X-Forwarded-Host header, or localhost. A misconfigured
    // FRONTEND_URL must surface as a loud server error, not a redirect to
    // an unreachable or attacker-influenced address.
    return NextResponse.json(
      {
        error: "fg_sso_misconfigured",
        message: error instanceof Error ? error.message : "FRONTEND_URL is misconfigured."
      },
      { status: 500 }
    );
  }

  const nextPath = safeFgNext(request.nextUrl.searchParams.get("next"));
  const session = await readSessionCookies();
  const loginUrl = new URL("/login", publicOrigin);
  loginUrl.searchParams.set("next", nextPath);

  if (!session.accessToken) {
    return NextResponse.redirect(loginUrl);
  }

  let upstreamBase: string;
  try {
    upstreamBase = resolveBffUpstreamApiBase().base;
  } catch {
    return NextResponse.redirect(loginUrl);
  }

  const exchangeUrl = `${upstreamBase.replace(/\/$/, "")}/auth/fg-sso/exchange`;
  let exchange: Response;
  try {
    exchange = await fetch(exchangeUrl, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${session.accessToken}`,
        "Content-Type": "application/json",
        Accept: "application/json",
        "X-Request-Id": request.headers.get("x-request-id") ?? crypto.randomUUID()
      },
      body: "{}"
    });
  } catch {
    return NextResponse.redirect(loginUrl);
  }

  if (exchange.status === 401) {
    return NextResponse.redirect(loginUrl);
  }
  if (exchange.status === 403) {
    return NextResponse.redirect(new URL("/fg/sso/denied", publicOrigin));
  }
  if (!exchange.ok) {
    return NextResponse.redirect(loginUrl);
  }

  const payload = (await exchange.json()) as {
    data?: { assertion?: string; expiresIn?: number };
  };
  const assertion = payload?.data?.assertion?.trim() ?? "";
  const expiresIn = Number(payload?.data?.expiresIn ?? 60);
  if (!assertion) {
    return NextResponse.redirect(loginUrl);
  }

  const consume = new URL("/fg/sso/consume/", publicOrigin);
  consume.searchParams.set("next", nextPath);
  const response = NextResponse.redirect(consume);
  response.cookies.set(FG_SSO_ASSERTION_COOKIE, assertion, {
    httpOnly: true,
    secure: cookiesShouldBeSecure(),
    sameSite: "lax",
    path: "/fg",
    maxAge: Math.max(15, Math.min(expiresIn, 120))
  });
  return response;
}
