import { UnauthorizedException } from "@nestjs/common";
import * as bcrypt from "bcryptjs";
import { RoleName } from "@prisma/client";

import { AuthService } from "../src/modules/auth/auth.service";

const buildPrisma = () => ({
  user: {
    findUnique: jest.fn(),
    update: jest.fn()
  },
  refreshToken: {
    create: jest.fn()
  }
});

const buildJwtService = () => ({
  signAsync: jest
    .fn()
    .mockResolvedValueOnce("access-token")
    .mockResolvedValueOnce("refresh-token"),
  verifyAsync: jest.fn(),
  decode: jest.fn(() => ({ exp: Math.floor(Date.now() / 1000) + 3600 }))
});

const buildConfigService = () => ({
  get: jest.fn((key: string, fallback?: unknown) => {
    if (key === "JWT_ACCESS_EXPIRES") return "15m";
    if (key === "JWT_REFRESH_EXPIRES") return "7d";
    return fallback;
  })
});

const role = {
  name: RoleName.ADMIN,
  permissions: [{ key: "users.read" }]
};

describe("AuthService login lockout", () => {
  it("increments failed attempts on invalid password", async () => {
    const prisma = buildPrisma();
    const passwordHash = await bcrypt.hash("CorrectPass1!", 4);
    prisma.user.findUnique.mockResolvedValue({
      id: "user-1",
      email: "user@example.com",
      isActive: true,
      failedLoginAttempts: 0,
      lockedUntil: null,
      passwordHash,
      tenantId: null,
      role
    });

    const service = new AuthService(
      prisma as any,
      buildJwtService() as any,
      buildConfigService() as any,
      { dispatch: jest.fn() } as any
    );

    await expect(
      service.login({ email: "user@example.com", password: "WrongPass1!" })
    ).rejects.toThrow(UnauthorizedException);

    expect(prisma.user.update).toHaveBeenCalledWith({
      where: { id: "user-1" },
      data: {
        failedLoginAttempts: 1,
        lockedUntil: null
      }
    });
  });

  it("locks account for 15 minutes after 5 failed attempts", async () => {
    const prisma = buildPrisma();
    const passwordHash = await bcrypt.hash("CorrectPass1!", 4);
    prisma.user.findUnique.mockResolvedValue({
      id: "user-1",
      email: "user@example.com",
      isActive: true,
      failedLoginAttempts: 4,
      lockedUntil: null,
      passwordHash,
      tenantId: null,
      role
    });

    const service = new AuthService(
      prisma as any,
      buildJwtService() as any,
      buildConfigService() as any,
      { dispatch: jest.fn() } as any
    );

    await expect(
      service.login({ email: "user@example.com", password: "WrongPass1!" })
    ).rejects.toThrow(UnauthorizedException);

    expect(prisma.user.update).toHaveBeenCalledWith({
      where: { id: "user-1" },
      data: {
        failedLoginAttempts: 5,
        lockedUntil: expect.any(Date)
      }
    });
  });

  it("blocks login while account is locked", async () => {
    const prisma = buildPrisma();
    const passwordHash = await bcrypt.hash("CorrectPass1!", 4);
    prisma.user.findUnique.mockResolvedValue({
      id: "user-1",
      email: "user@example.com",
      isActive: true,
      failedLoginAttempts: 5,
      lockedUntil: new Date(Date.now() + 10 * 60 * 1000),
      passwordHash,
      tenantId: null,
      role
    });

    const service = new AuthService(
      prisma as any,
      buildJwtService() as any,
      buildConfigService() as any,
      { dispatch: jest.fn() } as any
    );

    await expect(
      service.login({ email: "user@example.com", password: "CorrectPass1!" })
    ).rejects.toThrow(UnauthorizedException);

    expect(prisma.user.update).not.toHaveBeenCalled();
  });
});
