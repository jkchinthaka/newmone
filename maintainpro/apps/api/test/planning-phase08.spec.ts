import {
  buildPmGenerationKey,
  evaluateCombinedTriggers,
  evaluateSingleTrigger
} from "../src/modules/planning/trigger-engine";
import { validateAssetMeterReading } from "../src/modules/planning/meter-validation";
import {
  deriveComplianceLabel,
  evaluateComplianceStatus
} from "../src/modules/planning/compliance-status";
import { PlanningService } from "../src/modules/planning/planning.service";
import { CalibrationResult, InspectionResult, WorkOrderType } from "@prisma/client";

describe("Phase 8 planning engine - triggers", () => {
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

  it("combined 500 hours OR 3 months - whichever comes first (meter wins)", () => {
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

  it("combined triggers - calendar wins when meter not yet reached", () => {
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

  it("deriveComplianceLabel maps engine statuses", () => {
    expect(deriveComplianceLabel("CURRENT")).toBe("VALID");
    expect(deriveComplianceLabel("DUE")).toBe("DUE_SOON");
    expect(deriveComplianceLabel("GRACE")).toBe("GRACE");
    expect(deriveComplianceLabel("EXPIRED")).toBe("EXPIRED");
    expect(deriveComplianceLabel("UNKNOWN")).toBe("UNKNOWN");
  });
});

describe("Phase 8 PlanningService - auto-WO, inspection, calibration, revisions", () => {
  const actor = { sub: "user-1", tenantId: "tenant-1", role: "ADMIN" as const, email: "a@b.c" };

  function buildPrisma(overrides: Record<string, any> = {}) {
    const prisma: Record<string, any> = {
      pmPlan: {
        findFirst: jest.fn(),
        findMany: jest.fn(),
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
        create: jest.fn(),
        update: jest.fn().mockResolvedValue({ id: "wo-new" })
      },
      assetMeter: {
        findFirst: jest.fn(),
        update: jest.fn(),
        create: jest.fn()
      },
      assetMeterReading: {
        create: jest.fn()
      },
      inspection: {
        create: jest.fn()
      },
      inspectionFinding: {
        createMany: jest.fn().mockResolvedValue({ count: 1 })
      },
      calibrationRecord: {
        create: jest.fn()
      },
      complianceRequirement: {
        create: jest.fn(),
        findFirst: jest.fn(),
        update: jest.fn()
      },
      checklistTemplate: {
        create: jest.fn(),
        findMany: jest.fn(),
        findFirst: jest.fn(),
        updateMany: jest.fn()
      },
      checklistExecution: {
        findFirst: jest.fn(),
        findMany: jest.fn(),
        create: jest.fn(),
        update: jest.fn()
      },
      configChangeHistory: {
        count: jest.fn().mockResolvedValue(0),
        create: jest.fn().mockResolvedValue({})
      },
      ...overrides
    };
    prisma.$transaction = jest.fn(async (fn: (tx: unknown) => Promise<unknown>) => fn(prisma));
    return prisma;
  }

  function buildWorkOrders(createImpl?: jest.Mock) {
    return {
      create: createImpl ?? jest.fn().mockResolvedValue({ id: "wo-new" })
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
      siteId: null,
      functionalLocationId: null,
      priority: "MEDIUM",
      workType: WorkOrderType.PREVENTIVE,
      currentRevision: 1,
      estimatedDurationMinutes: 120,
      triggers: [{ id: "t1", kind: "CALENDAR", intervalDays: 90, isActive: true }]
    });
    prisma.workOrder.findFirst.mockResolvedValueOnce(null).mockResolvedValueOnce({
      id: "wo-existing"
    });
    prisma.pmAutoGeneration.findUnique.mockResolvedValue(null);
    prisma.pmAutoGeneration.create.mockResolvedValue({ id: "gen-1" });

    const workOrders = buildWorkOrders();
    const service = new PlanningService(prisma as any, workOrders as any);
    const first = await service.autoCreateWorkOrderIfDue(actor, "plan-1", {
      now: new Date("2026-09-14T00:00:00.000Z")
    });
    expect(first.created).toBe(true);
    expect(first.workOrderId).toBe("wo-new");
    expect(workOrders.create).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "PREVENTIVE",
        createdById: "user-1",
        idempotencyKey: expect.stringMatching(/^pm:plan-1:/)
      }),
      expect.objectContaining({ sub: "user-1", role: "ADMIN" })
    );
    expect(prisma.workOrder.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "wo-new" },
        data: expect.objectContaining({
          pmPlanId: "plan-1",
          estimatedHours: 2
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
      priority: "MEDIUM",
      workType: WorkOrderType.PREVENTIVE,
      currentRevision: 1,
      estimatedDurationMinutes: null,
      triggers: [{ id: "t1", kind: "CALENDAR", intervalDays: 30, isActive: true }]
    });
    prisma.workOrder.findFirst.mockResolvedValue(null);
    prisma.pmAutoGeneration.findUnique.mockResolvedValue({
      id: "gen-1",
      workOrderId: "wo-prior"
    });

    const workOrders = buildWorkOrders();
    const service = new PlanningService(prisma as any, workOrders as any);
    const result = await service.autoCreateWorkOrderIfDue(actor, "plan-1", {
      now: new Date("2026-09-14T00:00:00.000Z")
    });
    expect(result.created).toBe(false);
    expect(result.reason).toBe("DUPLICATE_GENERATION_KEY");
    expect(result.workOrderId).toBe("wo-prior");
    expect(workOrders.create).not.toHaveBeenCalled();
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
    prisma.pmPlanRevision.findMany.mockResolvedValue([{ revision: 2 }, { revision: 1 }]);

    const service = new PlanningService(prisma as any, buildWorkOrders() as any);
    const updated = await service.revisePmPlan(actor, "plan-1", { name: "Updated" }, "interval change");
    expect(updated.currentRevision).toBe(2);
    const history = await service.listRevisionHistory(actor, "plan-1");
    expect(history).toHaveLength(2);
  });

  it("inspection FAIL creates INSPECTION_CORRECTIVE WO and findings", async () => {
    const prisma = buildPrisma();
    const workOrders = buildWorkOrders(jest.fn().mockResolvedValue({ id: "wo-corr" }));
    prisma.inspection.create.mockResolvedValue({
      id: "insp-1",
      result: InspectionResult.FAIL,
      correctiveWorkOrderId: "wo-corr"
    });

    const service = new PlanningService(prisma as any, workOrders as any);
    const row = await service.completeInspection(actor, {
      assetId: "asset-1",
      result: InspectionResult.FAIL,
      findings: "Leak detected"
    });
    expect(row.correctiveWorkOrderId).toBe("wo-corr");
    expect(workOrders.create).toHaveBeenCalledWith(
      expect.objectContaining({ type: "INSPECTION_CORRECTIVE" }),
      expect.objectContaining({ sub: "user-1" })
    );
    expect(prisma.inspectionFinding.createMany).toHaveBeenCalled();
  });

  it("calibration FAIL creates CALIBRATION_CORRECTIVE WO", async () => {
    const prisma = buildPrisma();
    const workOrders = buildWorkOrders(jest.fn().mockResolvedValue({ id: "wo-cal" }));
    prisma.calibrationRecord.create.mockResolvedValue({
      id: "cal-1",
      result: CalibrationResult.FAIL,
      passFail: false,
      correctiveWorkOrderId: "wo-cal"
    });

    const service = new PlanningService(prisma as any, workOrders as any);
    const row = await service.recordCalibration(actor, {
      calibrationType: "TEMP_PROBE",
      result: CalibrationResult.FAIL,
      correctiveAction: "Recalibrate / replace"
    });
    expect(row.correctiveWorkOrderId).toBe("wo-cal");
    expect(row.passFail).toBe(false);
    expect(workOrders.create).toHaveBeenCalledWith(
      expect.objectContaining({ type: "CALIBRATION_CORRECTIVE" }),
      expect.any(Object)
    );
  });

  it("buildPmGenerationKey is stable per day", () => {
    const key = buildPmGenerationKey("plan-1", new Date("2026-09-14T15:00:00.000Z"));
    expect(key).toBe("plan-1:2026-09-14");
  });

  it("starts checklist execution with frozen template snapshot", async () => {
    const prisma = buildPrisma();
    prisma.workOrder.findFirst.mockResolvedValue({ id: "wo-1" });
    prisma.checklistTemplate.findFirst.mockResolvedValue({
      id: "tpl-1",
      code: "GEN-MONTHLY",
      name: "Generator Monthly",
      version: 2,
      domainKey: "MACHINERY",
      items: [
        {
          key: "oil",
          label: "Oil level",
          type: "PASS_FAIL",
          required: true,
          sortOrder: 0,
          unit: null,
          minValue: null,
          maxValue: null,
          options: "[]",
          signatureJustified: false
        }
      ]
    });
    prisma.checklistExecution.findFirst.mockResolvedValue(null);
    prisma.checklistExecution.create.mockImplementation(async ({ data }: { data: Record<string, unknown> }) => ({
      id: "exec-1",
      ...data
    }));

    const service = new PlanningService(prisma as any, buildWorkOrders() as any);
    const exec = await service.startChecklistExecution(actor, {
      workOrderId: "wo-1",
      templateId: "tpl-1"
    });

    expect(exec.templateRevision).toBe(2);
    const snapshot = JSON.parse(String(exec.templateSnapshot));
    expect(snapshot.code).toBe("GEN-MONTHLY");
    expect(snapshot.items).toHaveLength(1);
    expect(snapshot.items[0].key).toBe("oil");
  });

  it("revising checklist template does not mutate prior execution snapshot", async () => {
    const prisma = buildPrisma();
    const frozenSnapshot = JSON.stringify({
      code: "GEN-MONTHLY",
      version: 1,
      items: [{ key: "oil", label: "Oil level (v1)" }]
    });
    prisma.workOrder.findFirst.mockResolvedValue({ id: "wo-1" });
    prisma.checklistExecution.findFirst.mockResolvedValue({
      id: "exec-old",
      templateId: "tpl-v1",
      templateRevision: 1,
      templateSnapshot: frozenSnapshot,
      workOrderId: "wo-1",
      completedAt: null
    });

    const service = new PlanningService(prisma as any, buildWorkOrders() as any);
    const existing = await service.startChecklistExecution(actor, {
      workOrderId: "wo-1",
      templateId: "tpl-v1"
    });
    expect(existing.templateSnapshot).toBe(frozenSnapshot);
    expect(prisma.checklistExecution.create).not.toHaveBeenCalled();

    prisma.checklistTemplate.findFirst.mockResolvedValue({
      id: "tpl-v1",
      tenantId: "tenant-1",
      code: "GEN-MONTHLY",
      name: "Generator Monthly",
      description: null,
      domainKey: "MACHINERY",
      version: 1,
      items: [{ key: "oil", label: "Oil level (v1)", type: "PASS_FAIL", required: true, sortOrder: 0, unit: null, options: "[]" }]
    });
    prisma.checklistTemplate.create.mockResolvedValue({
      id: "tpl-v2",
      code: "GEN-MONTHLY",
      name: "Generator Monthly",
      version: 2,
      items: [{ key: "oil", label: "Oil level (v2)", type: "PASS_FAIL" }]
    });

    const revised = await service.reviseChecklistTemplate(actor, "tpl-v1", {
      items: [
        {
          key: "oil",
          label: "Oil level (v2)",
          type: "PASS_FAIL" as never,
          required: true
        }
      ],
      changeReason: "Clarify oil check wording"
    });
    expect(revised.version).toBe(2);
    expect(prisma.configChangeHistory.create).toHaveBeenCalled();
    // Prior execution snapshot remains the v1 wording when re-read
    expect(JSON.parse(frozenSnapshot).items[0].label).toBe("Oil level (v1)");
  });

  it("auto-creates checklist execution when PM plan has checklistTemplateId", async () => {
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
      lastCompletionMileage: null,
      lastCompletionHours: null,
      nextDueAt: new Date("2026-09-01T00:00:00.000Z"),
      nextDueMeterValue: null,
      assetId: "asset-1",
      vehicleId: null,
      siteId: null,
      functionalLocationId: null,
      priority: "MEDIUM",
      workType: WorkOrderType.PREVENTIVE,
      currentRevision: 1,
      estimatedDurationMinutes: 60,
      checklistTemplateId: "tpl-1",
      triggers: [{ id: "t1", kind: "CALENDAR", intervalDays: 30, isActive: true }]
    });
    prisma.workOrder.findFirst
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({ id: "wo-new" });
    prisma.pmAutoGeneration.findUnique.mockResolvedValue(null);
    prisma.pmAutoGeneration.create.mockResolvedValue({ id: "gen-1" });
    prisma.checklistTemplate.findFirst.mockResolvedValue({
      id: "tpl-1",
      code: "COMP-PM",
      name: "Compressor PM",
      version: 1,
      domainKey: "MACHINERY",
      items: []
    });
    prisma.checklistExecution.findFirst.mockResolvedValue(null);
    prisma.checklistExecution.create.mockResolvedValue({ id: "exec-1" });

    const workOrders = buildWorkOrders();
    const service = new PlanningService(prisma as any, workOrders as any);
    const result = await service.autoCreateWorkOrderIfDue(actor, "plan-1", {
      now: new Date("2026-09-14T00:00:00.000Z")
    });
    expect(result.created).toBe(true);
    expect(prisma.checklistExecution.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          workOrderId: "wo-new",
          templateId: "tpl-1",
          templateRevision: 1
        })
      })
    );
  });
});
