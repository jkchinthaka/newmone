import { randomUUID } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";

import { FG_SSO_ASSERTION_COOKIE } from "@/lib/fg-config";
import { resolveBffUpstreamApiBase } from "@/lib/bff-upstream-url";
import { readSessionCookies } from "@/lib/session-cookies";

export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";
export const revalidate = 0;

const FG_COOKIE_NAMES = ["fg_sessionid", "csrftoken", "csrf", FG_SSO_ASSERTION_COOKIE];

function jsonError(code: string, message: string, status: number, requestId: string) {
  return NextResponse.json(
    { data: null, meta: null, error: { code, message, fieldErrors: {}, requestId } },
    {
      status,
      headers: {
        "Cache-Control": "no-store",
        "X-Request-Id": requestId
      }
    }
  );
}

function resolveFgUpstream(env: NodeJS.ProcessEnv = process.env): string {
  const raw = String(env.FG_API_INTERNAL_URL || env.FG_INTERNAL_URL || "").trim().replace(/\/+$/, "");
  if (!raw) {
    throw new Error("missing");
  }
  return raw;
}

function incomingFgCookies(request: NextRequest): string {
  return FG_COOKIE_NAMES.map((name) => {
    const value = request.cookies.get(name)?.value;
    return value ? `${name}=${value}` : "";
  })
    .filter(Boolean)
    .join("; ");
}

function csrfHeader(request: NextRequest): string {
  return (
    request.headers.get("x-csrftoken") ||
    request.headers.get("x-csrf-token") ||
    request.cookies.get("csrftoken")?.value ||
    ""
  );
}

function applyUpstreamCookies(response: NextResponse, upstream: Response) {
  const getSetCookie = (upstream.headers as Headers & { getSetCookie?: () => string[] }).getSetCookie;
  const cookies = typeof getSetCookie === "function" ? getSetCookie.call(upstream.headers) : [];
  for (const cookie of cookies) {
    response.headers.append("set-cookie", cookie);
  }
}

async function mintAssertion(request: NextRequest, accessToken: string, requestId: string): Promise<string | null> {
  let upstreamBase: string;
  try {
    upstreamBase = resolveBffUpstreamApiBase().base;
  } catch {
    return null;
  }
  const exchange = await fetch(`${upstreamBase.replace(/\/$/, "")}/auth/fg-sso/exchange`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Accept: "application/json",
      "Content-Type": "application/json",
      "X-Request-Id": requestId
    },
    body: "{}"
  });
  if (!exchange.ok) {
    return null;
  }
  const payload = (await exchange.json()) as { data?: { assertion?: string } };
  return payload?.data?.assertion?.trim() || null;
}

async function proxyDjango(
  request: NextRequest,
  path: string[],
  extraCookie?: string
): Promise<Response> {
  const base = resolveFgUpstream();
  const search = request.nextUrl.search;
  const target = `${base}/api/v1/${path.join("/")}${search}`;
  const headers = new Headers();
  headers.set("Accept", "application/json");
  headers.set("X-Request-Id", request.headers.get("x-request-id") ?? randomUUID());
  const cookie = [incomingFgCookies(request), extraCookie].filter(Boolean).join("; ");
  if (cookie) {
    headers.set("Cookie", cookie);
  }
  const csrf = csrfHeader(request);
  if (csrf) {
    headers.set("X-CSRFToken", csrf);
  }
  const origin = request.headers.get("origin");
  if (origin) {
    headers.set("Origin", origin);
  }
  headers.set("Referer", request.nextUrl.origin + "/fg");
  const method = request.method.toUpperCase();
  let body: ArrayBuffer | undefined;
  if (method !== "GET" && method !== "HEAD") {
    headers.set("Content-Type", request.headers.get("content-type") || "application/json");
    body = await request.arrayBuffer();
  }
  return fetch(target, {
    method,
    headers,
    body,
    cache: "no-store",
    redirect: "manual"
  });
}

export async function GET(request: NextRequest, context: { params: { path?: string[] } }) {
  return handle(request, context);
}

export async function POST(request: NextRequest, context: { params: { path?: string[] } }) {
  return handle(request, context);
}

export async function PUT(request: NextRequest, context: { params: { path?: string[] } }) {
  return handle(request, context);
}

export async function PATCH(request: NextRequest, context: { params: { path?: string[] } }) {
  return handle(request, context);
}

export async function DELETE(request: NextRequest, context: { params: { path?: string[] } }) {
  return handle(request, context);
}

async function handle(request: NextRequest, context: { params: { path?: string[] } }) {
  const requestId = request.headers.get("x-request-id") ?? randomUUID();
  const session = await readSessionCookies();
  if (!session.accessToken) {
    return jsonError("UNAUTHENTICATED", "Sign in to MaintainPro to use FG Digital Records.", 401, requestId);
  }

  const { path = [] } = context.params;
  const isSession = path[0] === "session" && path.length === 1;

  try {
    resolveFgUpstream();
  } catch {
    return jsonError(
      "FG_UNAVAILABLE",
      "FG Digital Records is not connected in this environment.",
      503,
      requestId
    );
  }

  let extraCookie = "";
  if (isSession || !request.cookies.get("fg_sessionid")?.value) {
    try {
      const assertion = await mintAssertion(request, session.accessToken, requestId);
      if (!assertion) {
        return jsonError("FORBIDDEN", "You do not have FG Digital Records access.", 403, requestId);
      }
      extraCookie = `${FG_SSO_ASSERTION_COOKIE}=${assertion}`;
    } catch {
      return jsonError("UNAUTHENTICATED", "Sign in to MaintainPro to use FG Digital Records.", 401, requestId);
    }
  }

  const djangoPath = isSession ? ["session"] : path;
  let upstream: Response;
  try {
    if (isSession) {
      const sessionUrl = `${resolveFgUpstream()}/api/v1/session`;
      upstream = await fetch(sessionUrl, {
        method: "GET",
        headers: {
          Accept: "application/json",
          Cookie: extraCookie,
          Authorization: extraCookie ? `Bearer ${extraCookie.split("=")[1]}` : "",
          "X-Request-Id": requestId
        },
        cache: "no-store"
      });
    } else {
      upstream = await proxyDjango(request, djangoPath, extraCookie);
      if (upstream.status === 401 && extraCookie) {
        const sessionUrl = `${resolveFgUpstream()}/api/v1/session`;
        const boot = await fetch(sessionUrl, {
          method: "GET",
          headers: {
            Accept: "application/json",
            Cookie: extraCookie,
            Authorization: `Bearer ${extraCookie.split("=")[1]}`,
            "X-Request-Id": requestId
          },
          cache: "no-store"
        });
        if (boot.ok) {
          upstream = await proxyDjango(request, djangoPath, extraCookie);
        }
      }
    }
  } catch {
    return jsonError("FG_UNAVAILABLE", "FG Digital Records is temporarily unavailable.", 502, requestId);
  }

  const text = await upstream.text();
  const response = new NextResponse(text, {
    status: upstream.status,
    headers: {
      "Cache-Control": "no-store",
      "Content-Type": upstream.headers.get("content-type") || "application/json",
      "X-Request-Id": requestId
    }
  });
  applyUpstreamCookies(response, upstream);
  return response;
}
