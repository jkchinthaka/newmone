import { ExecutionContext } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { RoleName } from "@prisma/client";

import { RolesGuard } from "../src/common/guards/roles.guard";
import { requestContext } from "../src/common/context/request-context";
import { AdminAccessController } from "../src/modules/admin/admin-access.controller";
import {
  ADMIN_TENANT_OVERVIEW_FIELDS,
  ADMIN_TENANT_SENSITIVE_FIELDS,
  AdminTenantOverviewRow,
  AdminTenantsService
} from "../src/modules/admin/admin-tenants.service";

const sampleTenant = {
  id: "tenant-a",
  name: "Tenant A",
  slug: "tenant-a",
  isActive: true,
  createdAt: new Date("2026-01-01T00:00:00.000Z"),
  updatedAt: new Date("2026-06-01T00:00:00.000Z"),
  _count: { memberships: 12 }
};

const createPrismaMock = () => ({
  tenant: {
    findMany: jest.fn().mockResolvedValue([sampleTenant])
  }
});

describe("Admin tenant overview", () => {
  it("returns sanitized rows for tenant-scoped ADMIN", async () => {
    const prisma = createPrismaMock();
    const service = new AdminTenantsService(prisma as any);

    const rows = await requestContext.run(
      {
        actorId: "admin-1",
        actorEmail: "admin@example.com",
        actorRole: "ADMIN",
        tenantId: "tenant-a",
        module: "admin",
        ipAddress: null,
        userAgent: null,
        requestPath: "/admin/tenants"
      },
      () => service.findAllForAdminTenantReview()
    );

    expect(prisma.tenant.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "tenant-a" },
        take: 1
      })
    );

    expect(rows).toHaveLength(1);
    const row = rows[0] as AdminTenantOverviewRow;
    expect(row.name).toBe("Tenant A");
    expect(row.memberCount).toBe(12);
    expect(Object.keys(row).sort()).toEqual([...ADMIN_TENANT_OVERVIEW_FIELDS].sort());

    for (const field of ADMIN_TENANT_SENSITIVE_FIELDS) {
      expect(Object.prototype.hasOwnProperty.call(row, field)).toBe(false);
    }
  });

  it("does not apply tenant filter for SUPER_ADMIN and can list multiple tenants", async () => {
    const prisma = createPrismaMock();
    prisma.tenant.findMany.mockResolvedValue([
      sampleTenant,
      {
        ...sampleTenant,
        id: "tenant-b",
        name: "Tenant B",
        slug: "tenant-b",
        _count: { memberships: 3 }
      }
    ]);
    const service = new AdminTenantsService(prisma as any);

    const rows = await requestContext.run(
      {
        actorId: "super-1",
        actorEmail: "super@example.com",
        actorRole: "SUPER_ADMIN",
        tenantId: null,
        module: "admin",
        ipAddress: null,
        userAgent: null,
        requestPath: "/admin/tenants"
      },
      () => service.findAllForAdminTenantReview()
    );

    expect(prisma.tenant.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {},
        take: 100
      })
    );
    expect(rows).toHaveLength(2);
  });

  it("blocks non-admin roles from the admin tenants endpoint via RolesGuard", () => {
    const guard = new RolesGuard(new Reflector());

    const context = {
      getHandler: () => AdminAccessController.prototype.listTenantsForReview,
      getClass: () => AdminAccessController,
      switchToHttp: () => ({
        getRequest: () => ({ user: { role: "VIEWER" } })
      })
    } as unknown as ExecutionContext;

    expect(guard.canActivate(context)).toBe(false);
  });
});
