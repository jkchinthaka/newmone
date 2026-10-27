import { ForbiddenException, UnauthorizedException } from "@nestjs/common";
import { RoleName } from "@prisma/client";
import * as bcrypt from "bcryptjs";
import { plainToInstance } from "class-transformer";
import { validate } from "class-validator";

import { AuthService } from "../src/modules/auth/auth.service";
import { AuthController } from "../src/modules/auth/auth.controller";
import {
  ALLOW_PENDING_PASSWORD_CHANGE_KEY,
  PasswordChangeRequiredGuard
} from "../src/common/guards/password-change-required.guard";
import { IS_PUBLIC_KEY } from "../src/common/decorators/public.decorator";
import { normalizeDecimals } from "../src/common/interceptors/response.interceptor";
import { resolveListenHost } from "../src/config/listen-host";
import { PERMISSION_CATALOG } from "../src/database/permission-catalog";
import { ChangePasswordDto } from "../src/modules/settings/dto/change-password.dto";
import { UpdateProfileDto } from "../src/modules/settings/dto/update-profile.dto";
import { SettingsController } from "../src/modules/settings/settings.controller";
import { SettingsService } from "../src/modules/settings/settings.service";
import { Prisma } from "@prisma/client";

const configService = {
  get: jest.fn((key: string, fallback?: unknown) => {
    if (key === "JWT_ACCESS_EXPIRES") return "15m";
    if (key === "JWT_REFRESH_EXPIRES") return "7d";
    return fallback;
  })
};

const jwtService = () => ({
  signAsync: jest.fn(async (payload: unknown) => JSON.stringify(payload)),
  verifyAsync: jest.fn(),
  decode: jest.fn(() => ({ exp: Math.floor(Date.now() / 1000) + 3600 }))
});

// The raw CommonJS export (the `import * as` namespace object is not spy-able).
// eslint-disable-next-line @typescript-eslint/no-require-imports
const bcryptModule = require("bcryptjs") as typeof bcrypt;

const role = { name: RoleName.TECHNICIAN, permissionLinks: [] };

function authService(prisma: Record<string, unknown>, jwt = jwtService()) {
  return { service: new AuthService(prisma as any, jwt as any, configService as any, { dispatch: jest.fn() } as any), jwt };
}

describe("login enumeration hardening", () => {
  afterEach(() => jest.restoreAllMocks());

  it("runs a bcrypt compare for unknown accounts (timing parity)", async () => {
    const compare = jest.spyOn(bcryptModule, "compare");
    const prisma = { user: { findUnique: jest.fn().mockResolvedValue(null), update: jest.fn() } };
    const { service } = authService(prisma);

    await expect(service.login({ email: "ghost@example.com", password: "Whatever1!" })).rejects.toThrow(
      "Invalid email or password"
    );
    expect(compare).toHaveBeenCalledTimes(1);
  });

  it("runs a bcrypt compare for inactive accounts", async () => {
    const compare = jest.spyOn(bcryptModule, "compare");
    const prisma = {
      user: { findUnique: jest.fn().mockResolvedValue({ id: "u1", isActive: false, role }), update: jest.fn() }
    };
    const { service } = authService(prisma);

    await expect(service.login({ email: "off@example.com", password: "Whatever1!" })).rejects.toThrow(
      "Invalid email or password"
    );
    expect(compare).toHaveBeenCalledTimes(1);
  });

  it("does not reveal temporary-password expiry to a wrong password", async () => {
    const passwordHash = await bcrypt.hash("TempPass1!", 4);
    const user = {
      id: "u1",
      email: "temp@example.com",
      isActive: true,
      failedLoginAttempts: 0,
      lockedUntil: null,
      passwordHash,
      mustChangePassword: true,
      temporaryPasswordExpiresAt: new Date(Date.now() - 1000),
      tenantId: "t1",
      role
    };
    const prisma = {
      user: { findUnique: jest.fn().mockResolvedValue(user), update: jest.fn() },
      refreshToken: { create: jest.fn() }
    };
    const { service } = authService(prisma);

    await expect(service.login({ email: user.email, password: "Wrong1!aa" })).rejects.toThrow(
      "Invalid email or password"
    );
    await expect(service.login({ email: user.email, password: "TempPass1!" })).rejects.toThrow(
      /Temporary password expired/
    );
  });

  it("embeds the session version in both issued tokens", async () => {
    const passwordHash = await bcrypt.hash("GoodPass1!", 4);
    const prisma = {
      user: {
        findUnique: jest.fn().mockResolvedValue({
          id: "u1",
          email: "u@example.com",
          isActive: true,
          failedLoginAttempts: 0,
          lockedUntil: null,
          passwordHash,
          sessionVersion: 4,
          tenantId: "t1",
          role
        }),
        update: jest.fn()
      },
      refreshToken: { create: jest.fn() }
    };
    const { service, jwt } = authService(prisma);

    await service.login({ email: "u@example.com", password: "GoodPass1!" });
    expect(jwt.signAsync.mock.calls[0][0]).toMatchObject({ sub: "u1", sv: 4 });
    expect(jwt.signAsync.mock.calls[1][0]).toMatchObject({ sub: "u1", sv: 4 });
  });
});

describe("session version on refresh and reset", () => {
  it("rejects a refresh token older than the user's session version and revokes its family", async () => {
    const prisma = {
      refreshToken: {
        findUnique: jest.fn().mockResolvedValue({
          tokenHash: "h",
          familyId: "fam-1",
          userId: "u1",
          expiresAt: new Date(Date.now() + 60_000),
          revokedAt: null
        }),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
        create: jest.fn()
      },
      user: {
        findUnique: jest.fn().mockResolvedValue({ id: "u1", isActive: true, sessionVersion: 2, role })
      }
    };
    const jwt = jwtService();
    jwt.verifyAsync.mockResolvedValue({ sub: "u1", sv: 1 });
    const { service } = authService(prisma, jwt);

    await expect(service.refresh({ refreshToken: "old" })).rejects.toThrow(UnauthorizedException);
    expect(prisma.refreshToken.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { familyId: "fam-1", revokedAt: null } })
    );
    expect(prisma.refreshToken.create).not.toHaveBeenCalled();
  });

  it("password reset clears the temporary-password flags and bumps the session version", async () => {
    const tx = {
      user: { update: jest.fn() },
      passwordResetToken: { update: jest.fn() },
      refreshToken: { updateMany: jest.fn() },
      auditLog: { create: jest.fn() }
    };
    const prisma = {
      passwordResetToken: {
        findUnique: jest.fn().mockResolvedValue({
          id: "prt",
          userId: "u1",
          usedAt: null,
          expiresAt: new Date(Date.now() + 60_000)
        })
      },
      $transaction: jest.fn(async (fn: (t: typeof tx) => Promise<void>) => fn(tx))
    };
    const { service } = authService(prisma);

    await service.resetPassword({ token: "t", newPassword: "NewPass1!" });
    expect(tx.user.update).toHaveBeenCalledWith({
      where: { id: "u1" },
      data: expect.objectContaining({
        mustChangePassword: false,
        temporaryPasswordExpiresAt: null,
        lastPasswordChangedAt: expect.any(Date),
        sessionVersion: { increment: 1 }
      })
    });
    expect(tx.refreshToken.updateMany).toHaveBeenCalled();
  });
});

describe("PasswordChangeRequiredGuard", () => {
  const context = (user: unknown) =>
    ({
      getHandler: () => ({}),
      getClass: () => ({}),
      switchToHttp: () => ({ getRequest: () => ({ user }) })
    }) as never;
  const guard = (meta: Record<string, boolean> = {}) =>
    new PasswordChangeRequiredGuard({ getAllAndOverride: jest.fn((key: string) => meta[key]) } as never);

  it("returns 403 PASSWORD_CHANGE_REQUIRED for a pending account", () => {
    try {
      guard().canActivate(context({ sub: "u1", mustChangePassword: true }));
      throw new Error("expected rejection");
    } catch (error) {
      expect(error).toBeInstanceOf(ForbiddenException);
      expect((error as ForbiddenException).getResponse()).toMatchObject({ code: "PASSWORD_CHANGE_REQUIRED" });
    }
  });

  it("allows exempt routes, public routes and accounts without a pending change", () => {
    expect(guard({ [ALLOW_PENDING_PASSWORD_CHANGE_KEY]: true }).canActivate(context({ mustChangePassword: true }))).toBe(true);
    expect(guard({ [IS_PUBLIC_KEY]: true }).canActivate(context(undefined))).toBe(true);
    expect(guard().canActivate(context({ sub: "u1", mustChangePassword: false }))).toBe(true);
  });

  it("exempts only auth/me, auth/logout and the password change route", () => {
    const allowed = (target: object, name: string) =>
      Reflect.getMetadata(ALLOW_PENDING_PASSWORD_CHANGE_KEY, (target as Record<string, object>)[name]) === true;
    expect(allowed(AuthController.prototype, "me")).toBe(true);
    expect(allowed(AuthController.prototype, "logout")).toBe(true);
    expect(allowed(SettingsController.prototype, "changePassword")).toBe(true);
    expect(allowed(AuthController.prototype, "logoutAll")).toBe(false);
    expect(allowed(SettingsController.prototype, "updateProfile")).toBe(false);
  });
});

describe("self-service credential changes", () => {
  async function buildSettings(user: Record<string, unknown>) {
    const tx = { user: { update: jest.fn() }, refreshToken: { updateMany: jest.fn() } };
    const prisma = {
      user: {
        findUnique: jest.fn().mockResolvedValue(user),
        findFirst: jest.fn().mockResolvedValue(null),
        update: jest.fn()
      },
      auditLog: { create: jest.fn() },
      $transaction: jest.fn(async (fn: (t: typeof tx) => Promise<void>) => fn(tx))
    };
    const auth = { issueSessionTokens: jest.fn().mockResolvedValue({ accessToken: "a2", refreshToken: "r2" }) };
    return { service: new SettingsService(prisma as any, auth as any), prisma, tx, auth };
  }

  const baseUser = async () => ({
    id: "u1",
    email: "me@example.com",
    firstName: "A",
    lastName: "B",
    phone: null,
    tenantId: "t1",
    isActive: true,
    passwordHash: await bcrypt.hash("OldPass1!", 4),
    mustChangePassword: true,
    role: { name: RoleName.TECHNICIAN }
  });

  it("changePassword verifies the current password, clears temp flags, revokes other sessions and re-issues tokens", async () => {
    const { service, tx, auth } = await buildSettings(await baseUser());

    await expect(
      service.changePassword("u1", { currentPassword: "nope", newPassword: "NewPass1!" }, "t1")
    ).rejects.toThrow(ForbiddenException);

    const result = await service.changePassword("u1", { currentPassword: "OldPass1!", newPassword: "NewPass1!" }, "t1");
    expect(tx.user.update).toHaveBeenCalledWith({
      where: { id: "u1" },
      data: expect.objectContaining({
        mustChangePassword: false,
        temporaryPasswordExpiresAt: null,
        lastPasswordChangedAt: expect.any(Date),
        sessionVersion: { increment: 1 }
      })
    });
    expect(tx.refreshToken.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { userId: "u1", revokedAt: null } })
    );
    expect(auth.issueSessionTokens).toHaveBeenCalledWith("u1", "t1");
    expect(result).toMatchObject({ changed: true, accessToken: "a2", refreshToken: "r2" });
  });

  it("changing the email requires the current password and revokes other sessions", async () => {
    const { service, tx, prisma } = await buildSettings(await baseUser());

    await expect(service.updateProfile("u1", { email: "new@example.com" })).rejects.toThrow(/Current password is required/);
    await expect(
      service.updateProfile("u1", { email: "new@example.com", currentPassword: "bad" })
    ).rejects.toThrow(ForbiddenException);

    await service.updateProfile("u1", { email: "new@example.com", currentPassword: "OldPass1!" });
    expect(tx.user.update).toHaveBeenCalledWith({
      where: { id: "u1" },
      data: expect.objectContaining({ email: "new@example.com", sessionVersion: { increment: 1 } })
    });

    // Unchanged email + name edit is not a credential change.
    tx.user.update.mockClear();
    await service.updateProfile("u1", { email: "ME@example.com", firstName: "Z" });
    expect(tx.user.update).not.toHaveBeenCalled();
    expect(prisma.user.update).toHaveBeenCalledWith({ where: { id: "u1" }, data: { firstName: "Z" } });
  });

  it("DTOs enforce the reset-password strength rule", async () => {
    const weak = await validate(plainToInstance(ChangePasswordDto, { currentPassword: "x", newPassword: "password" }));
    expect(weak.map((e) => e.property)).toContain("newPassword");
    const strong = await validate(plainToInstance(ChangePasswordDto, { currentPassword: "x", newPassword: "Str0ng!pw" }));
    expect(strong).toEqual([]);
    const profile = await validate(plainToInstance(UpdateProfileDto, { newPassword: "short" }));
    expect(profile.map((e) => e.property)).toContain("newPassword");
  });
});

describe("refresh throttle, listen host, decimals, permission catalog", () => {
  it("allows 30 refreshes per minute per client IP", () => {
    const handler = AuthController.prototype.refresh;
    expect(Reflect.getMetadata("THROTTLER:LIMITdefault", handler)).toBe(30);
  });

  it("binds to loopback in production unless HOST is set", () => {
    expect(resolveListenHost({ NODE_ENV: "production" } as NodeJS.ProcessEnv)).toBe("127.0.0.1");
    expect(resolveListenHost({ NODE_ENV: "production", HOST: "0.0.0.0" } as NodeJS.ProcessEnv)).toBe("0.0.0.0");
    expect(resolveListenHost({ NODE_ENV: "development" } as NodeJS.ProcessEnv)).toBe("0.0.0.0");
  });

  it("converts Prisma Decimals to numbers recursively and leaves dates alone", () => {
    const createdAt = new Date("2026-01-01T00:00:00Z");
    const out = normalizeDecimals({
      items: [{ unitCost: new Prisma.Decimal("12.50"), qty: 2, createdAt, nested: { total: new Prisma.Decimal("25") } }],
      label: "x",
      none: null
    }) as { items: Array<Record<string, unknown>>; label: string; none: null };

    expect(out.items[0].unitCost).toBe(12.5);
    expect(out.items[0].qty).toBe(2);
    expect(out.items[0].createdAt).toBe(createdAt);
    expect((out.items[0].nested as { total: unknown }).total).toBe(25);
    expect(out.label).toBe("x");
    expect(out.none).toBeNull();
    expect(JSON.parse(JSON.stringify(out)).items[0].unitCost).toBe(12.5);
  });

  it("defines assets.view in the permission catalog", () => {
    expect(PERMISSION_CATALOG).toContain("assets.view");
  });
});

describe("People temporary-password reset", () => {
  it("revokes refresh tokens and bumps the session version", async () => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { PeopleService } = require("../src/modules/people/people.service");
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { requestContext } = require("../src/common/context/request-context");
    const prisma = {
      user: {
        findFirst: jest.fn().mockResolvedValue({ id: "u1", firstName: "A", lastName: "B", linkedWorkforceEmployees: [] }),
        update: jest.fn()
      },
      refreshToken: { updateMany: jest.fn() },
      auditLog: { create: jest.fn() }
    };
    const invitations = { isEmailConfigured: jest.fn(() => false) };
    const service = new PeopleService(prisma as never, invitations as never);

    await requestContext.run({ actorId: "admin-1", actorRole: RoleName.ADMIN, tenantId: "t1" }, () =>
      service.resetPassword("u1")
    );
    expect(prisma.user.update).toHaveBeenCalledWith({
      where: { id: "u1" },
      data: expect.objectContaining({ mustChangePassword: true, sessionVersion: { increment: 1 } })
    });
    expect(prisma.refreshToken.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { userId: "u1", revokedAt: null } })
    );
  });
});
