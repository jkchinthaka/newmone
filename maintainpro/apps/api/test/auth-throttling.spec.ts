import "reflect-metadata";

import { Controller, Get, INestApplication, Module, ValidationPipe } from "@nestjs/common";
import { APP_GUARD, NestFactory } from "@nestjs/core";
import { SkipThrottle, ThrottlerModule } from "@nestjs/throttler";
import request from "supertest";

import { Public } from "../src/common/decorators/public.decorator";
import { HttpThrottlerGuard } from "../src/common/guards/http-throttler.guard";
import { JwtAuthGuard } from "../src/common/guards/jwt-auth.guard";
import { resolveTrustedClientIp, sanitizeCanonicalClientIp } from "../src/common/security/client-ip.util";
import { AuthController } from "../src/modules/auth/auth.controller";
import { AuthService } from "../src/modules/auth/auth.service";
import { FgSsoService } from "../src/modules/auth/fg-sso.service";

const LOGIN_LIMIT = 5;
const LOGIN_TTL_MS = 60_000;
const HEALTH_TEST_LIMIT = 3;

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

const healthServiceMock = {
  getLiveness: jest.fn(() => ({ status: "ok" })),
  getPublicHealth: jest.fn(async () => ({ status: "healthy", database: { status: "healthy" } })),
  getSafeBuildInfoPayload: jest.fn(() => ({ commit: "test", version: "1.2.0" }))
};

@Controller("health")
class ThrottleHealthController {
  @Public()
  @Get()
  async health() {
    return {
      data: await healthServiceMock.getPublicHealth(),
      message: "Health check passed"
    };
  }

  @Public()
  @SkipThrottle()
  @Get("live")
  live() {
    return {
      data: healthServiceMock.getLiveness(),
      message: "Liveness check passed"
    };
  }

  @Public()
  @Get("build-info")
  buildInfo() {
    return {
      data: healthServiceMock.getSafeBuildInfoPayload(),
      message: "Build info fetched"
    };
  }
}

@Controller("build-info")
class ThrottleBuildInfoController {
  @Public()
  @Get()
  getBuildInfo() {
    return {
      data: healthServiceMock.getSafeBuildInfoPayload(),
      message: "Build info fetched"
    };
  }
}

function buildThrottleModule(defaultLimit: number) {
  @Module({
    imports: [
      ThrottlerModule.forRoot({
        getTracker: (req) => resolveTrustedClientIp(req),
        throttlers: [{ name: "default", ttl: LOGIN_TTL_MS, limit: defaultLimit }]
      })
    ],
    controllers: [AuthController, ThrottleHealthController, ThrottleBuildInfoController],
    providers: [
      {
        provide: AuthService,
        useValue: authServiceMock
      },
      {
        provide: FgSsoService,
        useValue: { createAssertion: jest.fn() }
      },
      {
        provide: APP_GUARD,
        useClass: HttpThrottlerGuard
      },
      {
        provide: APP_GUARD,
        useClass: JwtAuthGuard
      }
    ]
  })
  class ThrottleHttpTestModule {}

  return ThrottleHttpTestModule;
}

describe("MP-002: auth throttling enforcement", () => {
  let app: INestApplication;

  beforeAll(async () => {
    app = await NestFactory.create(buildThrottleModule(100), { logger: false });
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
    authServiceMock.login.mockResolvedValue({
      data: { accessToken: "test-access", user: { id: "u1", email: "user@example.com" } },
      message: "Login successful"
    });
  });

  async function postLogin(clientIp: string) {
    return request(app.getHttpServer())
      .post("/auth/login")
      .set("X-Real-IP", clientIp)
      .send({ email: "user@example.com", password: "password123" });
  }

  it("returns normal login responses below the configured @Throttle limit", async () => {
    for (let i = 0; i < LOGIN_LIMIT; i += 1) {
      const response = await postLogin("203.0.113.10");
      expect(response.status).toBe(200);
      expect(response.body.data.accessToken).toBe("test-access");
    }
    expect(authServiceMock.login).toHaveBeenCalledTimes(LOGIN_LIMIT);
  });

  it("returns HTTP 429 after exceeding the configured login throttle limit", async () => {
    const clientIp = "203.0.113.20";
    for (let i = 0; i < LOGIN_LIMIT; i += 1) {
      const ok = await postLogin(clientIp);
      expect(ok.status).toBe(200);
    }

    const blocked = await postLogin(clientIp);
    expect(blocked.status).toBe(429);
    expect(authServiceMock.login).toHaveBeenCalledTimes(LOGIN_LIMIT);
  });

  it("does not throttle a different client identity when another client is limited", async () => {
    const throttledIp = "203.0.113.30";
    const otherIp = "203.0.113.31";

    for (let i = 0; i < LOGIN_LIMIT; i += 1) {
      const ok = await postLogin(throttledIp);
      expect(ok.status).toBe(200);
    }
    const blocked = await postLogin(throttledIp);
    expect(blocked.status).toBe(429);

    const otherClient = await postLogin(otherIp);
    expect(otherClient.status).toBe(200);
    expect(otherClient.body.data.accessToken).toBe("test-access");
  });

  it("keeps public login authentication behavior working under the throttle guard", async () => {
    authServiceMock.login.mockResolvedValueOnce({
      data: { accessToken: "auth-ok", user: { id: "u2", email: "ok@example.com" } },
      message: "Login successful"
    });

    const response = await postLogin("203.0.113.40");
    expect(response.status).toBe(200);
    expect(response.body.data.accessToken).toBe("auth-ok");
    expect(authServiceMock.login).toHaveBeenCalledWith({
      email: "user@example.com",
      password: "password123"
    });
  });

  it("enforces throttling at HTTP/guard level (not decorator metadata alone)", async () => {
    const clientIp = "203.0.113.50";
    for (let i = 0; i < LOGIN_LIMIT; i += 1) {
      const ok = await postLogin(clientIp);
      expect(ok.status).not.toBe(429);
    }
    const limited = await postLogin(clientIp);
    expect(limited.status).toBe(429);
    expect(String(limited.body.message ?? limited.text)).toMatch(/ThrottlerException|Too Many Requests/i);
  });
});

describe("MP-002: resolveTrustedClientIp", () => {
  it("honors X-Real-IP only when the peer looks like a private proxy hop", () => {
    expect(
      resolveTrustedClientIp({
        headers: { "x-real-ip": "203.0.113.9" },
        socket: { remoteAddress: "10.0.0.2" }
      })
    ).toBe("203.0.113.9");

    expect(
      resolveTrustedClientIp({
        headers: { "x-real-ip": "203.0.113.9" },
        socket: { remoteAddress: "198.51.100.1" }
      })
    ).toBe("198.51.100.1");
  });

  it("rejects multi-value / forged X-Real-IP headers", () => {
    expect(
      resolveTrustedClientIp({
        headers: { "x-real-ip": "203.0.113.1, 198.51.100.2" },
        socket: { remoteAddress: "10.0.0.2" }
      })
    ).toBe("10.0.0.2");
  });

  it("falls back deterministically for direct internal peers without X-Real-IP", () => {
    expect(
      resolveTrustedClientIp({
        headers: {},
        socket: { remoteAddress: "10.0.0.5" }
      })
    ).toBe("10.0.0.5");
  });
});

describe("MP-002: sanitizeCanonicalClientIp (node:net isIP)", () => {
  it("accepts valid IPv4 and IPv6 literals", () => {
    expect(sanitizeCanonicalClientIp("203.0.113.9")).toBe("203.0.113.9");
    expect(sanitizeCanonicalClientIp("127.0.0.1")).toBe("127.0.0.1");
    expect(sanitizeCanonicalClientIp("2001:db8::1")).toBe("2001:db8::1");
    expect(sanitizeCanonicalClientIp("::1")).toBe("::1");
    expect(sanitizeCanonicalClientIp("::ffff:203.0.113.9")).toBe("203.0.113.9");
  });

  it("rejects malformed and multi-value IP strings", () => {
    expect(sanitizeCanonicalClientIp("::::")).toBeNull();
    expect(sanitizeCanonicalClientIp("dead:beef:")).toBeNull();
    expect(sanitizeCanonicalClientIp("1.2.3")).toBeNull();
    expect(sanitizeCanonicalClientIp("203.0.113.1, 198.51.100.2")).toBeNull();
    expect(sanitizeCanonicalClientIp("not-an-ip")).toBeNull();
    expect(sanitizeCanonicalClientIp("")).toBeNull();
  });
});

describe("MP-002: health/build-info throttle exemptions", () => {
  let app: INestApplication;

  beforeAll(async () => {
    app = await NestFactory.create(buildThrottleModule(HEALTH_TEST_LIMIT), { logger: false });
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it("keeps /health/live operational beyond the default throttle budget", async () => {
    for (let i = 0; i < HEALTH_TEST_LIMIT + 5; i += 1) {
      const res = await request(app.getHttpServer())
        .get("/health/live")
        .set("X-Real-IP", "203.0.113.80");
      expect(res.status).toBe(200);
    }
  });

  it("applies default throttling to legacy /health and /build-info", async () => {
    const healthIp = "203.0.113.81";
    for (let i = 0; i < HEALTH_TEST_LIMIT; i += 1) {
      const ok = await request(app.getHttpServer()).get("/health").set("X-Real-IP", healthIp);
      expect(ok.status).toBe(200);
    }
    const healthBlocked = await request(app.getHttpServer())
      .get("/health")
      .set("X-Real-IP", healthIp);
    expect(healthBlocked.status).toBe(429);

    const buildIp = "203.0.113.82";
    for (let i = 0; i < HEALTH_TEST_LIMIT; i += 1) {
      const ok = await request(app.getHttpServer()).get("/build-info").set("X-Real-IP", buildIp);
      expect(ok.status).toBe(200);
    }
    const buildBlocked = await request(app.getHttpServer())
      .get("/build-info")
      .set("X-Real-IP", buildIp);
    expect(buildBlocked.status).toBe(429);
  });
});

describe("MP-002: HttpThrottlerGuard skips non-HTTP contexts", () => {
  it("shouldSkip returns true for WebSocket execution contexts", async () => {
    const guard = Object.create(HttpThrottlerGuard.prototype) as HttpThrottlerGuard;
    const wsContext = {
      getType: () => "ws"
    } as unknown as import("@nestjs/common").ExecutionContext;

    await expect(
      (guard as unknown as { shouldSkip: (c: unknown) => Promise<boolean> }).shouldSkip(wsContext)
    ).resolves.toBe(true);
  });
});
