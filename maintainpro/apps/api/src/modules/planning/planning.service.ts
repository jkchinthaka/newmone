import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException
} from "@nestjs/common";
import {
  CalibrationResult,
  InspectionResult,
  PmPlanStatus,
  PmTriggerCombineMode,
  WorkOrderStatus,
  WorkOrderType
} from "@prisma/client";

import { requireTenantId } from "../../common/utils/tenant-scope.util";
import { PrismaService } from "../../database/prisma.service";
import type { JwtPayload } from "../auth/auth.types";
import { evaluateComplianceStatus } from "./compliance-status";
import { validateAssetMeterReading } from "./meter-validation";
import {
  buildPmGenerationKey,
  evaluateCombinedTriggers,
  type CombineMode,
  type TriggerContext,
  type TriggerDefinition
} from "./trigger-engine";

type Actor = Pick<JwtPayload, "sub" | "tenantId">;

const OPEN_WO_STATUSES: WorkOrderStatus[] = [
  WorkOrderStatus.OPEN,
  WorkOrderStatus.IN_PROGRESS,
  WorkOrderStatus.ON_HOLD,
  WorkOrderStatus.TECHNICIAN_COMPLETED,
  WorkOrderStatus.REWORK_REQUIRED,
  WorkOrderStatus.OVERDUE
];

@Injectable()
export class PlanningService {
  constructor(private readonly prisma: PrismaService) {}

  // ----- PM Plans -----

  async createPmPlan(
    actor: Actor,
    input: {
      code: string;
      name: string;
      description?: string;
      assetId?: string;
      vehicleId?: string;
      location?: string;
      teamId?: string;
      estimatedDurationMinutes?: number;
      requiredPartIds?: string[];
      checklistTemplateId?: string;
      gracePeriodDays?: number;
      autoCreateWorkOrder?: boolean;
      combineMode?: PmTriggerCombineMode;
      effectiveFrom?: Date;
      triggers?: Array<{
        kind: TriggerDefinition["kind"];
        intervalDays?: number;
        intervalValue?: number;
        meterType?: string;
        meterId?: string;
        unit?: string;
        referenceKey?: string;
        combineGroup?: number;
      }>;
    }
  ) {
    const tenantId = requireTenantId(actor.tenantId);
    const plan = await this.prisma.pmPlan.create({
      data: {
        tenantId,
        code: input.code,
        name: input.name,
        description: input.description,
        status: PmPlanStatus.ACTIVE,
        assetId: input.assetId,
        vehicleId: input.vehicleId,
        location: input.location,
        teamId: input.teamId,
        estimatedDurationMinutes: input.estimatedDurationMinutes,
        requiredPartIds: input.requiredPartIds ?? [],
        checklistTemplateId: input.checklistTemplateId,
        gracePeriodDays: input.gracePeriodDays ?? 0,
        autoCreateWorkOrder: input.autoCreateWorkOrder ?? true,
        combineMode: input.combineMode ?? PmTriggerCombineMode.EARLIEST,
        effectiveFrom: input.effectiveFrom ?? new Date(),
        currentRevision: 1,
        triggers: input.triggers?.length
          ? {
              create: input.triggers.map((t) => ({
                tenantId,
                kind: t.kind as any,
                intervalDays: t.intervalDays,
                intervalValue: t.intervalValue,
                meterType: t.meterType as any,
                meterId: t.meterId,
                unit: t.unit,
                referenceKey: t.referenceKey,
                combineGroup: t.combineGroup ?? 0
              }))
            }
          : undefined,
        revisions: {
          create: {
            tenantId,
            revision: 1,
            effectiveFrom: input.effectiveFrom ?? new Date(),
            snapshot: input as any,
            changeReason: "INITIAL",
            createdById: actor.sub
          }
        }
      },
      include: { triggers: true, revisions: true }
    });
    return plan;
  }

  async revisePmPlan(
    actor: Actor,
    planId: string,
    patch: Record<string, unknown>,
    changeReason?: string
  ) {
    const tenantId = requireTenantId(actor.tenantId);
    const existing = await this.prisma.pmPlan.findFirst({
      where: { id: planId, tenantId },
      include: { triggers: true }
    });
    if (!existing) {
      throw new NotFoundException("PM plan not found");
    }
    const nextRevision = existing.currentRevision + 1;
    const now = new Date();
    await this.prisma.pmPlanRevision.updateMany({
      where: { planId, effectiveTo: null },
      data: { effectiveTo: now }
    });
    const updated = await this.prisma.pmPlan.update({
      where: { id: planId },
      data: {
        ...(patch as any),
        currentRevision: nextRevision,
        revisions: {
          create: {
            tenantId,
            revision: nextRevision,
            effectiveFrom: now,
            snapshot: { ...existing, ...patch } as any,
            changeReason: changeReason ?? "REVISION",
            createdById: actor.sub
          }
        }
      },
      include: { revisions: { orderBy: { revision: "desc" } }, triggers: true }
    });
    return updated;
  }

  async listRevisionHistory(actor: Actor, planId: string) {
    const tenantId = requireTenantId(actor.tenantId);
    return this.prisma.pmPlanRevision.findMany({
      where: { tenantId, planId },
      orderBy: { revision: "desc" }
    });
  }

  evaluatePlanDue(
    plan: {
      id: string;
      gracePeriodDays?: number | null;
      combineMode?: PmTriggerCombineMode | CombineMode | null;
      lastCompletionAt?: Date | null;
      lastCompletionMileage?: number | null;
      lastCompletionHours?: number | null;
      nextDueAt?: Date | null;
      nextDueMeterValue?: number | null;
      triggers: TriggerDefinition[];
    },
    ctx: Omit<TriggerContext, "gracePeriodDays" | "lastCompletionAt" | "nextDueAt" | "nextDueMeterValue" | "lastCompletionMeter">
  ) {
    return evaluateCombinedTriggers(
      plan.triggers,
      {
        ...ctx,
        gracePeriodDays: plan.gracePeriodDays ?? 0,
        lastCompletionAt: plan.lastCompletionAt,
        lastCompletionMeter: plan.lastCompletionMileage ?? plan.lastCompletionHours,
        nextDueAt: plan.nextDueAt,
        nextDueMeterValue: plan.nextDueMeterValue
      },
      (plan.combineMode as CombineMode) ?? "EARLIEST"
    );
  }

  /**
   * Auto-create preventive WO when plan is due.
   * Duplicate prevention: open WO for plan OR PmAutoGeneration unique key.
   */
  async autoCreateWorkOrderIfDue(
    actor: Actor,
    planId: string,
    ctx: TriggerContext = {}
  ): Promise<{ created: boolean; workOrderId?: string; reason: string; evaluation?: unknown }> {
    const tenantId = requireTenantId(actor.tenantId);
    const plan = await this.prisma.pmPlan.findFirst({
      where: { id: planId, tenantId, status: PmPlanStatus.ACTIVE },
      include: { triggers: true }
    });
    if (!plan) {
      throw new NotFoundException("Active PM plan not found");
    }
    if (!plan.autoCreateWorkOrder) {
      return { created: false, reason: "AUTO_WO_DISABLED" };
    }

    const evaluation = this.evaluatePlanDue(
      {
        id: plan.id,
        gracePeriodDays: plan.gracePeriodDays,
        combineMode: plan.combineMode,
        lastCompletionAt: plan.lastCompletionAt,
        lastCompletionMileage: plan.lastCompletionMileage,
        lastCompletionHours: plan.lastCompletionHours,
        nextDueAt: plan.nextDueAt,
        nextDueMeterValue: plan.nextDueMeterValue,
        triggers: plan.triggers.map((t) => ({
          id: t.id,
          kind: t.kind as TriggerDefinition["kind"],
          intervalDays: t.intervalDays,
          intervalValue: t.intervalValue,
          referenceKey: t.referenceKey,
          isActive: t.isActive
        }))
      },
      ctx
    );

    if (!evaluation.due) {
      return { created: false, reason: "NOT_DUE", evaluation };
    }

    const existingOpen = await this.prisma.workOrder.findFirst({
      where: {
        tenantId,
        pmPlanId: plan.id,
        status: { in: OPEN_WO_STATUSES }
      },
      select: { id: true }
    });
    if (existingOpen) {
      return {
        created: false,
        workOrderId: existingOpen.id,
        reason: "DUPLICATE_OPEN_WO",
        evaluation
      };
    }

    const generationKey = buildPmGenerationKey(plan.id, evaluation.dueAt, ctx.now);
    const priorGen = await this.prisma.pmAutoGeneration.findUnique({
      where: {
        tenantId_planId_generationKey: {
          tenantId,
          planId: plan.id,
          generationKey
        }
      }
    });
    if (priorGen) {
      return {
        created: false,
        workOrderId: priorGen.workOrderId ?? undefined,
        reason: "DUPLICATE_GENERATION_KEY",
        evaluation
      };
    }

    const woNumber = `PM-${Date.now().toString(36).toUpperCase()}`;
    const workOrder = await this.prisma.workOrder.create({
      data: {
        tenantId,
        woNumber,
        title: `PM: ${plan.name}`,
        description: plan.description ?? `Auto-generated from PM plan ${plan.code}`,
        type: WorkOrderType.PREVENTIVE,
        status: WorkOrderStatus.OPEN,
        assetId: plan.assetId,
        vehicleId: plan.vehicleId,
        pmPlanId: plan.id,
        createdById: actor.sub,
        dueDate: evaluation.dueAt ?? undefined,
        estimatedHours:
          plan.estimatedDurationMinutes != null
            ? plan.estimatedDurationMinutes / 60
            : undefined
      }
    });

    await this.prisma.pmAutoGeneration.create({
      data: {
        tenantId,
        planId: plan.id,
        generationKey,
        workOrderId: workOrder.id,
        triggerSummary: evaluation as any
      }
    });

    return {
      created: true,
      workOrderId: workOrder.id,
      reason: "CREATED",
      evaluation
    };
  }

  // ----- Meters -----

  async recordMeterReading(
    actor: Actor,
    meterId: string,
    input: {
      value: number;
      source?: "USER" | "DEVICE" | "IMPORT" | "SYSTEM";
      deviceId?: string;
      recordedAt?: Date;
      notes?: string;
    }
  ) {
    const tenantId = requireTenantId(actor.tenantId);
    const meter = await this.prisma.assetMeter.findFirst({
      where: { id: meterId, tenantId, isActive: true }
    });
    if (!meter) {
      throw new NotFoundException("Meter not found");
    }

    const validation = validateAssetMeterReading({
      previousValue: meter.currentValue,
      nextValue: input.value,
      lastReadingAt: meter.lastReadingAt,
      recordedAt: input.recordedAt,
      staleAfterDays: meter.staleAfterDays,
      jumpWarningThreshold: meter.jumpWarningThreshold
    });

    if (validation.rejected) {
      await this.prisma.assetMeterReading.create({
        data: {
          tenantId,
          meterId,
          value: input.value,
          previousValue: meter.currentValue,
          source: (input.source as any) ?? "USER",
          recordedById: actor.sub,
          deviceId: input.deviceId,
          recordedAt: input.recordedAt ?? new Date(),
          rejected: true,
          rejectReason: validation.rejectReason,
          notes: input.notes
        }
      });
      throw new BadRequestException(validation.rejectReason ?? "Invalid meter reading");
    }

    const reading = await this.prisma.assetMeterReading.create({
      data: {
        tenantId,
        meterId,
        value: input.value,
        previousValue: meter.currentValue,
        source: (input.source as any) ?? "USER",
        recordedById: actor.sub,
        deviceId: input.deviceId,
        recordedAt: input.recordedAt ?? new Date(),
        isStale: validation.isStale,
        suspiciousJump: validation.suspiciousJump,
        notes: input.notes
      }
    });

    await this.prisma.assetMeter.update({
      where: { id: meterId },
      data: {
        currentValue: input.value,
        lastReadingAt: input.recordedAt ?? new Date()
      }
    });

    return { reading, validation };
  }

  // ----- Inspections -----

  async completeInspection(
    actor: Actor,
    input: {
      templateId?: string;
      assetId?: string;
      vehicleId?: string;
      inspectorId?: string;
      isAdHoc?: boolean;
      result: InspectionResult;
      findings?: string;
      evidenceUrls?: string[];
      answers?: unknown;
      createCorrectiveWo?: boolean;
    }
  ) {
    const tenantId = requireTenantId(actor.tenantId);
    let correctiveWorkOrderId: string | undefined;

    if (input.result === InspectionResult.FAIL && input.createCorrectiveWo !== false) {
      const wo = await this.prisma.workOrder.create({
        data: {
          tenantId,
          woNumber: `INSP-${Date.now().toString(36).toUpperCase()}`,
          title: "Corrective work from failed inspection",
          description: input.findings ?? "Inspection FAIL — corrective action required",
          type: WorkOrderType.CORRECTIVE,
          status: WorkOrderStatus.OPEN,
          assetId: input.assetId,
          vehicleId: input.vehicleId,
          createdById: actor.sub
        }
      });
      correctiveWorkOrderId = wo.id;
    }

    return this.prisma.inspection.create({
      data: {
        tenantId,
        templateId: input.templateId,
        assetId: input.assetId,
        vehicleId: input.vehicleId,
        inspectorId: input.inspectorId ?? actor.sub,
        isAdHoc: input.isAdHoc ?? !input.templateId,
        performedAt: new Date(),
        result: input.result,
        findings: input.findings,
        evidenceUrls: input.evidenceUrls ?? [],
        answers: input.answers as any,
        correctiveWorkOrderId,
        status: "COMPLETED"
      }
    });
  }

  // ----- Calibration -----

  async recordCalibration(
    actor: Actor,
    input: {
      equipmentAssetId?: string;
      calibrationType: string;
      lastCalibratedAt?: Date;
      nextDueAt?: Date;
      vendorId?: string;
      vendorName?: string;
      certificateUrl?: string;
      result: CalibrationResult;
      tolerance?: string;
      measuredValue?: number;
      correctiveAction?: string;
      createCorrectiveWo?: boolean;
    }
  ) {
    const tenantId = requireTenantId(actor.tenantId);
    const passFail = input.result === CalibrationResult.PASS;
    let correctiveWorkOrderId: string | undefined;

    if (input.result === CalibrationResult.FAIL && input.createCorrectiveWo !== false) {
      const wo = await this.prisma.workOrder.create({
        data: {
          tenantId,
          woNumber: `CAL-${Date.now().toString(36).toUpperCase()}`,
          title: `Calibration fail: ${input.calibrationType}`,
          description: input.correctiveAction ?? "Calibration FAIL — corrective action required",
          type: WorkOrderType.CORRECTIVE,
          status: WorkOrderStatus.OPEN,
          assetId: input.equipmentAssetId,
          createdById: actor.sub
        }
      });
      correctiveWorkOrderId = wo.id;
    }

    return this.prisma.calibrationRecord.create({
      data: {
        tenantId,
        equipmentAssetId: input.equipmentAssetId,
        calibrationType: input.calibrationType,
        lastCalibratedAt: input.lastCalibratedAt ?? new Date(),
        nextDueAt: input.nextDueAt,
        vendorId: input.vendorId,
        vendorName: input.vendorName,
        certificateUrl: input.certificateUrl,
        result: input.result,
        tolerance: input.tolerance,
        measuredValue: input.measuredValue,
        passFail,
        correctiveAction: input.correctiveAction,
        correctiveWorkOrderId
      }
    });
  }

  // ----- Compliance -----

  async upsertComplianceRequirement(
    actor: Actor,
    input: {
      id?: string;
      typeKey: string;
      subjectType: string;
      subjectId: string;
      title: string;
      issuedAt?: Date;
      expiresAt?: Date;
      gracePeriodDays?: number;
      reminderDays?: number;
      certificateUrl?: string;
      providerName?: string;
      metadata?: unknown;
    }
  ) {
    const tenantId = requireTenantId(actor.tenantId);
    const status = evaluateComplianceStatus({
      expiresAt: input.expiresAt,
      gracePeriodDays: input.gracePeriodDays,
      reminderDays: input.reminderDays
    });

    if (input.id) {
      const existing = await this.prisma.complianceRequirement.findFirst({
        where: { id: input.id, tenantId }
      });
      if (!existing) {
        throw new NotFoundException("Compliance requirement not found");
      }
      return this.prisma.complianceRequirement.update({
        where: { id: input.id },
        data: {
          typeKey: input.typeKey,
          subjectType: input.subjectType,
          subjectId: input.subjectId,
          title: input.title,
          issuedAt: input.issuedAt,
          expiresAt: input.expiresAt,
          gracePeriodDays: input.gracePeriodDays ?? existing.gracePeriodDays,
          reminderDays: input.reminderDays ?? existing.reminderDays,
          certificateUrl: input.certificateUrl,
          providerName: input.providerName,
          metadata: input.metadata as any,
          status: status as any
        }
      });
    }

    return this.prisma.complianceRequirement.create({
      data: {
        tenantId,
        typeKey: input.typeKey,
        subjectType: input.subjectType,
        subjectId: input.subjectId,
        title: input.title,
        issuedAt: input.issuedAt,
        expiresAt: input.expiresAt,
        gracePeriodDays: input.gracePeriodDays ?? 0,
        reminderDays: input.reminderDays ?? 30,
        certificateUrl: input.certificateUrl,
        providerName: input.providerName,
        metadata: input.metadata as any,
        status: status as any
      }
    });
  }

  refreshComplianceStatus(actor: Actor, id: string) {
    return this.prisma.complianceRequirement
      .findFirst({ where: { id, tenantId: requireTenantId(actor.tenantId) } })
      .then(async (row) => {
        if (!row) throw new NotFoundException("Compliance requirement not found");
        const status = evaluateComplianceStatus({
          expiresAt: row.expiresAt,
          gracePeriodDays: row.gracePeriodDays,
          reminderDays: row.reminderDays
        });
        return this.prisma.complianceRequirement.update({
          where: { id },
          data: { status: status as any }
        });
      });
  }

  /** Assert generation key uniqueness helper for tests / callers. */
  assertNoDuplicateGeneration() {
    throw new ConflictException("Duplicate PM auto-generation prevented");
  }
}
