import { BadRequestException, ForbiddenException, NotFoundException } from "@nestjs/common";
import { RoleName } from "@prisma/client";

import { requestContext } from "../src/common/context/request-context";
import {
  ADMIN_USER_ACCESS_SENSITIVE_FIELDS,
  PUBLIC_USER_RESPONSE_FIELDS,
  UsersService
} from "../src/modules/users/users.service";

const sampleDbUser = {
  id: "user-1",
  firstName: "Ada",
  lastName: "Lovelace",
  email: "ada@example.com",
  passwordHash: "secret-hash",
  tenantId: "tenant-a",
  roleId: "role-manager",
  departmentId: "dept-1",
  avatar: "https://example.com/avatar.png",
  isActive: true,
  lastLogin: new Date("2026-06-01T10:00:00.000Z"),
  failedLoginAttempts: 3,
  lockedUntil: new Date("2026-06-02T10:00:00.000Z"),
  createdAt: new Date("2026-01-01T00:00:00.000Z"),
  updatedAt: new Date("2026-06-01T12:00:00.000Z"),
  role: {
    id: "role-manager",
    name: RoleName.MANAGER,
    permissionIds: ["perm-1"],
    permissions: [{ id: "perm-1", key: "users.view" }]
  }
};

const buildTargetUser = (overrides: Partial<{ id: string; isActive: boolean; roleName: RoleName }> = {}) => ({
  id: overrides.id ?? "user-target",
  firstName: "Target",
  lastName: "User",
  email: "target@example.com",
  tenantId: "tenant-a",
  isActive: overrides.isActive ?? true,
  lastLogin: null,
  createdAt: new Date("2026-01-01T00:00:00.000Z"),
  updatedAt: new Date("2026-06-01T00:00:00.000Z"),
  role: { id: "role-manager", name: overrides.roleName ?? RoleName.MANAGER },
  tenant: { id: "tenant-a", name: "Tenant A" },
  memberships: [{ tenant: { id: "tenant-a", name: "Tenant A" } }]
});

const createPrismaMock = () => ({
  user: {
    findMany: jest.fn().mockResolvedValue([sampleDbUser]),
    findFirst: jest.fn(),
    update: jest.fn(),
    count: jest.fn().mockResolvedValue(2)
  },
  tenantMembership: {
    findUnique: jest.fn()
  }
});

const adminContext = {
  actorId: "admin-1",
  actorEmail: "admin@example.com",
  actorRole: "ADMIN",
  tenantId: "tenant-a",
  module: "users",
  ipAddress: null,
  userAgent: null,
  requestPath: "/users/user-target/status"
};

describe("Legacy users API hardening", () => {
  it("returns allowlisted GET /users rows without sensitive auth fields", async () => {
    const prisma = createPrismaMock();
    const service = new UsersService(prisma as any);

    const rows = await requestContext.run(adminContext, () => service.findAll());

    expect(rows).toHaveLength(1);
    const row = rows[0];
    expect(Object.keys(row).sort()).toEqual([...PUBLIC_USER_RESPONSE_FIELDS].sort());
    expect(row.role).toEqual({ id: "role-manager", name: RoleName.MANAGER });
    expect(Object.prototype.hasOwnProperty.call(row.role, "permissions")).toBe(false);
    expect(Object.prototype.hasOwnProperty.call(row.role, "permissionIds")).toBe(false);

    for (const field of ADMIN_USER_ACCESS_SENSITIVE_FIELDS) {
      expect(Object.prototype.hasOwnProperty.call(row, field)).toBe(false);
    }

    expect(prisma.user.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        include: { role: { select: { id: true, name: true } } }
      })
    );
  });

  it("applies ADMIN-002B protections through legacy setActive for own-tenant users", async () => {
    const prisma = createPrismaMock();
    const target = buildTargetUser();
    prisma.user.findFirst.mockResolvedValue(target);
    prisma.user.update.mockResolvedValue({ ...target, isActive: false });

    const service = new UsersService(prisma as any);
    const row = await requestContext.run(adminContext, () => service.setActive("user-target", false));

    expect(row.isActive).toBe(false);
    expect(row.role.name).toBe(RoleName.MANAGER);
    for (const field of ADMIN_USER_ACCESS_SENSITIVE_FIELDS) {
      expect(Object.prototype.hasOwnProperty.call(row, field)).toBe(false);
    }
  });

  it("blocks legacy setActive for cross-tenant targets", async () => {
    const prisma = createPrismaMock();
    prisma.user.findFirst.mockResolvedValue(null);
    const service = new UsersService(prisma as any);

    await expect(
      requestContext.run(adminContext, () => service.setActive("other-tenant-user", false))
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it("blocks legacy setActive for SUPER_ADMIN targets from ADMIN actors", async () => {
    const prisma = createPrismaMock();
    prisma.user.findFirst.mockResolvedValue(buildTargetUser({ roleName: RoleName.SUPER_ADMIN }));
    const service = new UsersService(prisma as any);

    await expect(
      requestContext.run(adminContext, () => service.setActive("user-target", false))
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it("blocks self-deactivation through legacy setActive", async () => {
    const prisma = createPrismaMock();
    prisma.user.findFirst.mockResolvedValue(buildTargetUser({ id: "admin-1" }));
    const service = new UsersService(prisma as any);

    await expect(
      requestContext.run(adminContext, () => service.setActive("admin-1", false))
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it("blocks deactivating the last active SUPER_ADMIN through legacy setActive", async () => {
    const prisma = createPrismaMock();
    prisma.user.findFirst.mockResolvedValue(buildTargetUser({ roleName: RoleName.SUPER_ADMIN }));
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
        () => service.setActive("user-target", false)
      )
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});
