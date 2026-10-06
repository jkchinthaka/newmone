import { BadRequestException } from "@nestjs/common";

import { PlanningService, pmPlanValidityIssues } from "../src/modules/planning/planning.service";
import { evaluateCalendarTrigger } from "../src/modules/planning/trigger-engine";

const actor = { sub: "u-admin", tenantId: "t-1", role: "ADMIN" } as never;
const DAY = 86_400_000;

function plan(overrides: Record<string, unknown>) {
  return {
    id: "plan-1",
    tenantId: "t-1",
    code: "PM-1",
    name: "Compressor service",
    status: "ACTIVE",
    assetId: "asset-1",
    vehicleId: null,
    gracePeriodDays: 0,
    combineMode: "EARLIEST",
    lastCompletionAt: null,
    lastCompletionMileage: null,
    lastCompletionHours: null,
    nextDueAt: null,
    nextDueMeterValue: null,
    effectiveFrom: new Date("2026-10-01T00:00:00.000Z"),
    createdAt: new Date("2026-10-01T00:00:00.000Z"),
    autoCreateWorkOrder: true,
    currentRevision: 1,
    triggers: [{ id: "trg-1", kind: "CALENDAR", intervalDays: 30, intervalValue: null, referenceKey: null, isActive: true }],
    asset: { id: "asset-1", name: "Air Compressor", assetTag: "AST-9001", status: "ACTIVE" },
    vehicle: null,
    workOrders: [],
    ...overrides
  };
}

function serviceWith(rows: unknown[]) {
  const prisma = {
    pmPlan: {
      findMany: jest.fn().mockResolvedValue(rows),
      findFirst: jest.fn().mockResolvedValue(rows[0] ?? null),
      update: jest.fn()
    },
    pmPlanRevision: { updateMany: jest.fn().mockResolvedValue({ count: 1 }) },
    workOrder: { findFirst: jest.fn().mockResolvedValue(null) }
  };
  return { service: new PlanningService(prisma as never, { create: jest.fn() } as never), prisma };
}

describe("PM plan next due (QA: active calendar PM showed no next due)", () => {
  it("projects next due from the schedule start when the plan was never completed", async () => {
    const { service } = serviceWith([plan({})]);
    const result = await service.listPmPlans(actor);
    const row = result.items[0] as unknown as { nextDueAt: Date; nextDueSource: string; dueState: string };
    expect(row.nextDueAt.toISOString()).toBe("2026-10-31T00:00:00.000Z");
    expect(row.nextDueSource).toBe("PROJECTED");
    expect(row.dueState).not.toBe("NEEDS_ATTENTION");
  });

  it("projects from the last completion when there is one", async () => {
    const { service } = serviceWith([plan({ lastCompletionAt: new Date("2026-09-20T00:00:00.000Z") })]);
    const row = (await service.listPmPlans(actor)).items[0] as unknown as { nextDueAt: Date };
    expect(row.nextDueAt.toISOString()).toBe("2026-10-20T00:00:00.000Z");
  });

  it("a never-completed calendar plan actually becomes due (no perpetual now+interval)", () => {
    const now = new Date("2026-11-05T00:00:00.000Z");
    const result = evaluateCalendarTrigger(
      { id: "t", kind: "CALENDAR", intervalDays: 30 },
      { now, scheduleStartAt: new Date(now.getTime() - 40 * DAY) }
    );
    expect(result.due).toBe(true);
  });
});

describe("PM plan validity (QA: active plan with No asset assigned looked valid)", () => {
  it("flags active plans without an asset or vehicle", () => {
    expect(pmPlanValidityIssues({ status: "ACTIVE", assetId: null, vehicleId: null, triggers: [{ isActive: true }] })).toEqual([
      "NO_ASSET_ASSIGNED"
    ]);
    expect(pmPlanValidityIssues({ status: "INACTIVE", assetId: null, vehicleId: null, triggers: [] })).toEqual([]);
  });

  it("lists legacy invalid plans as INVALID and counts them for remediation", async () => {
    const { service } = serviceWith([plan({ id: "legacy", assetId: null, asset: null })]);
    const result = await service.listPmPlans(actor);
    const row = result.items[0] as unknown as { dueState: string; validityIssues: string[] };
    expect(row.dueState).toBe("INVALID");
    expect(row.validityIssues).toContain("NO_ASSET_ASSIGNED");
    expect((result.summary as { invalid: number }).invalid).toBe(1);
  });

  it("never auto-generates work from an invalid plan", async () => {
    const { service, prisma } = serviceWith([plan({ assetId: null, asset: null, nextDueAt: new Date("2026-01-01") })]);
    const outcome = await service.autoCreateWorkOrderIfDue(actor, "plan-1");
    expect(outcome.created).toBe(false);
    expect(outcome.reason).toBe("PLAN_INVALID_NO_ASSET_ASSIGNED");
    expect(prisma.workOrder.findFirst).not.toHaveBeenCalled();
  });

  it("rejects saving an active plan that still has no asset", async () => {
    const { service } = serviceWith([plan({ assetId: null, asset: null })]);
    await expect(service.revisePmPlan(actor, "plan-1", { name: "Renamed" }, "edit")).rejects.toBeInstanceOf(BadRequestException);
  });

  it("allows pausing an invalid plan as a remediation path", async () => {
    const { service, prisma } = serviceWith([plan({ assetId: null, asset: null })]);
    prisma.pmPlan.update.mockResolvedValue({ id: "plan-1", status: "INACTIVE" });
    await expect(service.revisePmPlan(actor, "plan-1", { status: "INACTIVE" }, "pause")).resolves.toBeDefined();
  });
});
