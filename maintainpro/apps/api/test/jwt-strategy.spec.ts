import { UnauthorizedException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { RoleName } from "@prisma/client";

import { JwtStrategy } from "../src/modules/auth/jwt.strategy";

describe("JwtStrategy validate()", () => {
  const payload = {
    sub: "user-1",
    email: "user@example.com",
    role: RoleName.TECHNICIAN,
    tenantId: "tenant-a"
  };

  const configService = {
    get: jest.fn().mockReturnValue("test-secret")
  } as unknown as ConfigService;

  const buildStrategy = (findUnique: jest.Mock) => {
    const prisma = { user: { findUnique } } as any;
    return new JwtStrategy(configService, prisma);
  };

  it("returns the current database role for an active user", async () => {
    const findUnique = jest.fn().mockResolvedValue({
      isActive: true,
      tenantId: "tenant-a",
      role: { name: RoleName.TECHNICIAN }
    });
    const strategy = buildStrategy(findUnique);

    await expect(strategy.validate(payload)).resolves.toEqual({ ...payload, mustChangePassword: false });
    expect(findUnique).toHaveBeenCalledWith({
      where: { id: payload.sub },
      select: {
        isActive: true,
        lockedUntil: true,
        tenantId: true,
        mustChangePassword: true,
        sessionVersion: true,
        role: { select: { name: true } }
      }
    });
  });

  it("replaces a stale SUPER_ADMIN claim with the current database role", async () => {
    const findUnique = jest.fn().mockResolvedValue({
      isActive: true,
      tenantId: "tenant-a",
      role: { name: RoleName.TECHNICIAN }
    });
    const strategy = buildStrategy(findUnique);

    await expect(
      strategy.validate({ ...payload, role: RoleName.SUPER_ADMIN })
    ).resolves.toEqual({ ...payload, role: RoleName.TECHNICIAN, tenantId: "tenant-a", mustChangePassword: false });
  });

  it("rejects when the user is deactivated", async () => {
    const findUnique = jest.fn().mockResolvedValue({ isActive: false });
    const strategy = buildStrategy(findUnique);

    await expect(strategy.validate(payload)).rejects.toThrow(UnauthorizedException);
  });

  it("rejects when the user no longer exists", async () => {
    const findUnique = jest.fn().mockResolvedValue(null);
    const strategy = buildStrategy(findUnique);

    await expect(strategy.validate(payload)).rejects.toThrow(UnauthorizedException);
  });

  it("rejects an access token minted before the session version was bumped", async () => {
    const findUnique = jest.fn().mockResolvedValue({
      isActive: true,
      tenantId: "tenant-a",
      sessionVersion: 3,
      role: { name: RoleName.TECHNICIAN }
    });
    const strategy = buildStrategy(findUnique);

    await expect(strategy.validate({ ...payload, sv: 2 })).rejects.toThrow(/revoked/);
    await expect(strategy.validate(payload)).rejects.toThrow(UnauthorizedException);
    await expect(strategy.validate({ ...payload, sv: 3 })).resolves.toMatchObject({ sub: "user-1" });
  });

  it("keeps the per-session tenant claim and exposes mustChangePassword from the database", async () => {
    const findUnique = jest.fn().mockResolvedValue({
      isActive: true,
      tenantId: "tenant-home",
      mustChangePassword: true,
      sessionVersion: 0,
      role: { name: RoleName.TECHNICIAN }
    });
    const strategy = buildStrategy(findUnique);

    await expect(
      strategy.validate({ ...payload, tenantId: "tenant-b", mustChangePassword: false })
    ).resolves.toMatchObject({ tenantId: "tenant-b", mustChangePassword: true });
    await expect(strategy.validate({ ...payload, tenantId: null })).resolves.toMatchObject({
      tenantId: "tenant-home"
    });
  });
});
