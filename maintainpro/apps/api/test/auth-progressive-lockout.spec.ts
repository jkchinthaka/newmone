import { UnauthorizedException } from "@nestjs/common";
import * as bcrypt from "bcryptjs";
import { RoleName } from "@prisma/client";

import { AuthService, lockoutMinutesForRound } from "../src/modules/auth/auth.service";

const config = { get: jest.fn((_key: string, fallback?: unknown) => fallback) };

async function attempt(user: Record<string, unknown>, previousLocks: number) {
  const prisma = {
    user: { findUnique: jest.fn().mockResolvedValue(user), update: jest.fn() },
    securityEvent: { count: jest.fn().mockResolvedValue(previousLocks), create: jest.fn().mockResolvedValue({}) },
    refreshToken: { create: jest.fn() }
  };
  const service = new AuthService(prisma as any, {} as any, config as any, { dispatch: jest.fn() } as any);
  const before = Date.now();
  await expect(service.login({ email: "tech@nelna.lk", password: "Wrong-1" })).rejects.toThrow(UnauthorizedException);
  const data = prisma.user.update.mock.calls[0][0].data as { failedLoginAttempts: number; lockedUntil: Date | null };
  const minutes = data.lockedUntil ? Math.round((data.lockedUntil.getTime() - before) / 60_000) : 0;
  return { data, minutes, prisma };
}

describe("progressive login lockout", () => {
  let passwordHash: string;
  beforeAll(async () => {
    passwordHash = await bcrypt.hash("Correct-1", 4);
  });
  const base = () => ({
    id: "u1",
    email: "tech@nelna.lk",
    isActive: true,
    passwordHash,
    tenantId: "t1",
    lastLogin: null,
    lockedUntil: null,
    role: { name: RoleName.TECHNICIAN, permissionLinks: [] },
    linkedWorkforceEmployees: []
  });

  it("maps lock rounds to 5, 10 and 30 minutes", () => {
    expect([0, 1, 2, 3, 9].map(lockoutMinutesForRound)).toEqual([5, 10, 30, 30, 30]);
  });

  it("first lock is 5 minutes, second 10, third 30", async () => {
    expect((await attempt({ ...base(), failedLoginAttempts: 4 }, 0)).minutes).toBe(5);
    expect((await attempt({ ...base(), failedLoginAttempts: 4 }, 1)).minutes).toBe(10);
    expect((await attempt({ ...base(), failedLoginAttempts: 4 }, 2)).minutes).toBe(30);
  });

  it("after a lock runs out the user gets a fresh five attempts", async () => {
    const { data } = await attempt(
      { ...base(), failedLoginAttempts: 5, lockedUntil: new Date(Date.now() - 1000) },
      1
    );
    expect(data).toEqual({ failedLoginAttempts: 1, lockedUntil: null });
  });

  it("counts earlier locks only since the last successful sign-in", async () => {
    const lastLogin = new Date(Date.now() - 60 * 60 * 1000);
    const { prisma } = await attempt({ ...base(), failedLoginAttempts: 4, lastLogin }, 0);
    expect(prisma.securityEvent.count).toHaveBeenCalledWith({
      where: expect.objectContaining({
        actorId: "u1",
        eventType: "ACCOUNT_LOCK",
        reasonCode: "MAX_FAILED_ATTEMPTS",
        createdAt: { gte: lastLogin }
      })
    });
  });
});
