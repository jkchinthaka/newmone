import {
  BadGatewayException,
  BadRequestException,
  ConflictException,
  ForbiddenException,
  GatewayTimeoutException,
  ServiceUnavailableException,
  UnauthorizedException
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { createHash } from "crypto";
import { RoleName } from "@prisma/client";

import { FgDjangoClient, FgUpstreamAuthError } from "../src/modules/mobile-fg/fg-django-client";
import { MemoryFgSessionStore } from "../src/modules/mobile-fg/fg-session-store";
import { CL30_FORM_CODE, MobileFgService } from "../src/modules/mobile-fg/mobile-fg.service";
import type { JwtPayload } from "../src/modules/auth/auth.types";

const INTERNAL_URL = "http://127.0.0.1:18080";

function sha32(token: string): string {
  return createHash("sha256").update(token).digest("hex").slice(0, 32);
}

function mockResponse(init: {
  status?: number;
  json?: unknown;
  setCookie?: string[];
}): Response {
  const headers = new Headers();
  const cookies = init.setCookie ?? [];
  if (cookies.length === 1) {
    headers.set("set-cookie", cookies[0]);
  }
  const bodyText = init.json === undefined ? "" : JSON.stringify(init.json);
  const response = new Response(bodyText, {
    status: init.status ?? 200,
    headers
  });
  if (cookies.length > 1) {
    (response.headers as Headers & { getSetCookie: () => string[] }).getSetCookie = () => cookies;
  } else if (cookies.length === 1) {
    (response.headers as Headers & { getSetCookie: () => string[] }).getSetCookie = () => cookies;
  }
  return response;
}

describe("MobileFgService / FgDjangoClient", () => {
  const user: JwtPayload = {
    sub: "user-1",
    email: "u@example.com",
    role: RoleName.ADMIN,
    tenantId: "tenant-1",
    permissions: ["fg.access"]
  };

  let store: MemoryFgSessionStore;
  let fgSso: { exchangeForUser: jest.Mock };
  let prisma: { auditLog: { create: jest.Mock } };
  let config: { get: jest.Mock };
  let client: FgDjangoClient;
  let service: MobileFgService;
  let fetchMock: jest.Mock;

  const reqFor = (accessToken: string, actor: JwtPayload = user) => ({
    user: actor,
    headers: { authorization: `Bearer ${accessToken}` }
  });

  beforeEach(() => {
    store = new MemoryFgSessionStore(1800);
    fgSso = {
      exchangeForUser: jest.fn().mockResolvedValue({
        assertion: "assertion.jwt.token",
        expiresIn: 60,
        jti: "jti-1"
      })
    };
    prisma = { auditLog: { create: jest.fn().mockResolvedValue({}) } };
    config = {
      get: jest.fn((key: string, fallback?: unknown) => {
        if (key === "FG_API_INTERNAL_URL") return INTERNAL_URL;
        if (key === "FG_MOBILE_SESSION_TTL_SECONDS") return 1800;
        if (key === "NODE_ENV") return "test";
        if (key === "REDIS_URL") return "";
        return fallback;
      })
    };
    client = new FgDjangoClient(config as unknown as ConfigService);
    service = new MobileFgService(
      fgSso as any,
      client,
      store,
      prisma as any,
      config as unknown as ConfigService
    );
    fetchMock = jest.fn();
    global.fetch = fetchMock as unknown as typeof fetch;
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("ensureSession throws without JWT user context", async () => {
    await expect(
      service.ensureSession({} as JwtPayload, "abc")
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it("missing FG_API_INTERNAL_URL → ServiceUnavailable", async () => {
    config.get.mockImplementation((key: string, fallback?: unknown) => {
      if (key === "FG_API_INTERNAL_URL") return "";
      return fallback;
    });
    await expect(client.bootstrapSession("assertion")).rejects.toBeInstanceOf(
      ServiceUnavailableException
    );
  });

  it("bootstrap success parses set-cookie + csrfToken", async () => {
    fetchMock.mockResolvedValue(
      mockResponse({
        status: 200,
        setCookie: [
          "fg_sessionid=sess-value; Path=/; HttpOnly",
          "csrftoken=csrf-cookie; Path=/"
        ],
        json: {
          data: {
            csrfToken: "csrf-from-json",
            actor: { id: "user-1", email: "u@example.com" },
            authenticated: true
          }
        }
      })
    );

    const result = await client.bootstrapSession("assertion.jwt.token");
    expect(result.session.sessionCookieValue).toBe("sess-value");
    expect(result.session.csrfCookieValue).toBe("csrf-cookie");
    expect(result.session.csrfToken).toBe("csrf-from-json");
    expect(result.actor?.email).toBe("u@example.com");
    expect(fetchMock).toHaveBeenCalledWith(
      `${INTERNAL_URL}/api/v1/session`,
      expect.objectContaining({
        method: "GET",
        headers: expect.objectContaining({
          Authorization: "Bearer assertion.jwt.token"
        })
      })
    );
  });

  it("session isolation: different fingerprints → different store keys", async () => {
    fetchMock.mockResolvedValue(
      mockResponse({
        status: 200,
        setCookie: ["fg_sessionid=s1; Path=/", "csrftoken=c1; Path=/"],
        json: { data: { csrfToken: "c1", actor: {}, authenticated: true } }
      })
    );

    const fp1 = sha32("token-a");
    const fp2 = sha32("token-b");
    expect(fp1).not.toBe(fp2);
    expect(service.sessionStoreKey("tenant-1", "user-1", fp1)).not.toBe(
      service.sessionStoreKey("tenant-1", "user-1", fp2)
    );

    await service.ensureSession(user, fp1);
    fetchMock.mockResolvedValue(
      mockResponse({
        status: 200,
        setCookie: ["fg_sessionid=s2; Path=/", "csrftoken=c2; Path=/"],
        json: { data: { csrfToken: "c2", actor: {}, authenticated: true } }
      })
    );
    await service.ensureSession(user, fp2);

    const a = await store.get(service.sessionStoreKey("tenant-1", "user-1", fp1));
    const b = await store.get(service.sessionStoreKey("tenant-1", "user-1", fp2));
    expect(a?.sessionCookieValue).toBe("s1");
    expect(b?.sessionCookieValue).toBe("s2");
  });

  it("same user two fingerprints don't share cookies", async () => {
    fetchMock
      .mockResolvedValueOnce(
        mockResponse({
          status: 200,
          setCookie: ["fg_sessionid=cookie-a; Path=/", "csrftoken=csrf-a; Path=/"],
          json: { data: { csrfToken: "csrf-a", authenticated: true } }
        })
      )
      .mockResolvedValueOnce(
        mockResponse({
          status: 200,
          setCookie: ["fg_sessionid=cookie-b; Path=/", "csrftoken=csrf-b; Path=/"],
          json: { data: { csrfToken: "csrf-b", authenticated: true } }
        })
      );

    const s1 = await service.ensureSession(user, sha32("access-1"));
    const s2 = await service.ensureSession(user, sha32("access-2"));
    expect(s1.sessionCookieValue).toBe("cookie-a");
    expect(s2.sessionCookieValue).toBe("cookie-b");
    expect(s1.csrfToken).not.toBe(s2.csrfToken);
  });

  it("vehicles calls correct URL with formCode=NMS/PPU/CL/30", async () => {
    fetchMock
      .mockResolvedValueOnce(
        mockResponse({
          status: 200,
          setCookie: ["fg_sessionid=s; Path=/", "csrftoken=c; Path=/"],
          json: { data: { csrfToken: "c", authenticated: true } }
        })
      )
      .mockResolvedValueOnce(
        mockResponse({
          status: 200,
          json: { data: [{ id: "v1" }] }
        })
      );

    await service.listCl30Vehicles(reqFor("tok-vehicles"), "bus");
    expect(fetchMock).toHaveBeenCalledTimes(2);
    const vehiclesUrl = String(fetchMock.mock.calls[1][0]);
    expect(vehiclesUrl.startsWith(`${INTERNAL_URL}/api/v1/vehicles?`)).toBe(true);
    const qs = new URL(vehiclesUrl).searchParams;
    expect(qs.get("q")).toBe("bus");
    expect(qs.get("formCode")).toBe(CL30_FORM_CODE);
  });

  it("open forces formCode and requires occurrenceToken", async () => {
    await expect(
      service.openCl30Record(reqFor("tok"), { date: "2026-01-01" })
    ).rejects.toBeInstanceOf(BadRequestException);

    fetchMock
      .mockResolvedValueOnce(
        mockResponse({
          status: 200,
          setCookie: ["fg_sessionid=s; Path=/", "csrftoken=c; Path=/"],
          json: { data: { csrfToken: "c", authenticated: true } }
        })
      )
      .mockResolvedValueOnce(
        mockResponse({
          status: 200,
          json: { data: { id: "rec-1" } }
        })
      );

    await service.openCl30Record(reqFor("tok-open"), {
      date: "2026-01-01",
      occurrenceToken: "occ-1"
    });
    const openCall = fetchMock.mock.calls[1];
    expect(String(openCall[0])).toBe(`${INTERNAL_URL}/api/v1/records/open`);
    const body = JSON.parse(openCall[1].body);
    expect(body.formCode).toBe(CL30_FORM_CODE);
    expect(body.occurrenceToken).toBe("occ-1");
  });

  it("decision rejects invalid decision enum before upstream", async () => {
    await expect(
      service.reviewDecision(reqFor("tok"), "sub-1", { decision: "MAYBE" })
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(fetchMock).not.toHaveBeenCalled();

    await expect(
      service.qaDecision(reqFor("tok"), "sub-1", { decision: "SHIP_IT" })
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("upstream 403 maps Forbidden", async () => {
    fetchMock
      .mockResolvedValueOnce(
        mockResponse({
          status: 200,
          setCookie: ["fg_sessionid=s; Path=/", "csrftoken=c; Path=/"],
          json: { data: { csrfToken: "c", authenticated: true } }
        })
      )
      .mockResolvedValueOnce(
        mockResponse({
          status: 403,
          json: { error: { code: "SELF_REVIEW_BLOCKED", message: "Cannot review own submission" } }
        })
      );

    await expect(service.getReview(reqFor("tok-403"), "sub-1")).rejects.toBeInstanceOf(
      ForbiddenException
    );
  });

  it("upstream 409 maps Conflict", async () => {
    fetchMock
      .mockResolvedValueOnce(
        mockResponse({
          status: 200,
          setCookie: ["fg_sessionid=s; Path=/", "csrftoken=c; Path=/"],
          json: { data: { csrfToken: "c", authenticated: true } }
        })
      )
      .mockResolvedValueOnce(
        mockResponse({
          status: 409,
          json: { error: { code: "IMMUTABLE", message: "Record locked" } }
        })
      );

    await expect(
      service.saveCl30Record(reqFor("tok-409"), "rec-1", { fields: {}, expectedDraftVersion: 1 })
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it("upstream 500 maps BadGateway", async () => {
    fetchMock
      .mockResolvedValueOnce(
        mockResponse({
          status: 200,
          setCookie: ["fg_sessionid=s; Path=/", "csrftoken=c; Path=/"],
          json: { data: { csrfToken: "c", authenticated: true } }
        })
      )
      .mockResolvedValueOnce(
        mockResponse({
          status: 500,
          json: { error: { code: "SERVER", message: "boom" } }
        })
      );

    await expect(service.listReviews(reqFor("tok-500"))).rejects.toBeInstanceOf(
      BadGatewayException
    );
  });

  it("timeout maps GatewayTimeout", async () => {
    const timeoutErr = new Error("The operation was aborted due to timeout");
    timeoutErr.name = "TimeoutError";
    fetchMock.mockRejectedValue(timeoutErr);

    await expect(client.bootstrapSession("assertion")).rejects.toBeInstanceOf(
      GatewayTimeoutException
    );
  });

  it("error responses do not include assertion/cookie/csrf strings", async () => {
    fetchMock.mockResolvedValue(
      mockResponse({
        status: 403,
        json: {
          error: {
            code: "FORBIDDEN",
            message: "denied Bearer assertion.jwt.token fg_sessionid=secret csrftoken=tok"
          }
        }
      })
    );

    try {
      await client.bootstrapSession("assertion.jwt.token");
      throw new Error("expected throw");
    } catch (err) {
      if (err instanceof Error && err.message === "expected throw") throw err;
      expect(err).toBeInstanceOf(ForbiddenException);
      const payload = (err as ForbiddenException).getResponse();
      const text = JSON.stringify(payload);
      expect(text).not.toContain("assertion.jwt.token");
      expect(text).not.toMatch(/fg_sessionid=secret/i);
      expect(text).not.toMatch(/csrftoken=tok/i);
      expect(text).not.toContain("Bearer ");
    }
  });

  it("path traversal / absolute URL in client.request throws", async () => {
    const session = {
      tenantId: "t",
      userId: "u",
      accessTokenFingerprint: "f",
      sessionCookieName: "fg_sessionid",
      sessionCookieValue: "s",
      csrfCookieName: "csrftoken",
      csrfCookieValue: "c",
      csrfToken: "c",
      expiresAtMs: Date.now() + 60_000,
      createdAtMs: Date.now(),
      refreshedAtMs: Date.now()
    };

    await expect(client.request(session, "GET", "https://evil.example/api/v1/x")).rejects.toBeInstanceOf(
      BadRequestException
    );
    await expect(client.request(session, "GET", "/api/v1/../admin")).rejects.toBeInstanceOf(
      BadRequestException
    );
    await expect(client.request(session, "GET", "/api/v2/vehicles")).rejects.toBeInstanceOf(
      BadRequestException
    );
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("FgUpstreamAuthError triggers single rebootstrap + retry", async () => {
    fetchMock
      // initial bootstrap
      .mockResolvedValueOnce(
        mockResponse({
          status: 200,
          setCookie: ["fg_sessionid=s1; Path=/", "csrftoken=c1; Path=/"],
          json: { data: { csrfToken: "c1", authenticated: true } }
        })
      )
      // first vehicles call → unauthenticated
      .mockResolvedValueOnce(
        mockResponse({
          status: 401,
          json: { error: { code: "UNAUTHENTICATED", message: "expired" } }
        })
      )
      // rebootstrap
      .mockResolvedValueOnce(
        mockResponse({
          status: 200,
          setCookie: ["fg_sessionid=s2; Path=/", "csrftoken=c2; Path=/"],
          json: { data: { csrfToken: "c2", authenticated: true } }
        })
      )
      // retry vehicles
      .mockResolvedValueOnce(
        mockResponse({
          status: 200,
          json: { data: [] }
        })
      );

    const result = await service.listCl30Vehicles(reqFor("tok-retry"));
    expect(result.data).toEqual([]);
    expect(fgSso.exchangeForUser).toHaveBeenCalledTimes(2);
    expect(fetchMock).toHaveBeenCalledTimes(4);
  });

  it("resolveFingerprint uses Authorization header only", () => {
    const fp = service.resolveFingerprint(reqFor("unique-access-token"));
    expect(fp).toBe(sha32("unique-access-token"));
    expect(() => service.resolveFingerprint({ user, headers: {} })).toThrow(
      UnauthorizedException
    );
  });
});

describe("FgUpstreamAuthError", () => {
  it("is distinguishable", () => {
    const err = new FgUpstreamAuthError();
    expect(err.name).toBe("FgUpstreamAuthError");
  });
});
