import { RoleName } from "@prisma/client";

import { requestContext } from "../src/common/context/request-context";
import { SuperAdminGuard } from "../src/common/guards/super-admin.guard";
import { AdminRolesService } from "../src/modules/admin/admin-roles.service";
import { PERMISSION_CATALOG } from "../src/database/permission-catalog";

const actor = { sub: "super-1", email: "super@test.local", role: RoleName.SUPER_ADMIN, tenantId: "tenant-a" };
const ctx = {
  actorId: actor.sub,
  actorEmail: actor.email,
  actorRole: actor.role,
  tenantId: actor.tenantId,
  module: "admin-roles",
  ipAddress: null,
  userAgent: null,
  requestPath: "/admin/permissions/sync"
};

function buildPrisma(seedKeys: string[]) {
  const permissions = new Map<string, { key: string }>(seedKeys.map((key) => [key, { key }]));
  const auditEntries: any[] = [];

  const prisma: any = {
    permission: {
      findMany: jest.fn(async ({ where }: any) => {
        const wanted: string[] = where.key.in;
        return wanted.filter((key) => permissions.has(key)).map((key) => ({ key }));
      }),
      upsert: jest.fn(async ({ where, create }: any) => {
        const record = permissions.get(where.key) ?? create;
        permissions.set(where.key, record);
        return record;
      })
    },
    auditLog: {
      create: jest.fn(async ({ data }: any) => {
        auditEntries.push(data);
        return { id: `audit-${auditEntries.length}` };
      })
    }
  };

  return { prisma, permissions, auditEntries };
}

describe("Permission catalog sync (SUPER_ADMIN)", () => {
  it("creates only the missing permissions and leaves existing ones untouched", async () => {
    const preExisting = PERMISSION_CATALOG.slice(0, 5);
    const { prisma, permissions, auditEntries } = buildPrisma(preExisting);
    const service = new AdminRolesService(prisma);

    const result = await requestContext.run(ctx, () => service.syncPermissionCatalog(actor));

    expect(result.existingCount).toBe(preExisting.length);
    expect(result.createdCount).toBe(PERMISSION_CATALOG.length - preExisting.length);
    expect(result.createdKeys).toContain("fg.nonconformance.manage");
    expect(permissions.size).toBe(PERMISSION_CATALOG.length);
    expect(auditEntries).toHaveLength(1);
    expect(auditEntries[0].metadata.event).toBe("PERMISSION_CATALOG_SYNCED");
    expect(auditEntries[0].metadata.createdCount).toBe(result.createdCount);
    // No secrets, no full-catalog dump beyond the created keys.
    expect(JSON.stringify(auditEntries)).not.toMatch(/passwordHash|token|secret/i);
  });

  it("never deletes or renames an existing permission", async () => {
    const { prisma, permissions } = buildPrisma(PERMISSION_CATALOG);
    const service = new AdminRolesService(prisma);

    await requestContext.run(ctx, () => service.syncPermissionCatalog(actor));

    expect(permissions.size).toBe(PERMISSION_CATALOG.length);
    expect(prisma.permission.upsert).not.toHaveBeenCalled();
  });

  it("is idempotent — a second sync creates zero new permissions", async () => {
    const { prisma } = buildPrisma([]);
    const service = new AdminRolesService(prisma);

    const first = await requestContext.run(ctx, () => service.syncPermissionCatalog(actor));
    const second = await requestContext.run(ctx, () => service.syncPermissionCatalog(actor));

    expect(first.createdCount).toBe(PERMISSION_CATALOG.length);
    expect(second.createdCount).toBe(0);
    expect(second.existingCount).toBe(PERMISSION_CATALOG.length);
  });

  it("SuperAdminGuard rejects ADMIN/MANAGER and a stale JWT claiming SUPER_ADMIN when the DB says otherwise", async () => {
    for (const dbRole of [RoleName.ADMIN, RoleName.MANAGER]) {
      const prisma: any = { user: { findUnique: jest.fn().mockResolvedValue({ isActive: true, lockedUntil: null, role: { name: dbRole } }) } };
      const guard = new SuperAdminGuard(prisma);
      await expect(
        guard.canActivate({ switchToHttp: () => ({ getRequest: () => ({ user: { sub: "u1", role: RoleName.SUPER_ADMIN } }) }) } as any)
      ).rejects.toBeTruthy();
    }
  });

  it("SuperAdminGuard allows a DB-current, active, unlocked SUPER_ADMIN", async () => {
    const prisma: any = { user: { findUnique: jest.fn().mockResolvedValue({ isActive: true, lockedUntil: null, role: { name: RoleName.SUPER_ADMIN } }) } };
    const guard = new SuperAdminGuard(prisma);
    await expect(guard.canActivate({ switchToHttp: () => ({ getRequest: () => ({ user: { sub: "super-1" } }) }) } as any)).resolves.toBe(true);
  });
});
