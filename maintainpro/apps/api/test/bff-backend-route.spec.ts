/**
 * BFF route behaviour tests (mocked upstream). Does not contact production.
 * Test IDs: BFF-*, CSRF-*
 */
import { NextRequest } from "next/server";

const cookieJar = new Map<string, string>();

jest.mock("next/headers", () => ({
  cookies: jest.fn(async () => ({
    get: (name: string) => {
      const value = cookieJar.get(name);
      return value === undefined ? undefined : { name, value };
    }
  }))
}));

import { proxyBffRequest } from "../../web/lib/bff-proxy";

function setSessionCookies(input: {
  access?: string;
  refresh?: string;
  csrf?: string;
}) {
  cookieJar.clear();
  if (input.access) cookieJar.set("maintainpro_access", input.access);
  if (input.refresh) cookieJar.set("maintainpro_refresh", input.refresh);
  if (input.csrf) cookieJar.set("maintainpro_csrf", input.csrf);
}

function requestFor(
  method: string,
  pathSegments: string[],
  options?: { body?: unknown; headers?: Record<string, string> }
) {
  const url = `http://localhost/api/backend/${pathSegments.join("/")}`;
  return new NextRequest(url, {
    method,
    headers: {
      "content-type": "application/json",
      ...(options?.headers ?? {})
    },
    body: options?.body === undefined ? undefined : JSON.stringify(options.body)
  });
}

describe("BFF backend route", () => {
  const originalFetch = global.fetch;
  const originalEnv = { ...process.env };

  beforeEach(() => {
    cookieJar.clear();
    process.env = {
      ...originalEnv,
      NODE_ENV: "development",
      API_INTERNAL_URL: "http://api-upstream.test/api"
    };
    delete process.env.COOKIE_SECURE;
    delete process.env.ALLOW_INSECURE_HTTP;
  });

  afterEach(() => {
    global.fetch = originalFetch;
    process.env = { ...originalEnv };
  });

  it("BFF-001: login success sets session cookies and strips tokens from body", async () => {
    global.fetch = jest.fn(async () =>
      new Response(
        JSON.stringify({
          data: {
            user: { id: "u1", email: "admin@example.invalid" },
            accessToken: "access-token-value",
            refreshToken: "refresh-token-value"
          },
          message: "Login successful"
        }),
        { status: 200, headers: { "content-type": "application/json" } }
      )
    ) as unknown as typeof fetch;

    const response = await proxyBffRequest(
      requestFor("POST", ["auth", "login"], {
        body: { email: "admin@example.invalid", password: "x" }
      }),
      ["auth", "login"]
    );

    expect(response.status).toBe(200);
    const json = (await response.json()) as { data: Record<string, unknown> };
    expect(json.data.accessToken).toBeUndefined();
    expect(json.data.refreshToken).toBeUndefined();
    expect(json.data.user).toEqual({ id: "u1", email: "admin@example.invalid" });

    const setCookie = response.headers.getSetCookie?.() ?? [];
    const joined = setCookie.join("\n");
    expect(joined).toMatch(/maintainpro_access=/);
    expect(joined).toMatch(/maintainpro_refresh=/);
    expect(joined).toMatch(/maintainpro_csrf=/);
    expect(joined).toMatch(/HttpOnly/i);
    expect(joined).toMatch(/maintainpro_access=access-token-value/);
    // Cookie value holds the access token by design; JSON body must not expose token fields.
  });

  it("BFF-003: unauthenticated auth/me returns upstream 401", async () => {
    global.fetch = jest.fn(async () =>
      new Response(JSON.stringify({ success: false, error: { message: "Unauthorized" } }), {
        status: 401,
        headers: { "content-type": "application/json" }
      })
    ) as unknown as typeof fetch;

    const response = await proxyBffRequest(requestFor("GET", ["auth", "me"]), ["auth", "me"]);
    expect(response.status).toBe(401);
    expect(response.status).not.toBe(404);
  });

  it("BFF logout clears session cookies", async () => {
    setSessionCookies({ access: "a", refresh: "r", csrf: "c" });
    global.fetch = jest.fn(async () =>
      new Response(JSON.stringify({ data: { ok: true }, message: "Logged out" }), {
        status: 200,
        headers: { "content-type": "application/json" }
      })
    ) as unknown as typeof fetch;

    const response = await proxyBffRequest(
      requestFor("POST", ["auth", "logout"], {
        body: {},
        headers: { "x-csrf-token": "c" }
      }),
      ["auth", "logout"]
    );
    expect(response.status).toBe(200);
    const setCookie = (response.headers.getSetCookie?.() ?? []).join("\n");
    expect(setCookie).toMatch(/maintainpro_access=;/);
    expect(setCookie).toMatch(/maintainpro_refresh=;/);
    expect(setCookie).toMatch(/maintainpro_csrf=;/);
  });

  it("refresh injects HttpOnly refresh cookie into upstream body", async () => {
    setSessionCookies({ refresh: "cookie-refresh-token", csrf: "csrf-1" });
    let upstreamBody = "";
    global.fetch = jest.fn(async (_url, init) => {
      upstreamBody = Buffer.from(init?.body as ArrayBuffer).toString("utf8");
      return new Response(
        JSON.stringify({
          data: { accessToken: "new-access", refreshToken: "new-refresh" },
          message: "Refreshed"
        }),
        { status: 200, headers: { "content-type": "application/json" } }
      );
    }) as unknown as typeof fetch;

    const response = await proxyBffRequest(
      requestFor("POST", ["auth", "refresh"], {
        body: {},
        headers: { "x-csrf-token": "csrf-1" }
      }),
      ["auth", "refresh"]
    );
    expect(response.status).toBe(200);
    expect(JSON.parse(upstreamBody).refreshToken).toBe("cookie-refresh-token");
  });

  it("CSRF-001: mutation without CSRF returns 403", async () => {
    setSessionCookies({ access: "a", csrf: "expected" });
    global.fetch = jest.fn() as unknown as typeof fetch;

    const response = await proxyBffRequest(
      requestFor("POST", ["work-orders"], { body: { title: "x" } }),
      ["work-orders"]
    );
    expect(response.status).toBe(403);
    expect(global.fetch).not.toHaveBeenCalled();
    const json = (await response.json()) as { error: { code: string; requestId: string } };
    expect(json.error.code).toBe("CSRF_INVALID");
    expect(json.error.requestId).toBeTruthy();
  });

  it("CSRF-002: mutation with matching CSRF is forwarded", async () => {
    setSessionCookies({ access: "a", csrf: "matching-token" });
    global.fetch = jest.fn(async () =>
      new Response(JSON.stringify({ data: { id: "wo-1" }, message: "Created" }), {
        status: 201,
        headers: { "content-type": "application/json", "x-request-id": "req-upstream-1" }
      })
    ) as unknown as typeof fetch;

    const response = await proxyBffRequest(
      requestFor("POST", ["work-orders"], {
        body: { title: "x" },
        headers: { "x-csrf-token": "matching-token" }
      }),
      ["work-orders"]
    );
    expect(response.status).toBe(201);
    expect(global.fetch).toHaveBeenCalled();
    expect(response.headers.get("x-request-id")).toBe("req-upstream-1");
  });

  it("CSRF-003: mismatched CSRF returns 403", async () => {
    setSessionCookies({ access: "a", csrf: "cookie-token" });
    const response = await proxyBffRequest(
      requestFor("POST", ["work-orders"], {
        body: { title: "x" },
        headers: { "x-csrf-token": "header-token" }
      }),
      ["work-orders"]
    );
    expect(response.status).toBe(403);
  });

  it("upstream non-JSON error does not leak raw body secrets", async () => {
    setSessionCookies({ access: "a", csrf: "csrf" });
    global.fetch = jest.fn(async () =>
      new Response("Internal stack JWT_SECRET=super-secret-do-not-leak\nat Object.<anonymous>", {
        status: 500,
        headers: { "content-type": "text/plain" }
      })
    ) as unknown as typeof fetch;

    const response = await proxyBffRequest(
      requestFor("POST", ["work-orders"], {
        body: { title: "x" },
        headers: { "x-csrf-token": "csrf" }
      }),
      ["work-orders"]
    );
    expect(response.status).toBe(500);
    const text = await response.text();
    expect(text).not.toContain("super-secret-do-not-leak");
    expect(text).not.toContain("JWT_SECRET");
    expect(text).toContain("UPSTREAM_ERROR");
  });
});
