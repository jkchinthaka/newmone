import {
  buildPmGenerationKey,
  evaluateCombinedTriggers,
  evaluateSingleTrigger
} from "../src/modules/planning/trigger-engine";
import { validateAssetMeterReading } from "../src/modules/planning/meter-validation";
import { evaluateComplianceStatus } from "../src/modules/planning/compliance-status";
import { PlanningService } from "../src/modules/planning/planning.service";
import { InspectionResult, CalibrationResult, WorkOrderStatus, WorkOrderType } from "@prisma/client";

describe("Phase 8 planning engine — triggers", () => {
  const now = new Date("2026-09-14T12:00:00.000Z");

  it("date/calendar trigger becomes due after interval", () => {
    const result = evaluateSingleTrigger(
      { id: "t1", kind: "CALENDAR", intervalDays: 90 },
      {
        now,
        lastCompletionAt: new Date("2026-06-01T12:00:00.000Z"),
        gracePeriodDays: 7
      }
    );
    expect(result.due).toBe(true);
    expect(result.reason).toMatch(/CALENDAR_/);
  });

  it("meter trigger becomes due at threshold", () => {
    const result = evaluateSingleTrigger(
      { id: "t2", kind: "METER", intervalValue: 500 },
      {
        now,
        lastCompletionMeter: 1000,
        currentMeterValue: 1500
      }
    );
    expect(result.due).toBe(true);
    expect(result.reason).toBe("METER_DUE");
  });

  it("expiry trigger marks expired after grace", () => {
    const result = evaluateSingleTrigger(
      { id: "t3", kind: "EXPIRY", referenceKey: "INSURANCE" },
      {
        now,
        expiresAt: new Date("2026-09-01T00:00:00.000Z"),
        gracePeriodDays: 0
      }
    );
    expect(result.due).toBe(true);
    expect(result.reason).toBe("EXPIRY_EXPIRED");
  });

  it("combined 500 hours OR 3 months — whichever comes first (meter wins)", () => {
    const result = evaluateCombinedTriggers(
      [
        { id: "cal", kind: "CALENDAR", intervalDays: 90 },
        { id: "mtr", kind: "METER", intervalValue: 500 }
      ],
      {
        now,
        lastCompletionAt: new Date("2026-08-01T12:00:00.000Z"),
        lastCompletionMeter: 1000,
        currentMeterValue: 1600
      },
      "EARLIEST"
    );
    expect(result.due).toBe(true);
    expect(result.winningTriggerId).toBe("mtr");
    expect(result.summary).toContain("METER");
  });

  it("combined triggers — calendar wins when meter not yet reached", () => {
    const result = evaluateCombinedTriggers(
      [
        { id: "cal", kind: "CALENDAR", intervalDays: 30 },
        { id: "mtr", kind: "METER", intervalValue: 500 }
      ],
      {
        now,
        lastCompletionAt: new Date("2026-07-01T12:00:00.000Z"),
        lastCompletionMeter: 1000,
        currentMeterValue: 1100
      },
      "EARLIEST"
    );
    expect(result.due).toBe(true);
    expect(result.winningTriggerId).toBe("cal");
  });
});

describe("Phase 8 meter validation", () => {
  it("rejects backwards readings", () => {
    const result = validateAssetMeterReading({
      previousValue: 1000,
      nextValue: 900
    });
    expect(result.rejected).toBe(true);
    expect(result.rejectReason).toBe("METER_ROLLBACK");
  });

  it("flags stale readings", () => {
    const result = validateAssetMeterReading({
      previousValue: 1000,
      nextValue: 1050,
      lastReadingAt: new Date("2026-01-01T00:00:00.000Z"),
      recordedAt: new Date("2026-09-14T00:00:00.000Z"),
      staleAfterDays: 30
    });
    expect(result.accepted).toBe(true);
    expect(result.isStale).toBe(true);
    expect(result.warnings).toContain("STALE_READING");
  });

  it("warns on suspicious jump without rejecting", () => {
    const result = validateAssetMeterReading({
      previousValue: 1000,
      nextValue: 5000,
      jumpWarningThreshold: 200
    });
    expect(result.accepted).toBe(true);
    expect(result.suspiciousJump).toBe(true);
  });
});

describe("Phase 8 compliance status", () => {
  it("evaluates expiry statuses", () => {
    const now = new Date("2026-09-14T00:00:00.000Z");
    expect(
      evaluateComplianceStatus({
        expiresAt: new Date("2026-12-01T00:00:00.000Z"),
        now,
        reminderDays: 30
      })
    ).toBe("CURRENT");
    expect(
      evaluateComplianceStatus({
        expiresAt: new Date("2026-09-20T00:00:00.000Z"),
        now,
        reminderDays: 30
      })
    ).toBe("DUE");
    expect(
      evaluateComplianceStatus({
        expiresAt: new Date("2026-09-10T00:00:00.000Z"),
        now,
        gracePeriodDays: 7
      })
    ).toBe("GRACE");
    expect(
      evaluateComplianceStatus({
        expiresAt: new Date("2026-08-01T00:00:00.000Z"),
        now,
        gracePeriodDays: 0
      })
    ).toBe("EXPIRED");
  });
});

describe("Phase 8 PlanningService — auto-WO, inspection, calibration, revisions", () => {
  const actor = { sub: "user-1", tenantId: "tenant-1" };

  function buildPrisma(overrides: Record<string, any> = {}) {
    return {
      pmPlan: {
        findFirst: jest.fn(),
        create: jest.fn(),
        update: jest.fn()
      },
      pmPlanRevision: {
        findMany: jest.fn(),
        updateMany: jest.fn()
      },
      pmAutoGeneration: {
        findUnique: jest.fn(),
        create: jest.fn()
      },
      workOrder: {
        findFirst: jest.fn(),
        create: jest.fn()
      },
      assetMeter: {
        findFirst: jest.fn(),
        update: jest.fn()
      },
      assetMeterReading: {
        create: jest.fn()
      },
      inspection: {
        create: jest.fn()
      },
      calibrationRecord: {
        create: jest.fn()
      },
      complianceRequirement: {
        create: jest.fn(),
        findFirst: jest.fn(),
        update: jest.fn()
      },
      ...overrides
    };
  }

  it("auto-creates WO when due and prevents duplicates", async () => {
    const prisma = buildPrisma();
    prisma.pmPlan.findFirst.mockResolvedValue({
      id: "plan-1",
      tenantId: "tenant-1",
      code: "PM-001",
      name: "Compressor service",
      description: null,
      status: "ACTIVE",
      autoCreateWorkOrder: true,
      gracePeriodDays: 0,
      combineMode: "EARLIEST",
      lastCompletionAt: new Date("2026-01-01T00:00:00.000Z"),
      lastCompletionMileage: null,
      lastCompletionHours: null,
      nextDueAt: new Date("2026-09-01T00:00:00.000Z"),
      nextDueMeterValue: null,
      assetId: "asset-1",
      vehicleId: null,
      estimatedDurationMinutes: 120,
      triggers: [{ id: "t1", kind: "CALENDAR", intervalDays: 90, isActive: true }]
    });
    prisma.workOrder.findFirst.mockResolvedValueOnce(null).mockResolvedValueOnce({
      id: "wo-existing"
    });
    prisma.pmAutoGeneration.findUnique.mockResolvedValue(null);
    prisma.workOrder.create.mockResolvedValue({ id: "wo-new" });
    prisma.pmAutoGeneration.create.mockResolvedValue({ id: "gen-1" });

    const service = new PlanningService(prisma as any);
    const first = await service.autoCreateWorkOrderIfDue(actor, "plan-1", {
      now: new Date("2026-09-14T00:00:00.000Z")
    });
    expect(first.created).toBe(true);
    expect(first.workOrderId).toBe("wo-new");
    expect(prisma.workOrder.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          type: WorkOrderType.PREVENTIVE,
          pmPlanId: "plan-1",
          status: WorkOrderStatus.OPEN
        })
      })
    );

    const second = await service.autoCreateWorkOrderIfDue(actor, "plan-1", {
      now: new Date("2026-09-14T00:00:00.000Z")
    });
    expect(second.created).toBe(false);
    expect(second.reason).toBe("DUPLICATE_OPEN_WO");
  });

  it("prevents duplicate via generation key", async () => {
    const prisma = buildPrisma();
    prisma.pmPlan.findFirst.mockResolvedValue({
      id: "plan-1",
      tenantId: "tenant-1",
      code: "PM-001",
      name: "Compressor service",
      description: null,
      status: "ACTIVE",
      autoCreateWorkOrder: true,
      gracePeriodDays: 0,
      combineMode: "EARLIEST",
      lastCompletionAt: null,
      nextDueAt: new Date("2026-09-01T00:00:00.000Z"),
      nextDueMeterValue: null,
      assetId: null,
      vehicleId: null,
      estimatedDurationMinutes: null,
      triggers: [{ id: "t1", kind: "CALENDAR", intervalDays: 30, isActive: true }]
    });
    prisma.workOrder.findFirst.mockResolvedValue(null);
    prisma.pmAutoGeneration.findUnique.mockResolvedValue({
      id: "gen-1",
      workOrderId: "wo-prior"
    });

    const service = new PlanningService(prisma as any);
    const result = await service.autoCreateWorkOrderIfDue(actor, "plan-1", {
      now: new Date("2026-09-14T00:00:00.000Z")
    });
    expect(result.created).toBe(false);
    expect(result.reason).toBe("DUPLICATE_GENERATION_KEY");
    expect(result.workOrderId).toBe("wo-prior");
  });

  it("creates revision history on revise", async () => {
    const prisma = buildPrisma();
    prisma.pmPlan.findFirst.mockResolvedValue({
      id: "plan-1",
      tenantId: "tenant-1",
      currentRevision: 1,
      triggers: []
    });
    prisma.pmPlanRevision.updateMany.mockResolvedValue({ count: 1 });
    prisma.pmPlan.update.mockResolvedValue({
      id: "plan-1",
      currentRevision: 2,
      revisions: [{ revision: 2 }, { revision: 1 }],
      triggers: []
    });
    prisma.pmPlanRevision.findMany.mockResolvedValue([
      { revision: 2 },
      { revision: 1 }
    ]);

    const service = new PlanningService(prisma as any);
    const updated = await service.revisePmPlan(actor, "plan-1", { name: "Updated" }, "interval change");
    expect(updated.currentRevision).toBe(2);
    const history = await service.listRevisionHistory(actor, "plan-1");
    expect(history).toHaveLength(2);
  });

  it("inspection FAIL creates corrective WO", async () => {
    const prisma = buildPrisma();
    prisma.workOrder.create.mockResolvedValue({ id: "wo-corr" });
    prisma.inspection.create.mockResolvedValue({
      id: "insp-1",
      result: InspectionResult.FAIL,
      correctiveWorkOrderId: "wo-corr"
    });

    const service = new PlanningService(prisma as any);
    const row = await service.completeInspection(actor, {
      assetId: "asset-1",
      result: InspectionResult.FAIL,
      findings: "Leak detected"
    });
    expect(row.correctiveWorkOrderId).toBe("wo-corr");
    expect(prisma.workOrder.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ type: WorkOrderType.CORRECTIVE })
      })
    );
  });

  it("calibration FAIL creates corrective WO", async () => {
    const prisma = buildPrisma();
    prisma.workOrder.create.mockResolvedValue({ id: "wo-cal" });
    prisma.calibrationRecord.create.mockResolvedValue({
      id: "cal-1",
      result: CalibrationResult.FAIL,
      passFail: false,
      correctiveWorkOrderId: "wo-cal"
    });

    const service = new PlanningService(prisma as any);
    const row = await service.recordCalibration(actor, {
      calibrationType: "TEMP_PROBE",
      result: CalibrationResult.FAIL,
      correctiveAction: "Recalibrate / replace"
    });
    expect(row.correctiveWorkOrderId).toBe("wo-cal");
    expect(row.passFail).toBe(false);
  });

  it("buildPmGenerationKey is stable per day", () => {
    const key = buildPmGenerationKey("plan-1", new Date("2026-09-14T15:00:00.000Z"));
    expect(key).toBe("plan-1:2026-09-14");
  });
});
