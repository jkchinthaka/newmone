import { NextRequest, NextResponse } from "next/server";

import { resolveBffUpstreamApiBase } from "@/lib/bff-upstream-url";
import { cookiesShouldBeSecure } from "@/lib/runtime-security-config";
import { readSessionCookies } from "@/lib/session-cookies";

const FG_SSO_ASSERTION_COOKIE = "fg_sso_assertion";

function safeFgNext(raw: string | null): string {
  const fallback = "/fg/";
  if (!raw) return fallback;
  const value = raw.trim();
  if (!value.startsWith("/fg")) return fallback;
  if (value.startsWith("//") || value.includes("://")) return fallback;
  return value;
}

/**
 * MaintainPro → FG SSO handoff.
 * Requires MaintainPro access cookie; mints short-lived assertion via Nest;
 * stores assertion in Path=/fg HttpOnly cookie; redirects to FG consume.
 */
export async function GET(request: NextRequest) {
  const nextPath = safeFgNext(request.nextUrl.searchParams.get("next"));
  const session = await readSessionCookies();
  const loginUrl = new URL("/login", request.nextUrl.origin);
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
    return NextResponse.redirect(new URL("/fg/sso/denied/", request.nextUrl.origin));
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

  const consume = new URL("/fg/sso/consume/", request.nextUrl.origin);
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
