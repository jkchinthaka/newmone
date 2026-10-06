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

import { persistEvidenceFileBytes } from "../evidence/evidence-storage.mapper";
import { evaluateInspectionChecklist } from "./inspection-checklist";
import { requireTenantId } from "../../common/utils/tenant-scope.util";
import { PrismaService } from "../../database/prisma.service";
import type { JwtPayload } from "../auth/auth.types";
import { ApprovalsService } from "../approvals/approvals.service";
import { MaintenanceRequestsService } from "../maintenance-requests/maintenance-requests.service";
import { ReliabilityService } from "../reliability/reliability.service";
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

const PM_PLAN_STATUS_TRANSITIONS: Record<string, string[]> = {
  DRAFT: ["ACTIVE", "INACTIVE"],
  ACTIVE: ["INACTIVE", "RETIRED"],
  INACTIVE: ["ACTIVE", "RETIRED"],
  RETIRED: []
};

export function assertPmPlanStatusTransition(from: string, to: string) {
  if (from === to) return;
  const allowed = PM_PLAN_STATUS_TRANSITIONS[from] ?? [];
  if (!allowed.includes(to)) {
    throw new BadRequestException(`PM plan cannot move from ${from} to ${to}`);
  }
}

function parseInspectionMeta(raw: string | null | undefined): Record<string, unknown> {
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw) as unknown;
    return parsed && typeof parsed === "object" && !Array.isArray(parsed)
      ? (parsed as Record<string, unknown>)
      : {};
  } catch {
    return {};
  }
}

@Injectable()
export class PlanningService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly workOrdersService: WorkOrdersService,
    @Optional() private readonly approvalsService?: ApprovalsService,
    @Optional()
    @Inject(MaintenanceRequestsService)
    private readonly maintenanceRequestsService?: MaintenanceRequestsService,
    @Optional() private readonly reliability?: ReliabilityService
  ) {}

  // ----- PM Plans -----

  async listPmPlans(
    actor: Actor,
    filters?: {
      status?: PmPlanStatus;
      siteId?: string;
      assetId?: string;
      vehicleId?: string;
      search?: string;
      trigger?: string;
      dueWindow?: string;
      page?: number;
      pageSize?: number;
    }
  ) {
    const tenantId = requireTenantId(actor.tenantId);
    const page = Math.max(filters?.page ?? 1, 1);
    const pageSize = Math.min(Math.max(filters?.pageSize ?? 25, 1), 100);
    const search = filters?.search?.trim();
    const rows = await this.prisma.pmPlan.findMany({
      where: {
        tenantId,
        status: filters?.status,
        siteId: filters?.siteId,
        assetId: filters?.assetId,
        vehicleId: filters?.vehicleId,
        ...(filters?.trigger
          ? { triggers: { some: { kind: filters.trigger as never, isActive: true } } }
          : {}),
        ...(search
          ? {
              OR: [
                { code: { contains: search } },
                { name: { contains: search } },
                { description: { contains: search } },
                { asset: { name: { contains: search } } },
                { asset: { assetTag: { contains: search } } },
                { vehicle: { registrationNo: { contains: search } } },
                { vehicle: { make: { contains: search } } }
              ]
            }
          : {})
      },
      include: {
        triggers: true,
        asset: { select: { id: true, name: true, assetTag: true, status: true } },
        vehicle: { select: { id: true, registrationNo: true, make: true, vehicleModel: true, status: true } },
        workOrders: {
          where: { status: { notIn: [WorkOrderStatus.COMPLETED, WorkOrderStatus.CLOSED, WorkOrderStatus.CANCELLED] } },
          orderBy: { createdAt: "desc" },
          take: 1,
          select: { id: true, woNumber: true, status: true }
        }
      },
      orderBy: [{ nextDueAt: "asc" }, { updatedAt: "desc" }]
    });

    const now = Date.now();
    const decorated = rows.map((plan) => {
      const validityIssues = pmPlanValidityIssues(plan);
      // Show the real next due date even when it was never stored: calendar plans project
      // from the last completion, or from the schedule start when never completed.
      const projected =
        plan.nextDueAt ??
        this.evaluatePlanDue(
          {
            id: plan.id,
            gracePeriodDays: plan.gracePeriodDays,
            combineMode: plan.combineMode,
            lastCompletionAt: plan.lastCompletionAt,
            lastCompletionMileage: plan.lastCompletionMileage,
            lastCompletionHours: plan.lastCompletionHours,
            nextDueAt: plan.nextDueAt,
            nextDueMeterValue: plan.nextDueMeterValue,
            effectiveFrom: plan.effectiveFrom,
            createdAt: plan.createdAt,
            triggers: (plan.triggers ?? []).map((t) => ({
              id: t.id,
              kind: t.kind as TriggerDefinition["kind"],
              intervalDays: t.intervalDays,
              intervalValue: t.intervalValue,
              referenceKey: t.referenceKey,
              isActive: t.isActive
            }))
          },
          { now: new Date(now) }
        ).results.filter((result) => result.kind === "CALENDAR" && result.dueAt)
          .map((result) => result.dueAt as Date)
          .sort((a, b) => a.getTime() - b.getTime())[0] ??
        null;
      const due = projected ? projected.getTime() : null;
      const days = due == null ? null : (due - now) / 86400000;
      let dueState = "ON_TRACK";
      if (plan.status === "ACTIVE" && validityIssues.length > 0) {
        dueState = "INVALID";
      } else if (plan.status === "ACTIVE" && due == null && plan.triggers?.some((trigger) => trigger.kind === "CALENDAR")) {
        dueState = "NEEDS_ATTENTION";
      } else if (days != null && days < 0) {
        dueState = "OVERDUE";
      } else if (days != null && days <= 7) {
        dueState = "DUE_SOON";
      }
      return {
        ...plan,
        nextDueAt: projected,
        nextDueSource: plan.nextDueAt ? "STORED" : projected ? "PROJECTED" : null,
        validityIssues,
        dueState,
        remainingDays: days
      };
    });

    const summary = {
      active: decorated.filter((plan) => plan.status === "ACTIVE").length,
      dueIn7: decorated.filter((plan) => plan.dueState === "DUE_SOON").length,
      overdue: decorated.filter((plan) => plan.dueState === "OVERDUE").length,
      needsAttention: decorated.filter((plan) => plan.dueState === "NEEDS_ATTENTION" || plan.dueState === "INVALID").length,
      invalid: decorated.filter((plan) => plan.dueState === "INVALID").length
    };

    const windowed = decorated.filter((plan) => {
      if (filters?.dueWindow === "overdue") return plan.dueState === "OVERDUE";
      if (filters?.dueWindow === "7") return plan.dueState === "DUE_SOON";
      if (filters?.dueWindow === "attention") return plan.dueState === "NEEDS_ATTENTION" || plan.dueState === "INVALID";
      if (filters?.dueWindow === "invalid") return plan.dueState === "INVALID";
      return true;
    });

    const total = windowed.length;
    const items = windowed.slice((page - 1) * pageSize, page * pageSize);
    return {
      items,
      summary,
      meta: { page, pageSize, total, totalPages: Math.max(1, Math.ceil(total / pageSize)) }
    };
  }

  async createPmPlan(
    actor: Actor,
    input: {
      code: string;
      name: string;
      description?: string;
      status?: PmPlanStatus;
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
    const code = input.code?.trim();
    const name = input.name?.trim();
    if (!code || !name) {
      throw new BadRequestException("PM plan code and name are required");
    }
    if (input.effectiveFrom && Number.isNaN(input.effectiveFrom.getTime())) {
      throw new BadRequestException("PM plan effective date is not valid");
    }
    const status = (input as { status?: PmPlanStatus }).status ?? PmPlanStatus.ACTIVE;
    const assetId = input.assetId?.trim() || undefined;
    const vehicleId = input.vehicleId?.trim() || undefined;

    if (status === PmPlanStatus.ACTIVE && !assetId && !vehicleId) {
      throw new BadRequestException("Active PM plans require an asset or vehicle assignment");
    }

    if (input.triggers?.length) {
      for (const trigger of input.triggers) {
        if (trigger.kind === "CALENDAR") {
          if (trigger.intervalDays == null || trigger.intervalDays <= 0) {
            throw new BadRequestException("Calendar trigger intervalDays must be greater than 0");
          }
        }
        if (trigger.kind === "METER") {
          if (trigger.intervalValue == null || trigger.intervalValue <= 0) {
            throw new BadRequestException("Meter trigger intervalValue must be greater than 0");
          }
        }
      }
    }

    if (assetId) {
      const asset = await this.prisma.asset.findFirst({
        where: { id: assetId, tenantId },
        select: { status: true, isActive: true }
      });
      if (!asset) throw new BadRequestException("Asset not found for this organization");
      if (!asset.isActive || asset.status === "RETIRED" || asset.status === "DISPOSED" || asset.status === "INACTIVE") {
        throw new BadRequestException("Retired or inactive assets cannot be the target of a new PM plan");
      }
    }
    const plan = await this.prisma.pmPlan.create({
      data: {
        tenantId,
        code,
        name,
        description: input.description,
        status,
        assetId,
        vehicleId,
        location: input.location,
        teamId: input.teamId,
        estimatedDurationMinutes: input.estimatedDurationMinutes,
        requiredParts: {
          create: (input.requiredPartIds ?? []).map((sparePartId) => ({ sparePartId }))
        },
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
            // SQL Server stores JSON as NVarChar — Prisma expects String, not Json object
            snapshot: JSON.stringify(input),
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

    const nextStatus = typeof safePatch.status === "string" ? safePatch.status : undefined;
    if (nextStatus) {
      assertPmPlanStatusTransition(existing.status, nextStatus);
    }

    // A revision may not leave (or put) an ACTIVE plan without an asset/vehicle target.
    const resultingStatus = nextStatus ?? existing.status;
    const resultingAssetId = "assetId" in safePatch ? (safePatch.assetId as string | null | undefined) : existing.assetId;
    const resultingVehicleId =
      "vehicleId" in safePatch ? (safePatch.vehicleId as string | null | undefined) : existing.vehicleId;
    if (
      resultingStatus === PmPlanStatus.ACTIVE &&
      !String(resultingAssetId ?? "").trim() &&
      !String(resultingVehicleId ?? "").trim()
    ) {
      throw new BadRequestException(
        "Active PM plans require an asset or vehicle assignment. Assign one, or pause the plan, before saving."
      );
    }

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
            snapshot: JSON.stringify({
              ...existing,
              ...patch,
              triggers: existing.triggers
            }),
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
      effectiveFrom?: Date | null;
      createdAt?: Date | null;
      triggers: TriggerDefinition[];
    },
    ctx: Omit<
      TriggerContext,
      | "gracePeriodDays"
      | "lastCompletionAt"
      | "nextDueAt"
      | "nextDueMeterValue"
      | "lastCompletionMeter"
      | "scheduleStartAt"
    >
  ) {
    return evaluateCombinedTriggers(
      plan.triggers,
      {
        ...ctx,
        gracePeriodDays: plan.gracePeriodDays ?? 0,
        lastCompletionAt: plan.lastCompletionAt,
        scheduleStartAt: plan.effectiveFrom ?? plan.createdAt ?? null,
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
          effectiveFrom: plan.effectiveFrom,
          createdAt: plan.createdAt,
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
    const validityIssues = pmPlanValidityIssues(plan);
    if (validityIssues.length > 0) {
      // Legacy invalid plans must be remediated, never silently generate work.
      return { created: false, reason: `PLAN_INVALID_${validityIssues[0]}` };
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
        effectiveFrom: plan.effectiveFrom,
        createdAt: plan.createdAt,
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
    if (priorGen?.workOrderId) {
      return {
        created: false,
        workOrderId: priorGen.workOrderId,
        reason: "DUPLICATE_GENERATION_KEY",
        evaluation
      };
    }

    let generationId = priorGen?.id ?? null;
    if (!generationId) {
      try {
        const claimed = await this.prisma.pmAutoGeneration.create({
          data: {
            tenantId,
            planId: plan.id,
            generationKey,
            triggerSummary: evaluation as object
          }
        });
        generationId = claimed.id;
      } catch (error) {
        if (!isUniqueConflict(error)) throw error;
        const winner = await this.prisma.pmAutoGeneration.findUnique({
          where: {
            tenantId_planId_generationKey: {
              tenantId,
              planId: plan.id,
              generationKey
            }
          }
        });
        return {
          created: false,
          workOrderId: winner?.workOrderId ?? undefined,
          reason: "DUPLICATE_GENERATION_KEY",
          evaluation
        };
      }
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
      if (!generationId) {
        throw new ConflictException("PM generation claim was lost before the work order was stored");
      }
      await this.prisma.pmAutoGeneration.update({
        where: { id: generationId },
        data: {
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

    // Canonical occurrence row (idempotent on tenant+plan+generationKey).
    // WO creation does NOT mark the occurrence COMPLETED — only governed WO close/verify does.
    try {
      await this.prisma.pmOccurrence.upsert({
        where: {
          tenantId_planId_generationKey: {
            tenantId,
            planId: plan.id,
            generationKey
          }
        },
        create: {
          tenantId,
          planId: plan.id,
          planRevision: plan.currentRevision,
          status: "GENERATED",
          dueAt: evaluation.dueAt ?? null,
          generationKey,
          workOrderId: workOrder.id
        },
        update: {
          status: "GENERATED",
          workOrderId: workOrder.id,
          planRevision: plan.currentRevision,
          dueAt: evaluation.dueAt ?? null
        }
      });
    } catch {
      // Occurrence write must not roll back an already-created WO; Technical Admin can reconcile.
    }

    if (plan.checklistTemplateId) {
      try {
        await this.startChecklistExecution(actor, {
          workOrderId: workOrder.id,
          templateId: plan.checklistTemplateId,
          notes: `Auto-started from PM plan ${plan.code}`
        });
      } catch {
        // Checklist attach failure must not roll back the WO; ops can start manually.
      }
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

    let conditionEvaluation: { triggered: Array<{ ruleId: string; severity: string; message: string }>; ruleCount: number } | null =
      null;
    if (this.reliability) {
      conditionEvaluation = await this.reliability.evaluateMeterReading({
        tenantId,
        meterId,
        assetId: meter.assetId,
        meterType: meter.meterType,
        value: input.value
      });
    }

    return { reading, validation, conditionEvaluation };
  }

  // ----- Checklist templates -----

  async listChecklistTemplates(actor: Actor, query: { domainKey?: string; activeOnly?: boolean } = {}) {
    const tenantId = requireTenantId(actor.tenantId);
    return this.prisma.checklistTemplate.findMany({
      where: {
        tenantId,
        ...(query.domainKey ? { domainKey: query.domainKey } : {}),
        ...(query.activeOnly === false ? {} : { isActive: true })
      },
      orderBy: [{ code: "asc" }, { version: "desc" }],
      include: {
        items: { orderBy: { sortOrder: "asc" } },
        _count: { select: { pmPlans: true, inspectionTemplates: true } }
      }
    });
  }

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
      reason?: string;
    }
  ) {
    const tenantId = requireTenantId(actor.tenantId);
    if (!input.code?.trim() || !input.name?.trim()) {
      throw new BadRequestException("code and name are required");
    }

    const created = await this.prisma.checklistTemplate.create({
      data: {
        tenantId,
        code: input.code.trim().toUpperCase(),
        name: input.name.trim(),
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
                options: JSON.stringify(item.options ?? [])
              }))
            }
          : undefined
      },
      include: { items: true }
    });

    await this.recordConfigChange(actor, {
      entityType: "ChecklistTemplate",
      entityId: created.id,
      action: "CREATE",
      reason: input.reason ?? "Checklist template created",
      afterJson: { id: created.id, code: created.code, version: created.version, name: created.name }
    });

    return created;
  }

  /**
   * Create a new version of a checklist template. Prior active versions with the same
   * code are deactivated. Existing ChecklistExecution rows keep their frozen snapshot.
   */
  async reviseChecklistTemplate(
    actor: Actor,
    templateId: string,
    input: {
      name?: string;
      description?: string;
      domainKey?: string;
      items?: Array<{
        key: string;
        label: string;
        type: ChecklistItemType;
        required?: boolean;
        sortOrder?: number;
        unit?: string;
        options?: string[];
      }>;
      changeReason?: string;
    }
  ) {
    const tenantId = requireTenantId(actor.tenantId);
    const current = await this.prisma.checklistTemplate.findFirst({
      where: { id: templateId, tenantId },
      include: { items: { orderBy: { sortOrder: "asc" } } }
    });
    if (!current) throw new NotFoundException("Checklist template not found");

    const nextVersion = current.version + 1;
    const itemsSource =
      input.items ??
      current.items.map((item) => ({
        key: item.key,
        label: item.label,
        type: item.type as ChecklistItemType,
        required: item.required,
        sortOrder: item.sortOrder,
        unit: item.unit ?? undefined,
        options: (() => {
          try {
            const parsed = JSON.parse(item.options || "[]");
            return Array.isArray(parsed) ? parsed.map(String) : [];
          } catch {
            return [] as string[];
          }
        })()
      }));

    const created = await this.prisma.$transaction(async (tx) => {
      await tx.checklistTemplate.updateMany({
        where: { tenantId, code: current.code, isActive: true },
        data: { isActive: false, effectiveTo: new Date() }
      });

      return tx.checklistTemplate.create({
        data: {
          tenantId,
          code: current.code,
          name: input.name?.trim() || current.name,
          description:
            input.description !== undefined ? input.description : current.description,
          domainKey: input.domainKey !== undefined ? input.domainKey : current.domainKey,
          version: nextVersion,
          isActive: true,
          items: {
            create: itemsSource.map((item, index) => ({
              tenantId,
              key: item.key,
              label: item.label,
              type: item.type,
              required: item.required ?? false,
              sortOrder: item.sortOrder ?? index,
              unit: item.unit,
              options: JSON.stringify(item.options ?? [])
            }))
          }
        },
        include: { items: true }
      });
    });

    await this.recordConfigChange(actor, {
      entityType: "ChecklistTemplate",
      entityId: created.id,
      action: "REVISE",
      reason: input.changeReason ?? `Revised ${current.code} to version ${nextVersion}`,
      beforeJson: {
        id: current.id,
        code: current.code,
        version: current.version,
        name: current.name,
        itemCount: current.items.length
      },
      afterJson: {
        id: created.id,
        code: created.code,
        version: created.version,
        name: created.name,
        itemCount: created.items.length
      }
    });

    return created;
  }

  /**
   * Start a checklist execution for a work order, freezing the template definition
   * into templateSnapshot so later template edits cannot mutate historical results.
   */
  async startChecklistExecution(
    actor: Actor,
    input: { workOrderId: string; templateId: string; notes?: string }
  ) {
    const tenantId = requireTenantId(actor.tenantId);
    const workOrder = await this.prisma.workOrder.findFirst({
      where: { id: input.workOrderId, tenantId },
      select: { id: true }
    });
    if (!workOrder) throw new NotFoundException("Work order not found");

    const existing = await this.prisma.checklistExecution.findFirst({
      where: {
        tenantId,
        workOrderId: workOrder.id,
        templateId: input.templateId,
        completedAt: null
      }
    });
    if (existing) return existing;

    const template = await this.prisma.checklistTemplate.findFirst({
      where: { id: input.templateId, tenantId, isActive: true },
      include: { items: { orderBy: { sortOrder: "asc" } } }
    });
    if (!template) throw new NotFoundException("Active checklist template not found");

    const snapshot = {
      id: template.id,
      code: template.code,
      name: template.name,
      version: template.version,
      domainKey: template.domainKey,
      items: template.items.map((item) => ({
        key: item.key,
        label: item.label,
        type: item.type,
        required: item.required,
        sortOrder: item.sortOrder,
        unit: item.unit,
        minValue: item.minValue,
        maxValue: item.maxValue,
        options: item.options,
        signatureJustified: item.signatureJustified
      }))
    };

    return this.prisma.checklistExecution.create({
      data: {
        tenantId,
        templateId: template.id,
        templateRevision: template.version,
        templateSnapshot: JSON.stringify(snapshot),
        workOrderId: workOrder.id,
        executedById: actor.sub,
        notes: input.notes
      }
    });
  }

  async completeChecklistExecution(
    actor: Actor,
    executionId: string,
    input: { answers: unknown; notes?: string }
  ) {
    const tenantId = requireTenantId(actor.tenantId);
    const execution = await this.prisma.checklistExecution.findFirst({
      where: { id: executionId, tenantId }
    });
    if (!execution) throw new NotFoundException("Checklist execution not found");
    if (execution.completedAt) {
      throw new BadRequestException("Checklist execution is already completed");
    }

    return this.prisma.checklistExecution.update({
      where: { id: executionId },
      data: {
        answers: JSON.stringify(input.answers ?? {}),
        notes: input.notes ?? execution.notes,
        completedAt: new Date(),
        executedById: actor.sub ?? execution.executedById
      }
    });
  }

  async listChecklistExecutionsForWorkOrder(actor: Actor, workOrderId: string) {
    const tenantId = requireTenantId(actor.tenantId);
    const workOrder = await this.prisma.workOrder.findFirst({
      where: { id: workOrderId, tenantId },
      select: { id: true }
    });
    if (!workOrder) throw new NotFoundException("Work order not found");

    return this.prisma.checklistExecution.findMany({
      where: { tenantId, workOrderId },
      orderBy: { startedAt: "desc" }
    });
  }

  private async recordConfigChange(
    actor: Actor,
    input: {
      entityType: string;
      entityId: string;
      action: string;
      reason?: string;
      beforeJson?: unknown;
      afterJson?: unknown;
    }
  ) {
    const tenantId = requireTenantId(actor.tenantId);
    const priorCount = await this.prisma.configChangeHistory.count({
      where: {
        tenantId,
        entityType: input.entityType,
        entityId: input.entityId
      }
    });
    await this.prisma.configChangeHistory.create({
      data: {
        tenantId,
        entityType: input.entityType,
        entityId: input.entityId,
        action: input.action,
        reason: input.reason,
        beforeJson: input.beforeJson != null ? JSON.stringify(input.beforeJson) : null,
        afterJson: input.afterJson != null ? JSON.stringify(input.afterJson) : null,
        version: priorCount + 1,
        actorId: actor.sub
      }
    });
  }

  // ----- Inspections -----

  async listInspections(
    actor: Actor,
    query: {
      search?: string;
      status?: string;
      result?: string;
      view?: string;
      page?: number;
      pageSize?: number;
    } = {}
  ) {
    const tenantId = requireTenantId(actor.tenantId);
    const page = Math.max(query.page ?? 1, 1);
    const pageSize = Math.min(Math.max(query.pageSize ?? 25, 1), 100);
    const search = query.search?.trim();
    const rows = await this.prisma.inspection.findMany({
      where: {
        tenantId,
        ...(query.result ? { result: query.result } : {}),
        ...(search
          ? {
              OR: [
                { findings: { contains: search } },
                { asset: { name: { contains: search } } },
                { asset: { assetTag: { contains: search } } },
                { vehicle: { registrationNo: { contains: search } } },
                { template: { name: { contains: search } } },
                { template: { code: { contains: search } } }
              ]
            }
          : {})
      },
      include: {
        template: { select: { id: true, code: true, name: true, version: true, domainKey: true } },
        asset: { select: { id: true, name: true, assetTag: true, criticalityLevel: true } },
        vehicle: { select: { id: true, registrationNo: true, make: true, vehicleModel: true } },
        findingRecords: { select: { id: true, severity: true, workOrderId: true, maintenanceRequestId: true } }
      },
      orderBy: [{ scheduledAt: "asc" }, { createdAt: "desc" }]
    });

    const now = new Date();
    const startOfDay = new Date(now);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(startOfDay);
    endOfDay.setDate(endOfDay.getDate() + 1);
    const weekStart = new Date(startOfDay);
    weekStart.setDate(weekStart.getDate() - 6);

    const decorated = rows.map((row) => {
      const due = row.scheduledAt ?? row.performedAt;
      const open = row.status !== "COMPLETED" && row.status !== "CANCELLED" && row.status !== "MISSED";
      const overdue = Boolean(open && due && due.getTime() < startOfDay.getTime());
      const dueToday = Boolean(open && due && due >= startOfDay && due < endOfDay);
      const criticalFindings = row.findingRecords.filter((finding) =>
        ["CRITICAL", "HIGH"].includes(String(finding.severity).toUpperCase())
      ).length;
      return {
        ...row,
        displayCode: `INSP-${row.createdAt.getFullYear()}-${row.id.slice(-6).toUpperCase()}`,
        dueState: overdue ? "OVERDUE" : dueToday ? "DUE_TODAY" : open ? "UPCOMING" : "DONE",
        criticalFindings,
        subjectName: row.vehicle
          ? `${row.vehicle.make} ${row.vehicle.vehicleModel}`.trim() || row.vehicle.registrationNo
          : row.asset?.name || "Unassigned",
        subjectCode: row.vehicle?.registrationNo || row.asset?.assetTag || ""
      };
    });

    const summary = {
      dueToday: decorated.filter((row) => row.dueState === "DUE_TODAY").length,
      overdue: decorated.filter((row) => row.dueState === "OVERDUE").length,
      failed: decorated.filter((row) => row.result === "FAIL" || row.criticalFindings > 0).length,
      completedThisWeek: decorated.filter(
        (row) => row.status === "COMPLETED" && row.performedAt && row.performedAt >= weekStart
      ).length
    };

    const view = query.view;
    const filtered = decorated.filter((row) => {
      if (query.status && row.status !== query.status) return false;
      if (view === "due") return row.dueState === "DUE_TODAY";
      if (view === "overdue") return row.dueState === "OVERDUE";
      if (view === "upcoming") return row.dueState === "UPCOMING";
      if (view === "failed") return row.result === "FAIL";
      if (view === "completed") return row.status === "COMPLETED";
      return true;
    });

    const total = filtered.length;
    return {
      items: filtered.slice((page - 1) * pageSize, page * pageSize),
      summary,
      meta: { page, pageSize, total, totalPages: Math.max(1, Math.ceil(total / pageSize)) }
    };
  }

  async scheduleInspection(
    actor: Actor,
    input: {
      title?: string;
      templateId?: string;
      assetId?: string;
      vehicleId?: string;
      inspectorId?: string;
      scheduledAt?: Date;
      priorInspectionId?: string;
      functionalLocationId?: string;
      inspectionType?: string;
      description?: string;
    }
  ) {
    const tenantId = requireTenantId(actor.tenantId);
    if (input.assetId) {
      const asset = await this.prisma.asset.findFirst({ where: { id: input.assetId, tenantId }, select: { id: true } });
      if (!asset) throw new BadRequestException("Asset is not in this workspace.");
    }
    if (input.vehicleId) {
      const vehicle = await this.prisma.vehicle.findFirst({ where: { id: input.vehicleId, tenantId }, select: { id: true } });
      if (!vehicle) throw new BadRequestException("Vehicle is not in this workspace.");
    }
    if (input.functionalLocationId) {
      const location = await this.prisma.functionalLocation.findFirst({
        where: { id: input.functionalLocationId, tenantId },
        select: { id: true }
      });
      if (!location) throw new BadRequestException("Location is not in this workspace.");
    }
    if (input.inspectorId) {
      const inspector = await this.prisma.user.findFirst({
        where: { id: input.inspectorId, tenantId },
        select: { id: true }
      });
      if (!inspector) throw new BadRequestException("Inspector is not in this workspace.");
    }
    if (input.templateId) {
      const template = await this.prisma.inspectionTemplate.findFirst({
        where: { id: input.templateId, tenantId },
        select: { id: true }
      });
      if (!template) throw new BadRequestException("Inspection template is not in this workspace.");
    }
    if (!input.assetId && !input.vehicleId && !input.functionalLocationId && !input.title?.trim()) {
      throw new BadRequestException("Choose an asset, a vehicle, a location, or a title.");
    }
    return this.prisma.inspection.create({
      data: {
        tenantId,
        templateId: input.templateId,
        assetId: input.assetId,
        vehicleId: input.vehicleId,
        functionalLocationId: input.functionalLocationId,
        inspectionType: input.inspectionType,
        description: input.description,
        inspectorId: input.inspectorId ?? actor.sub,
        scheduledAt: input.scheduledAt ?? new Date(),
        isAdHoc: !input.templateId,
        findings: input.title,
        answers: input.priorInspectionId
          ? JSON.stringify({ reinspectionOfId: input.priorInspectionId })
          : undefined,
        status: "SCHEDULED"
      }
    });
  }

  async listInspectionTemplates(actor: Actor) {
    const tenantId = requireTenantId(actor.tenantId);
    return this.prisma.inspectionTemplate.findMany({
      where: { tenantId, isActive: true },
      include: { checklistTemplate: { include: { items: { orderBy: { sortOrder: "asc" } } } } },
      orderBy: { name: "asc" }
    });
  }

  async getInspection(actor: Actor, id: string) {
    const tenantId = requireTenantId(actor.tenantId);
    const row = await this.prisma.inspection.findFirst({
      where: { id, tenantId },
      include: {
        template: { include: { checklistTemplate: { include: { items: { orderBy: { sortOrder: "asc" } } } } } },
        asset: { select: { id: true, name: true, assetTag: true, tenantId: true } },
        vehicle: { select: { id: true, registrationNo: true, make: true, vehicleModel: true, tenantId: true } },
        functionalLocation: { select: { id: true, name: true, code: true } },
        findingRecords: true
      }
    });
    if (!row) throw new NotFoundException("Inspection not found");
    const execution = await this.prisma.checklistExecution.findFirst({
      where: { tenantId, inspectionId: id },
      orderBy: { startedAt: "desc" }
    });
    return {
      ...row,
      displayCode: `INSP-${row.createdAt.getFullYear()}-${row.id.slice(-6).toUpperCase()}`,
      execution
    };
  }

  async startInspection(actor: Actor, id: string) {
    const tenantId = requireTenantId(actor.tenantId);
    const row = await this.prisma.inspection.findFirst({
      where: { id, tenantId },
      include: { template: true }
    });
    if (!row) throw new NotFoundException("Inspection not found");
    if (row.status === "COMPLETED" || row.status === "CANCELLED" || row.status === "MISSED") {
      throw new BadRequestException(`Inspection cannot be started from ${row.status}.`);
    }
    if (row.status === "IN_PROGRESS") {
      return row;
    }
    const checklistTemplateId = row.template?.checklistTemplateId;
    if (checklistTemplateId) {
      const existingExecution = await this.prisma.checklistExecution.findFirst({
        where: { tenantId, inspectionId: id, completedAt: null }
      });
      if (!existingExecution) {
        const template = await this.prisma.checklistTemplate.findFirst({
          where: { id: checklistTemplateId, tenantId },
          include: { items: { orderBy: { sortOrder: "asc" } } }
        });
        if (template) {
          await this.prisma.checklistExecution.create({
            data: {
              tenantId,
              templateId: template.id,
              templateRevision: template.version,
              inspectionId: id,
              executedById: actor.sub,
              templateSnapshot: JSON.stringify({
                id: template.id,
                version: template.version,
                items: template.items
              })
            }
          });
        }
      }
    }
    return this.prisma.inspection.update({
      where: { id },
      data: {
        status: "IN_PROGRESS",
        answers: JSON.stringify({
          ...(parseInspectionMeta(row.answers)),
          startedAt: new Date().toISOString(),
          startedBy: actor.sub
        })
      }
    });
  }

  async saveInspectionAnswers(actor: Actor, id: string, answers: Record<string, unknown>) {
    const tenantId = requireTenantId(actor.tenantId);
    const row = await this.prisma.inspection.findFirst({ where: { id, tenantId } });
    if (!row) throw new NotFoundException("Inspection not found");
    if (row.status === "COMPLETED") {
      throw new BadRequestException("Completed inspections are read-only.");
    }
    const execution = await this.prisma.checklistExecution.findFirst({
      where: { tenantId, inspectionId: id, completedAt: null }
    });
    if (!execution) throw new BadRequestException("Start the inspection before recording answers.");
    return this.prisma.checklistExecution.update({
      where: { id: execution.id },
      data: { answers: JSON.stringify(answers), executedById: actor.sub }
    });
  }

  async completeScheduledInspection(actor: Actor, id: string, answers: Record<string, { value?: unknown; comment?: string | null; evidenceRefs?: string[] }>) {
    const tenantId = requireTenantId(actor.tenantId);
    const row = await this.getInspection(actor, id);
    if (row.status === "COMPLETED") {
      return { ...row, alreadyCompleted: true };
    }
    if (row.status !== "IN_PROGRESS") {
      throw new BadRequestException("Start the inspection before completing it.");
    }
    const execution = row.execution;
    const snapshot = execution?.templateSnapshot ? JSON.parse(execution.templateSnapshot) : null;
    const items = Array.isArray(snapshot?.items) ? snapshot.items : [];
    const evaluated = evaluateInspectionChecklist({
      items,
      answers: answers as never
    });
    if (evaluated.errors.length) {
      throw new BadRequestException(evaluated.errors.join(" "));
    }
    if (execution && !execution.completedAt) {
      await this.prisma.checklistExecution.update({
        where: { id: execution.id },
        data: { answers: JSON.stringify(answers), completedAt: new Date(), executedById: actor.sub }
      });
    }
    return this.completeInspection(actor, {
      inspectionId: id,
      templateId: row.templateId ?? undefined,
      assetId: row.assetId ?? undefined,
      vehicleId: row.vehicleId ?? undefined,
      inspectorId: actor.sub,
      result: evaluated.result as InspectionResult,
      findings: row.findings ?? row.template?.name ?? "Inspection completed",
      answers,
      findingItems: evaluated.findings
    });
  }

  async attachInspectionEvidence(
    actor: Actor,
    inspectionId: string,
    input: { checklistItemKey: string; fileName: string; mimeType: string; contentBase64: string }
  ) {
    const tenantId = requireTenantId(actor.tenantId);
    const inspection = await this.prisma.inspection.findFirst({
      where: { id: inspectionId, tenantId },
      select: { id: true, status: true }
    });
    if (!inspection) throw new NotFoundException("Inspection not found");
    if (inspection.status === "COMPLETED") {
      throw new BadRequestException("Completed inspections are read-only.");
    }
    const stored = await persistEvidenceFileBytes({
      tenantId,
      inspectionId,
      checklistItemKey: input.checklistItemKey,
      fileName: input.fileName,
      mimeType: input.mimeType,
      contentBase64: input.contentBase64
    });
    if (!stored.ok) {
      throw new BadRequestException(stored.message);
    }
    return this.prisma.evidenceAttachment.create({
      data: {
        tenantId,
        inspectionId,
        checklistItemKey: input.checklistItemKey,
        evidenceType: "PHOTO",
        fileName: stored.fileName,
        mimeType: input.mimeType.trim().toLowerCase(),
        sizeBytes: stored.sizeBytes,
        storageProvider: "LOCAL",
        storageKey: stored.storageKey,
        status: "READY",
        uploadedById: actor.sub,
        source: "WEB"
      },
      select: { id: true, fileName: true, mimeType: true, sizeBytes: true, status: true, checklistItemKey: true }
    });
  }

  async createReinspection(actor: Actor, id: string) {
    const source = await this.getInspection(actor, id);
    if (source.status !== "COMPLETED") {
      throw new BadRequestException("Only a completed inspection can be re-inspected.");
    }
    return this.scheduleInspection(actor, {
      title: `Re-inspection of ${source.displayCode}`,
      templateId: source.templateId ?? undefined,
      assetId: source.assetId ?? undefined,
      vehicleId: source.vehicleId ?? undefined,
      inspectorId: source.inspectorId ?? actor.sub,
      scheduledAt: new Date(),
      priorInspectionId: source.id
    });
  }

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
      inspectionId?: string;
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
    if (
      input.result !== InspectionResult.PASS &&
      input.result !== InspectionResult.OBSERVATION &&
      input.result !== InspectionResult.FAIL
    ) {
      throw new BadRequestException("Inspection result must be PASS, OBSERVATION, or FAIL");
    }
    if (input.inspectionId) {
      const existing = await this.prisma.inspection.findFirst({
        where: { id: input.inspectionId, tenantId },
        include: { findingRecords: true }
      });
      if (!existing) throw new NotFoundException("Inspection not found");
      if (existing.status === "COMPLETED") {
        return {
          ...existing,
          alreadyCompleted: true,
          maintenanceRequestId: existing.findingRecords.find((finding) => finding.maintenanceRequestId)?.maintenanceRequestId,
          findingCount: existing.findingRecords.length
        };
      }
    }
    let correctiveWorkOrderId: string | undefined;
    let maintenanceRequestId: string | undefined;
    const correctiveKey = input.inspectionId ? `insp-fail:${input.inspectionId}` : undefined;

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
              idempotencyKey: correctiveKey ?? `insp-fail:${input.assetId ?? input.functionalLocationId ?? "adhoc"}`
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

    const writeCompletedInspection = async (db: typeof this.prisma) => {
      const inspection = input.inspectionId
        ? await db.inspection.update({
            where: { id: input.inspectionId },
            data: {
              performedAt: new Date(),
              result: input.result,
              findings: input.findings,
              answers: JSON.stringify(input.answers ?? {}),
              correctiveWorkOrderId,
              status: "COMPLETED",
              inspectorId: input.inspectorId ?? actor.sub
            }
          })
        : await db.inspection.create({
            data: {
              tenantId,
              templateId: input.templateId,
              assetId: input.assetId,
              vehicleId: input.vehicleId,
              functionalLocationId: input.functionalLocationId,
              inspectorId: input.inspectorId ?? actor.sub,
              isAdHoc: input.isAdHoc ?? !input.templateId,
              performedAt: new Date(),
              result: input.result,
              findings: input.findings,
              evidenceUrls: input.evidenceUrls ?? [],
              answers: JSON.stringify(input.answers ?? {}),
              correctiveWorkOrderId,
              status: "COMPLETED"
            }
          });

      if (findingInputs.length > 0) {
        await db.inspectionFinding.createMany({
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
      return inspection;
    };

    const inspection =
      input.inspectionId && typeof this.prisma.$transaction === "function"
        ? await this.prisma.$transaction(async (tx) => writeCompletedInspection(tx as typeof this.prisma))
        : await writeCompletedInspection(this.prisma);

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

export type PmPlanValidityIssue = "NO_ASSET_ASSIGNED" | "NO_TRIGGER";

/**
 * Active PM plans must target an asset or vehicle and have at least one active trigger.
 * Legacy rows that predate this rule are flagged (never silently treated as valid).
 */
export function pmPlanValidityIssues(plan: {
  status?: string | null;
  assetId?: string | null;
  vehicleId?: string | null;
  triggers?: Array<{ isActive?: boolean | null }> | null;
}): PmPlanValidityIssue[] {
  if (plan.status !== "ACTIVE") return [];
  const issues: PmPlanValidityIssue[] = [];
  if (!plan.assetId && !plan.vehicleId) issues.push("NO_ASSET_ASSIGNED");
  if (!(plan.triggers ?? []).some((trigger) => trigger.isActive !== false)) issues.push("NO_TRIGGER");
  return issues;
}
