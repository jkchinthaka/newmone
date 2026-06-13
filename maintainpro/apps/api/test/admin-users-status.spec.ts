import { BadRequestException, ForbiddenException, NotFoundException } from "@nestjs/common";
import { ExecutionContext } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { RoleName } from "@prisma/client";

import { RolesGuard } from "../src/common/guards/roles.guard";
import { requestContext } from "../src/common/context/request-context";
import { AdminAccessController } from "../src/modules/admin/admin-access.controller";
import {
  ADMIN_USER_ACCESS_SENSITIVE_FIELDS,
  UsersService
} from "../src/modules/users/users.service";

const buildTargetUser = (overrides: Partial<{
  id: string;
  isActive: boolean;
  roleName: RoleName;
}> = {}) => ({
  id: overrides.id ?? "user-target",
  firstName: "Target",
  lastName: "User",
  email: "target@example.com",
  tenantId: "tenant-a",
  isActive: overrides.isActive ?? true,
  lastLogin: null,
  createdAt: new Date("2026-01-01T00:00:00.000Z"),
  updatedAt: new Date("2026-06-01T00:00:00.000Z"),
  role: { name: overrides.roleName ?? RoleName.MANAGER },
  tenant: { id: "tenant-a", name: "Tenant A" },
  memberships: [{ tenant: { id: "tenant-a", name: "Tenant A" } }]
});

const createPrismaMock = () => ({
  user: {
    findFirst: jest.fn(),
    update: jest.fn(),
    count: jest.fn().mockResolvedValue(2)
  }
});

const adminContext = {
  actorId: "admin-1",
  actorEmail: "admin@example.com",
  actorRole: "ADMIN",
  tenantId: "tenant-a",
  module: "admin",
  ipAddress: null,
  userAgent: null,
  requestPath: "/admin/users/user-target/status"
};

describe("Admin user status mutation", () => {
  it("allows ADMIN to deactivate an own-tenant user and returns sanitized DTO", async () => {
    const prisma = createPrismaMock();
    const target = buildTargetUser();
    prisma.user.findFirst.mockResolvedValue(target);
    prisma.user.update.mockResolvedValue({ ...target, isActive: false });

    const service = new UsersService(prisma as any);
    const row = await requestContext.run(adminContext, () => service.updateAdminUserStatus("user-target", false));

    expect(prisma.user.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          id: "user-target",
          memberships: { some: { tenantId: "tenant-a" } }
        })
      })
    );
    expect(prisma.user.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "user-target" },
        data: { isActive: false }
      })
    );
    expect(row.isActive).toBe(false);
    expect(row.displayName).toBe("Target User");

    for (const field of ADMIN_USER_ACCESS_SENSITIVE_FIELDS) {
      expect(Object.prototype.hasOwnProperty.call(row, field)).toBe(false);
    }
  });

  it("allows ADMIN to reactivate an own-tenant user", async () => {
    const prisma = createPrismaMock();
    const target = buildTargetUser({ isActive: false });
    prisma.user.findFirst.mockResolvedValue(target);
    prisma.user.update.mockResolvedValue({ ...target, isActive: true });

    const service = new UsersService(prisma as any);
    const row = await requestContext.run(adminContext, () => service.updateAdminUserStatus("user-target", true));

    expect(row.isActive).toBe(true);
  });

  it("returns not found when ADMIN targets a user outside tenant scope", async () => {
    const prisma = createPrismaMock();
    prisma.user.findFirst.mockResolvedValue(null);

    const service = new UsersService(prisma as any);

    await expect(
      requestContext.run(adminContext, () => service.updateAdminUserStatus("other-tenant-user", false))
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it("blocks ADMIN from mutating SUPER_ADMIN users", async () => {
    const prisma = createPrismaMock();
    prisma.user.findFirst.mockResolvedValue(buildTargetUser({ roleName: RoleName.SUPER_ADMIN }));

    const service = new UsersService(prisma as any);

    await expect(
      requestContext.run(adminContext, () => service.updateAdminUserStatus("user-target", false))
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it("blocks self-deactivation", async () => {
    const prisma = createPrismaMock();
    prisma.user.findFirst.mockResolvedValue(buildTargetUser({ id: "admin-1" }));

    const service = new UsersService(prisma as any);

    await expect(
      requestContext.run(adminContext, () => service.updateAdminUserStatus("admin-1", false))
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it("blocks deactivating the last active SUPER_ADMIN", async () => {
    const prisma = createPrismaMock();
    const target = buildTargetUser({ roleName: RoleName.SUPER_ADMIN });
    prisma.user.findFirst.mockResolvedValue(target);
    prisma.user.count.mockResolvedValue(1);

    const service = new UsersService(prisma as any);

    await expect(
      requestContext.run(
        {
          ...adminContext,
          actorId: "super-1",
          actorRole: "SUPER_ADMIN",
          tenantId: null
        },
        () => service.updateAdminUserStatus("user-target", false)
      )
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it("allows SUPER_ADMIN to deactivate a non-super user when another active super admin exists", async () => {
    const prisma = createPrismaMock();
    const target = buildTargetUser({ roleName: RoleName.ADMIN });
    prisma.user.findFirst.mockResolvedValue(target);
    prisma.user.update.mockResolvedValue({ ...target, isActive: false });
    prisma.user.count.mockResolvedValue(2);

    const service = new UsersService(prisma as any);

    const row = await requestContext.run(
      {
        ...adminContext,
        actorId: "super-1",
        actorRole: "SUPER_ADMIN",
        tenantId: null
      },
      () => service.updateAdminUserStatus("user-target", false)
    );

    expect(row.isActive).toBe(false);
    expect(prisma.user.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "user-target" }
      })
    );
  });

  it("blocks non-admin roles from the admin status endpoint via RolesGuard", () => {
    const guard = new RolesGuard(new Reflector());

    const context = {
      getHandler: () => AdminAccessController.prototype.updateUserStatus,
      getClass: () => AdminAccessController,
      switchToHttp: () => ({
        getRequest: () => ({ user: { role: "VIEWER" } })
      })
    } as unknown as ExecutionContext;

    expect(guard.canActivate(context)).toBe(false);
  });
});
