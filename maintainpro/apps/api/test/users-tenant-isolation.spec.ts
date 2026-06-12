import { RoleName } from "@prisma/client";

import { requestContext } from "../src/common/context/request-context";
import { UsersService } from "../src/modules/users/users.service";

const createPrismaMock = () => ({
  user: {
    findMany: jest.fn().mockResolvedValue([]),
    findFirst: jest.fn(),
    findUnique: jest.fn().mockResolvedValue(null),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn()
  },
  role: {
    findUnique: jest.fn().mockResolvedValue({ id: "role-admin", name: RoleName.ADMIN })
  },
  tenantMembership: {
    findUnique: jest.fn().mockResolvedValue({ id: "membership-1" }),
    create: jest.fn()
  },
  workOrder: {
    count: jest.fn().mockResolvedValue(0)
  },
  $transaction: jest.fn(async (handler: (tx: any) => Promise<any>) =>
    handler({
      user: {
        create: jest.fn().mockResolvedValue({
          id: "user-1",
          email: "tenant-user@example.com",
          passwordHash: "hash",
          role: { id: "role-admin", name: RoleName.ADMIN }
        })
      },
      tenantMembership: {
        create: jest.fn().mockResolvedValue({ id: "membership-1" })
      }
    })
  )
});

describe("UsersService tenant isolation", () => {
  it("findAll filters by tenant membership for non-super-admin actors", async () => {
    const prisma = createPrismaMock();
    const service = new UsersService(prisma as any);

    await requestContext.run(
      {
        actorId: "actor-1",
        actorEmail: "actor@example.com",
        actorRole: "ADMIN",
        tenantId: "tenant-a",
        module: "users",
        ipAddress: null,
        userAgent: null,
        requestPath: "/users"
      },
      () => service.findAll()
    );

    expect(prisma.user.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          AND: expect.arrayContaining([{ memberships: { some: { tenantId: "tenant-a" } } }])
        })
      })
    );
  });

  it("create stamps tenantId and creates tenant membership in scoped context", async () => {
    const prisma = createPrismaMock();
    const service = new UsersService(prisma as any);

    await requestContext.run(
      {
        actorId: "actor-1",
        actorEmail: "actor@example.com",
        actorRole: "ADMIN",
        tenantId: "tenant-a",
        module: "users",
        ipAddress: null,
        userAgent: null,
        requestPath: "/users"
      },
      () =>
        service.create({
          email: "tenant-user@example.com",
          firstName: "Tenant",
          lastName: "User",
          password: "Password1!",
          roleId: "role-admin",
          phone: ""
        })
    );

    expect(prisma.$transaction).toHaveBeenCalled();
  });
});
