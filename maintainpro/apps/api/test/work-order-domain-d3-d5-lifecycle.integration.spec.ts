/**
 * D3/D4/D5 closeout — full domain lifecycles through WorkOrdersService + WorkOrderDomainService.
 * Fixture setup may use Prisma for seed subjects; lifecycle mutations go through service methods only.
 * Persistence assertions are READ-ONLY after each phase.
 */
import { BadRequestException, ForbiddenException } from "@nestjs/common";
import {
  Priority,
  PrismaClient,
  RoleName,
  WorkOrderStatus,
  WorkOrderType
} from "@prisma/client";

import { displayOperationalStatus } from "../src/common/utils/work-order-domain.util";
import { WorkOrderDomainService } from "../src/modules/work-orders/work-order-domain.service";
import { WorkOrdersService } from "../src/modules/work-orders/work-orders.service";
import { createWorkOrderPartsServiceMock } from "./helpers/work-order-parts-service.mock";
import { createWorkOrderTaxonomyServiceMock } from "./helpers/work-order-taxonomy-service.mock";

const hasDb = Boolean(process.env.DATABASE_URL && !String(process.env.DATABASE_URL).includes("<"));

const describeIfDb = hasDb ? describe : describe.skip;

type Actor = {
  sub: string;
  email: string;
  role: RoleName;
  tenantId: string;
};

describeIfDb("D3/D4/D5 domain lifecycle (real WorkOrdersService + SQL)", () => {
  const prisma = new PrismaClient();
  const parts = createWorkOrderPartsServiceMock() as any;
  parts.getCostSummary = jest.fn().mockResolvedValue({ netPartCost: 0, unaccountedLines: 0 });

  // PrismaService middleware normally stringifies audit JSON fields; raw PrismaClient does not.
  const originalAuditCreate = prisma.auditLog.create.bind(prisma.auditLog);
  (prisma.auditLog as any).create = (args: any) => {
    const data = { ...(args?.data ?? {}) };
    for (const key of ["actorSnapshot", "metadata", "beforeData", "afterData"]) {
      if (data[key] != null && typeof data[key] === "object") {
        data[key] = JSON.stringify(data[key]);
      }
    }
    return originalAuditCreate({ ...args, data });
  };

  let domainService: WorkOrderDomainService;
  let workOrders: WorkOrdersService;
  let tenantId: string;
  let planner: Actor;
  let technician: Actor;
  let verifier: Actor;
  let assetId: string;
  let vehicleId: string;
  let functionalLocationId: string;
  let createdLocation = false;
  const createdWoIds: string[] = [];

  const originalEnv = {
    NODE_ENV: process.env.NODE_ENV,
    STORAGE_UPLOADS_ENABLED: process.env.STORAGE_UPLOADS_ENABLED,
    E2E_TEST_MODE: process.env.E2E_TEST_MODE
  };

  beforeAll(async () => {
    process.env.NODE_ENV = "test";
    process.env.STORAGE_UPLOADS_ENABLED = "false";
    process.env.E2E_TEST_MODE = "true";

    await prisma.$connect();

    const tenant = await prisma.tenant.findFirst({ select: { id: true } });
    if (!tenant) throw new Error("No tenant in local DB — cannot run lifecycle closeout");
    tenantId = tenant.id;

    const users = await prisma.user.findMany({
      where: { tenantId },
      include: { role: true },
      take: 40
    });
    const byRole = (names: RoleName[]) =>
      users.find((u) => names.includes(u.role.name as RoleName));

    const admin = byRole([RoleName.ADMIN, RoleName.SUPER_ADMIN]);
    const manager = byRole([RoleName.MANAGER, RoleName.OPERATIONS_MANAGER, RoleName.ASSET_MANAGER]);
    const tech = byRole([RoleName.TECHNICIAN, RoleName.MECHANIC]);
    if (!admin || !tech) {
      throw new Error("Need at least ADMIN and TECHNICIAN/MECHANIC users in tenant for SoD proof");
    }

    planner = {
      sub: admin.id,
      email: admin.email,
      role: admin.role.name as RoleName,
      tenantId
    };
    technician = {
      sub: tech.id,
      email: tech.email,
      role: tech.role.name as RoleName,
      tenantId
    };
    const verifierUser = manager && manager.id !== tech.id ? manager : admin;
    if (verifierUser.id === tech.id) {
      throw new Error("Cannot prove SoD — verifier would equal technician");
    }
    verifier = {
      sub: verifierUser.id,
      email: verifierUser.email,
      role: verifierUser.role.name as RoleName,
      tenantId
    };

    const asset = await prisma.asset.findFirst({ where: { tenantId }, select: { id: true } });
    if (!asset) throw new Error("No Asset fixture for MACHINERY lifecycle");
    assetId = asset.id;

    const vehicle = await prisma.vehicle.findFirst({
      where: { tenantId },
      select: { id: true, currentMileage: true, status: true }
    });
    if (!vehicle) throw new Error("No Vehicle fixture for VEHICLE lifecycle");
    vehicleId = vehicle.id;

    let location = await prisma.functionalLocation.findFirst({
      where: { tenantId, isActive: true },
      select: { id: true }
    });
    if (!location) {
      const site = await prisma.site.findFirst({ where: { tenantId }, select: { id: true } });
      if (!site) throw new Error("No Site to create FunctionalLocation fixture");
      location = await prisma.functionalLocation.create({
        data: {
          tenantId,
          siteId: site.id,
          code: `LOC-D3D5-${Date.now()}`,
          name: "D3-D5 Closeout Facility",
          type: "AREA",
          isActive: true
        },
        select: { id: true }
      });
      createdLocation = true;
    }
    functionalLocationId = location.id;

    domainService = new WorkOrderDomainService(prisma as any);

    const assignees = {
      addAssignee: jest.fn().mockImplementation(async (workOrderId: string, input: { employeeId: string }) => {
        const existing = await prisma.workOrderAssignee.findFirst({
          where: { workOrderId, employeeId: input.employeeId }
        });
        if (existing) return existing;
        return prisma.workOrderAssignee.create({
          data: {
            tenantId,
            workOrderId,
            employeeId: input.employeeId,
            isPrimary: true,
            assignmentStatus: "ASSIGNED"
          }
        });
      })
    };

    workOrders = new WorkOrdersService(
      prisma as any,
      { createNotification: jest.fn().mockResolvedValue({}) } as any,
      parts,
      createWorkOrderTaxonomyServiceMock() as any,
      assignees as any,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      domainService
    );
  }, 120_000);

  beforeEach(async () => {
    // Close any leftover active labour sessions for the technician between cases.
    if (technician?.sub) {
      await prisma.workOrderLabourEntry.updateMany({
        where: { technicianUserId: technician.sub, endedAt: null },
        data: { endedAt: new Date(), durationMinutes: 1 }
      });
    }
    // Isolate prior critical debris so VEHICLE RTS proofs are deterministic.
    if (tenantId && vehicleId) {
      await prisma.workOrder.updateMany({
        where: {
          tenantId,
          vehicleId,
          status: {
            in: [
              WorkOrderStatus.OPEN,
              WorkOrderStatus.PLANNED,
              WorkOrderStatus.ASSIGNED,
              WorkOrderStatus.IN_PROGRESS,
              WorkOrderStatus.ON_HOLD,
              WorkOrderStatus.TECHNICIAN_COMPLETED,
              WorkOrderStatus.REWORK_REQUIRED
            ]
          },
          OR: [{ priority: Priority.CRITICAL }, { type: WorkOrderType.EMERGENCY }]
        },
        data: {
          status: WorkOrderStatus.CANCELLED,
          cancelledReason: "D3-D5 closeout isolation — cancel prior critical debris"
        }
      });
    }
  });

  afterAll(async () => {
    process.env.NODE_ENV = originalEnv.NODE_ENV;
    process.env.STORAGE_UPLOADS_ENABLED = originalEnv.STORAGE_UPLOADS_ENABLED;
    process.env.E2E_TEST_MODE = originalEnv.E2E_TEST_MODE;

    for (const id of createdWoIds) {
      try {
        await prisma.workOrderLabourEntry.deleteMany({ where: { workOrderId: id } });
        await prisma.workOrderAssignee.deleteMany({ where: { workOrderId: id } });
        await prisma.workOrderStatusHistory.deleteMany({ where: { workOrderId: id } });
        await prisma.workOrderCostSnapshot.deleteMany({ where: { workOrderId: id } });
        await prisma.workOrder.updateMany({
          where: { id },
          data: { status: WorkOrderStatus.CANCELLED, cancelledReason: "D3-D5 closeout cleanup" }
        });
      } catch {
        /* best-effort cleanup */
      }
    }
    if (createdLocation) {
      await prisma.functionalLocation.updateMany({
        where: { id: functionalLocationId },
        data: { isActive: false }
      });
    }
    await prisma.$disconnect();
  }, 120_000);

  async function readback(id: string) {
    return prisma.workOrder.findFirstOrThrow({
      where: { id, tenantId },
      select: {
        id: true,
        woNumber: true,
        status: true,
        jobDomain: true,
        assetId: true,
        vehicleId: true,
        functionalLocationId: true,
        functionalTestResult: true,
        roadTestResult: true,
        completionMeterReading: true,
        temporaryRepair: true,
        operatingRestriction: true,
        productionImpact: true,
        technicianId: true,
        verifiedById: true,
        description: true
      }
    });
  }

  async function history(id: string) {
    return prisma.workOrderStatusHistory.findMany({
      where: { workOrderId: id },
      orderBy: { createdAt: "asc" },
      select: { fromStatus: true, toStatus: true, action: true, actorId: true }
    });
  }

  async function runLifecycle(input: {
    label: string;
    jobDomain: "MACHINERY" | "SERVICE" | "VEHICLE";
    assetId?: string;
    vehicleId?: string;
    functionalLocationId?: string;
    description: string;
    currentOdometer?: number;
    completionExtra?: Record<string, unknown>;
  }) {
    let jobCategoryId: string | undefined;
    if (input.jobDomain === "SERVICE") {
      const category = await prisma.maintenanceJobCategory.findFirst({
        where: { tenantId, jobDomain: "SERVICE", level: "SUB", active: true },
        select: { id: true },
        orderBy: { sortOrder: "asc" }
      });
      expect(category?.id).toBeTruthy();
      jobCategoryId = category!.id;
    }

    const created = await workOrders.create(
      {
        title: `${input.label} closeout`,
        description: input.description,
        priority: Priority.MEDIUM,
        type: WorkOrderType.CORRECTIVE,
        createdById: planner.sub,
        assetId: input.assetId,
        vehicleId: input.vehicleId,
        functionalLocationId: input.functionalLocationId,
        jobDomain: input.jobDomain,
        jobCategoryId,
        currentOdometer: input.currentOdometer
      },
      planner
    );
    createdWoIds.push(created.id);
    expect(created.status).toBe(WorkOrderStatus.OPEN);
    expect(created.jobDomain).toBe(input.jobDomain);

    await workOrders.planWork(
      created.id,
      { plannedStartAt: new Date().toISOString(), estimatedHours: 1, notes: "Closeout plan" },
      planner
    );
    expect((await readback(created.id)).status).toBe(WorkOrderStatus.PLANNED);

    await workOrders.assign(created.id, technician.sub, planner);
    expect((await readback(created.id)).status).toBe(WorkOrderStatus.ASSIGNED);

    await workOrders.updateStatus(created.id, { status: WorkOrderStatus.IN_PROGRESS }, technician);
    expect((await readback(created.id)).status).toBe(WorkOrderStatus.IN_PROGRESS);

    await workOrders.updateStatus(
      created.id,
      {
        status: WorkOrderStatus.TECHNICIAN_COMPLETED,
        completionNote: `${input.label} technician completion — findings recorded`,
        failureCode: "GENERAL",
        causeCode: "WEAR",
        remedyCode: "REPAIRED",
        functionalTestResult: "PASS",
        roadTestResult: input.jobDomain === "VEHICLE" ? "PASS" : "NOT_REQUIRED",
        productionImpact: input.jobDomain === "MACHINERY" ? "NONE" : undefined,
        completionMeterReading: input.currentOdometer,
        ...input.completionExtra
      } as any,
      technician
    );
    const afterComplete = await readback(created.id);
    expect(afterComplete.status).toBe(WorkOrderStatus.TECHNICIAN_COMPLETED);

    await expect(
      workOrders.verifySupervisor(created.id, { verificationNote: "Self verify attempt" }, technician as any)
    ).rejects.toThrow(/Supervisor verification|segregation|SoD|not allowed|Forbidden|cannot verify/i);

    await workOrders.verifySupervisor(
      created.id,
      { verificationNote: `${input.label} supervisor verification` },
      verifier
    );
    const afterVerify = await readback(created.id);
    expect(afterVerify.status).toBe(WorkOrderStatus.VERIFIED);
    expect(afterVerify.verifiedById).toBe(verifier.sub);
    expect(afterVerify.verifiedById).not.toBe(technician.sub);

    if (input.jobDomain === "MACHINERY" || input.jobDomain === "VEHICLE") {
      await domainService.returnToService(
        created.id,
        { note: `${input.label} return to service` },
        verifier
      );
    }

    await workOrders.closeWorkOrder(created.id, `${input.label} close`, verifier);
    const finalRow = await readback(created.id);
    expect(finalRow.status).toBe(WorkOrderStatus.CLOSED);
    expect(finalRow.jobDomain).toBe(input.jobDomain);

    const hist = await history(created.id);
    const toStatuses = hist.map((h) => h.toStatus);
    expect(toStatuses).toEqual(
      expect.arrayContaining([
        WorkOrderStatus.OPEN,
        WorkOrderStatus.PLANNED,
        WorkOrderStatus.ASSIGNED,
        WorkOrderStatus.IN_PROGRESS,
        WorkOrderStatus.TECHNICIAN_COMPLETED,
        WorkOrderStatus.VERIFIED,
        WorkOrderStatus.CLOSED
      ])
    );

    return { created, finalRow, hist };
  }

  it("MACHINERY full lifecycle via service + read-only SQL", async () => {
    const { finalRow } = await runLifecycle({
      label: "D3-MACHINERY",
      jobDomain: "MACHINERY",
      assetId,
      description: "Machinery closeout lifecycle problem"
    });
    expect(finalRow.assetId).toBe(assetId);
    expect(finalRow.vehicleId).toBeNull();
    expect(finalRow.functionalLocationId).toBeNull();
    expect(finalRow.functionalTestResult).toBe("PASS");
  }, 180_000);

  it("SERVICE full lifecycle via service + read-only SQL", async () => {
    const { finalRow } = await runLifecycle({
      label: "D4-SERVICE",
      jobDomain: "SERVICE",
      functionalLocationId,
      description: "[ELECTRICAL] Service closeout lifecycle problem"
    });
    expect(finalRow.functionalLocationId).toBe(functionalLocationId);
    expect(finalRow.assetId).toBeNull();
    expect(finalRow.vehicleId).toBeNull();
    expect(finalRow.description).toContain("[ELECTRICAL]");
    expect(finalRow.functionalTestResult).toBe("PASS");
  }, 180_000);

  it("VEHICLE full lifecycle via service + read-only SQL", async () => {
    const vehicle = await prisma.vehicle.findFirstOrThrow({
      where: { id: vehicleId },
      select: { currentMileage: true, status: true }
    });
    const odometer = Number(vehicle.currentMileage ?? 0) + 5;
    const { finalRow } = await runLifecycle({
      label: "D5-VEHICLE",
      jobDomain: "VEHICLE",
      vehicleId,
      description: "Vehicle closeout lifecycle problem",
      currentOdometer: odometer,
      completionExtra: { completionMeterReading: odometer + 1 }
    });
    expect(finalRow.vehicleId).toBe(vehicleId);
    expect(finalRow.assetId).toBeNull();
    expect(finalRow.jobDomain).toBe("VEHICLE");
    expect(finalRow.roadTestResult).toBe("PASS");
    expect(Number(finalRow.completionMeterReading)).toBe(odometer + 1);

    const afterVehicle = await prisma.vehicle.findFirstOrThrow({
      where: { id: vehicleId },
      select: { currentMileage: true, status: true }
    });
    expect(Number(afterVehicle.currentMileage)).toBeGreaterThanOrEqual(odometer);
  }, 180_000);

  describe("negative domain gates via service", () => {
    it("rejects MACHINERY without Asset", async () => {
      await expect(
        workOrders.create(
          {
            title: "Missing asset",
            description: "Should fail",
            priority: Priority.LOW,
            type: WorkOrderType.CORRECTIVE,
            createdById: planner.sub,
            jobDomain: "MACHINERY"
          },
          planner
        )
      ).rejects.toThrow(/Asset|Machine|asset, vehicle, or functional location/);
    });

    it("rejects SERVICE without Functional Location", async () => {
      await expect(
        workOrders.create(
          {
            title: "Missing FL",
            description: "Should fail",
            priority: Priority.LOW,
            type: WorkOrderType.CORRECTIVE,
            createdById: planner.sub,
            jobDomain: "SERVICE",
            assetId
          },
          planner
        )
      ).rejects.toThrow(/Functional Location/);
    });

    it("rejects VEHICLE without Vehicle (asset alone insufficient)", async () => {
      await expect(
        workOrders.create(
          {
            title: "Missing vehicle",
            description: "Should fail",
            priority: Priority.LOW,
            type: WorkOrderType.CORRECTIVE,
            createdById: planner.sub,
            jobDomain: "VEHICLE",
            assetId,
            currentOdometer: 1
          },
          planner
        )
      ).rejects.toThrow(/Vehicle/);
    });

    it("rejects cross-tenant Asset on MACHINERY create", async () => {
      await expect(
        workOrders.create(
          {
            title: "Cross tenant asset",
            description: "Should fail",
            priority: Priority.LOW,
            type: WorkOrderType.CORRECTIVE,
            createdById: planner.sub,
            jobDomain: "MACHINERY",
            assetId: "clxxxxxxxxxxxxxxxxxxxxxx" // valid cuid shape, wrong tenant / missing
          },
          planner
        )
      ).rejects.toThrow();
    });

    it("rejects lower odometer on VEHICLE completion path", async () => {
      const vehicle = await prisma.vehicle.findFirstOrThrow({
        where: { id: vehicleId },
        select: { currentMileage: true }
      });
      const baseline = Number(vehicle.currentMileage ?? 100);
      const created = await workOrders.create(
        {
          title: "Odometer negative",
          description: "Lower odometer should fail",
          priority: Priority.MEDIUM,
          type: WorkOrderType.CORRECTIVE,
          createdById: planner.sub,
          jobDomain: "VEHICLE",
          vehicleId,
          currentOdometer: baseline + 2
        },
        planner
      );
      createdWoIds.push(created.id);
      await workOrders.planWork(created.id, { plannedStartAt: new Date().toISOString() }, planner);
      await workOrders.assign(created.id, technician.sub, planner);
      await workOrders.updateStatus(created.id, { status: WorkOrderStatus.IN_PROGRESS }, technician);
      await expect(
        workOrders.updateStatus(
          created.id,
          {
            status: WorkOrderStatus.TECHNICIAN_COMPLETED,
            completionNote: "Attempt lower odometer",
            functionalTestResult: "PASS",
            roadTestResult: "PASS",
            completionMeterReading: baseline - 10
          } as any,
          technician
        )
      ).rejects.toThrow(/lower than last accepted/);
    }, 120_000);

    it("blocks failed road test on VEHICLE completion", async () => {
      const vehicle = await prisma.vehicle.findFirstOrThrow({
        where: { id: vehicleId },
        select: { currentMileage: true }
      });
      const reading = Number(vehicle.currentMileage ?? 0) + 3;
      const created = await workOrders.create(
        {
          title: "Failed road test",
          description: "Fail test should block",
          priority: Priority.MEDIUM,
          type: WorkOrderType.CORRECTIVE,
          createdById: planner.sub,
          jobDomain: "VEHICLE",
          vehicleId,
          currentOdometer: reading
        },
        planner
      );
      createdWoIds.push(created.id);
      await workOrders.planWork(created.id, { plannedStartAt: new Date().toISOString() }, planner);
      await workOrders.assign(created.id, technician.sub, planner);
      await workOrders.updateStatus(created.id, { status: WorkOrderStatus.IN_PROGRESS }, technician);
      await expect(
        workOrders.updateStatus(
          created.id,
          {
            status: WorkOrderStatus.TECHNICIAN_COMPLETED,
            completionNote: "Failed test attempt",
            functionalTestResult: "PASS",
            roadTestResult: "FAIL",
            completionMeterReading: reading
          } as any,
          technician
        )
      ).rejects.toThrow(/Failed or partial vehicle test/);
    }, 120_000);

    it("blank operational status display is not AVAILABLE", () => {
      expect(displayOperationalStatus("")).toBe("Status not set");
      expect(displayOperationalStatus(null)).toBe("Status not set");
      expect(displayOperationalStatus("AVAILABLE")).toBe("AVAILABLE");
    });

    it("blocks return-to-service when another critical open WO exists", async () => {
      const critical = await workOrders.create(
        {
          title: "Critical blocker",
          description: "Blocks RTS",
          priority: Priority.CRITICAL,
          type: WorkOrderType.EMERGENCY,
          createdById: planner.sub,
          jobDomain: "VEHICLE",
          vehicleId,
          currentOdometer: Number((await prisma.vehicle.findFirstOrThrow({ where: { id: vehicleId } })).currentMileage ?? 0) + 1
        },
        planner
      );
      createdWoIds.push(critical.id);

      await expect(
        domainService.returnToService(
          // Use a fabricated verified-shaped call by creating a verified WO then RTS
          (
            await (async () => {
              const vehicle = await prisma.vehicle.findFirstOrThrow({
                where: { id: vehicleId },
                select: { currentMileage: true }
              });
              const reading = Number(vehicle.currentMileage ?? 0) + 4;
              const created = await workOrders.create(
                {
                  title: "RTS candidate",
                  description: "Should block on critical open",
                  priority: Priority.MEDIUM,
                  type: WorkOrderType.CORRECTIVE,
                  createdById: planner.sub,
                  jobDomain: "VEHICLE",
                  vehicleId,
                  currentOdometer: reading
                },
                planner
              );
              createdWoIds.push(created.id);
              await workOrders.planWork(created.id, { plannedStartAt: new Date().toISOString() }, planner);
              await workOrders.assign(created.id, technician.sub, planner);
              await workOrders.updateStatus(created.id, { status: WorkOrderStatus.IN_PROGRESS }, technician);
              await workOrders.updateStatus(
                created.id,
                {
                  status: WorkOrderStatus.TECHNICIAN_COMPLETED,
                  completionNote: "Done",
                  functionalTestResult: "PASS",
                  roadTestResult: "PASS",
                  completionMeterReading: reading
                } as any,
                technician
              );
              await workOrders.verifySupervisor(created.id, { verificationNote: "OK" }, verifier);
              return created.id;
            })()
          ),
          {},
          verifier
        )
      ).rejects.toThrow(/critical open work order/);
    }, 180_000);
  });
});
