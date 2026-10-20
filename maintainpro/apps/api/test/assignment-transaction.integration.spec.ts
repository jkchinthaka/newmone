/**
 * Real SQL Server checks for WorkOrdersService.assign().
 * Refuses any URL whose database is not a maintainpro_e2e_* database.
 */
import { randomUUID } from "node:crypto";
import { ConflictException, NotFoundException } from "@nestjs/common";
import { PrismaClient, RoleName, WorkOrderStatus } from "@prisma/client";

import { PrismaService } from "../src/database/prisma.service";
import { WorkOrderAssigneesService } from "../src/modules/work-orders/work-order-assignees.service";
import { WorkOrdersService } from "../src/modules/work-orders/work-orders.service";
import { WorkforceEmployeesService } from "../src/modules/workforce/workforce-employees.service";
import { WorkforcePlanningService } from "../src/modules/workforce/workforce-planning.service";

function databaseName(url: string): string {
  const match = url.match(/(?:database|initial catalog)\s*=\s*([^;]+)/i);
  return match?.[1]?.trim() ?? "";
}

const disposableUrl = process.env.DISPOSABLE_SQLSERVER_URL?.trim() ?? "";
const name = databaseName(disposableUrl);
const usable =
  name.startsWith("maintainpro_e2e_") &&
  !/nelna/i.test(disposableUrl) &&
  !/MaintainProDev/i.test(disposableUrl);
const describeIfDisposable = usable ? describe : describe.skip;

describeIfDisposable("assignment transaction (disposable SQL Server)", () => {
  jest.setTimeout(60_000);
  const prisma = usable
    ? new PrismaClient({ datasources: { db: { url: disposableUrl } } })
    : (null as unknown as PrismaClient);
  let service: WorkOrdersService;
  const createdTenantIds: string[] = [];

  beforeAll(async () => {
    process.env.DATABASE_URL = disposableUrl;
    process.env.PRIMARY_DATABASE_URL = disposableUrl;
    process.env.DATABASE_REPLICATION_ENABLED = "false";
    process.env.DATABASE_REPLICATION_MODE = "disabled";
    const db = new PrismaService();
    await db.onModuleInit();
    const employees = new WorkforceEmployeesService(db);
    const planning = new WorkforcePlanningService(db);
    const assignees = new WorkOrderAssigneesService(db, planning, employees);
    service = new WorkOrdersService(
      db,
      { createNotification: async () => ({}) } as never,
      {} as never,
      {} as never,
      assignees
    );
  });

  afterAll(async () => {
    if (!usable) return;
    await prisma.$disconnect();
  });

  async function fixture(label: string) {
    const stamp = `${Date.now()}-${randomUUID().slice(0, 8)}-${label}`;
    const tenant = await prisma.tenant.create({
      data: { name: `E2E assignment ${stamp}`, slug: `e2e-assign-${stamp}` }
    });
    createdTenantIds.push(tenant.id);
    const managerRole = await prisma.role.create({
      data: { tenantId: tenant.id, name: RoleName.MANAGER }
    });
    const techRole = await prisma.role.create({
      data: { tenantId: tenant.id, name: RoleName.TECHNICIAN }
    });
    const manager = await prisma.user.create({
      data: {
        tenantId: tenant.id,
        email: `mgr-${stamp}@e2e.maintainpro.test`,
        passwordHash: "e2e-not-a-secret",
        firstName: "E2E",
        lastName: "Manager",
        roleId: managerRole.id
      }
    });
    const technician = await prisma.user.create({
      data: {
        tenantId: tenant.id,
        email: `tech-${stamp}@e2e.maintainpro.test`,
        passwordHash: "e2e-not-a-secret",
        firstName: "E2E",
        lastName: "Technician",
        roleId: techRole.id
      }
    });
    const actor = {
      sub: manager.id,
      email: manager.email,
      role: RoleName.MANAGER,
      tenantId: tenant.id
    };
    return { tenant, technician, actor, stamp };
  }

  async function workOrder(tenantId: string, createdById: string, woNumber: string) {
    return prisma.workOrder.create({
      data: {
        tenantId,
        woNumber,
        title: "Assignment transaction",
        description: "Disposable assignment transaction verification",
        type: "CORRECTIVE",
        status: WorkOrderStatus.PLANNED,
        approvalStatus: "APPROVED",
        createdById
      }
    });
  }

  async function employeeFor(tenantId: string, user: { id: string; email: string; firstName: string; lastName: string }) {
    return prisma.employee.create({
      data: {
        tenantId,
        employeeNo: `EMP-${user.id}`,
        fullName: `${user.firstName} ${user.lastName}`,
        email: user.email,
        designation: "Technician",
        linkedUserId: user.id,
        availabilityStatus: "AVAILABLE",
        canReceiveWorkOrders: true,
        active: true
      }
    });
  }

  it("commits the assignee, technician link, audit, and status history together", async () => {
    const { tenant, technician, actor, stamp } = await fixture("success");
    const employee = await employeeFor(tenant.id, technician);
    const wo = await workOrder(tenant.id, actor.sub, `WO-E2E-${stamp}`);

    await service.assign(wo.id, technician.id, actor);

    const saved = await prisma.workOrder.findUnique({ where: { id: wo.id } });
    const assignees = await prisma.workOrderAssignee.findMany({ where: { workOrderId: wo.id } });
    const history = await prisma.workOrderStatusHistory.findMany({ where: { workOrderId: wo.id } });
    const audits = await prisma.auditLog.findMany({
      where: { tenantId: tenant.id, entityId: { in: [wo.id, assignees[0]?.id].filter(Boolean) as string[] } }
    });
    expect(saved?.technicianId).toBe(technician.id);
    expect(saved?.status).toBe(WorkOrderStatus.ASSIGNED);
    expect(assignees).toHaveLength(1);
    expect(assignees[0].employeeId).toBe(employee.id);
    expect(assignees[0].isPrimary).toBe(true);
    expect(history).toHaveLength(1);
    expect(audits.length).toBeGreaterThan(0);
  });

  it("rolls back assignee, primary flag, technician link, new employee, audit, and history when the work-order update fails", async () => {
    const { tenant, technician, actor, stamp } = await fixture("rollback");
    const primaryUser = await prisma.user.create({
      data: {
        tenantId: tenant.id,
        email: `primary-${stamp}@e2e.maintainpro.test`,
        passwordHash: "e2e-not-a-secret",
        firstName: "Primary",
        lastName: "Tech",
        roleId: (await prisma.role.findFirstOrThrow({ where: { tenantId: tenant.id, name: RoleName.TECHNICIAN } })).id
      }
    });
    const primaryEmployee = await employeeFor(tenant.id, primaryUser);
    const wo = await workOrder(tenant.id, actor.sub, `WO-E2E-RB-${stamp}`);
    const existing = await prisma.workOrderAssignee.create({
      data: {
        tenantId: tenant.id,
        workOrderId: wo.id,
        employeeId: primaryEmployee.id,
        isPrimary: true,
        assignmentStatus: "ASSIGNED"
      }
    });
    await prisma.workOrder.update({ where: { id: wo.id }, data: { technicianId: primaryUser.id } });

    await prisma.$executeRawUnsafe(
      `ALTER TABLE [WorkOrder] WITH NOCHECK ADD CONSTRAINT [CK_e2e_block_assigned] CHECK ([id] <> N'${wo.id}' OR [status] <> N'ASSIGNED')`
    );
    try {
      await expect(service.assign(wo.id, technician.id, actor)).rejects.toThrow();
    } finally {
      await prisma.$executeRawUnsafe(
        "IF OBJECT_ID('CK_e2e_block_assigned', 'C') IS NOT NULL ALTER TABLE [WorkOrder] DROP CONSTRAINT [CK_e2e_block_assigned]"
      );
    }

    const saved = await prisma.workOrder.findUnique({ where: { id: wo.id } });
    const assignees = await prisma.workOrderAssignee.findMany({ where: { workOrderId: wo.id } });
    const created = await prisma.employee.findFirst({ where: { linkedUserId: technician.id, tenantId: tenant.id } });
    const history = await prisma.workOrderStatusHistory.count({ where: { workOrderId: wo.id } });
    const audits = await prisma.auditLog.count({ where: { tenantId: tenant.id, entityId: wo.id } });
    expect(saved?.technicianId).toBe(primaryUser.id);
    expect(saved?.status).toBe(WorkOrderStatus.PLANNED);
    expect(assignees).toEqual([expect.objectContaining({ id: existing.id, isPrimary: true })]);
    expect(created).toBeNull();
    expect(history).toBe(0);
    expect(audits).toBe(0);
  });

  it("keeps a single assignee when the same technician is assigned twice", async () => {
    const { tenant, technician, actor, stamp } = await fixture("duplicate");
    await employeeFor(tenant.id, technician);
    const wo = await workOrder(tenant.id, actor.sub, `WO-E2E-DUP-${stamp}`);
    await service.assign(wo.id, technician.id, actor);
    await service.assign(wo.id, technician.id, actor, { reason: "Same technician" });
    const assignees = await prisma.workOrderAssignee.findMany({
      where: { workOrderId: wo.id, assignmentStatus: { not: "REMOVED" } }
    });
    expect(assignees).toHaveLength(1);
    expect(assignees.filter((row) => row.isPrimary)).toHaveLength(1);
  });

  // A committed assignment bumps version and technicianId together. Callers that still
  // send the previous version get ConflictException even when they omit a reassignment reason.
  it("returns a conflict when the technician changed before this request used a stale version", async () => {
    const { tenant, technician, actor, stamp } = await fixture("stale-version");
    const winner = await prisma.user.create({
      data: {
        tenantId: tenant.id,
        email: `winner-${stamp}@e2e.maintainpro.test`,
        passwordHash: "e2e-not-a-secret",
        firstName: "Winner",
        lastName: "Tech",
        roleId: (await prisma.role.findFirstOrThrow({ where: { tenantId: tenant.id, name: RoleName.TECHNICIAN } })).id
      }
    });
    const winnerEmployee = await employeeFor(tenant.id, winner);
    await employeeFor(tenant.id, technician);
    const wo = await workOrder(tenant.id, actor.sub, `WO-E2E-STALE-${stamp}`);
    await prisma.workOrderAssignee.create({
      data: {
        tenantId: tenant.id,
        workOrderId: wo.id,
        employeeId: winnerEmployee.id,
        isPrimary: true,
        assignmentStatus: "ASSIGNED"
      }
    });
    await prisma.workOrder.update({
      where: { id: wo.id },
      data: { technicianId: winner.id, status: WorkOrderStatus.ASSIGNED, version: 2 }
    });

    await expect(service.assign(wo.id, technician.id, actor, { expectedVersion: 1 })).rejects.toBeInstanceOf(
      ConflictException
    );

    const saved = await prisma.workOrder.findUnique({ where: { id: wo.id } });
    const assignees = await prisma.workOrderAssignee.findMany({ where: { workOrderId: wo.id } });
    expect(saved?.technicianId).toBe(winner.id);
    expect(saved?.version).toBe(2);
    expect(assignees).toHaveLength(1);
    expect(assignees[0].employeeId).toBe(winnerEmployee.id);
  });

  it("lets one concurrent assignment win and rolls the version conflict back", async () => {
    const { tenant, technician, actor, stamp } = await fixture("concurrent");
    const second = await prisma.user.create({
      data: {
        tenantId: tenant.id,
        email: `tech2-${stamp}@e2e.maintainpro.test`,
        passwordHash: "e2e-not-a-secret",
        firstName: "Second",
        lastName: "Tech",
        roleId: (await prisma.role.findFirstOrThrow({ where: { tenantId: tenant.id, name: RoleName.TECHNICIAN } })).id
      }
    });
    await employeeFor(tenant.id, technician);
    await employeeFor(tenant.id, second);
    const wo = await workOrder(tenant.id, actor.sub, `WO-E2E-CC-${stamp}`);
    const results = await Promise.allSettled([
      service.assign(wo.id, technician.id, actor, { expectedVersion: 1 }),
      service.assign(wo.id, second.id, actor, { expectedVersion: 1, reason: "Concurrent assign" })
    ]);
    const rejected = results.filter((result) => result.status === "rejected");
    expect(rejected).toHaveLength(1);
    expect((rejected[0] as PromiseRejectedResult).reason).toBeInstanceOf(ConflictException);
    const assignees = await prisma.workOrderAssignee.findMany({ where: { workOrderId: wo.id } });
    const saved = await prisma.workOrder.findUnique({ where: { id: wo.id } });
    expect(assignees).toHaveLength(1);
    expect(assignees.filter((row) => row.isPrimary)).toHaveLength(1);
    expect([technician.id, second.id]).toContain(saved?.technicianId);
    const winnerEmployee = assignees[0].employeeId;
    const loserUserId = saved?.technicianId === technician.id ? second.id : technician.id;
    const loserEmployee = await prisma.employee.findFirst({
      where: { linkedUserId: loserUserId, tenantId: tenant.id }
    });
    expect(assignees.some((row) => row.employeeId === loserEmployee?.id)).toBe(false);
    expect(winnerEmployee).toBeTruthy();
  });

  it("does not assign a technician from another tenant", async () => {
    const { tenant, actor, stamp } = await fixture("tenant-a");
    const other = await fixture("tenant-b");
    const wo = await workOrder(tenant.id, actor.sub, `WO-E2E-TN-${stamp}`);
    await expect(service.assign(wo.id, other.technician.id, actor)).rejects.toBeInstanceOf(NotFoundException);
    expect(await prisma.workOrderAssignee.count({ where: { workOrderId: wo.id } })).toBe(0);
    const saved = await prisma.workOrder.findUnique({ where: { id: wo.id } });
    expect(saved?.technicianId).toBeNull();
  });

  it("rejects an employee whose availability changes before the assignment lock is acquired", async () => {
    const { tenant, technician, actor, stamp } = await fixture("availability");
    const employee = await employeeFor(tenant.id, technician);
    const wo = await workOrder(tenant.id, actor.sub, `WO-E2E-AV-${stamp}`);
    let release: () => void = () => undefined;
    const released = new Promise<void>((resolve) => {
      release = resolve;
    });
    const holder = prisma.$transaction(
      async (tx) => {
        await tx.$executeRaw`UPDATE [Employee] SET [availabilityStatus] = N'INACTIVE' WHERE [id] = ${employee.id}`;
        await released;
      },
      { maxWait: 5_000, timeout: 20_000 }
    );
    await new Promise((resolve) => setTimeout(resolve, 400));
    const attempt = service.assign(wo.id, technician.id, actor);
    release();
    await expect(attempt).rejects.toThrow(/not available|unknown|Inactive/i);
    await holder;
    expect(await prisma.workOrderAssignee.count({ where: { workOrderId: wo.id } })).toBe(0);
    const saved = await prisma.workOrder.findUnique({ where: { id: wo.id } });
    expect(saved?.technicianId).toBeNull();
  });
});
