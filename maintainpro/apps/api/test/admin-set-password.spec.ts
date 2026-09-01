import { AuditAction, RoleName } from "@prisma/client";

import { requestContext } from "../src/common/context/request-context";
import { UsersService } from "../src/modules/users/users.service";

const targetUser = {
  id: "user-target",
  firstName: "Target",
  lastName: "User",
  email: "target@example.com",
  tenantId: "tenant-a",
  isActive: true,
  lastLogin: null,
  createdAt: new Date("2026-01-01T00:00:00.000Z"),
  updatedAt: new Date("2026-01-02T00:00:00.000Z"),
  role: { id: "role-1", name: RoleName.TECHNICIAN },
  tenant: { id: "tenant-a", name: "Tenant A" },
  memberships: [{ tenant: { id: "tenant-a", name: "Tenant A" } }]
};

const createPrismaMock = () => ({
  user: {
    findFirst: jest.fn().mockResolvedValue(targetUser),
    update: jest.fn().mockResolvedValue(targetUser)
  },
  refreshToken: {
    updateMany: jest.fn().mockResolvedValue({ count: 2 })
  },
  auditLog: {
    create: jest.fn().mockResolvedValue({ id: "audit-1" })
  },
  $transaction: jest.fn(async (fn: (tx: unknown) => Promise<unknown>) =>
    fn({
      user: {
        update: jest.fn().mockResolvedValue(targetUser)
      },
      refreshToken: {
        updateMany: jest.fn().mockResolvedValue({ count: 2 })
      },
      auditLog: {
        create: jest.fn().mockResolvedValue({ id: "audit-1" })
      }
    })
  )
});

describe("Super admin set user password", () => {
  it("hashes password, clears lockout, revokes refresh sessions, and audits", async () => {
    const prisma = createPrismaMock();
    const service = new UsersService(prisma as any);

    const row = await requestContext.run(
      {
        actorId: "super-1",
        actorEmail: "super@example.com",
        actorRole: "SUPER_ADMIN",
        tenantId: null,
        module: "admin",
        ipAddress: "127.0.0.1",
        userAgent: "jest",
        requestPath: "/admin/users/user-target/set-password"
      },
      () => service.setAdminUserPassword("user-target", "new-password-1", "new-password-1")
    );

    expect(prisma.$transaction).toHaveBeenCalled();
    expect(row.email).toBe("target@example.com");
    expect(row.roleName).toBe("TECHNICIAN");

    const tx = (prisma.$transaction as jest.Mock).mock.calls[0][0];
    const txClient = {
      user: { update: jest.fn().mockResolvedValue(targetUser) },
      refreshToken: { updateMany: jest.fn().mockResolvedValue({ count: 2 }) },
      auditLog: { create: jest.fn().mockResolvedValue({ id: "audit-1" }) }
    };
    await tx(txClient);

    expect(txClient.user.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "user-target" },
        data: expect.objectContaining({
          failedLoginAttempts: 0,
          lockedUntil: null,
          mustChangePassword: false,
          passwordHash: expect.any(String)
        })
      })
    );
    expect(txClient.refreshToken.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { userId: "user-target", revokedAt: null }
      })
    );
    expect(txClient.auditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          action: AuditAction.UPDATE,
          reason: "Super admin set user password"
        })
      })
    );
  });

  it("rejects mismatched confirmation passwords", async () => {
    const prisma = createPrismaMock();
    const service = new UsersService(prisma as any);

    await expect(
      requestContext.run(
        {
          actorId: "super-1",
          actorEmail: "super@example.com",
          actorRole: "SUPER_ADMIN",
          tenantId: null,
          module: "admin",
          ipAddress: null,
          userAgent: null,
          requestPath: "/admin/users/user-target/set-password"
        },
        () => service.setAdminUserPassword("user-target", "new-password-1", "other-password")
      )
    ).rejects.toThrow("Passwords do not match");
  });
});
