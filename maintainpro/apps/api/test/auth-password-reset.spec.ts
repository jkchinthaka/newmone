import { BadRequestException } from "@nestjs/common";

import { AuthService } from "../src/modules/auth/auth.service";

const buildPrisma = () => ({
  passwordResetToken: {
    updateMany: jest.fn(),
    create: jest.fn(),
    findUnique: jest.fn()
  },
  refreshToken: {
    updateMany: jest.fn()
  },
  user: {
    findUnique: jest.fn(),
    update: jest.fn()
  },
  auditLog: {
    create: jest.fn()
  },
  $transaction: jest.fn(async (handler: (tx: any) => Promise<void>) => {
    const tx = {
      user: { update: jest.fn() },
      passwordResetToken: { update: jest.fn() },
      refreshToken: { updateMany: jest.fn() },
      auditLog: { create: jest.fn() }
    };
    await handler(tx);
    return tx;
  })
});

const buildJwtService = () => ({
  signAsync: jest.fn(),
  verifyAsync: jest.fn(),
  decode: jest.fn()
});

const buildConfigService = () => ({
  get: jest.fn((key: string, fallback?: unknown) => {
    if (key === "FRONTEND_URL") return "https://app.maintainpro.test";
    return fallback;
  })
});

describe("AuthService password reset flow", () => {
  it("returns generic message when email is missing", async () => {
    const prisma = buildPrisma();
    prisma.user.findUnique.mockResolvedValue(null);
    const emailDispatchService = { dispatch: jest.fn() };

    const service = new AuthService(
      prisma as any,
      buildJwtService() as any,
      buildConfigService() as any,
      emailDispatchService as any
    );

    const result = await service.forgotPassword({ email: "missing@example.com" });

    expect(result.message).toBe("If this email exists, a reset link has been sent");
    expect(prisma.passwordResetToken.create).not.toHaveBeenCalled();
    expect(emailDispatchService.dispatch).not.toHaveBeenCalled();
  });

  it("creates hashed reset token and dispatches reset email for valid user", async () => {
    const prisma = buildPrisma();
    prisma.user.findUnique.mockResolvedValue({
      id: "user-1",
      email: "user@example.com"
    });
    const emailDispatchService = { dispatch: jest.fn().mockResolvedValue(undefined) };

    const service = new AuthService(
      prisma as any,
      buildJwtService() as any,
      buildConfigService() as any,
      emailDispatchService as any
    );

    const result = await service.forgotPassword({ email: "user@example.com" });

    expect(prisma.passwordResetToken.updateMany).toHaveBeenCalled();
    expect(prisma.passwordResetToken.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        tokenHash: expect.any(String),
        userId: "user-1",
        expiresAt: expect.any(Date)
      })
    });
    expect(emailDispatchService.dispatch).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: "user-1",
        title: "MaintainPro password reset",
        message: expect.stringContaining("/reset-password?token=")
      })
    );
    expect(result.message).toBe("If this email exists, a reset link has been sent");
    expect(result.data).toEqual({ accepted: true });
  });

  it("rejects invalid or expired reset token", async () => {
    const prisma = buildPrisma();
    prisma.passwordResetToken.findUnique.mockResolvedValue(null);

    const service = new AuthService(
      prisma as any,
      buildJwtService() as any,
      buildConfigService() as any,
      { dispatch: jest.fn() } as any
    );

    await expect(
      service.resetPassword({ token: "bad-token", newPassword: "StrongPass1!" })
    ).rejects.toThrow(BadRequestException);
  });

  it("resets password, marks token used, revokes sessions, and writes audit", async () => {
    const prisma = buildPrisma();
    prisma.passwordResetToken.findUnique.mockResolvedValue({
      id: "prt-1",
      userId: "user-1",
      usedAt: null,
      expiresAt: new Date(Date.now() + 60_000)
    });

    const service = new AuthService(
      prisma as any,
      buildJwtService() as any,
      buildConfigService() as any,
      { dispatch: jest.fn() } as any
    );

    const result = await service.resetPassword({
      token: "valid-token",
      newPassword: "StrongPass1!"
    });

    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    expect(result).toEqual({
      data: { changed: true },
      message: "Password reset successful"
    });
  });

  it("stores a hash, then rejects a second use of the same token", async () => {
    const { createHash } = await import("node:crypto");
    const prisma = buildPrisma();
    prisma.user.findUnique.mockResolvedValue({ id: "user-1", email: "user@example.com" });
    const stored = { tokenHash: "", expiresAt: new Date(), usedAt: null as Date | null, created: false };
    prisma.passwordResetToken.create.mockImplementation(async ({ data }: { data: { tokenHash: string; expiresAt: Date } }) => {
      stored.tokenHash = data.tokenHash;
      stored.expiresAt = data.expiresAt;
      stored.usedAt = null;
      stored.created = true;
      return stored;
    });
    prisma.passwordResetToken.findUnique.mockImplementation(async ({ where }: { where: { tokenHash: string } }) => {
      if (!stored.created || where.tokenHash !== stored.tokenHash) return null;
      return { id: "prt-1", userId: "user-1", tokenHash: stored.tokenHash, expiresAt: stored.expiresAt, usedAt: stored.usedAt };
    });
    prisma.$transaction.mockImplementation(async (handler: (tx: any) => Promise<void>) => {
      const tx = {
        user: { update: jest.fn() },
        passwordResetToken: {
          update: jest.fn(async () => {
            stored.usedAt = new Date();
          })
        },
        refreshToken: { updateMany: jest.fn() },
        auditLog: { create: jest.fn() }
      };
      await handler(tx);
      return tx;
    });
    const emailDispatchService = { dispatch: jest.fn().mockResolvedValue(undefined) };
    const service = new AuthService(
      prisma as any,
      buildJwtService() as any,
      buildConfigService() as any,
      emailDispatchService as any
    );

    await service.forgotPassword({ email: "user@example.com" });
    const message = String(emailDispatchService.dispatch.mock.calls[0][0].message);
    const token = decodeURIComponent(message.match(/token=([^\s]+)/)?.[1] ?? "");
    expect(token.length).toBeGreaterThan(20);
    expect(stored.tokenHash).toBe(createHash("sha256").update(token).digest("hex"));
    expect(stored.tokenHash).not.toBe(token);

    await service.resetPassword({ token, newPassword: "StrongPass1!" });
    await expect(service.resetPassword({ token, newPassword: "StrongPass1!" })).rejects.toThrow(
      BadRequestException
    );
  });
});
