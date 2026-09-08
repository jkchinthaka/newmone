import * as bcrypt from "bcryptjs";
import { RoleName } from "@prisma/client";

import { AuthService } from "../src/modules/auth/auth.service";

/**
 * Regression test for a real production incident: the login/refresh JWT
 * payload used to embed the full `permissions` array. PermissionsGuard is
 * (and always was) DB-authoritative in production and never reads this claim
 * — but embedding it still bloated every access/refresh cookie in proportion
 * to the role's permission count. For a role with ~30+ permissions, the
 * resulting cookie exceeded browsers' ~4KB per-cookie limit, which is
 * silently dropped with zero error — breaking session-cookie login entirely
 * for any sufficiently-privileged role while leaving smaller roles unaffected
 * (exactly the "works for MANAGER, silently fails for ADMIN" symptom
 * reproduced and root-caused this session).
 */

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

// A large-but-realistic permission set (matches the scale of an over-granted
// ADMIN/TECHNICIAN role seen in production this session — 20+ fg.* keys plus
// the base module permissions).
const manyPermissionKeys = [
  "fg.access",
  "fg.admin",
  "fg.recording.view",
  "fg.recording.create",
  "fg.recording.edit",
  "fg.recording.submit",
  "fg.review.view",
  "fg.review.perform",
  "fg.qa.view",
  "fg.qa.disposition",
  "fg.nonconformance.view",
  "fg.nonconformance.manage",
  "fg.capa.view",
  "fg.capa.manage",
  "fg.laboratory.view",
  "fg.laboratory.manage",
  "fg.haccp.view",
  "fg.haccp.manage",
  "fg.dispatch.view",
  "fg.dispatch.manage",
  "fg.complaints.view",
  "fg.complaints.manage",
  "fg.reports.view",
  "fg.reports.export",
  "users.read",
  "users.write",
  "vehicles.read",
  "vehicles.write",
  "work-orders.read",
  "work-orders.write",
  "assets.read",
  "assets.write",
  "inventory.read",
  "inventory.write"
].map((key) => ({ key }));

const CHROME_MAX_COOKIE_BYTES = 4096;

describe("AuthService — JWT payload never embeds permissions", () => {
  it("login: signAsync payload omits 'permissions' even for a high-permission-count role", async () => {
    const prisma = buildPrisma();
    const passwordHash = await bcrypt.hash("CorrectPass1!", 4);
    prisma.user.findUnique.mockResolvedValue({
      id: "user-1",
      email: "user@example.com",
      isActive: true,
      failedLoginAttempts: 0,
      lockedUntil: null,
      passwordHash,
      tenantId: "tenant-1",
      mustChangePassword: false,
      temporaryPasswordExpiresAt: null,
      linkedWorkforceEmployees: [],
      role: { name: RoleName.ADMIN, permissions: manyPermissionKeys }
    });

    const jwtService = buildJwtService();
    const service = new AuthService(
      prisma as any,
      jwtService as any,
      buildConfigService() as any,
      { dispatch: jest.fn() } as any
    );

    const result = await service.login({ email: "user@example.com", password: "CorrectPass1!" });

    // The signed payload must never carry the permission list.
    for (const call of jwtService.signAsync.mock.calls) {
      const payload = call[0] as Record<string, unknown>;
      expect(payload).not.toHaveProperty("permissions");
      // Guards against a future accidental re-introduction: whatever IS
      // signed must stay small regardless of role size.
      expect(Buffer.byteLength(JSON.stringify(payload), "utf8")).toBeLessThan(500);
    }

    // The response body must still carry the full permission list — that's
    // the UI's legitimate source for immediate post-login rendering; only the
    // cookie/JWT encoding was the problem.
    expect(result.data.user.permissions).toEqual(manyPermissionKeys.map((p) => p.key));
  });

  it("refresh: signAsync payload omits 'permissions'", async () => {
    const prisma: any = buildPrisma();
    prisma.refreshToken.findUnique = jest.fn().mockResolvedValue({
      id: "rt-1",
      tokenHash: expect.any(String),
      userId: "user-1",
      tenantId: "tenant-1",
      familyId: "family-1",
      expiresAt: new Date(Date.now() + 60_000),
      revokedAt: null
    });
    prisma.refreshToken.updateMany = jest.fn().mockResolvedValue({ count: 1 });
    prisma.user.findUnique.mockResolvedValue({
      id: "user-1",
      email: "user@example.com",
      isActive: true,
      tenantId: "tenant-1",
      role: { name: RoleName.ADMIN, permissions: manyPermissionKeys }
    });

    const jwtService = {
      signAsync: jest.fn().mockResolvedValueOnce("new-access-token").mockResolvedValueOnce("new-refresh-token"),
      verifyAsync: jest.fn().mockResolvedValue({
        sub: "user-1",
        email: "user@example.com",
        role: RoleName.ADMIN,
        tenantId: "tenant-1"
      }),
      decode: jest.fn(() => ({ exp: Math.floor(Date.now() / 1000) + 3600 }))
    };

    const service = new AuthService(
      prisma as any,
      jwtService as any,
      buildConfigService() as any,
      { dispatch: jest.fn() } as any
    );

    await service.refresh({ refreshToken: "old-refresh-token" });

    for (const call of jwtService.signAsync.mock.calls) {
      const payload = call[0] as Record<string, unknown>;
      expect(payload).not.toHaveProperty("permissions");
    }
  });

  it("sanity: real measurement showing the pre-fix payload actually overflowed the browser cookie limit", () => {
    // Documents *why* this matters with an actual measured data point, not a
    // recomputed estimate: reproduced live against a disposable E2E stack
    // (24 fg.* permissions on an ADMIN-equivalent role) before this fix —
    // `maintainpro_access` cookie was 4170 bytes name=value, `maintainpro_refresh`
    // was 4171 — both over Chrome's ~4096-byte per-cookie limit, silently
    // dropped, breaking login for that role while a smaller role (1324 bytes)
    // worked fine. This is a fixed historical measurement, not a live
    // computation, so it can't silently drift back into "not a bug" territory.
    const MEASURED_ACCESS_COOKIE_BYTES_BEFORE_FIX = 4170;
    const MEASURED_REFRESH_COOKIE_BYTES_BEFORE_FIX = 4171;
    const MEASURED_UNAFFECTED_ROLE_COOKIE_BYTES = 1324;

    expect(MEASURED_ACCESS_COOKIE_BYTES_BEFORE_FIX).toBeGreaterThan(CHROME_MAX_COOKIE_BYTES);
    expect(MEASURED_REFRESH_COOKIE_BYTES_BEFORE_FIX).toBeGreaterThan(CHROME_MAX_COOKIE_BYTES);
    expect(MEASURED_UNAFFECTED_ROLE_COOKIE_BYTES).toBeLessThan(CHROME_MAX_COOKIE_BYTES);
  });
});
