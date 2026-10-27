import { HttpException } from "@nestjs/common";
import * as bcrypt from "bcryptjs";
import { RoleName } from "@prisma/client";

import { AuthService, lockoutSecondsForRound } from "../src/modules/auth/auth.service";

const config = { get: jest.fn((_key: string, fallback?: unknown) => fallback) };

async function attempt(user: Record<string, unknown>, previousLocks: number) {
  const prisma = {
    user: { findUnique: jest.fn().mockResolvedValue(user), update: jest.fn() },
    securityEvent: { count: jest.fn().mockResolvedValue(previousLocks), create: jest.fn().mockResolvedValue({}) },
    refreshToken: { create: jest.fn() }
  };
  const service = new AuthService(prisma as any, {} as any, config as any, { dispatch: jest.fn() } as any);
  const before = Date.now();
  const error = await service.login({ email: "tech@nelna.lk", password: "Wrong-1" }).catch((e: unknown) => e);
  expect(error).toBeInstanceOf(HttpException);
  const data = prisma.user.update.mock.calls[0][0].data as { failedLoginAttempts: number; lockedUntil: Date | null };
  const seconds = data.lockedUntil ? Math.round((data.lockedUntil.getTime() - before) / 1000) : 0;
  return { data, seconds, prisma, error: error as HttpException };
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

  it("maps lock rounds to 30, 60 and 90 seconds", () => {
    expect([0, 1, 2, 3, 9].map(lockoutSecondsForRound)).toEqual([30, 60, 90, 90, 90]);
  });

  it("first lock is 30 seconds, second 60, third 90, and the reply carries the countdown", async () => {
    const first = await attempt({ ...base(), failedLoginAttempts: 4 }, 0);
    expect(first.seconds).toBe(30);
    expect(first.error.getStatus()).toBe(429);
    expect(first.error.getResponse()).toMatchObject({ code: "ACCOUNT_LOCKED", metadata: { retryAfterSeconds: 30 } });
    expect((await attempt({ ...base(), failedLoginAttempts: 4 }, 1)).seconds).toBe(60);
    expect((await attempt({ ...base(), failedLoginAttempts: 4 }, 2)).seconds).toBe(90);
  });

  it("a wrong password before the fifth is still 401", async () => {
    const { error } = await attempt({ ...base(), failedLoginAttempts: 1 }, 0);
    expect(error.getStatus()).toBe(401);
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
