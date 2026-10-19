import "reflect-metadata";
import { BadRequestException, ConflictException, ForbiddenException, NotFoundException } from "@nestjs/common";
import { AuditAction, Prisma, RoleName } from "@prisma/client";

import { requestContext } from "../src/common/context/request-context";
import { ROLES_KEY } from "../src/common/decorators/roles.decorator";
import { AdminAccessController } from "../src/modules/admin/admin-access.controller";
import { MaintenanceConfigController } from "../src/modules/maintenance-config/maintenance-config.controller";
import { UsersService } from "../src/modules/users/users.service";

const adminCtx = {
  actorId: "admin-1",
  actorEmail: "admin@test.local",
  actorRole: RoleName.ADMIN,
  tenantId: "tenant-a",
  module: "users",
  ipAddress: null,
  userAgent: null,
  requestPath: "/users"
};

function serviceFor(users: Map<string, { id: string; role: { name: RoleName }; roleId: string }>) {
  const audit: unknown[] = [];
  const prisma: any = {
    user: {
      findUnique: jest.fn(async ({ where }: { where: { id?: string } }) => users.get(where.id ?? "") ?? null),
      findFirst: jest.fn(async ({ where }: { where: { id: string; memberships?: unknown } }) => {
        if (where.memberships) return null;
        return users.get(where.id) ?? null;
      }),
      update: jest.fn(async ({ where, data }: { where: { id: string }; data: { roleId?: string } }) => {
        const current = users.get(where.id);
        return { ...current, ...data, role: current?.role };
      }),
      delete: jest.fn(async () => {
        throw new Prisma.PrismaClientKnownRequestError("fk", { code: "P2003", clientVersion: "test" });
      }),
      count: jest.fn(async () => 2)
    },
    tenantMembership: {
      findUnique: jest.fn(async () => ({ id: "membership-1" })),
      deleteMany: jest.fn(async () => ({ count: 1 })),
      count: jest.fn(async () => 1)
    },
    refreshToken: { deleteMany: jest.fn(async () => ({ count: 0 })) },
    workOrder: { count: jest.fn(async () => 0) },
    auditLog: { create: jest.fn(async ({ data }: { data: unknown }) => { audit.push(data); return data; }) },
    role: { findUnique: jest.fn(async () => ({ id: "role-tech", name: RoleName.TECHNICIAN, tenantId: null })) },
    $transaction: jest.fn(async (fn: (tx: unknown) => Promise<unknown>) => fn(prisma))
  };
  return { service: new UsersService(prisma), prisma, audit };
}

describe("admin user guards", () => {
  it("allows a tenant admin to call the protected status route", () => {
    const roles = Reflect.getMetadata(ROLES_KEY, AdminAccessController.prototype.updateUserStatus) as string[];
    expect(roles).toEqual(expect.arrayContaining([RoleName.ADMIN, RoleName.SUPER_ADMIN]));
  });

  it("blocks a tenant admin from editing a super admin in the same tenant", async () => {
    const users = new Map([
      ["super-user", { id: "super-user", roleId: "role-super", role: { name: RoleName.SUPER_ADMIN } }]
    ]);
    const { service } = serviceFor(users);
    await expect(
      requestContext.run(adminCtx, () => service.update("super-user", { firstName: "Changed" }))
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it("returns 404 when a tenant admin changes status for a user outside the tenant", async () => {
    const users = new Map([
      ["other-user", { id: "other-user", roleId: "role-tech", role: { name: RoleName.TECHNICIAN } }]
    ]);
    const { service } = serviceFor(users);
    await expect(
      requestContext.run(adminCtx, () => service.updateAdminUserStatus("other-user", false))
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it("removes only the current membership inside one transaction and keeps the user when other memberships remain", async () => {
    const users = new Map([
      ["tech-1", { id: "tech-1", roleId: "role-tech", role: { name: RoleName.TECHNICIAN } }]
    ]);
    const { service, prisma } = serviceFor(users);
    const result = await requestContext.run(adminCtx, () => service.remove("tech-1"));
    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    expect(prisma.workOrder.count).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          status: {
            in: ["OPEN", "PLANNED", "ASSIGNED", "IN_PROGRESS", "ON_HOLD", "TECHNICIAN_COMPLETED", "REWORK_REQUIRED"]
          }
        })
      })
    );
    expect(result).toEqual({ deleted: false, membershipRemoved: true });
    expect(prisma.user.delete).not.toHaveBeenCalled();
  });

  it("returns 409 Deactivate instead when the last membership still has related records", async () => {
    const users = new Map([
      ["tech-1", { id: "tech-1", roleId: "role-tech", role: { name: RoleName.TECHNICIAN } }]
    ]);
    const { service, prisma } = serviceFor(users);
    prisma.tenantMembership.count.mockResolvedValue(0);
    await expect(requestContext.run(adminCtx, () => service.remove("tech-1"))).rejects.toBeInstanceOf(ConflictException);
    await expect(requestContext.run(adminCtx, () => service.remove("tech-1"))).rejects.toThrow("Deactivate instead");
  });

  it("writes an audit row when a role changes", async () => {
    const users = new Map([
      ["tech-1", { id: "tech-1", roleId: "role-tech", role: { name: RoleName.TECHNICIAN } }]
    ]);
    const { service, prisma } = serviceFor(users);
    await requestContext.run(
      { ...adminCtx, actorRole: RoleName.SUPER_ADMIN },
      () => service.update("tech-1", { roleId: "role-next" })
    );
    expect(prisma.auditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ action: AuditAction.UPDATE, entityId: "tech-1" })
      })
    );
  });

  it("rejects a feature-flag toggle without a typed reason", async () => {
    const controller = new MaintenanceConfigController({} as never, { upsert: jest.fn() } as never, {} as never);
    await expect(
      controller.upsertFeatureFlag({ user: { sub: "admin-1", tenantId: "tenant-a" } } as never, {
        code: "FLEET",
        enabled: false,
        reason: "no"
      })
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});
