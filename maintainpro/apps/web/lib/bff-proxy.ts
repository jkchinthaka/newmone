import { randomBytes, randomUUID, timingSafeEqual } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";

import {
  extractAuthTokens,
  isBffCsrfExempt,
  stripAuthTokensFromBody
} from "./bff-auth";
import {
  joinUpstreamPath,
  resolveBffUpstreamApiBase,
  sanitizeRequestId
} from "./bff-upstream-url";
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
import { applyCanonicalClientIpHeader } from "./canonical-client-ip";

const ACCESS_MAX_AGE = 15 * 60;
const REFRESH_MAX_AGE = 7 * 24 * 60 * 60;

type AuthTokenPayload = {
  accessToken?: unknown;
  refreshToken?: unknown;
};

function resolveRequestId(incoming: string | null): string {
  return sanitizeRequestId(incoming) || randomUUID();
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

function classifyUpstreamFetchError(error: unknown): {
  status: number;
  code: string;
  category: string;
} {
  const message = error instanceof Error ? error.message : String(error || "");
  const name = error instanceof Error ? error.name : "";
  const lowered = message.toLowerCase();
  if (
    name === "TimeoutError" ||
    name === "AbortError" ||
    lowered.includes("timeout") ||
    lowered.includes("aborted")
  ) {
    return { status: 504, code: "UPSTREAM_TIMEOUT", category: "timeout" };
  }
  if (
    lowered.includes("econnrefused") ||
    lowered.includes("enotfound") ||
    lowered.includes("eai_again") ||
    lowered.includes("econnreset") ||
    lowered.includes("fetch failed") ||
    lowered.includes("network") ||
    lowered.includes("socket")
  ) {
    return { status: 502, code: "UPSTREAM_UNAVAILABLE", category: "connectivity" };
  }
  if (name === "BffUpstreamUrlError" || lowered.includes("upstream url") || lowered.includes("api_internal_url")) {
    return { status: 500, code: "UPSTREAM_CONFIG", category: "configuration" };
  }
  return { status: 502, code: "UPSTREAM_UNAVAILABLE", category: "connectivity" };
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
  const requestId = resolveRequestId(request.headers.get("x-request-id"));
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

  let upstreamBase: string;
  try {
    upstreamBase = resolveBffUpstreamApiBase(process.env).base;
  } catch (error) {
    const classified = classifyUpstreamFetchError(error);
    return NextResponse.json(
      {
        success: false,
        error: {
          code: classified.code,
          message: "Upstream API configuration is invalid",
          requestId
        }
      },
      { status: classified.status, headers: { "X-Request-Id": requestId } }
    );
  }

  const upstreamUrl = new URL(joinUpstreamPath(upstreamBase, pathSegments));
  request.nextUrl.searchParams.forEach((value, key) => {
    upstreamUrl.searchParams.set(key, value);
  });

  // Forward only safe application headers. Never forward hop-by-hop headers
  // (host, connection, content-length, transfer-encoding, etc.).
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

  // Preserve Nginx canonical client IP for API throttling (single validated IP only).
  applyCanonicalClientIpHeader(headers, request.headers.get("x-real-ip"));

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
      redirect: "manual",
      signal: AbortSignal.timeout(60_000)
    });
  } catch (error) {
    const classified = classifyUpstreamFetchError(error);
    // Safe server-side category only — never log bodies, tokens, or Authorization.
    console.error(
      `[bff] upstream_fetch_failed category=${classified.category} code=${classified.code} requestId=${requestId}`
    );
    return NextResponse.json(
      {
        success: false,
        error: {
          code: classified.code,
          message:
            classified.status === 504
              ? "Upstream API request timed out"
              : "Upstream API is unavailable",
          requestId
        }
      },
      { status: classified.status, headers: { "X-Request-Id": requestId } }
    );
  }

  const responseHeaders = new Headers();
  responseHeaders.set("X-Request-Id", sanitizeRequestId(upstream.headers.get("x-request-id")) || requestId);
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

  // Preserve upstream status for all responses, including 4xx.
  // Only rewrite non-JSON error bodies; never convert a valid 401/403 into 502.
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
  } else if (!parsedBody && !rawText && !upstream.ok) {
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

  const response = new NextResponse(responseBody || null, {
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