import {
  ForbiddenException,
  ServiceUnavailableException,
  UnauthorizedException
} from "@nestjs/common";
import { RoleName } from "@prisma/client";
import { createHmac } from "node:crypto";

import { FgSsoService } from "../src/modules/auth/fg-sso.service";
import { FG_PERMISSION_KEYS } from "../src/modules/auth/fg-sso.constants";

const SSO_SECRET = "unit-test-fg-sso-signing-secret-min-32-chars";

function b64url(input: Buffer | string): string {
  const buf = Buffer.isBuffer(input) ? input : Buffer.from(input);
  return buf.toString("base64url");
}

function forgeHs256(payload: Record<string, unknown>, secret: string): string {
  const header = b64url(JSON.stringify({ alg: "HS256", typ: "JWT" }));
  const body = b64url(JSON.stringify(payload));
  const data = `${header}.${body}`;
  const sig = createHmac("sha256", secret).update(data).digest("base64url");
  return `${data}.${sig}`;
}

const buildUser = (overrides: Record<string, unknown> = {}) => ({
  id: "507f1f77bcf86cd799439011",
  email: "admin@example.com",
  firstName: "Ada",
  lastName: "Lovelace",
  tenantId: "tenant-1",
  isActive: true,
  lockedUntil: null,
  role: {
    name: RoleName.ADMIN,
    permissions: [{ key: "fg.access" }, { key: "fg.recording.view" }]
  },
  ...overrides
});

describe("FgSsoService", () => {
  const buildService = (user: ReturnType<typeof buildUser> | null = buildUser()) => {
    const prisma = {
      user: {
        findUnique: jest.fn().mockResolvedValue(user)
      }
    };
    const jwtService = {
      signAsync: jest.fn(async (payload: Record<string, unknown>, opts: { secret: string }) => {
        return forgeHs256(payload, opts.secret);
      }),
      verifyAsync: jest.fn(async (token: string, opts: { secret: string; issuer: string; audience: string }) => {
        const [headerB64, payloadB64, sig] = token.split(".");
        const expected = createHmac("sha256", opts.secret)
          .update(`${headerB64}.${payloadB64}`)
          .digest("base64url");
        if (sig !== expected) {
          throw new Error("bad signature");
        }
        const payload = JSON.parse(Buffer.from(payloadB64, "base64url").toString("utf8"));
        if (payload.iss !== opts.issuer) throw new Error("bad iss");
        if (payload.aud !== opts.audience) throw new Error("bad aud");
        if (payload.exp < Math.floor(Date.now() / 1000)) throw new Error("expired");
        return payload;
      })
    };
    const config = {
      get: jest.fn((key: string) => {
        if (key === "FG_SSO_SIGNING_SECRET") return SSO_SECRET;
        if (key === "FG_SSO_ISSUER") return "maintainpro";
        if (key === "FG_SSO_AUDIENCE") return "fg-digital-recording";
        if (key === "FG_SSO_TTL_SECONDS") return 60;
        return undefined;
      })
    };
    return {
      service: new FgSsoService(prisma as any, jwtService as any, config as any),
      prisma,
      jwtService
    };
  };

  it("mints a short-lived assertion for users with fg.access", async () => {
    const { service, jwtService } = buildService();
    const result = await service.exchangeForUser("507f1f77bcf86cd799439011");
    expect(result.assertion.split(".")).toHaveLength(3);
    expect(result.expiresIn).toBe(60);
    expect(jwtService.signAsync).toHaveBeenCalled();
    const payload = jwtService.signAsync.mock.calls[0][0];
    expect(payload.sub).toBe("507f1f77bcf86cd799439011");
    expect(payload.permissions).toContain("fg.access");
    expect(payload.iss).toBe("maintainpro");
    expect(payload.aud).toBe("fg-digital-recording");
  });

  it("grants all FG permissions to SUPER_ADMIN", async () => {
    const { service, jwtService } = buildService(
      buildUser({
        role: { name: RoleName.SUPER_ADMIN, permissions: [] }
      })
    );
    await service.exchangeForUser("507f1f77bcf86cd799439011");
    const payload = jwtService.signAsync.mock.calls[0][0];
    expect(payload.permissions).toEqual([...FG_PERMISSION_KEYS]);
  });

  it("denies users without fg.access", async () => {
    const { service } = buildService(
      buildUser({
        role: { name: RoleName.VIEWER, permissions: [{ key: "dashboard.view" }] }
      })
    );
    await expect(service.exchangeForUser("507f1f77bcf86cd799439011")).rejects.toBeInstanceOf(
      ForbiddenException
    );
  });

  it("denies inactive users", async () => {
    const { service } = buildService(buildUser({ isActive: false }));
    await expect(service.exchangeForUser("507f1f77bcf86cd799439011")).rejects.toBeInstanceOf(
      UnauthorizedException
    );
  });

  it("denies locked users", async () => {
    const { service } = buildService(
      buildUser({ lockedUntil: new Date(Date.now() + 60_000) })
    );
    await expect(service.exchangeForUser("507f1f77bcf86cd799439011")).rejects.toBeInstanceOf(
      UnauthorizedException
    );
  });

  it("fails closed when FG_SSO_SIGNING_SECRET is missing", async () => {
    const prisma = { user: { findUnique: jest.fn() } };
    const jwtService = { signAsync: jest.fn(), verifyAsync: jest.fn() };
    const config = { get: jest.fn(() => "") };
    const service = new FgSsoService(prisma as any, jwtService as any, config as any);
    await expect(service.exchangeForUser("u1")).rejects.toBeInstanceOf(ServiceUnavailableException);
  });

  it("rejects invalid signature on verify", async () => {
    const { service } = buildService();
    const now = Math.floor(Date.now() / 1000);
    const bad = forgeHs256(
      {
        iss: "maintainpro",
        aud: "fg-digital-recording",
        sub: "507f1f77bcf86cd799439011",
        email: "admin@example.com",
        permissions: ["fg.access"],
        jti: "jti-1",
        iat: now,
        exp: now + 60
      },
      "wrong-secret-wrong-secret-wrong-secret!!"
    );
    await expect(service.verifyAssertion(bad)).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it("rejects wrong issuer", async () => {
    const { service } = buildService();
    const now = Math.floor(Date.now() / 1000);
    const token = forgeHs256(
      {
        iss: "evil-issuer",
        aud: "fg-digital-recording",
        sub: "507f1f77bcf86cd799439011",
        email: "admin@example.com",
        permissions: ["fg.access"],
        jti: "jti-2",
        iat: now,
        exp: now + 60
      },
      SSO_SECRET
    );
    await expect(service.verifyAssertion(token)).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it("rejects wrong audience", async () => {
    const { service } = buildService();
    const now = Math.floor(Date.now() / 1000);
    const token = forgeHs256(
      {
        iss: "maintainpro",
        aud: "other-audience",
        sub: "507f1f77bcf86cd799439011",
        email: "admin@example.com",
        permissions: ["fg.access"],
        jti: "jti-3",
        iat: now,
        exp: now + 60
      },
      SSO_SECRET
    );
    await expect(service.verifyAssertion(token)).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it("rejects expired assertion", async () => {
    const { service } = buildService();
    const now = Math.floor(Date.now() / 1000);
    const token = forgeHs256(
      {
        iss: "maintainpro",
        aud: "fg-digital-recording",
        sub: "507f1f77bcf86cd799439011",
        email: "admin@example.com",
        permissions: ["fg.access"],
        jti: "jti-4",
        iat: now - 120,
        exp: now - 30
      },
      SSO_SECRET
    );
    await expect(service.verifyAssertion(token)).rejects.toBeInstanceOf(UnauthorizedException);
  });
});
