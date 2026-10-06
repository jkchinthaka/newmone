import { JwtService } from "@nestjs/jwt";
import { RoleName } from "@prisma/client";
import { createHash } from "node:crypto";

import { AuthService } from "../src/modules/auth/auth.service";

/**
 * QA-MANUAL-001: two rotations for the same user/tenant inside the same second used to
 * sign byte-identical refresh JWTs (payload {sub, tenantId} + second-granular iat/exp).
 * The second insert hit the unique RefreshToken.tokenHash index -> P2002 -> HTTP 409,
 * and the client treated that as session expiry and redirected to /login.
 */

const hash = (value: string) => createHash("sha256").update(value).digest("hex");

const configService = {
  get: jest.fn((key: string, fallback?: unknown) => {
    if (key === "JWT_ACCESS_SECRET") return "access-secret-for-tests-only-0123456789";
    if (key === "JWT_REFRESH_SECRET") return "refresh-secret-for-tests-only-0123456789";
    if (key === "JWT_ACCESS_EXPIRES") return "15m";
    if (key === "JWT_REFRESH_EXPIRES") return "7d";
    return fallback;
  })
};

type Row = {
  tokenHash: string;
  familyId: string;
  userId: string;
  tenantId: string | null;
  expiresAt: Date;
  revokedAt: Date | null;
  replacedByTokenHash: string | null;
};

/** Minimal in-memory RefreshToken table that enforces the unique tokenHash index. */
function buildStore() {
  const rows = new Map<string, Row>();
  const matches = (row: Row, where: Record<string, unknown>) =>
    Object.entries(where).every(([key, value]) => (row as Record<string, unknown>)[key] === value);
  return {
    rows,
    prisma: {
      refreshToken: {
        create: jest.fn(async ({ data }: { data: Omit<Row, "revokedAt" | "replacedByTokenHash"> & Partial<Row> }) => {
          if (rows.has(data.tokenHash)) {
            const error = Object.assign(new Error("Unique constraint failed"), { code: "P2002" });
            throw error;
          }
          rows.set(data.tokenHash, { revokedAt: null, replacedByTokenHash: null, ...data });
          return data;
        }),
        findUnique: jest.fn(async ({ where }: { where: { tokenHash: string } }) => rows.get(where.tokenHash) ?? null),
        updateMany: jest.fn(async ({ where, data }: { where: Record<string, unknown>; data: Partial<Row> }) => {
          let count = 0;
          for (const row of rows.values()) {
            if (matches(row, where)) {
              Object.assign(row, data);
              count += 1;
            }
          }
          return { count };
        })
      },
      user: {
        findUnique: jest.fn(async () => ({
          id: "user-1",
          email: "admin@example.com",
          isActive: true,
          tenantId: "tenant-1",
          role: { name: RoleName.ADMIN }
        }))
      }
    }
  };
}

describe("QA-MANUAL-001 refresh rotation within the same second", () => {
  afterEach(() => jest.useRealTimers());

  it("issues a distinct refresh token on back-to-back rotations (no 409 collision)", async () => {
    jest.useFakeTimers({ now: new Date("2026-10-06T06:49:30.100Z"), doNotFake: ["nextTick", "setImmediate"] });
    const store = buildStore();
    const service = new AuthService(
      store.prisma as any,
      new JwtService({}) as any,
      configService as any,
      { dispatch: jest.fn() } as any
    );

    const tokens = await (service as any).generateTokens({
      sub: "user-1",
      email: "admin@example.com",
      role: RoleName.ADMIN,
      tenantId: "tenant-1"
    });

    const first = await service.refresh({ refreshToken: tokens.refreshToken });
    jest.setSystemTime(new Date("2026-10-06T06:49:30.400Z")); // same wall-clock second
    const second = await service.refresh({ refreshToken: first.data.refreshToken });

    expect(second.data.refreshToken).not.toEqual(first.data.refreshToken);
    expect(hash(second.data.refreshToken)).not.toEqual(hash(first.data.refreshToken));
    // Chain is intact: only the newest token is live.
    const live = [...store.rows.values()].filter((row) => row.revokedAt === null);
    expect(live.map((row) => row.tokenHash)).toEqual([hash(second.data.refreshToken)]);
  });

  it("releases the claimed token when storing the successor fails", async () => {
    const store = buildStore();
    const service = new AuthService(
      store.prisma as any,
      new JwtService({}) as any,
      configService as any,
      { dispatch: jest.fn() } as any
    );
    const tokens = await (service as any).generateTokens({
      sub: "user-1",
      email: "admin@example.com",
      role: RoleName.ADMIN,
      tenantId: "tenant-1"
    });

    store.prisma.refreshToken.create.mockRejectedValueOnce(new Error("db write failed"));
    await expect(service.refresh({ refreshToken: tokens.refreshToken })).rejects.toThrow("db write failed");

    const original = store.rows.get(hash(tokens.refreshToken));
    expect(original?.revokedAt).toBeNull();

    // The same session can rotate normally afterwards (no false "reuse detected").
    const retried = await service.refresh({ refreshToken: tokens.refreshToken });
    expect(typeof retried.data.refreshToken).toBe("string");
  });
});
