import { UnauthorizedException } from "@nestjs/common";
import { RoleName } from "@prisma/client";
import { createHash } from "node:crypto";

import { AuthService } from "../src/modules/auth/auth.service";

const hash = (value: string) => createHash("sha256").update(value).digest("hex");

const buildPrisma = () => ({
  refreshToken: {
    create: jest.fn(),
    findUnique: jest.fn(),
    updateMany: jest.fn()
  },
  user: {
    findUnique: jest.fn()
  }
});

const buildConfigService = () => ({
  get: jest.fn((key: string, fallback?: unknown) => {
    if (key === "JWT_ACCESS_SECRET") return "access-secret";
    if (key === "JWT_REFRESH_SECRET") return "refresh-secret";
    if (key === "JWT_ACCESS_EXPIRES") return "15m";
    if (key === "JWT_REFRESH_EXPIRES") return "7d";
    return fallback;
  })
});

describe("AuthService refresh token persistence", () => {
  it("rotates refresh token and revokes the previous token", async () => {
    const prisma = buildPrisma();
    const jwtService = {
      signAsync: jest
        .fn()
        .mockResolvedValueOnce("new-access-token")
        .mockResolvedValueOnce("new-refresh-token"),
      verifyAsync: jest.fn().mockResolvedValue({
        sub: "user-1",
        email: "user@example.com",
        role: RoleName.ADMIN,
        tenantId: "tenant-1"
      }),
      decode: jest.fn((token: string) => {
        if (token === "new-refresh-token") {
          return { exp: Math.floor(Date.now() / 1000) + 3600 };
        }
        return null;
      })
    };

    prisma.refreshToken.findUnique.mockResolvedValue({
      id: "rt-old",
      tokenHash: hash("old-refresh-token"),
      userId: "user-1",
      tenantId: "tenant-1",
      expiresAt: new Date(Date.now() + 60_000),
      revokedAt: null
    });
    prisma.refreshToken.updateMany.mockResolvedValue({ count: 1 });
    prisma.user.findUnique.mockResolvedValue({
      id: "user-1",
      email: "user@example.com",
      isActive: true,
      tenantId: "tenant-1",
      role: {
        name: RoleName.ADMIN,
        permissions: [{ key: "users.read" }]
      }
    });

    const service = new AuthService(
      prisma as any,
      jwtService as any,
      buildConfigService() as any,
      { dispatch: jest.fn() } as any
    );

    const result = await service.refresh({ refreshToken: "old-refresh-token" });

    expect(result.data).toEqual({
      accessToken: "new-access-token",
      refreshToken: "new-refresh-token"
    });
    expect(prisma.refreshToken.findUnique).toHaveBeenCalledWith({
      where: { tokenHash: hash("old-refresh-token") }
    });
    expect(prisma.refreshToken.updateMany).toHaveBeenCalledWith({
      where: { tokenHash: hash("old-refresh-token"), revokedAt: null },
      data: { revokedAt: expect.any(Date), lastUsedAt: expect.any(Date) }
    });
    expect(prisma.refreshToken.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        tokenHash: hash("new-refresh-token"),
        userId: "user-1",
        tenantId: "tenant-1",
        expiresAt: expect.any(Date)
      })
    });
  });

  it("rejects revoked or missing refresh token", async () => {
    const prisma = buildPrisma();
    const jwtService = {
      signAsync: jest.fn(),
      verifyAsync: jest.fn(),
      decode: jest.fn()
    };
    prisma.refreshToken.findUnique.mockResolvedValue(null);

    const service = new AuthService(
      prisma as any,
      jwtService as any,
      buildConfigService() as any,
      { dispatch: jest.fn() } as any
    );

    await expect(
      service.refresh({ refreshToken: "does-not-exist" })
    ).rejects.toThrow(UnauthorizedException);
  });

  it("revokes all active sessions for logout-all", async () => {
    const prisma = buildPrisma();
    const jwtService = {
      signAsync: jest.fn(),
      verifyAsync: jest.fn(),
      decode: jest.fn()
    };
    prisma.refreshToken.updateMany.mockResolvedValue({ count: 3 });

    const service = new AuthService(
      prisma as any,
      jwtService as any,
      buildConfigService() as any,
      { dispatch: jest.fn() } as any
    );

    const result = await service.logoutAll("user-1");

    expect(prisma.refreshToken.updateMany).toHaveBeenCalledWith({
      where: {
        userId: "user-1",
        revokedAt: null,
        expiresAt: { gt: expect.any(Date) }
      },
      data: {
        revokedAt: expect.any(Date),
        lastUsedAt: expect.any(Date)
      }
    });
    expect(result.data).toEqual({ loggedOutAll: true, revokedSessions: 3 });
  });
});
