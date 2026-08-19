/**
 * BFF → API client-IP throttle propagation (mocked upstream). Does not contact production.
 * Excluded from api tsconfig rootDir (imports apps/web), same pattern as bff-backend-route.spec.ts.
 */
import "reflect-metadata";

import { INestApplication, Module, ValidationPipe } from "@nestjs/common";
import { APP_GUARD, NestFactory } from "@nestjs/core";
import { ThrottlerModule } from "@nestjs/throttler";
import { NextRequest } from "next/server";
import request from "supertest";

jest.mock("next/headers", () => ({
  cookies: jest.fn(async () => ({
    get: () => undefined
  }))
}));

import { HttpThrottlerGuard } from "../src/common/guards/http-throttler.guard";
import { JwtAuthGuard } from "../src/common/guards/jwt-auth.guard";
import {
  resolveTrustedClientIp,
  sanitizeCanonicalClientIp
} from "../src/common/security/client-ip.util";
import { AuthController } from "../src/modules/auth/auth.controller";
import { AuthService } from "../src/modules/auth/auth.service";
import { FgSsoService } from "../src/modules/auth/fg-sso.service";
import {
  applyCanonicalClientIpHeader,
  sanitizeCanonicalClientIp as sanitizeBffCanonicalClientIp
} from "../../web/lib/canonical-client-ip";
import { proxyBffRequest } from "../../web/lib/bff-proxy";

const LOGIN_LIMIT = 5;
const LOGIN_TTL_MS = 60_000;

const authServiceMock = {
  login: jest.fn(),
  register: jest.fn(),
  refresh: jest.fn(),
  logout: jest.fn(),
  logoutAll: jest.fn(),
  forgotPassword: jest.fn(),
  resetPassword: jest.fn(),
  verifyInvite: jest.fn(),
  acceptInvite: jest.fn(),
  me: jest.fn()
};

@Module({
  imports: [
    ThrottlerModule.forRoot({
      getTracker: (req) => resolveTrustedClientIp(req),
      throttlers: [{ name: "default", ttl: LOGIN_TTL_MS, limit: 100 }]
    })
  ],
  controllers: [AuthController],
  providers: [
    { provide: AuthService, useValue: authServiceMock },
    { provide: FgSsoService, useValue: { createAssertion: jest.fn() } },
    { provide: APP_GUARD, useClass: HttpThrottlerGuard },
    { provide: APP_GUARD, useClass: JwtAuthGuard }
  ]
})
class BffThrottleHttpTestModule {}

describe("MP-002: BFF client-IP propagation + throttle identity", () => {
  let app: INestApplication;
  const originalFetch = global.fetch;
  const originalEnv = { ...process.env };

  beforeAll(async () => {
    app = await NestFactory.create(BffThrottleHttpTestModule, { logger: false });
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        transform: true,
        forbidNonWhitelisted: true
      })
    );
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(() => {
    jest.clearAllMocks();
    process.env = {
      ...originalEnv,
      NODE_ENV: "development",
      API_INTERNAL_URL: "http://api-upstream.test/api"
    };
    delete process.env.COOKIE_SECURE;
    delete process.env.ALLOW_INSECURE_HTTP;
    delete process.env.E2E_TEST_MODE;

    authServiceMock.login.mockResolvedValue({
      data: { accessToken: "bff-access", user: { id: "u1", email: "user@example.com" } },
      message: "Login successful"
    });
  });

  afterEach(() => {
    global.fetch = originalFetch;
    process.env = { ...originalEnv };
  });

  async function loginViaBffPath(nginxClientIp: string | null) {
    const captured: { xRealIp: string | null } = { xRealIp: null };

    global.fetch = jest.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
      const headers = new Headers(init?.headers);
      captured.xRealIp = headers.get("x-real-ip");

      const apiResponse = await request(app.getHttpServer())
        .post("/auth/login")
        .set(captured.xRealIp ? { "X-Real-IP": captured.xRealIp } : {})
        .send({ email: "user@example.com", password: "password123" });

      return new Response(JSON.stringify(apiResponse.body), {
        status: apiResponse.status,
        headers: { "content-type": "application/json" }
      });
    }) as typeof fetch;

    const bffRequest = new NextRequest("http://localhost/api/backend/auth/login", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        ...(nginxClientIp ? { "x-real-ip": nginxClientIp } : {})
      },
      body: JSON.stringify({ email: "user@example.com", password: "password123" })
    });

    const bffResponse = await proxyBffRequest(bffRequest, ["auth", "login"]);
    return { bffResponse, captured };
  }

  it("propagates Nginx canonical X-Real-IP from BFF to API", async () => {
    const { bffResponse, captured } = await loginViaBffPath("203.0.113.60");
    expect(captured.xRealIp).toBe("203.0.113.60");
    expect(bffResponse.status).toBe(200);

    const headers = new Headers();
    const applied = applyCanonicalClientIpHeader(headers, "203.0.113.61");
    expect(applied).toBe("203.0.113.61");
    expect(headers.get("X-Real-IP")).toBe("203.0.113.61");
  });

  it("maps two BFF client IPs to two throttle identities (one limited, one allowed)", async () => {
    const throttled = "203.0.113.70";
    const other = "203.0.113.71";

    for (let i = 0; i < LOGIN_LIMIT; i += 1) {
      const { bffResponse } = await loginViaBffPath(throttled);
      expect(bffResponse.status).toBe(200);
    }
    const blocked = await loginViaBffPath(throttled);
    expect(blocked.bffResponse.status).toBe(429);
    expect(blocked.captured.xRealIp).toBe(throttled);

    const second = await loginViaBffPath(other);
    expect(second.captured.xRealIp).toBe(other);
    expect(second.bffResponse.status).toBe(200);
  });

  it("rejects invalid/multi-value spoofed IP as canonical tracker input", async () => {
    expect(sanitizeBffCanonicalClientIp("203.0.113.1, 198.51.100.2")).toBeNull();
    expect(sanitizeCanonicalClientIp("203.0.113.1, 198.51.100.2")).toBeNull();
    expect(sanitizeBffCanonicalClientIp("not-an-ip")).toBeNull();
    expect(sanitizeBffCanonicalClientIp("::::")).toBeNull();
    expect(sanitizeBffCanonicalClientIp("dead:beef:")).toBeNull();
    expect(sanitizeBffCanonicalClientIp("1.2.3")).toBeNull();
    expect(sanitizeBffCanonicalClientIp("203.0.113.9")).toBe("203.0.113.9");
    expect(sanitizeBffCanonicalClientIp("2001:db8::1")).toBe("2001:db8::1");

    const headers = new Headers();
    expect(applyCanonicalClientIpHeader(headers, "1.2.3.4, 5.6.7.8")).toBeNull();
    expect(headers.has("X-Real-IP")).toBe(false);

    const { captured, bffResponse } = await loginViaBffPath("203.0.113.1, 198.51.100.2");
    expect(captured.xRealIp).toBeNull();
    expect(bffResponse.status).toBe(200);
  });

  it("falls back deterministically when BFF omits invalid X-Real-IP", async () => {
    expect(
      resolveTrustedClientIp({
        headers: {},
        socket: { remoteAddress: "10.0.0.5" }
      })
    ).toBe("10.0.0.5");

    const { captured } = await loginViaBffPath(null);
    expect(captured.xRealIp).toBeNull();
  });
});
