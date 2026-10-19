/**
 * Disposable-database journey for the maintenance flow.
 * Mutations go through WorkOrdersService. Evidence and vendor tax use the same helpers as the API.
 */
import { BadRequestException, ForbiddenException } from "@nestjs/common";
import { PrismaClient, Priority, RoleName, EvidenceType, WorkOrderStatus, WorkOrderType } from "@prisma/client";

import { taxFromRate } from "../../src/common/utils/vendor-tax";
import { assertEvidenceForTechnicianCompletion } from "../../src/common/utils/work-order-evidence-governance";
import { WorkOrderDomainService } from "../../src/modules/work-orders/work-order-domain.service";
import { WorkOrdersService } from "../../src/modules/work-orders/work-orders.service";
import { createWorkOrderPartsServiceMock } from "../helpers/work-order-parts-service.mock";
import { createWorkOrderTaxonomyServiceMock } from "../helpers/work-order-taxonomy-service.mock";

function databaseName(url: string): string {
  const match = url.match(/(?:database|initial catalog)\s*=\s*([^;]+)/i);
  return match?.[1]?.trim() ?? "";
}

const databaseUrl = process.env.DATABASE_URL?.trim() ?? "";
const dbName = databaseName(databaseUrl);
if (/nelna|MaintainProDev/i.test(databaseUrl)) {
  throw new Error(`Refusing journey tests against ${dbName || "unknown database"}`);
}
const hasDisposableDb = Boolean(databaseUrl) && !databaseUrl.includes("<") && dbName.startsWith("maintainpro_e2e_");
const describeIfDb = hasDisposableDb ? describe : describe.skip;

type Actor = { sub: string; email: string; role: RoleName; tenantId: string };

describeIfDb("maintenance flow journey", () => {
  const prisma = new PrismaClient();
  const parts = createWorkOrderPartsServiceMock() as any;
  parts.getCostSummary = jest.fn().mockResolvedValue({ netPartCost: 0, unaccountedLines: 0 });

  function stringifyAuditArgs(args: any) {
    const data = { ...(args?.data ?? {}) };
    for (const key of ["actorSnapshot", "metadata", "beforeData", "afterData"]) {
      if (data[key] != null && typeof data[key] === "object") data[key] = JSON.stringify(data[key]);
    }
    return { ...args, data };
  }
  const originalAuditCreate = prisma.auditLog.create.bind(prisma.auditLog);
  (prisma.auditLog as any).create = (args: any) => originalAuditCreate(stringifyAuditArgs(args));
  const originalTransaction = prisma.$transaction.bind(prisma);
  (prisma as any).$transaction = (input: unknown, options?: unknown) => {
    if (typeof input !== "function") return originalTransaction(input as never, options as never);
    return originalTransaction(async (tx) => {
      const originalTxAuditCreate = tx.auditLog.create.bind(tx.auditLog);
      (tx.auditLog as any).create = (args: any) => originalTxAuditCreate(stringifyAuditArgs(args));
      return input(tx);
    }, options as never);
  };

  let workOrders: WorkOrdersService;
  let tenantId: string;
  let planner: Actor;
  let technician: Actor;
  let verifier: Actor;
  let assetId: string;
  let journeyUserId: string | null = null;
  const createdIds: string[] = [];

  beforeAll(async () => {
    process.env.NODE_ENV = "test";
    process.env.STORAGE_UPLOADS_ENABLED = "false";
    process.env.E2E_TEST_MODE = "true";
    await prisma.$connect();
    const tenant = await prisma.tenant.findUnique({ where: { slug: "default" }, select: { id: true } });
    if (!tenant) throw new Error("Seeded tenant slug=default is missing");
    tenantId = tenant.id;
    const users = await prisma.user.findMany({ where: { tenantId }, include: { role: true }, take: 40 });
    const byRole = (names: RoleName[]) => users.find((user) => names.includes(user.role.name as RoleName));
    const admin = byRole([RoleName.ADMIN, RoleName.SUPER_ADMIN]);
    const manager = byRole([RoleName.MANAGER, RoleName.OPERATIONS_MANAGER]);
    if (!admin) throw new Error("Need an ADMIN user");
    const techRole = await prisma.role.findFirst({ where: { name: RoleName.TECHNICIAN }, select: { id: true } });
    if (!techRole) throw new Error("TECHNICIAN role is missing");
    const stamp = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
    const createdTech = await prisma.user.create({
      data: {
        tenantId,
        email: `journey-${stamp}@e2e.maintainpro.test`,
        passwordHash: "journey-not-a-secret",
        firstName: "Journey",
        lastName: "Technician",
        roleId: techRole.id
      }
    });
    journeyUserId = createdTech.id;
    await prisma.employee.create({
      data: {
        tenantId,
        fullName: "Journey Technician",
        designation: "TECHNICIAN",
        availabilityStatus: "AVAILABLE",
        linkedUserId: createdTech.id,
        active: true,
        canReceiveWorkOrders: true,
        employeeNo: `JRN-${stamp}`
      }
    });
    const verifierUser = manager ?? admin;
    planner = { sub: admin.id, email: admin.email, role: admin.role.name as RoleName, tenantId };
    technician = { sub: createdTech.id, email: createdTech.email, role: RoleName.TECHNICIAN, tenantId };
    verifier = {
      sub: verifierUser.id,
      email: verifierUser.email,
      role: verifierUser.role.name as RoleName,
      tenantId
    };
    const asset = await prisma.asset.findFirst({ where: { tenantId }, select: { id: true } });
    if (!asset) throw new Error("No asset fixture");
    assetId = asset.id;
    const domain = new WorkOrderDomainService(prisma as any);
    const persistAssignee = async (workOrderId: string, employeeId: string) => {
      const existing = await prisma.workOrderAssignee.findFirst({ where: { workOrderId, employeeId } });
      if (existing) return existing;
      return prisma.workOrderAssignee.create({
        data: { tenantId, workOrderId, employeeId, isPrimary: true, assignmentStatus: "ASSIGNED" }
      });
    };
    workOrders = new WorkOrdersService(
      prisma as any,
      { createNotification: jest.fn().mockResolvedValue({}) } as any,
      parts,
      createWorkOrderTaxonomyServiceMock() as any,
      {
        prepareAssignee: jest.fn().mockResolvedValue(undefined),
        persistAssignee: jest.fn().mockImplementation(async (_tx: unknown, prepared: { workOrder: { id: string }; employee: { id: string } }) =>
          persistAssignee(prepared.workOrder.id, prepared.employee.id)
        ),
        addAssignee: jest.fn()
      } as any,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      domain
    );
  }, 120_000);

  afterAll(async () => {
    for (const id of createdIds) {
      await prisma.workOrderLabourEntry.deleteMany({ where: { workOrderId: id } }).catch(() => undefined);
      await prisma.workOrder.updateMany({
        where: { id },
        data: { status: WorkOrderStatus.CANCELLED, cancelledReason: "journey cleanup" }
      }).catch(() => undefined);
    }
    if (journeyUserId) {
      await prisma.workOrderLabourEntry.deleteMany({ where: { technicianUserId: journeyUserId } }).catch(() => undefined);
      const employees = await prisma.employee.findMany({ where: { linkedUserId: journeyUserId }, select: { id: true } }).catch(() => []);
      if (employees.length) {
        await prisma.workOrderAssignee.deleteMany({ where: { employeeId: { in: employees.map((row) => row.id) } } }).catch(() => undefined);
        await prisma.employee.deleteMany({ where: { id: { in: employees.map((row) => row.id) } } }).catch(() => undefined);
      }
      await prisma.user.delete({ where: { id: journeyUserId } }).catch(() => undefined);
    }
    await prisma.$disconnect();
  }, 120_000);

  async function row(id: string) {
    const current = await prisma.workOrder.findFirst({ where: { id, tenantId } });
    expect(current?.tenantId).toBe(tenantId);
    return current!;
  }

  async function expectAudit(id: string) {
    const count = await prisma.auditLog.count({ where: { entityId: id } });
    expect(count).toBeGreaterThan(0);
  }

  it("runs plan, assign, hold, resume, evidence gate, verify, and close", async () => {
    const created = await workOrders.create(
      {
        title: "Journey corrective",
        description: "Disposable journey",
        priority: Priority.MEDIUM,
        type: WorkOrderType.CORRECTIVE,
        createdById: planner.sub,
        assetId
      },
      planner
    );
    createdIds.push(created.id);
    expect((await row(created.id)).status).toBe(WorkOrderStatus.OPEN);

    await workOrders.planWork(created.id, { plannedStartAt: new Date().toISOString(), estimatedHours: 1 }, planner);
    expect((await row(created.id)).status).toBe(WorkOrderStatus.PLANNED);
    await workOrders.assign(created.id, technician.sub, planner);
    expect((await row(created.id)).status).toBe(WorkOrderStatus.ASSIGNED);

    let current = await row(created.id);
    await workOrders.updateStatus(created.id, { status: WorkOrderStatus.IN_PROGRESS, expectedVersion: current.version }, technician);
    current = await row(created.id);
    expect(current.status).toBe(WorkOrderStatus.IN_PROGRESS);
    await workOrders.updateStatus(
      created.id,
      { status: WorkOrderStatus.ON_HOLD, delayReason: "Waiting for a part", expectedVersion: current.version },
      technician
    );
    current = await row(created.id);
    expect(current.status).toBe(WorkOrderStatus.ON_HOLD);
    await workOrders.updateStatus(
      created.id,
      { status: WorkOrderStatus.IN_PROGRESS, expectedVersion: current.version },
      technician
    );
    expect((await row(created.id)).status).toBe(WorkOrderStatus.IN_PROGRESS);

    process.env.STORAGE_UPLOADS_ENABLED = "true";
    expect(() =>
      assertEvidenceForTechnicianCompletion({
        workOrderType: WorkOrderType.CORRECTIVE,
        items: [{ evidenceType: EvidenceType.BEFORE_PHOTO, status: "UPLOADED" }],
        completionNote: "Done",
        assetId
      })
    ).toThrow(new BadRequestException("After photo is required before completion."));
    process.env.STORAGE_UPLOADS_ENABLED = "false";

    const tax = taxFromRate(1000, 18);
    expect(tax.taxAmount).toBe(180);
    expect(tax.totalAmount).toBe(1180);

    current = await row(created.id);
    await workOrders.updateStatus(
      created.id,
      {
        status: WorkOrderStatus.TECHNICIAN_COMPLETED,
        completionNote: "Journey completion note",
        failureCode: "GENERAL",
        causeCode: "WEAR",
        remedyCode: "REPAIRED",
        functionalTestResult: "PASS",
        expectedVersion: current.version
      } as any,
      technician
    );
    current = await row(created.id);
    expect(current.status).toBe(WorkOrderStatus.TECHNICIAN_COMPLETED);
    await expect(
      workOrders.verifySupervisor(created.id, { verificationNote: "same user" }, technician as any)
    ).rejects.toBeInstanceOf(ForbiddenException);
    await workOrders.verifySupervisor(
      created.id,
      { verificationNote: "supervisor check", expectedVersion: current.version },
      verifier
    );
    expect((await row(created.id)).status).toBe(WorkOrderStatus.VERIFIED);
    await workOrders.closeWorkOrder(created.id, "Journey close", verifier);
    expect((await row(created.id)).status).toBe(WorkOrderStatus.CLOSED);
    await expectAudit(created.id);

    const otherTenant = await prisma.workOrder.findFirst({
      where: { id: created.id, tenantId: "other-tenant" }
    });
    expect(otherTenant).toBeNull();
  }, 120_000);

  it("cancels with a reason and emergency-closes with an audit reason", async () => {
    const cancelTarget = await workOrders.create(
      {
        title: "Journey cancel",
        description: "Cancel me",
        priority: Priority.LOW,
        type: WorkOrderType.CORRECTIVE,
        createdById: planner.sub,
        assetId
      },
      planner
    );
    createdIds.push(cancelTarget.id);
    await workOrders.updateStatus(
      cancelTarget.id,
      { status: WorkOrderStatus.CANCELLED, cancelReason: "No longer required", expectedVersion: cancelTarget.version },
      planner
    );
    expect((await row(cancelTarget.id)).status).toBe(WorkOrderStatus.CANCELLED);
    await expectAudit(cancelTarget.id);

    const emergency = await workOrders.create(
      {
        title: "Journey emergency",
        description: "Emergency close",
        priority: Priority.HIGH,
        type: WorkOrderType.EMERGENCY,
        createdById: planner.sub,
        assetId
      },
      planner
    );
    createdIds.push(emergency.id);
    await workOrders.planWork(emergency.id, { plannedStartAt: new Date().toISOString(), estimatedHours: 1 }, planner);
    await workOrders.assign(emergency.id, technician.sub, planner);
    let current = await row(emergency.id);
    await workOrders.updateStatus(emergency.id, { status: WorkOrderStatus.IN_PROGRESS, expectedVersion: current.version }, technician);
    current = await row(emergency.id);
    await workOrders.updateStatus(
      emergency.id,
      {
        status: WorkOrderStatus.TECHNICIAN_COMPLETED,
        completionNote: "Emergency work finished",
        expectedVersion: current.version
      } as any,
      technician
    );
    current = await row(emergency.id);
    await workOrders.updateStatus(
      emergency.id,
      {
        status: WorkOrderStatus.COMPLETED,
        emergencyCloseReason: "Safety stop",
        expectedVersion: current.version
      },
      planner
    );
    expect((await row(emergency.id)).status).toBe(WorkOrderStatus.COMPLETED);
    const audit = await prisma.auditLog.findFirst({
      where: { entityId: emergency.id },
      orderBy: { createdAt: "desc" }
    });
    expect(JSON.stringify(audit)).toMatch(/Safety stop/);
  }, 120_000);
});
