/**
 * BFF silent refresh (mocked upstream): concurrent sessions never share rotated tokens,
 * and the server-side refresh call carries the browser's X-Real-IP.
 * apps/web modules are required at runtime so the API tsc rootDir stays apps/api.
 */
import path from "node:path";
import { NextRequest } from "next/server";

const cookieJars: Array<Record<string, string>> = [];
jest.mock("next/headers", () => ({
  cookies: jest.fn(async () => {
    const jar = cookieJars.shift() ?? {};
    return { get: (name: string) => (jar[name] ? { value: jar[name] } : undefined) };
  })
}));

type ProxyModule = { proxyBffRequest: (request: NextRequest, pathSegments: string[]) => Promise<import("next/server").NextResponse> };
type LatchModule = { resetSilentRefreshLatchForTests: () => void };
const webLib = path.resolve(__dirname, "../../web/lib");
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { proxyBffRequest } = require(path.join(webLib, "bff-proxy.ts")) as ProxyModule;
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { resetSilentRefreshLatchForTests } = require(path.join(webLib, "bff-silent-refresh.ts")) as LatchModule;

describe("BFF silent refresh isolation", () => {
  const originalFetch = global.fetch;
  const originalEnv = { ...process.env };

  beforeEach(() => {
    resetSilentRefreshLatchForTests();
    process.env = { ...originalEnv, NODE_ENV: "development", API_INTERNAL_URL: "http://api-upstream.test/api" };
    delete process.env.COOKIE_SECURE;
    delete process.env.ALLOW_INSECURE_HTTP;
  });

  afterEach(() => {
    global.fetch = originalFetch;
    process.env = { ...originalEnv };
  });

  it("gives each session its own refreshed tokens and forwards the client IP on refresh", async () => {
    const refreshCalls: Array<{ refreshToken: string; xRealIp: string | null }> = [];
    global.fetch = jest.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      const headers = new Headers(init?.headers);
      if (url.endsWith("/auth/refresh")) {
        const { refreshToken } = JSON.parse(String(init?.body)) as { refreshToken: string };
        refreshCalls.push({ refreshToken, xRealIp: headers.get("x-real-ip") });
        await new Promise((resolve) => setTimeout(resolve, 20));
        const owner = refreshToken.replace("refresh-", "");
        return new Response(
          JSON.stringify({ success: true, data: { accessToken: `access-new-${owner}`, refreshToken: `refresh-new-${owner}` } }),
          { status: 200, headers: { "content-type": "application/json" } }
        );
      }
      const auth = headers.get("authorization") ?? "";
      if (auth.includes("access-new-")) {
        return new Response(JSON.stringify({ success: true, data: { auth } }), {
          status: 200,
          headers: { "content-type": "application/json" }
        });
      }
      return new Response(JSON.stringify({ success: false }), { status: 401, headers: { "content-type": "application/json" } });
    }) as typeof fetch;

    cookieJars.push(
      { maintainpro_access: "expired-a", maintainpro_refresh: "refresh-user-a" },
      { maintainpro_access: "expired-b", maintainpro_refresh: "refresh-user-b" }
    );

    const requestFor = (ip: string) =>
      new NextRequest("http://web.test/api/backend/work-orders", { headers: { "x-real-ip": ip } });

    const [responseA, responseB] = await Promise.all([
      proxyBffRequest(requestFor("203.0.113.10"), ["work-orders"]),
      proxyBffRequest(requestFor("203.0.113.20"), ["work-orders"])
    ]);

    expect(refreshCalls.map((call) => call.refreshToken).sort()).toEqual(["refresh-user-a", "refresh-user-b"]);
    expect(refreshCalls.find((call) => call.refreshToken === "refresh-user-a")?.xRealIp).toBe("203.0.113.10");
    expect(refreshCalls.find((call) => call.refreshToken === "refresh-user-b")?.xRealIp).toBe("203.0.113.20");

    expect(responseA.cookies.get("maintainpro_refresh")?.value).toBe("refresh-new-user-a");
    expect(responseA.cookies.get("maintainpro_access")?.value).toBe("access-new-user-a");
    expect(responseB.cookies.get("maintainpro_refresh")?.value).toBe("refresh-new-user-b");
    expect(responseB.cookies.get("maintainpro_access")?.value).toBe("access-new-user-b");
  });
});
