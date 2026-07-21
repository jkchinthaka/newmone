import { BadRequestException, ForbiddenException, NotFoundException } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { RoleName } from "@prisma/client";

import { requestContext } from "../src/common/context/request-context";
import { PLATFORM_SCOPED_KEY } from "../src/common/decorators/tenant-scope.decorator";
import { InventoryService } from "../src/modules/inventory/inventory.service";
import { PeopleService } from "../src/modules/people/people.service";
import { TenantContextGuard } from "../src/modules/tenancy/tenant-context.guard";
import { UsersService } from "../src/modules/users/users.service";

const TENANT_A = "tenant-a";
const TENANT_B = "tenant-b";

const actorCtx = (tenantId: string | null, role: RoleName = RoleName.ADMIN) => ({
  actorId: "actor-1",
  actorEmail: "actor@example.com",
  actorRole: role,
  tenantId,
  module: "test",
  ipAddress: null,
  userAgent: null,
  requestPath: null
});

const runAs = <T>(tenantId: string | null, fn: () => Promise<T> | T, role: RoleName = RoleName.ADMIN) =>
  requestContext.run(actorCtx(tenantId, role), fn);

function guardContext(request: Record<string, unknown>) {
  return {
    getHandler: () => ({}),
    getClass: () => ({}),
    switchToHttp: () => ({ getRequest: () => request })
  } as never;
}

describe("Cross-tenant isolation", () => {
  describe("TenantContextGuard — switching & platform scope", () => {
    const prisma = {
      tenantMembership: { findFirst: jest.fn(), findUnique: jest.fn() },
      tenant: { findUnique: jest.fn() }
    };

    const buildGuard = (meta: Record<string, boolean | undefined> = {}) =>
      new TenantContextGuard(
        { getAllAndOverride: jest.fn((key: string) => meta[key]) } as unknown as Reflector,
        prisma as never
      );

    beforeEach(() => jest.clearAllMocks());

    it("tenant-less authenticated user receives 403", async () => {
      prisma.tenantMembership.findFirst.mockResolvedValue(null);
      const request = { headers: {}, user: { sub: "u1", role: RoleName.TECHNICIAN, tenantId: null } };
      await expect(buildGuard().canActivate(guardContext(request))).rejects.toThrow(ForbiddenException);
    });

    it("Tenant A user cannot switch into Tenant B (no active membership)", async () => {
      // Requested tenant supplied via header; membership lookup (which requires an
      // active membership in an active tenant) returns nothing => denied.
      prisma.tenantMembership.findFirst.mockResolvedValue(null);
      const request = {
        headers: { "x-tenant-id": TENANT_B },
        user: { sub: "u1", role: RoleName.MANAGER, tenantId: TENANT_A }
      };
      await expect(buildGuard().canActivate(guardContext(request))).rejects.toThrow(/Tenant access denied/);
    });

    it("disabled membership / inactive tenant cannot be switched into", async () => {
      // findFirst filters on tenant.isActive:true, so a disabled tenant yields null.
      prisma.tenantMembership.findFirst.mockResolvedValue(null);
      const request = {
        headers: { "x-tenant-id": TENANT_B },
        user: { sub: "u1", role: RoleName.ADMIN, tenantId: TENANT_B }
      };
      await expect(buildGuard().canActivate(guardContext(request))).rejects.toThrow(/Tenant access denied/);
      expect(prisma.tenantMembership.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ tenant: { isActive: true } })
        })
      );
    });

    it("allows a user holding an active membership to operate in that tenant", async () => {
      prisma.tenantMembership.findFirst.mockResolvedValue({ tenantId: TENANT_A });
      const request = {
        headers: { "x-tenant-id": TENANT_A },
        user: { sub: "u1", role: RoleName.MANAGER, tenantId: TENANT_A }
      };
      await expect(buildGuard().canActivate(guardContext(request))).resolves.toBe(true);
    });

    it("platform scope requires explicit SUPER_ADMIN", async () => {
      const request = { headers: {}, user: { sub: "a1", role: RoleName.ADMIN, tenantId: null } };
      await expect(
        buildGuard({ [PLATFORM_SCOPED_KEY]: true }).canActivate(guardContext(request))
      ).rejects.toThrow(/SUPER_ADMIN/);
    });

    it("SUPER_ADMIN may hold platform scope without a tenant", async () => {
      const request = { headers: {}, user: { sub: "sa", role: RoleName.SUPER_ADMIN, tenantId: null } };
      await expect(
        buildGuard({ [PLATFORM_SCOPED_KEY]: true }).canActivate(guardContext(request))
      ).resolves.toBe(true);
    });
  });

  describe("InventoryService — cross-tenant spare part links", () => {
    const actorA = { sub: "u1", email: "u1@x.com", role: RoleName.ADMIN, tenantId: TENANT_A };

    const buildService = () => {
      const prisma = {
        sparePart: { findFirst: jest.fn().mockResolvedValue(null), create: jest.fn() },
        supplier: { findFirst: jest.fn() }
      };
      const service = new InventoryService(
        prisma as never,
        { createNotification: jest.fn() } as never,
        {} as never
      );
      return { service, prisma };
    };

    const partInput = { partNumber: "P-1", name: "Filter", category: "GEN", unitCost: 10 };

    it("rejects linking a supplier owned by another tenant", async () => {
      const { service, prisma } = buildService();
      prisma.supplier.findFirst.mockResolvedValue(null); // supplier belongs to tenant B
      await expect(
        service.createPart({ ...partInput, supplierId: "supplier-b" }, actorA)
      ).rejects.toBeInstanceOf(NotFoundException);
      expect(prisma.sparePart.create).not.toHaveBeenCalled();
    });

    it("allows linking a supplier owned by the active tenant", async () => {
      const { service, prisma } = buildService();
      prisma.supplier.findFirst.mockResolvedValue({ id: "supplier-a" });
      prisma.sparePart.create.mockResolvedValue({ id: "part-a" });
      await expect(
        service.createPart({ ...partInput, supplierId: "supplier-a" }, actorA)
      ).resolves.toEqual({ id: "part-a" });
      expect(prisma.supplier.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({ where: expect.objectContaining({ id: "supplier-a", tenantId: TENANT_A }) })
      );
    });
  });

  describe("PeopleService — cross-tenant employee access & links", () => {
    const buildService = () => {
      const prisma = {
        employee: { findFirst: jest.fn(), update: jest.fn() },
        department: { findFirst: jest.fn() }
      };
      const service = new PeopleService(prisma as never, { isEmailConfigured: () => false } as never);
      return { service, prisma };
    };

    it("Tenant A cannot read a Tenant B employee", async () => {
      const { service, prisma } = buildService();
      prisma.employee.findFirst.mockResolvedValue(null); // scoped to tenant A => not found
      await expect(runAs(TENANT_A, () => service.findOne("employee-b"))).rejects.toBeInstanceOf(NotFoundException);
      expect(prisma.employee.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({ where: expect.objectContaining({ id: "employee-b", tenantId: TENANT_A }) })
      );
    });

    it("Tenant A cannot reassign an employee to a Tenant B department", async () => {
      const { service, prisma } = buildService();
      prisma.employee.findFirst.mockResolvedValue({ id: "employee-a", linkedUserId: null });
      prisma.department.findFirst.mockResolvedValue(null); // department belongs to tenant B
      await expect(
        runAs(TENANT_A, () => service.update("employee-a", { departmentId: "dept-b" } as never))
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(prisma.employee.update).not.toHaveBeenCalled();
    });
  });

  describe("UsersService — cross-tenant role assignment", () => {
    it("rejects assigning a role owned by another tenant to a non-super-admin", async () => {
      const prisma = {
        user: { findUnique: jest.fn().mockResolvedValue(null) },
        role: { findUnique: jest.fn().mockResolvedValue({ id: "role-b", name: RoleName.MANAGER, tenantId: TENANT_B }) }
      };
      const service = new UsersService(prisma as never);
      await expect(
        runAs(TENANT_A, () =>
          service.create({
            email: "new@x.com",
            password: "Sup3rSecret!",
            firstName: "New",
            lastName: "User",
            roleId: "role-b"
          } as never)
        )
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it("permits assigning a global role (tenantId null)", async () => {
      const prisma = {
        user: {
          findUnique: jest.fn().mockResolvedValue(null),
          create: jest.fn().mockResolvedValue({ id: "user-a", role: { name: RoleName.MANAGER } })
        },
        role: { findUnique: jest.fn().mockResolvedValue({ id: "role-g", name: RoleName.MANAGER, tenantId: null }) },
        tenantMembership: { create: jest.fn() },
        $transaction: jest.fn()
      };
      prisma.$transaction.mockImplementation(async (fn: (tx: typeof prisma) => unknown) => fn(prisma));
      const service = new UsersService(prisma as never);
      await expect(
        runAs(TENANT_A, () =>
          service.create({
            email: "new@x.com",
            password: "Sup3rSecret!",
            firstName: "New",
            lastName: "User",
            roleId: "role-g"
          } as never)
        )
      ).resolves.toBeDefined();
      expect(prisma.role.findUnique).toHaveBeenCalled();
    });
  });
});
