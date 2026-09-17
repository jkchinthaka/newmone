import * as bcrypt from "bcryptjs";
import * as jwt from "jsonwebtoken";
import { RoleName } from "@prisma/client";

import { AuthService } from "../src/modules/auth/auth.service";
import { PERMISSION_CATALOG } from "../src/database/permission-catalog";

/**
 * Regression test for the browser cookie-size bug: JWTs embedding the full
 * permissions array grew past the ~4096-byte per-cookie limit for
 * highly-privileged roles, causing browsers to silently drop the
 * Set-Cookie header (login "succeeded" but the session cookie never landed,
 * so /auth/me came back 401 and refresh came back 400).
 *
 * SUPER_ADMIN is seeded with the entire PERMISSION_CATALOG (see
 * apps/api/src/database/seed.ts), so it is the worst-case role for JWT size.
 */

// Each auth cookie value plus its name/attributes must stay comfortably
// below the browser's 4096-byte hard limit.
const SAFE_COOKIE_VALUE_BYTES = 3800;

const ACCESS_SECRET = "cookie-size-test-access-secret-value";
const REFRESH_SECRET = "cookie-size-test-refresh-secret-value";

function buildRealJwtService() {
  return {
    signAsync: (payload: Record<string, unknown>, options: { secret: string; expiresIn?: string }) => {
      const signOptions: jwt.SignOptions = options.expiresIn
        ? { expiresIn: options.expiresIn as jwt.SignOptions["expiresIn"] }
        : {};
      return Promise.resolve(jwt.sign(payload, options.secret, signOptions));
    },
    verifyAsync: <T>(token: string, options: { secret: string }) =>
      Promise.resolve(jwt.verify(token, options.secret) as T),
    decode: (token: string) => jwt.decode(token) as { exp?: number } | null
  };
}

function buildConfigService() {
  return {
    get: jest.fn((key: string, fallback?: unknown) => {
      if (key === "JWT_ACCESS_SECRET") return ACCESS_SECRET;
      if (key === "JWT_REFRESH_SECRET") return REFRESH_SECRET;
      if (key === "JWT_ACCESS_EXPIRES") return "15m";
      if (key === "JWT_REFRESH_EXPIRES") return "7d";
      return fallback;
    })
  };
}

function buildSuperAdminUser(passwordHash: string) {
  return {
    id: "9f1c1e2a-6b3d-4a2e-8c3f-6a2b1e0d4f5a",
    email: "super.admin@maintainpro-tenant-example.com",
    passwordHash,
    isActive: true,
    failedLoginAttempts: 0,
    lockedUntil: null,
    mustChangePassword: false,
    temporaryPasswordExpiresAt: null,
    tenantId: "6f2e4c9a-1d3b-4a7e-9c2f-8b1a3d5e7f60",
    lastLogin: null,
    linkedWorkforceEmployees: [],
    role: {
      name: RoleName.SUPER_ADMIN,
      // Worst case: every permission key the platform defines, exactly as
      // seeded onto SUPER_ADMIN in apps/api/src/database/seed.ts.
      permissionLinks: PERMISSION_CATALOG.map((key) => ({ permission: { key } }))
    }
  };
}

describe("Auth cookie size regression (browser 4096-byte limit)", () => {
  it("keeps the SUPER_ADMIN access and refresh JWTs well under the safe cookie threshold", async () => {
    const passwordHash = await bcrypt.hash("Sup3rSecurePassw0rd!", 4);
    const user = buildSuperAdminUser(passwordHash);

    expect(PERMISSION_CATALOG.length).toBeGreaterThan(50);

    const prisma = {
      user: {
        findUnique: jest.fn().mockResolvedValue(user),
        update: jest.fn().mockResolvedValue(user)
      },
      refreshToken: {
        create: jest.fn().mockResolvedValue({})
      }
    };

    const service = new AuthService(
      prisma as any,
      buildRealJwtService() as any,
      buildConfigService() as any,
      { dispatch: jest.fn() } as any
    );

    const result = await service.login({
      email: user.email,
      password: "Sup3rSecurePassw0rd!"
    });

    const accessToken = (result.data as { accessToken: string }).accessToken;
    const refreshToken = (result.data as { refreshToken: string }).refreshToken;

    expect(typeof accessToken).toBe("string");
    expect(typeof refreshToken).toBe("string");

    const accessBytes = Buffer.byteLength(accessToken, "utf8");
    const refreshBytes = Buffer.byteLength(refreshToken, "utf8");

    expect(accessBytes).toBeLessThan(SAFE_COOKIE_VALUE_BYTES);
    expect(refreshBytes).toBeLessThan(SAFE_COOKIE_VALUE_BYTES);

    // Decoded claims must not carry the permissions array — permissions are
    // authoritative from the DB only (PermissionsGuard), never from the JWT.
    const decodedAccess = jwt.decode(accessToken) as Record<string, unknown>;
    const decodedRefresh = jwt.decode(refreshToken) as Record<string, unknown>;

    expect(decodedAccess).not.toHaveProperty("permissions");
    expect(decodedRefresh).not.toHaveProperty("permissions");
    expect(decodedAccess).toMatchObject({
      sub: user.id,
      tenantId: user.tenantId,
      role: RoleName.SUPER_ADMIN,
      email: user.email
    });
    // Refresh JWT is a strict subset: no role/email carried at all.
    expect(decodedRefresh).not.toHaveProperty("role");
    expect(decodedRefresh).not.toHaveProperty("email");
    expect(decodedRefresh).toMatchObject({
      sub: user.id,
      tenantId: user.tenantId
    });
  });

  it("does not expose accessToken/refreshToken from the login response as anything but the JSON token fields", async () => {
    const passwordHash = await bcrypt.hash("Sup3rSecurePassw0rd!", 4);
    const user = buildSuperAdminUser(passwordHash);

    const prisma = {
      user: {
        findUnique: jest.fn().mockResolvedValue(user),
        update: jest.fn().mockResolvedValue(user)
      },
      refreshToken: {
        create: jest.fn().mockResolvedValue({})
      }
    };

    const service = new AuthService(
      prisma as any,
      buildRealJwtService() as any,
      buildConfigService() as any,
      { dispatch: jest.fn() } as any
    );

    const result = await service.login({
      email: user.email,
      password: "Sup3rSecurePassw0rd!"
    });

    // user profile object embedded in the response must never itself carry
    // raw JWTs — only permissions/profile fields for the frontend.
    const userPayload = (result.data as { user: Record<string, unknown> }).user;
    expect(userPayload).not.toHaveProperty("accessToken");
    expect(userPayload).not.toHaveProperty("refreshToken");
    expect(userPayload).not.toHaveProperty("passwordHash");
  });
});
