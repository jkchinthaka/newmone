import { randomBytes, randomUUID, timingSafeEqual } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";

import {
  extractAuthTokens,
  isBffCsrfExempt,
  stripAuthTokensFromBody
} from "./bff-auth";
import { assertProductionRuntimeSecurity } from "./runtime-security-config";
import {
  ACCESS_COOKIE,
  CSRF_COOKIE,
  CSRF_HEADER,
  REFRESH_COOKIE,
  csrfCookieOptions,
  readSessionCookies,
  sessionCookieOptions
} from "./session-cookies";
import { apiOrigin } from "./api-url";

const ACCESS_MAX_AGE = 15 * 60;
const REFRESH_MAX_AGE = 7 * 24 * 60 * 60;

type AuthTokenPayload = {
  accessToken?: unknown;
  refreshToken?: unknown;
};

function upstreamApiBase(): string {
  const configured =
    process.env.API_INTERNAL_URL?.trim() ||
    process.env.NEXT_PUBLIC_API_URL?.trim() ||
    process.env.NEXT_PUBLIC_API_BASE_URL?.trim() ||
    `${apiOrigin}/api`;
  return configured.replace(/\/+$/, "");
}

function joinUpstream(pathSegments: string[]): string {
  const suffix = pathSegments.map((part) => encodeURIComponent(part)).join("/");
  return `${upstreamApiBase()}/${suffix}`;
}

function isMutation(method: string): boolean {
  return ["POST", "PUT", "PATCH", "DELETE"].includes(method.toUpperCase());
}

function isAuthTokenPath(pathSegments: string[]): boolean {
  const path = pathSegments.join("/");
  return (
    path === "auth/login" ||
    path === "auth/register" ||
    path === "auth/refresh" ||
    path === "auth/logout" ||
    path === "auth/logout-all" ||
    path === "auth/invite/accept"
  );
}

/** Paths whose successful responses may rotate BFF session cookies from JSON tokens. */
function isSessionCookieUpdatePath(pathSegments: string[]): boolean {
  if (isAuthTokenPath(pathSegments)) {
    const path = pathSegments.join("/");
    return path !== "auth/logout" && path !== "auth/logout-all";
  }
  // tenants/:id/switch returns a rotated access token for the active tenant.
  return (
    pathSegments.length === 3 &&
    pathSegments[0] === "tenants" &&
    pathSegments[2] === "switch"
  );
}

function safeEqual(a: string, b: string): boolean {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  if (left.length !== right.length) {
    return false;
  }
  return timingSafeEqual(left, right);
}

function generateCsrfToken(): string {
  return randomBytes(32).toString("hex");
}

function applySessionCookies(
  response: NextResponse,
  tokens: AuthTokenPayload,
  options?: { clear?: boolean; rotateCsrf?: boolean }
): void {
  if (options?.clear) {
    response.cookies.set(ACCESS_COOKIE, "", { ...sessionCookieOptions(0), maxAge: 0 });
    response.cookies.set(REFRESH_COOKIE, "", { ...sessionCookieOptions(0), maxAge: 0 });
    response.cookies.set(CSRF_COOKIE, "", { ...csrfCookieOptions(0), maxAge: 0 });
    return;
  }

  if (typeof tokens.accessToken === "string" && tokens.accessToken.trim()) {
    response.cookies.set(ACCESS_COOKIE, tokens.accessToken, sessionCookieOptions(ACCESS_MAX_AGE));
  }
  if (typeof tokens.refreshToken === "string" && tokens.refreshToken.trim()) {
    response.cookies.set(REFRESH_COOKIE, tokens.refreshToken, sessionCookieOptions(REFRESH_MAX_AGE));
  }
  if (options?.rotateCsrf !== false) {
    response.cookies.set(CSRF_COOKIE, generateCsrfToken(), csrfCookieOptions(REFRESH_MAX_AGE));
  }
}

export async function proxyBffRequest(
  request: NextRequest,
  pathSegments: string[]
): Promise<NextResponse> {
  try {
    assertProductionRuntimeSecurity();
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Invalid runtime security configuration";
    return NextResponse.json(
      {
        success: false,
        error: {
          code: "RUNTIME_SECURITY_CONFIG",
          message
        }
      },
      { status: 500 }
    );
  }

  const method = request.method.toUpperCase();
  const requestId = request.headers.get("x-request-id")?.trim() || randomUUID();
  const session = await readSessionCookies();

  if (isMutation(method)) {
    const path = pathSegments.join("/");
    if (!isBffCsrfExempt(path)) {
      const headerToken = request.headers.get(CSRF_HEADER)?.trim() ?? "";
      const cookieToken = session.csrfToken ?? "";
      if (!headerToken || !cookieToken || !safeEqual(headerToken, cookieToken)) {
        return NextResponse.json(
          {
            success: false,
            error: {
              code: "CSRF_INVALID",
              message: "CSRF validation failed",
              requestId
            }
          },
          { status: 403, headers: { "X-Request-Id": requestId } }
        );
      }
    }
  }

  const upstreamUrl = new URL(joinUpstream(pathSegments));
  request.nextUrl.searchParams.forEach((value, key) => {
    upstreamUrl.searchParams.set(key, value);
  });

  const headers = new Headers();
  const forwardHeaders = [
    "content-type",
    "accept",
    "x-tenant-id",
    "idempotency-key",
    "stripe-signature",
    "x-requested-with"
  ];
  for (const name of forwardHeaders) {
    const value = request.headers.get(name);
    if (value) {
      headers.set(name, value);
    }
  }
  headers.set("X-Request-Id", requestId);

  if (session.accessToken) {
    headers.set("Authorization", `Bearer ${session.accessToken}`);
  } else {
    const incomingAuth = request.headers.get("authorization");
    if (incomingAuth) {
      headers.set("Authorization", incomingAuth);
    }
  }

  const path = pathSegments.join("/");
  let body: ArrayBuffer | undefined;
  if (method !== "GET" && method !== "HEAD") {
    body = await request.arrayBuffer();
  }

  if ((path === "auth/refresh" || path === "auth/logout") && session.refreshToken) {
    let parsed: Record<string, unknown> = {};
    if (body && body.byteLength > 0) {
      try {
        parsed = JSON.parse(Buffer.from(body).toString("utf8")) as Record<string, unknown>;
      } catch {
        parsed = {};
      }
    }
    if (typeof parsed.refreshToken !== "string" || !parsed.refreshToken.trim()) {
      parsed.refreshToken = session.refreshToken;
      const encoded = Buffer.from(JSON.stringify(parsed), "utf8");
      body = encoded.buffer.slice(encoded.byteOffset, encoded.byteOffset + encoded.byteLength);
      headers.set("content-type", "application/json");
    }
  }

  let upstream: Response;
  try {
    upstream = await fetch(upstreamUrl, {
      method,
      headers,
      body,
      redirect: "manual"
    });
  } catch {
    return NextResponse.json(
      {
        success: false,
        error: {
          code: "UPSTREAM_UNAVAILABLE",
          message: "Upstream API is unavailable",
          requestId
        }
      },
      { status: 502, headers: { "X-Request-Id": requestId } }
    );
  }

  const responseHeaders = new Headers();
  responseHeaders.set("X-Request-Id", upstream.headers.get("x-request-id") ?? requestId);
  const contentType = upstream.headers.get("content-type");
  if (contentType) {
    responseHeaders.set("content-type", contentType);
  }

  const rawText = await upstream.text();
  let parsedBody: unknown = null;
  if (rawText) {
    try {
      parsedBody = JSON.parse(rawText);
    } catch {
      parsedBody = null;
    }
  }

  const tokens = extractAuthTokens(parsedBody);
  const shouldSetSession = isSessionCookieUpdatePath(pathSegments) && upstream.ok;
  const shouldClearSession =
    (path === "auth/logout" || path === "auth/logout-all") && upstream.ok;

  let responseBody = rawText;
  if (shouldSetSession && parsedBody) {
    responseBody = JSON.stringify(stripAuthTokensFromBody(parsedBody));
  } else if (!parsedBody && rawText && !upstream.ok) {
    responseBody = JSON.stringify({
      success: false,
      error: {
        code: "UPSTREAM_ERROR",
        message: "Upstream request failed",
        requestId
      }
    });
    responseHeaders.set("content-type", "application/json");
  }

  const response = new NextResponse(responseBody, {
    status: upstream.status,
    headers: responseHeaders
  });

  if (shouldClearSession) {
    applySessionCookies(response, {}, { clear: true });
  } else if (shouldSetSession) {
    const rotateCsrf = !(pathSegments[0] === "tenants" && pathSegments[2] === "switch");
    applySessionCookies(response, tokens, { rotateCsrf });
  }

  return response;
}
