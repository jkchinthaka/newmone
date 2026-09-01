import { ForbiddenException, UnauthorizedException } from "@nestjs/common";
import { RoleName } from "@prisma/client";

import { BulkImportAuthService } from "../src/modules/bulk-import/bulk-import-auth.service";

describe("BulkImportAuthService", () => {
  function buildService(user: unknown) {
    const prisma: any = {
      user: {
        findUnique: jest.fn(async () => user)
      }
    };
    return { service: new BulkImportAuthService(prisma), prisma };
  }

  it("throws Unauthorized when no user id is supplied (no auth)", async () => {
    const { service } = buildService(null);
    await expect(service.assertSuperAdmin(undefined)).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it("throws Unauthorized when the user no longer exists in the database", async () => {
    const { service } = buildService(null);
    await expect(service.assertSuperAdmin("user-1")).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it("throws Unauthorized when the account is disabled", async () => {
    const { service } = buildService({ isActive: false, lockedUntil: null, role: { name: RoleName.SUPER_ADMIN } });
    await expect(service.assertSuperAdmin("user-1")).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it("throws Unauthorized when the account is temporarily locked", async () => {
    const { service } = buildService({
      isActive: true,
      lockedUntil: new Date(Date.now() + 60_000),
      role: { name: RoleName.SUPER_ADMIN }
    });
    await expect(service.assertSuperAdmin("user-1")).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it("throws Forbidden for a non-SUPER_ADMIN role read fresh from the DB (e.g. ADMIN, MANAGER)", async () => {
    for (const role of [RoleName.ADMIN, RoleName.MANAGER, RoleName.ASSET_MANAGER, RoleName.INVENTORY_KEEPER]) {
      const { service } = buildService({ isActive: true, lockedUntil: null, role: { name: role } });
      await expect(service.assertSuperAdmin("user-1")).rejects.toBeInstanceOf(ForbiddenException);
    }
  });

  it("passes for an active, unlocked SUPER_ADMIN read fresh from the DB", async () => {
    const { service } = buildService({ isActive: true, lockedUntil: null, role: { name: RoleName.SUPER_ADMIN } });
    await expect(service.assertSuperAdmin("user-1")).resolves.toBeUndefined();
  });

  it("rejects a stale JWT claiming SUPER_ADMIN when the DB currently says ADMIN", async () => {
    // The caller only ever passes a userId — the JWT's role claim is never
    // consulted here, which is exactly what makes this check DB-authoritative.
    const { service, prisma } = buildService({ isActive: true, lockedUntil: null, role: { name: RoleName.ADMIN } });
    await expect(service.assertSuperAdmin("user-1")).rejects.toBeInstanceOf(ForbiddenException);
    expect(prisma.user.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: "user-1" } })
    );
  });
});
