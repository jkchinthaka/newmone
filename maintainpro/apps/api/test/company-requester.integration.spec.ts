/**
 * Disposable SQL Server proof for department requesters.
 * Refuses nelna and MaintainProDev. Does not grant request permissions to seeded production roles.
 */
import { ForbiddenException, NotFoundException } from "@nestjs/common";
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

import { MaintenanceRequestsService } from "../src/modules/maintenance-requests/maintenance-requests.service";

function databaseName(url: string): string {
  const match = url.match(/(?:database|initial catalog)\s*=\s*([^;]+)/i);
  return match?.[1]?.trim() ?? "";
}

const databaseUrl = process.env.DATABASE_URL?.trim() ?? "";
const name = databaseName(databaseUrl);
if (/nelna|MaintainProDev/i.test(databaseUrl)) {
  throw new Error(`Refusing requester tests against shared database ${name || databaseUrl}`);
}
const usable = Boolean(databaseUrl) && name.startsWith("maintainpro_e2e_");
const describeIfDb = usable ? describe : describe.skip;

const REQUEST_KEYS = [
  "maintenance_requests.create",
  "maintenance_requests.view_own",
  "maintenance_requests.cancel_own"
] as const;

const DEPARTMENTS = ["Finance", "Farm", "Sales", "Warehouse", "Production"] as const;

describeIfDb("company requester access (disposable SQL Server)", () => {
  jest.setTimeout(120_000);
  const prisma = new PrismaClient();
  const requests = new MaintenanceRequestsService(
    prisma as never,
    { validateSiteAndLocation: jest.fn(), resolveLocationPath: jest.fn() } as never,
    { create: jest.fn() } as never,
    { createNotification: jest.fn().mockResolvedValue(undefined) } as never
  );
  const createdRequestIds: string[] = [];

  beforeAll(async () => {
    await prisma.$connect();
  });

  afterAll(async () => {
    if (createdRequestIds.length) {
      await prisma.maintenanceRequestHistory.deleteMany({
        where: { requestId: { in: createdRequestIds } }
      });
      await prisma.maintenanceRequest.deleteMany({ where: { id: { in: createdRequestIds } } });
    }
    await prisma.$disconnect();
  });

  it("lets each department requester report and read only their own request", async () => {
    const tenant = await prisma.tenant.findUnique({ where: { slug: "default" }, select: { id: true } });
    if (!tenant) throw new Error("Seeded tenant slug=default is missing");
    const site = await prisma.site.findFirst({ where: { tenantId: tenant.id }, select: { id: true } });
    if (!site) throw new Error("Seeded site is missing");
    const permissions = await prisma.permission.findMany({
      where: { key: { in: [...REQUEST_KEYS] } },
      select: { id: true, key: true }
    });
    expect(permissions.map((row) => row.key).sort()).toEqual([...REQUEST_KEYS].sort());

    const otherTenant = await prisma.tenant.create({
      data: { name: "Requester isolation tenant", slug: `req-iso-${Date.now()}` },
      select: { id: true }
    });

    const actors: Array<{ label: string; sub: string; role: string; requestNumber: string; requestId: string }> = [];

    for (const label of DEPARTMENTS) {
      const role = await prisma.role.create({
        data: { tenantId: tenant.id, name: `QA_${label.toUpperCase()}_REQUESTER` }
      });
      await prisma.rolePermission.createMany({
        data: permissions.map((permission) => ({ roleId: role.id, permissionId: permission.id }))
      });
      const passwordHash = await bcrypt.hash(`disposable-${label}-${Date.now()}`, 4);
      const user = await prisma.user.create({
        data: {
          tenantId: tenant.id,
          email: `qa-${label.toLowerCase()}-requester-${Date.now()}@maintainpro.test`,
          passwordHash,
          firstName: label,
          lastName: "Requester",
          roleId: role.id,
          isActive: true
        }
      });
      const actor = {
        sub: user.id,
        role: role.name,
        tenantId: tenant.id,
        email: user.email,
        permissions: [] as string[]
      };
      const created = await requests.create(tenant.id, actor, {
        targetUnresolved: true,
        siteId: site.id,
        approximateLocation: `${label} yard`,
        description: `${label} reports a physical maintenance issue for disposable proof`,
        reportedUrgency: "NORMAL",
        safetyImpact: "NO",
        productionImpact: "NONE",
        idempotencyKey: `qa-req-${label}-${user.id}`
      });
      createdRequestIds.push(created.id);
      const replay = await requests.create(tenant.id, actor, {
        targetUnresolved: true,
        siteId: site.id,
        approximateLocation: `${label} yard`,
        description: `${label} reports a physical maintenance issue for disposable proof`,
        idempotencyKey: `qa-req-${label}-${user.id}`
      });
      expect(replay.requestNumber).toBe(created.requestNumber);
      expect(replay.id).toBe(created.id);

      const ownList = await requests.list(tenant.id, actor, { mine: false, page: 1, limit: 25 });
      expect(ownList.items.every((row) => row.reportedBy?.id === user.id)).toBe(true);
      expect(ownList.items.some((row) => row.id === created.id)).toBe(true);

      await expect(requests.list(tenant.id, actor, { triageQueue: true })).rejects.toBeInstanceOf(
        ForbiddenException
      );
      await expect(requests.startReview(tenant.id, created.id, actor)).rejects.toBeInstanceOf(
        ForbiddenException
      );
      await expect(requests.findOne(otherTenant.id, created.id, actor)).rejects.toBeInstanceOf(
        NotFoundException
      );

      actors.push({
        label,
        sub: user.id,
        role: role.name,
        requestNumber: created.requestNumber,
        requestId: created.id
      });
    }

    const finance = actors[0];
    const sales = actors[2];
    await expect(
      requests.findOne(tenant.id, finance.requestId, {
        sub: sales.sub,
        role: sales.role,
        tenantId: tenant.id,
        permissions: []
      })
    ).rejects.toBeInstanceOf(ForbiddenException);

    const manager = await prisma.user.findFirst({
      where: { tenantId: tenant.id, role: { name: "MANAGER" } },
      select: { id: true }
    });
    if (!manager) throw new Error("Seeded MANAGER is missing");
    const review = await requests.list(tenant.id, {
      sub: manager.id,
      role: "MANAGER",
      tenantId: tenant.id,
      permissions: []
    }, { page: 1, limit: 100 });
    expect(review.items.some((row) => row.requestNumber === finance.requestNumber)).toBe(true);
  });
});
