import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
  Optional
} from "@nestjs/common";
import {
  AssetMeterType,
  CalibrationResult,
  ChecklistItemType,
  InspectionResult,
  PmPlanStatus,
  PmTriggerCombineMode,
  Priority,
  Prisma,
  WorkOrderStatus,
  WorkOrderType
} from "@prisma/client";

import { requireTenantId } from "../../common/utils/tenant-scope.util";
import { PrismaService } from "../../database/prisma.service";
import type { JwtPayload } from "../auth/auth.types";
import { ApprovalsService } from "../approvals/approvals.service";
import { MaintenanceRequestsService } from "../maintenance-requests/maintenance-requests.service";
import { WorkOrdersService } from "../work-orders/work-orders.service";
import { evaluateComplianceStatus } from "./compliance-status";
import { validateAssetMeterReading } from "./meter-validation";
import {
  buildPmGenerationKey,
  evaluateCombinedTriggers,
  type CombineMode,
  type TriggerContext,
  type TriggerDefinition
} from "./trigger-engine";

type Actor = Pick<JwtPayload, "sub" | "tenantId" | "role" | "email"> & {
  permissions?: string[];
};

const OPEN_WO_STATUSES: WorkOrderStatus[] = [
  WorkOrderStatus.OPEN,
  WorkOrderStatus.PLANNED,
  WorkOrderStatus.ASSIGNED,
  WorkOrderStatus.IN_PROGRESS,
  WorkOrderStatus.ON_HOLD,
  WorkOrderStatus.TECHNICIAN_COMPLETED,
  WorkOrderStatus.REWORK_REQUIRED,
  WorkOrderStatus.VERIFIED,
  WorkOrderStatus.OVERDUE
];

function isUniqueConflict(error: unknown): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002";
}

@Injectable()
export class PlanningService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly workOrdersService: WorkOrdersService,
    @Optional() private readonly approvalsService?: ApprovalsService,
    @Optional()
    @Inject(MaintenanceRequestsService)
    private readonly maintenanceRequestsService?: MaintenanceRequestsService
  ) {}

  // ----- PM Plans -----

  async listPmPlans(
    actor: Actor,
    filters?: { status?: PmPlanStatus; siteId?: string; assetId?: string; vehicleId?: string }
  ) {
    const tenantId = requireTenantId(actor.tenantId);
    return this.prisma.pmPlan.findMany({
      where: {
        tenantId,
        status: filters?.status,
        siteId: filters?.siteId,
        assetId: filters?.assetId,
        vehicleId: filters?.vehicleId
      },
      include: { triggers: true },
      orderBy: [{ updatedAt: "desc" }]
    });
  }

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
      siteId?: string;
      functionalLocationId?: string;
      domainId?: string;
      priority?: Priority;
      workType?: WorkOrderType;
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
        siteId: input.siteId,
        functionalLocationId: input.functionalLocationId,
        domainId: input.domainId,
        priority: input.priority ?? Priority.MEDIUM,
        workType: input.workType ?? WorkOrderType.PREVENTIVE,
        autoCreateWorkOrder: input.autoCreateWorkOrder ?? true,
        combineMode: input.combineMode ?? PmTriggerCombineMode.EARLIEST,
        effectiveFrom: input.effectiveFrom ?? new Date(),
        currentRevision: 1,
        triggers: input.triggers?.length
          ? {
              create: input.triggers.map((t) => ({
                tenantId,
                kind: t.kind as never,
                intervalDays: t.intervalDays,
                intervalValue: t.intervalValue,
                meterType: t.meterType as AssetMeterType | undefined,
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
            snapshot: input as object,
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

    const {
      triggers: _triggers,
      revisions: _revisions,
      id: _id,
      tenantId: _tenantId,
      createdAt: _createdAt,
      updatedAt: _updatedAt,
      ...safePatch
    } = patch;

    const updated = await this.prisma.pmPlan.update({
      where: { id: planId },
      data: {
        ...(safePatch as Prisma.PmPlanUpdateInput),
        currentRevision: nextRevision,
        revisions: {
          create: {
            tenantId,
            revision: nextRevision,
            effectiveFrom: now,
            snapshot: { ...existing, ...patch } as object,
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
    ctx: Omit<
      TriggerContext,
      | "gracePeriodDays"
      | "lastCompletionAt"
      | "nextDueAt"
      | "nextDueMeterValue"
      | "lastCompletionMeter"
    >
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

  async listDueWork(actor: Actor, ctx: TriggerContext = {}) {
    const tenantId = requireTenantId(actor.tenantId);
    const plans = await this.prisma.pmPlan.findMany({
      where: { tenantId, status: PmPlanStatus.ACTIVE },
      include: { triggers: true }
    });

    const due: Array<{ plan: (typeof plans)[number]; evaluation: ReturnType<PlanningService["evaluatePlanDue"]> }> =
      [];
    for (const plan of plans) {
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
      if (evaluation.due) {
        due.push({ plan, evaluation });
      }
    }
    return due;
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

    const woType =
      plan.workType && plan.workType !== WorkOrderType.CORRECTIVE
        ? plan.workType
        : WorkOrderType.PREVENTIVE;

    let workOrder: { id: string };
    try {
      workOrder = await this.createCanonicalWorkOrder(
        actor,
        {
          title: `PM: ${plan.name}`,
          description: plan.description ?? `Auto-generated from PM plan ${plan.code}`,
          priority: plan.priority,
          type: woType === WorkOrderType.PREVENTIVE ? "PREVENTIVE" : (woType as never),
          assetId: plan.assetId ?? undefined,
          vehicleId: plan.vehicleId ?? undefined,
          siteId: plan.siteId ?? undefined,
          functionalLocationId: plan.functionalLocationId ?? undefined,
          dueDate: evaluation.dueAt ? evaluation.dueAt.toISOString() : undefined,
          idempotencyKey: `pm:${plan.id}:${generationKey}`
        },
        {
          pmPlanId: plan.id,
          pmPlanRevision: plan.currentRevision,
          pmTriggerSource: evaluation.winningTriggerId ?? evaluation.summary,
          pmOccurrenceKey: generationKey,
          estimatedHours:
            plan.estimatedDurationMinutes != null
              ? plan.estimatedDurationMinutes / 60
              : undefined
        }
      );
    } catch (error) {
      if (isUniqueConflict(error)) {
        return { created: false, reason: "DUPLICATE", evaluation };
      }
      throw error;
    }

    try {
      await this.prisma.pmAutoGeneration.create({
        data: {
          tenantId,
          planId: plan.id,
          generationKey,
          workOrderId: workOrder.id,
          triggerSummary: evaluation as object
        }
      });
    } catch (error) {
      if (isUniqueConflict(error)) {
        return {
          created: false,
          workOrderId: workOrder.id,
          reason: "DUPLICATE",
          evaluation
        };
      }
      throw error;
    }

    return {
      created: true,
      workOrderId: workOrder.id,
      reason: "CREATED",
      evaluation
    };
  }

  // ----- Meters -----

  async createMeter(
    actor: Actor,
    input: {
      assetId?: string;
      vehicleId?: string;
      meterType: AssetMeterType;
      name: string;
      unit: string;
      currentValue?: number;
      staleAfterDays?: number;
      jumpWarningThreshold?: number;
    }
  ) {
    const tenantId = requireTenantId(actor.tenantId);
    if (!input.assetId && !input.vehicleId) {
      throw new BadRequestException("assetId or vehicleId is required");
    }
    return this.prisma.assetMeter.create({
      data: {
        tenantId,
        assetId: input.assetId,
        vehicleId: input.vehicleId,
        meterType: input.meterType,
        name: input.name,
        unit: input.unit,
        currentValue: input.currentValue ?? 0,
        staleAfterDays: input.staleAfterDays ?? 30,
        jumpWarningThreshold: input.jumpWarningThreshold
      }
    });
  }

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
          source: (input.source as never) ?? "USER",
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
        source: (input.source as never) ?? "USER",
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

  // ----- Checklist templates -----

  async createChecklistTemplate(
    actor: Actor,
    input: {
      code: string;
      name: string;
      description?: string;
      domainKey?: string;
      version?: number;
      items?: Array<{
        key: string;
        label: string;
        type: ChecklistItemType;
        required?: boolean;
        sortOrder?: number;
        unit?: string;
        options?: string[];
      }>;
    }
  ) {
    const tenantId = requireTenantId(actor.tenantId);
    return this.prisma.checklistTemplate.create({
      data: {
        tenantId,
        code: input.code,
        name: input.name,
        description: input.description,
        domainKey: input.domainKey,
        version: input.version ?? 1,
        items: input.items?.length
          ? {
              create: input.items.map((item, index) => ({
                tenantId,
                key: item.key,
                label: item.label,
                type: item.type,
                required: item.required ?? false,
                sortOrder: item.sortOrder ?? index,
                unit: item.unit,
                options: item.options ?? []
              }))
            }
          : undefined
      },
      include: { items: true }
    });
  }

  // ----- Inspections -----

  async completeInspection(
    actor: Actor,
    input: {
      templateId?: string;
      assetId?: string;
      vehicleId?: string;
      siteId?: string;
      functionalLocationId?: string;
      inspectorId?: string;
      isAdHoc?: boolean;
      result: InspectionResult;
      findings?: string;
      evidenceUrls?: string[];
      answers?: unknown;
      createCorrectiveWo?: boolean;
      findingItems?: Array<{
        itemKey?: string;
        severity?: string;
        description: string;
        evidenceUrls?: string[];
      }>;
    }
  ) {
    const tenantId = requireTenantId(actor.tenantId);
    let correctiveWorkOrderId: string | undefined;
    let maintenanceRequestId: string | undefined;

    if (input.result === InspectionResult.FAIL && input.createCorrectiveWo !== false) {
      const description =
        input.findings?.trim() || "Inspection FAIL - corrective action required";

      const canRequest =
        Boolean(this.maintenanceRequestsService) &&
        Boolean(input.assetId || input.functionalLocationId);

      if (canRequest && this.maintenanceRequestsService) {
        try {
          const request = await this.maintenanceRequestsService.create(
            tenantId,
            {
              sub: actor.sub,
              role: actor.role,
              tenantId: actor.tenantId,
              email: actor.email ?? "",
              permissions: actor.permissions
            },
            {
              assetId: input.assetId,
              functionalLocationId: input.functionalLocationId,
              siteId: input.siteId,
              description: description.length >= 5 ? description : `${description} (inspection)`,
              priority: Priority.HIGH,
              problemCategoryLabel: "INSPECTION_FAIL",
              idempotencyKey: `insp-fail:${input.assetId ?? input.functionalLocationId ?? "adhoc"}:${Date.now()}`
            }
          );
          maintenanceRequestId = request.id;
        } catch {
          // Fall through to corrective WO if request path fails (e.g. placement rules).
        }
      }

      if (!maintenanceRequestId) {
        const wo = await this.createCanonicalWorkOrder(actor, {
          title: "Corrective work from failed inspection",
          description,
          priority: Priority.HIGH,
          type: "INSPECTION_CORRECTIVE",
          assetId: input.assetId,
          vehicleId: input.vehicleId,
          siteId: input.siteId,
          functionalLocationId: input.functionalLocationId
        });
        correctiveWorkOrderId = wo.id;
      }
    }

    const inspection = await this.prisma.inspection.create({
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
        answers: input.answers as Prisma.InputJsonValue,
        correctiveWorkOrderId,
        status: "COMPLETED"
      }
    });

    const findingInputs =
      input.findingItems?.length
        ? input.findingItems
        : input.result === InspectionResult.FAIL && input.findings
          ? [
              {
                description: input.findings,
                severity: "HIGH",
                evidenceUrls: input.evidenceUrls
              }
            ]
          : [];

    if (findingInputs.length > 0) {
      await this.prisma.inspectionFinding.createMany({
        data: findingInputs.map((f) => ({
          tenantId,
          inspectionId: inspection.id,
          itemKey: f.itemKey,
          severity: f.severity ?? "MEDIUM",
          description: f.description,
          evidenceUrls: f.evidenceUrls ?? [],
          correctiveActionRequired: true,
          maintenanceRequestId,
          workOrderId: correctiveWorkOrderId
        }))
      });
    }

    return {
      ...inspection,
      maintenanceRequestId,
      findingCount: findingInputs.length
    };
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
      const wo = await this.createCanonicalWorkOrder(actor, {
        title: `Calibration fail: ${input.calibrationType}`,
        description: input.correctiveAction ?? "Calibration FAIL - corrective action required",
        priority: Priority.HIGH,
        type: "CALIBRATION_CORRECTIVE",
        assetId: input.equipmentAssetId
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
          metadata: input.metadata as Prisma.InputJsonValue,
          status: status as never
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
        metadata: input.metadata as Prisma.InputJsonValue,
        status: status as never
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
          data: { status: status as never }
        });
      });
  }

  /** Assert generation key uniqueness helper for tests / callers. */
  assertNoDuplicateGeneration() {
    throw new ConflictException("Duplicate PM auto-generation prevented");
  }

  /** Optional hook so ApprovalsService injection stays wired for future PM approval gates. */
  getApprovalsService(): ApprovalsService | undefined {
    return this.approvalsService;
  }

  private async createCanonicalWorkOrder(
    actor: Actor,
    data: {
      title: string;
      description: string;
      priority: Priority;
      type:
        | "PREVENTIVE"
        | "CORRECTIVE"
        | "EMERGENCY"
        | "INSPECTION"
        | "INSTALLATION"
        | "ACCIDENT_REPAIR"
        | "BREAKDOWN"
        | "VENDOR_REPAIR"
        | "EXTERNAL_REPAIR"
        | "IMPROVEMENT"
        | "INSPECTION_CORRECTIVE"
        | "CALIBRATION_CORRECTIVE";
      assetId?: string;
      vehicleId?: string;
      siteId?: string;
      functionalLocationId?: string;
      dueDate?: string;
      idempotencyKey?: string;
    },
    pmFields?: {
      pmPlanId?: string;
      pmPlanRevision?: number;
      pmTriggerSource?: string;
      pmOccurrenceKey?: string;
      estimatedHours?: number;
    }
  ) {
    if (!actor.role) {
      throw new BadRequestException("Authenticated actor role is required to create work orders");
    }

    const created = await this.workOrdersService.create(
      {
        title: data.title,
        description: data.description,
        priority: data.priority,
        type: data.type,
        assetId: data.assetId,
        vehicleId: data.vehicleId,
        siteId: data.siteId,
        functionalLocationId: data.functionalLocationId,
        createdById: actor.sub,
        dueDate: data.dueDate,
        idempotencyKey: data.idempotencyKey
      },
      {
        sub: actor.sub,
        role: actor.role,
        tenantId: actor.tenantId,
        email: actor.email ?? "",
        permissions: actor.permissions
      }
    );

    if (
      pmFields &&
      (pmFields.pmPlanId ||
        pmFields.pmPlanRevision != null ||
        pmFields.pmTriggerSource ||
        pmFields.pmOccurrenceKey ||
        pmFields.estimatedHours != null)
    ) {
      await this.prisma.workOrder.update({
        where: { id: created.id },
        data: {
          pmPlanId: pmFields.pmPlanId,
          pmPlanRevision: pmFields.pmPlanRevision,
          pmTriggerSource: pmFields.pmTriggerSource,
          pmOccurrenceKey: pmFields.pmOccurrenceKey,
          estimatedHours: pmFields.estimatedHours
        }
      });
    }

    return created;
  }
}
