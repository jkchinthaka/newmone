import { RoleName } from "@prisma/client";

import { requestContext } from "../src/common/context/request-context";
import {
  ADMIN_USER_ACCESS_SENSITIVE_FIELDS,
  AdminUserAccessRow,
  UsersService
} from "../src/modules/users/users.service";

const sampleUser = {
  id: "user-1",
  firstName: "Ada",
  lastName: "Lovelace",
  email: "ada@example.com",
  tenantId: "tenant-a",
  isActive: true,
  lastLogin: new Date("2026-06-01T10:00:00.000Z"),
  createdAt: new Date("2026-01-01T00:00:00.000Z"),
  updatedAt: new Date("2026-06-01T12:00:00.000Z"),
  role: { name: RoleName.ADMIN },
  tenant: { id: "tenant-a", name: "Tenant A" },
  memberships: [{ tenant: { id: "tenant-a", name: "Tenant A" } }]
};

const createPrismaMock = () => ({
  user: {
    findMany: jest.fn().mockResolvedValue([sampleUser])
  }
});

describe("Admin user access view", () => {
  it("returns sanitized rows without sensitive auth fields for tenant-scoped ADMIN", async () => {
    const prisma = createPrismaMock();
    const service = new UsersService(prisma as any);

    const rows = await requestContext.run(
      {
        actorId: "actor-1",
        actorEmail: "admin@example.com",
        actorRole: "ADMIN",
        tenantId: "tenant-a",
        module: "admin",
        ipAddress: null,
        userAgent: null,
        requestPath: "/admin/users"
      },
      () => service.findAllForAdminAccessView()
    );

    expect(prisma.user.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          AND: expect.arrayContaining([{ memberships: { some: { tenantId: "tenant-a" } } }])
        })
      })
    );

    expect(rows).toHaveLength(1);
    const row = rows[0] as AdminUserAccessRow;
    expect(row.displayName).toBe("Ada Lovelace");
    expect(row.roleName).toBe("ADMIN");
    expect(row.tenantName).toBe("Tenant A");

    for (const field of ADMIN_USER_ACCESS_SENSITIVE_FIELDS) {
      expect(Object.prototype.hasOwnProperty.call(row, field)).toBe(false);
    }
  });

  it("does not apply tenant membership filter for SUPER_ADMIN", async () => {
    const prisma = createPrismaMock();
    const service = new UsersService(prisma as any);

    await requestContext.run(
      {
        actorId: "actor-1",
        actorEmail: "super@example.com",
        actorRole: "SUPER_ADMIN",
        tenantId: null,
        module: "admin",
        ipAddress: null,
        userAgent: null,
        requestPath: "/admin/users"
      },
      () => service.findAllForAdminAccessView()
    );

    expect(prisma.user.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          AND: expect.not.arrayContaining([expect.objectContaining({ memberships: expect.anything() })])
        })
      })
    );
  });
});
