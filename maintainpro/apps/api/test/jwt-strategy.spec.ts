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

  it("returns the payload for an active user", async () => {
    const findUnique = jest.fn().mockResolvedValue({ isActive: true });
    const strategy = buildStrategy(findUnique);

    await expect(strategy.validate(payload)).resolves.toEqual(payload);
    expect(findUnique).toHaveBeenCalledWith({ where: { id: payload.sub }, select: { isActive: true } });
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
});
