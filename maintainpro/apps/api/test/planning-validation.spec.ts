import { BadRequestException } from "@nestjs/common";
import { PmPlanStatus, WorkOrderType } from "@prisma/client";

import { PlanningService } from "../src/modules/planning/planning.service";

describe("PlanningService createPmPlan validation", () => {
  const actor = { sub: "user-1", tenantId: "tenant-1", role: "ADMIN" as const, email: "a@b.c" };

  function buildPrisma(overrides: Record<string, any> = {}) {
    const prisma: Record<string, any> = {
      asset: { findFirst: jest.fn() },
      pmPlan: { create: jest.fn().mockResolvedValue({ id: "plan-1" }) },
      $transaction: jest.fn(async (fn: (tx: unknown) => Promise<unknown>) => fn(prisma)),
      ...overrides
    };
    return prisma;
  }

  it("rejects ACTIVE plans without asset or vehicle", async () => {
    const prisma = buildPrisma();
    const service = new PlanningService(prisma as never, { create: jest.fn() } as never);

    await expect(
      service.createPmPlan(actor, {
        code: "PM-001",
        name: "Compressor service",
        status: PmPlanStatus.ACTIVE,
        triggers: [{ kind: "CALENDAR", intervalDays: 30 }]
      })
    ).rejects.toThrow(new BadRequestException("Active PM plans require an asset or vehicle assignment"));

    expect(prisma.pmPlan.create).not.toHaveBeenCalled();
  });

  it("rejects activating a draft that has no asset or vehicle", async () => {
    const prisma = buildPrisma();
    prisma.pmPlan.findFirst = jest.fn().mockResolvedValue({
      id: "plan-1",
      status: "DRAFT",
      assetId: null,
      vehicleId: null,
      currentRevision: 1,
      triggers: []
    });
    prisma.pmPlan.update = jest.fn();
    const service = new PlanningService(prisma as never, { create: jest.fn() } as never);

    await expect(service.revisePmPlan(actor, "plan-1", { status: "ACTIVE" }, "Activated")).rejects.toThrow(
      new BadRequestException("Active PM plans require an asset or vehicle assignment")
    );
    expect(prisma.pmPlan.update).not.toHaveBeenCalled();
  });

  it("does not generate a work order when an active plan has no asset", async () => {
    const prisma = buildPrisma();
    prisma.pmPlan.findFirst = jest.fn().mockResolvedValue({
      id: "plan-1",
      status: "ACTIVE",
      assetId: null,
      vehicleId: null,
      autoCreateWorkOrder: true,
      triggers: []
    });
    prisma.workOrder = { findFirst: jest.fn(), create: jest.fn() };
    const service = new PlanningService(prisma as never, { create: jest.fn() } as never);

    await expect(service.autoCreateWorkOrderIfDue(actor, "plan-1")).resolves.toEqual({
      created: false,
      reason: "PLAN_INVALID_NO_ASSET_ASSIGNED"
    });
    expect(prisma.workOrder.findFirst).not.toHaveBeenCalled();
    expect(prisma.workOrder.create).not.toHaveBeenCalled();
  });

  it("allows DRAFT plans without asset or vehicle", async () => {
    const prisma = buildPrisma();
    const service = new PlanningService(prisma as never, { create: jest.fn() } as never);

    await expect(
      service.createPmPlan(actor, {
        code: "PM-002",
        name: "Draft plan",
        status: PmPlanStatus.DRAFT,
        triggers: [{ kind: "CALENDAR", intervalDays: 30 }]
      })
    ).resolves.toEqual({ id: "plan-1" });
  });

  it("rejects calendar trigger intervalDays <= 0", async () => {
    const prisma = buildPrisma();
    (prisma.asset as { findFirst: jest.Mock }).findFirst.mockResolvedValue({
      status: "ACTIVE",
      isActive: true
    });
    const service = new PlanningService(prisma as never, { create: jest.fn() } as never);

    await expect(
      service.createPmPlan(actor, {
        code: "PM-003",
        name: "Bad interval",
        assetId: "asset-1",
        status: PmPlanStatus.ACTIVE,
        triggers: [{ kind: "CALENDAR", intervalDays: 0 }]
      })
    ).rejects.toThrow(new BadRequestException("Calendar trigger intervalDays must be greater than 0"));
  });

  it("rejects meter trigger intervalValue <= 0", async () => {
    const prisma = buildPrisma();
    (prisma.asset as { findFirst: jest.Mock }).findFirst.mockResolvedValue({
      status: "ACTIVE",
      isActive: true
    });
    const service = new PlanningService(prisma as never, { create: jest.fn() } as never);

    await expect(
      service.createPmPlan(actor, {
        code: "PM-004",
        name: "Bad meter",
        assetId: "asset-1",
        status: PmPlanStatus.ACTIVE,
        workType: WorkOrderType.PREVENTIVE,
        triggers: [{ kind: "METER", intervalValue: -10, unit: "hrs" }]
      })
    ).rejects.toThrow(new BadRequestException("Meter trigger intervalValue must be greater than 0"));
  });
});
