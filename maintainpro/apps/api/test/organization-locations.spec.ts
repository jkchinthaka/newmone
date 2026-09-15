import { BadRequestException, NotFoundException } from "@nestjs/common";
import { FunctionalLocationType, Prisma, SiteType } from "@prisma/client";

import { OrganizationService } from "../src/modules/organization/organization.service";

function uniqueError() {
  return new Prisma.PrismaClientKnownRequestError("Unique constraint failed", {
    code: "P2002",
    clientVersion: "5.22.0"
  });
}

function createPrismaMock() {
  const sites = new Map<string, Record<string, unknown>>();
  const locations = new Map<string, Record<string, unknown>>();
  const departments = new Map<string, Record<string, unknown>>();

  return {
    tenant: {
      findFirst: jest.fn(async ({ where }: { where: { id: string } }) =>
        where.id === "tenant-a"
          ? {
              id: "tenant-a",
              name: "Org A",
              slug: "org-a",
              isActive: true,
              createdAt: new Date(),
              updatedAt: new Date()
            }
          : null
      )
    },
    site: {
      count: jest.fn(async () => sites.size),
      findFirst: jest.fn(async ({ where }: { where: Record<string, unknown> }) => {
        for (const site of sites.values()) {
          if (site.id === where.id && site.tenantId === where.tenantId) {
            return site;
          }
          if (where.code && site.code === where.code && site.tenantId === where.tenantId) {
            return site;
          }
        }
        return null;
      }),
      findMany: jest.fn(async ({ where }: { where: { tenantId: string } }) =>
        [...sites.values()].filter((s) => s.tenantId === where.tenantId)
      ),
      create: jest.fn(async ({ data }: { data: Record<string, unknown> }) => {
        const duplicate = [...sites.values()].some(
          (s) => s.tenantId === data.tenantId && s.code === data.code
        );
        if (duplicate) {
          throw uniqueError();
        }
        const id = `site-${sites.size + 1}`;
        const row = {
          id,
          isActive: true,
          description: null,
          address: null,
          contactPhone: null,
          ...data,
          createdAt: new Date(),
          updatedAt: new Date()
        };
        sites.set(id, row);
        return row;
      }),
      update: jest.fn(async ({ where, data }: { where: { id: string }; data: Record<string, unknown> }) => {
        const existing = sites.get(where.id);
        if (!existing) throw new Error("missing");
        const next = { ...existing, ...data, updatedAt: new Date() };
        sites.set(where.id, next);
        return next;
      })
    },
    functionalLocation: {
      count: jest.fn(async ({ where }: { where?: Record<string, unknown> } = {}) => {
        return [...locations.values()].filter((loc) => {
          if (where?.tenantId && loc.tenantId !== where.tenantId) return false;
          if (where?.siteId && loc.siteId !== where.siteId) return false;
          if (where?.parentId && loc.parentId !== where.parentId) return false;
          if (where?.isActive !== undefined && loc.isActive !== where.isActive) return false;
          return true;
        }).length;
      }),
      findFirst: jest.fn(async ({ where }: { where: Record<string, unknown> }) => {
        for (const loc of locations.values()) {
          if (where.id && loc.id !== where.id) continue;
          if (where.tenantId && loc.tenantId !== where.tenantId) continue;
          return {
            ...loc,
            site: sites.get(String(loc.siteId))
              ? {
                  id: loc.siteId,
                  code: sites.get(String(loc.siteId))!.code,
                  name: sites.get(String(loc.siteId))!.name,
                  type: sites.get(String(loc.siteId))!.type
                }
              : null,
            parent: loc.parentId ? locations.get(String(loc.parentId)) : null,
            department: null,
            _count: { children: 0 }
          };
        }
        return null;
      }),
      findMany: jest.fn(async ({ where }: { where: Record<string, unknown> }) =>
        [...locations.values()].filter((loc) => {
          if (where.tenantId && loc.tenantId !== where.tenantId) return false;
          if (where.siteId && loc.siteId !== where.siteId) return false;
          return true;
        })
      ),
      create: jest.fn(async ({ data }: { data: Record<string, unknown> }) => {
        const duplicate = [...locations.values()].some(
          (l) =>
            l.tenantId === data.tenantId && l.siteId === data.siteId && l.code === data.code
        );
        if (duplicate) {
          throw uniqueError();
        }
        const id = `loc-${locations.size + 1}`;
        const row = {
          id,
          isActive: true,
          parentId: null,
          departmentId: null,
          ...data,
          createdAt: new Date(),
          updatedAt: new Date()
        };
        locations.set(id, row);
        return row;
      }),
      update: jest.fn(async ({ where, data }: { where: { id: string }; data: Record<string, unknown> }) => {
        const existing = locations.get(where.id);
        if (!existing) throw new Error("missing");
        const next = { ...existing, ...data, updatedAt: new Date() };
        locations.set(where.id, next);
        return next;
      })
    },
    department: {
      findFirst: jest.fn(async ({ where }: { where: Record<string, unknown> }) => {
        for (const dept of departments.values()) {
          if (dept.id === where.id && dept.tenantId === where.tenantId) return dept;
        }
        return null;
      })
    },
    auditLog: {
      create: jest.fn(async () => ({ id: "audit-1" }))
    },
    __seedDepartment(dept: Record<string, unknown>) {
      departments.set(String(dept.id), dept);
    },
    __stores: { sites, locations, departments }
  };
}

describe("OrganizationService", () => {
  const actor = {
    sub: "user-1",
    email: "a@example.com",
    role: "ADMIN" as const,
    tenantId: "tenant-a"
  };

  it("creates sites with tenant uniqueness and blocks duplicates", async () => {
    const prisma = createPrismaMock();
    const service = new OrganizationService(prisma as never);

    const site = await service.createSite(
      "tenant-a",
      { code: "fac-01", name: "Factory", type: SiteType.FACTORY },
      actor
    );
    expect(site.code).toBe("FAC-01");

    await expect(
      service.createSite("tenant-a", { code: "FAC-01", name: "Dup", type: SiteType.FACTORY }, actor)
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it("enforces same-site parents and blocks hierarchy cycles on move", async () => {
    const prisma = createPrismaMock();
    const service = new OrganizationService(prisma as never);

    const site = await service.createSite(
      "tenant-a",
      { code: "FAC-01", name: "Factory", type: SiteType.FACTORY },
      actor
    );
    const building = await service.createLocation(
      "tenant-a",
      {
        siteId: site.id,
        code: "B1",
        name: "Building",
        type: FunctionalLocationType.BUILDING
      },
      actor
    );
    const floor = await service.createLocation(
      "tenant-a",
      {
        siteId: site.id,
        parentId: building.id,
        code: "F1",
        name: "Floor",
        type: FunctionalLocationType.FLOOR
      },
      actor
    );

    await expect(
      service.moveLocation(
        "tenant-a",
        building.id,
        { parentId: floor.id, reason: "Illegal cycle attempt" },
        actor
      )
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it("blocks cross-tenant department association", async () => {
    const prisma = createPrismaMock();
    prisma.__seedDepartment({ id: "dept-b", tenantId: "tenant-b", code: "PROD", name: "Prod" });
    const service = new OrganizationService(prisma as never);
    const site = await service.createSite(
      "tenant-a",
      { code: "FAC-01", name: "Factory", type: SiteType.FACTORY },
      actor
    );

    await expect(
      service.createLocation(
        "tenant-a",
        {
          siteId: site.id,
          code: "AREA-1",
          name: "Area",
          type: FunctionalLocationType.AREA,
          departmentId: "dept-b"
        },
        actor
      )
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it("returns organization summary labeled from Tenant", async () => {
    const prisma = createPrismaMock();
    const service = new OrganizationService(prisma as never);
    const summary = await service.getOrganizationSummary("tenant-a");
    expect(summary.organization.name).toBe("Org A");
    expect(summary.organization.code).toBe("org-a");
  });
});
