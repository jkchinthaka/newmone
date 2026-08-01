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
    // Unit tests use a mock upstream host; do not apply Docker E2E host hard-checks.
    delete process.env.E2E_TEST_MODE;
  });

  afterEach(() => {
    global.fetch = originalFetch;
    process.env = { ...originalEnv };
  });

  it("AUTH-STATUS-006/007/008: BFF preserves 200, sets cookies, strips tokens", async () => {
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
    expect(response.status).not.toBe(201);
    const json = (await response.json()) as { data: Record<string, unknown> };
    expect(json.data.accessToken).toBeUndefined();
    expect(json.data.refreshToken).toBeUndefined();
    const joined = (response.headers.getSetCookie?.() ?? []).join("\n");
    expect(joined).toMatch(/maintainpro_access=/);
    expect(joined).toMatch(/maintainpro_refresh=/);
    expect(joined).toMatch(/maintainpro_csrf=/);
  });

  it("AUTH-STATUS-009: BFF preserves upstream 401 without session cookies", async () => {
    global.fetch = jest.fn(async () =>
      new Response(JSON.stringify({ success: false, message: "Invalid email or password" }), {
        status: 401,
        headers: { "content-type": "application/json" }
      })
    ) as unknown as typeof fetch;

    const response = await proxyBffRequest(
      requestFor("POST", ["auth", "login"], { body: { email: "a@b.c", password: "x" } }),
      ["auth", "login"]
    );
    expect(response.status).toBe(401);
    const joined = (response.headers.getSetCookie?.() ?? []).join("\n");
    expect(joined).not.toMatch(/maintainpro_access=[^;]+/);
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
  })

  it("COOKIE-CLOSE-001/008: BFF login sets canonical cookies and strips tokens from JSON", async () => {
    global.fetch = jest.fn(async () =>
      new Response(
        JSON.stringify({
          data: {
            user: { id: "u1" },
            accessToken: "access-token-value",
            refreshToken: "refresh-token-value"
          },
          message: "ok"
        }),
        { status: 200, headers: { "content-type": "application/json" } }
      )
    ) as unknown as typeof fetch;

    const response = await proxyBffRequest(
      requestFor("POST", ["auth", "login"], { body: { email: "a@b.c", password: "x" } }),
      ["auth", "login"]
    );
    const json = (await response.json()) as { data: Record<string, unknown> };
    expect(json.data.accessToken).toBeUndefined();
    expect(json.data.refreshToken).toBeUndefined();
    const joined = (response.headers.getSetCookie?.() ?? []).join("\n");
    expect(joined).toMatch(/maintainpro_access=/);
    expect(joined).toMatch(/maintainpro_refresh=/);
    expect(joined).toMatch(/maintainpro_csrf=/);
    expect(joined).toMatch(/HttpOnly/i);
    expect(joined).toMatch(/SameSite=lax/i);
    expect(joined.match(/maintainpro_access=/g)?.length).toBe(1);
    expect(joined.match(/maintainpro_refresh=/g)?.length).toBe(1);
  });

  it("COOKIE-CLOSE-003: HTTP compatibility mode cookies are Lax and not Secure", async () => {
    process.env.NODE_ENV = "production";
    process.env.COOKIE_SECURE = "false";
    process.env.ALLOW_INSECURE_HTTP = "true";
    process.env.FRONTEND_URL = "http://example.invalid";
    process.env.NEXT_PUBLIC_API_ORIGIN = "http://example.invalid";
    process.env.CORS_ORIGIN = "http://example.invalid";

    global.fetch = jest.fn(async () =>
      new Response(
        JSON.stringify({ data: { accessToken: "a", refreshToken: "r", user: {} }, message: "ok" }),
        { status: 200, headers: { "content-type": "application/json" } }
      )
    ) as unknown as typeof fetch;

    const response = await proxyBffRequest(
      requestFor("POST", ["auth", "login"], { body: {} }),
      ["auth", "login"]
    );
    const joined = (response.headers.getSetCookie?.() ?? []).join("\n");
    expect(joined).toMatch(/SameSite=lax/i);
    expect(joined).not.toMatch(/; Secure/i);
  });

  it("COOKIE-CLOSE-004: secure production cookies are Lax and Secure", async () => {
    process.env.NODE_ENV = "production";
    process.env.COOKIE_SECURE = "true";
    process.env.ALLOW_INSECURE_HTTP = "false";
    process.env.FRONTEND_URL = "https://example.invalid";
    process.env.NEXT_PUBLIC_API_ORIGIN = "https://example.invalid";
    process.env.CORS_ORIGIN = "https://example.invalid";

    global.fetch = jest.fn(async () =>
      new Response(
        JSON.stringify({ data: { accessToken: "a", refreshToken: "r", user: {} }, message: "ok" }),
        { status: 200, headers: { "content-type": "application/json" } }
      )
    ) as unknown as typeof fetch;

    const response = await proxyBffRequest(
      requestFor("POST", ["auth", "login"], { body: {} }),
      ["auth", "login"]
    );
    const joined = (response.headers.getSetCookie?.() ?? []).join("\n");
    expect(joined).toMatch(/SameSite=lax/i);
    expect(joined).toMatch(/Secure/i);
  });

  it("updates access cookie on tenant switch and strips accessToken from body", async () => {
    setSessionCookies({ access: "old", csrf: "csrf" });
    global.fetch = jest.fn(async () =>
      new Response(
        JSON.stringify({
          data: { accessToken: "new-tenant-access", activeTenant: { id: "t2" } },
          message: "Tenant switched"
        }),
        { status: 200, headers: { "content-type": "application/json" } }
      )
    ) as unknown as typeof fetch;

    const response = await proxyBffRequest(
      requestFor("POST", ["tenants", "t2", "switch"], {
        body: {},
        headers: { "x-csrf-token": "csrf" }
      }),
      ["tenants", "t2", "switch"]
    );
    expect(response.status).toBe(200);
    const json = (await response.json()) as { data: Record<string, unknown> };
    expect(json.data.accessToken).toBeUndefined();
    const joined = (response.headers.getSetCookie?.() ?? []).join("\n");
    expect(joined).toMatch(/maintainpro_access=new-tenant-access/);
  });

  it("BFF-502-008: upstream 400 remains 400", async () => {
    global.fetch = jest.fn(async () =>
      new Response(JSON.stringify({ success: false, error: { code: "VALIDATION_ERROR" } }), {
        status: 400,
        headers: { "content-type": "application/json", "x-request-id": "up-400" }
      })
    ) as unknown as typeof fetch;

    const response = await proxyBffRequest(
      requestFor("POST", ["auth", "login"], { body: { email: "bad", password: "x" } }),
      ["auth", "login"]
    );
    expect(response.status).toBe(400);
    expect(response.headers.get("x-request-id")).toBe("up-400");
  });

  it("BFF-502-009: upstream 401 remains 401 and does not set session cookies", async () => {
    global.fetch = jest.fn(async () =>
      new Response(JSON.stringify({ success: false, error: { message: "Invalid email or password" } }), {
        status: 401,
        headers: { "content-type": "application/json" }
      })
    ) as unknown as typeof fetch;

    const response = await proxyBffRequest(
      requestFor("POST", ["auth", "login"], { body: { email: "a@b.c", password: "wrong" } }),
      ["auth", "login"]
    );
    expect(response.status).toBe(401);
    const joined = (response.headers.getSetCookie?.() ?? []).join("\n");
    expect(joined).not.toMatch(/maintainpro_access=/);
  });

  it("BFF-502-010: upstream 403 remains 403", async () => {
    setSessionCookies({ access: "a", csrf: "csrf" });
    global.fetch = jest.fn(async () =>
      new Response(JSON.stringify({ success: false, error: { code: "FORBIDDEN" } }), {
        status: 403,
        headers: { "content-type": "application/json" }
      })
    ) as unknown as typeof fetch;

    const response = await proxyBffRequest(
      requestFor("POST", ["work-orders"], {
        body: { title: "x" },
        headers: { "x-csrf-token": "csrf" }
      }),
      ["work-orders"]
    );
    expect(response.status).toBe(403);
  });

  it("BFF-502-011: upstream 409 remains 409", async () => {
    setSessionCookies({ access: "a", csrf: "csrf" });
    global.fetch = jest.fn(async () =>
      new Response(JSON.stringify({ success: false, error: { code: "CONFLICT" } }), {
        status: 409,
        headers: { "content-type": "application/json" }
      })
    ) as unknown as typeof fetch;

    const response = await proxyBffRequest(
      requestFor("POST", ["work-orders"], {
        body: { title: "x" },
        headers: { "x-csrf-token": "csrf" }
      }),
      ["work-orders"]
    );
    expect(response.status).toBe(409);
  });

  it("BFF-502-012: connection refusal maps to controlled 502", async () => {
    global.fetch = jest.fn(async () => {
      throw new Error("fetch failed: ECONNREFUSED");
    }) as unknown as typeof fetch;

    const response = await proxyBffRequest(
      requestFor("POST", ["auth", "login"], { body: { email: "a@b.c", password: "x" } }),
      ["auth", "login"]
    );
    expect(response.status).toBe(502);
    const json = (await response.json()) as { error: { code: string; requestId: string; message: string } };
    expect(json.error.code).toBe("UPSTREAM_UNAVAILABLE");
    expect(json.error.requestId).toBeTruthy();
    expect(JSON.stringify(json)).not.toContain("api:3000");
    expect(JSON.stringify(json)).not.toContain("ECONNREFUSED");
  });

  it("BFF-502-014: malformed upstream 401 body stays 401 (not 502)", async () => {
    global.fetch = jest.fn(async () =>
      new Response("not-json-but-unauthorized", {
        status: 401,
        headers: { "content-type": "text/plain" }
      })
    ) as unknown as typeof fetch;

    const response = await proxyBffRequest(
      requestFor("POST", ["auth", "login"], { body: { email: "a@b.c", password: "x" } }),
      ["auth", "login"]
    );
    expect(response.status).toBe(401);
    expect(response.status).not.toBe(502);
  });

  it("BFF-502-005/006: does not forward content-length or hop-by-hop headers", async () => {
    let captured: Headers | undefined;
    global.fetch = jest.fn(async (_url, init) => {
      captured = init?.headers as Headers;
      return new Response(JSON.stringify({ success: false }), {
        status: 401,
        headers: { "content-type": "application/json" }
      });
    }) as unknown as typeof fetch;

    await proxyBffRequest(
      requestFor("POST", ["auth", "login"], {
        body: { email: "a@b.c", password: "x" },
        headers: {
          "content-length": "9999",
          connection: "keep-alive",
          host: "evil.example"
        }
      }),
      ["auth", "login"]
    );
    expect(captured?.get("content-length")).toBeNull();
    expect(captured?.get("connection")).toBeNull();
    expect(captured?.get("host")).toBeNull();
    expect(captured?.get("content-type")).toMatch(/application\/json/i);
    expect(captured?.get("x-request-id")).toBeTruthy();
  });

  it("BFF-502-013: timeout maps to controlled 504", async () => {
    global.fetch = jest.fn(async () => {
      const err = new Error("The operation was aborted due to timeout");
      err.name = "TimeoutError";
      throw err;
    }) as unknown as typeof fetch;

    const response = await proxyBffRequest(
      requestFor("POST", ["auth", "login"], { body: { email: "a@b.c", password: "x" } }),
      ["auth", "login"]
    );
    expect(response.status).toBe(504);
    const json = (await response.json()) as { error: { code: string; requestId: string } };
    expect(json.error.code).toBe("UPSTREAM_TIMEOUT");
    expect(json.error.requestId).toBeTruthy();
  });

  it("BFF-502-015: request id is forwarded and returned safely", async () => {
    let captured: Headers | undefined;
    global.fetch = jest.fn(async (_url, init) => {
      captured = init?.headers as Headers;
      return new Response(JSON.stringify({ success: false, message: "Invalid email or password" }), {
        status: 401,
        headers: { "content-type": "application/json", "x-request-id": "upstream-id-1" }
      });
    }) as unknown as typeof fetch;

    const response = await proxyBffRequest(
      requestFor("POST", ["auth", "login"], {
        body: { email: "a@b.c", password: "x" },
        headers: { "x-request-id": "client-req-id-abc" }
      }),
      ["auth", "login"]
    );
    expect(response.status).toBe(401);
    expect(captured?.get("x-request-id")).toBe("client-req-id-abc");
    expect(response.headers.get("x-request-id")).toBeTruthy();
  });

  it("BFF-502-003: missing API_INTERNAL_URL fails closed", async () => {
    delete process.env.API_INTERNAL_URL;
    const response = await proxyBffRequest(
      requestFor("POST", ["auth", "login"], { body: { email: "a@b.c", password: "x" } }),
      ["auth", "login"]
    );
    expect([500, 502]).toContain(response.status);
    const json = (await response.json()) as { error: { code: string } };
    expect(["UPSTREAM_CONFIG", "UPSTREAM_UNAVAILABLE"]).toContain(json.error.code);
  });
});
