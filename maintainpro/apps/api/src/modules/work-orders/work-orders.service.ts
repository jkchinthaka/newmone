import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException, Optional } from "@nestjs/common";
import {
  ApprovalDecisionStatus,
  ApprovalProcessType,
  ApprovalRequestStatus,
  ApprovalStage,
  ApprovalTrigger,
  AuditAction,
  NotificationPriority,
  NotificationType,
  PartRequestStatus,
  Priority,
  Prisma,
  RoleName,
  WorkOrderApprovalStatus,
  WorkOrderStatus,
  WorkOrderType,
  QrVerificationStatus,
  WorkOrderCompletionCondition,
  WorkOrderVerificationStatus
} from "@prisma/client";

import { requestContext } from "../../common/context/request-context";
import { stringArrayToText, toStringArray } from "../../common/utils/json-text";
import { PUBLIC_USER_SUMMARY_SELECT } from "../../common/selects/public-user.select";
import {
  assertTenantEntitiesExist,
  assertTenantEntityExists,
  requireTenantId
} from "../../common/utils/tenant-scope.util";
import { assertVersionMatch } from "../../common/utils/optimistic-concurrency.util";
import { resolveJobDomain } from "../../common/utils/job-domain.util";
import {
  assertLabourCorrectionReason,
  assertNoActiveLabourForTechnician,
  assertSingleActiveSessionOnWorkOrder,
  closeLabourSessionTimestamps,
  sumLabourHours
} from "../../common/utils/work-order-labour.util";
import { deriveActualCost } from "../../common/utils/work-order-cost.util";
import { deriveReadiness, getValidWorkOrderActions } from "../../common/utils/work-order-actions";
import {
  assertAllowedStatusTransition,
  assertReasonProvided,
  assertRoleCanSetStatus,
  assertSensitiveFieldsUnlocked,
  canDirectlyCloseWorkOrder,
  canReopenWorkOrder,
  canVerifySupervisor,
  requiresEvidenceForCompletion,
  requiresSupervisorVerification,
  TERMINAL_WORK_ORDER_STATUSES,
  TECHNICIAN_EXECUTION_ROLES
} from "../../common/utils/work-order-governance";
import {
  assertEvidenceForSupervisorVerification,
  assertEvidenceForTechnicianCompletion,
  requiresQrVerification
} from "../../common/utils/work-order-evidence-governance";
import { canOverrideCompletionBlock } from "../../common/utils/work-order-evidence-rbac";
import {
  assertValidEntityId,
  assertValidOptionalObjectId,
  assertWorkOrderAssetRules,
  calculateSlaRisk
} from "../../common/utils/work-order-validation";
import {
  assertIssueQuantity,
  requiresFinanceApprovalForTier,
  requiresProcurement,
  resolvePartApprovalTier
} from "../../common/utils/work-order-parts-governance";
import {
  assertMakerCheckerSeparation,
  assertReasonProvided as assertFraudReasonProvided,
  FRAUD_AUDIT_EVENTS,
  FRAUD_CONTROL_ENABLED
} from "../../common/utils/fraud-control.util";
import { PrismaService } from "../../database/prisma.service";
import type { JwtPayload } from "../auth/auth.types";
import { ApprovalsService } from "../approvals/approvals.service";
import { NotificationsService } from "../notifications/notifications.service";
import { WorkOrderTaxonomyService } from "../work-order-taxonomy/work-order-taxonomy.service";
import { WorkOrderPartsService } from "./work-order-parts.service";
import { WorkOrderAssigneesService } from "./work-order-assignees.service";
import { assertValidHoldReason } from "./work-order-lifecycle";
import { InventoryTransactionEngine } from "../inventory/inventory-transaction.engine";
import { EnterpriseOpsService } from "../enterprise-ops/enterprise-ops.service";
import { MaintenanceConfigService } from "../maintenance-config/maintenance-config.service";
import { MaintenanceTemplatesService } from "../maintenance-config/maintenance-templates.service";
import { WarrantiesService } from "../warranties/warranties.service";
import { ReliabilityService } from "../reliability/reliability.service";

type Actor = Pick<JwtPayload, "sub" | "email" | "role" | "tenantId"> & {
  permissions?: string[];
};

type AssignOptions = {
  reason?: string;
  expectedVersion?: number;
};

@Injectable()
export class WorkOrdersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notificationsService: NotificationsService,
    private readonly workOrderPartsService: WorkOrderPartsService,
    private readonly workOrderTaxonomyService: WorkOrderTaxonomyService,
    private readonly workOrderAssigneesService: WorkOrderAssigneesService,
    @Optional() private readonly maintenanceConfig?: MaintenanceConfigService,
    @Optional() private readonly maintenanceTemplates?: MaintenanceTemplatesService,
    @Optional() private readonly warranties?: WarrantiesService,
    @Optional() private readonly reliability?: ReliabilityService,
    @Optional() private readonly approvalsService?: ApprovalsService,
    @Optional() stockEngine?: InventoryTransactionEngine,
    @Optional() private readonly enterpriseOps?: EnterpriseOpsService
  ) {
    this.stockEngine = stockEngine ?? new InventoryTransactionEngine(this.prisma);
  }

  private readonly stockEngine: InventoryTransactionEngine;

  private readonly financeApprovalThreshold = Number(process.env.PHASE3_FINANCE_THRESHOLD ?? 5000);

  private resolveTenantId(actor?: Actor): string {
    return requireTenantId(actor?.tenantId);
  }

  private async recordAudit(payload: {
    entity: string;
    entityId: string;
    action: AuditAction;
    actor?: Actor;
    reason?: string;
    metadata?: Prisma.InputJsonValue;
    beforeData?: Prisma.InputJsonValue;
    afterData?: Prisma.InputJsonValue;
  }) {
    const ctx = requestContext.get();
    const actorId = payload.actor?.sub ?? ctx?.actorId ?? null;
    const actorEmail = payload.actor?.email ?? ctx?.actorEmail ?? null;
    const actorRole = payload.actor?.role ?? ctx?.actorRole ?? null;

    await this.prisma.auditLog.create({
      data: {
        tenantId: payload.actor?.tenantId ?? ctx?.tenantId ?? null,
        actorId,
        module: "maintenance",
        entity: payload.entity,
        entityId: payload.entityId,
        action: payload.action,
        reason: payload.reason,
        ipAddress: ctx?.ipAddress ?? undefined,
        userAgent: ctx?.userAgent ?? undefined,
        requestPath: ctx?.requestPath ?? undefined,
        actorSnapshot:
          actorId || actorEmail || actorRole
            ? ({ id: actorId, email: actorEmail, role: actorRole } as Prisma.InputJsonValue)
            : undefined,
        metadata: payload.metadata,
        beforeData: payload.beforeData,
        afterData: payload.afterData
      }
    });
  }

  private assertActor(actor?: Actor) {
    if (!actor?.sub) {
      throw new BadRequestException("Authenticated actor context is required");
    }

    return actor;
  }

  private assertOptimisticVersion(
    current: { id: string; version?: number | null },
    expectedVersion?: number
  ): { id: string; version?: number } {
    assertVersionMatch(current.version, expectedVersion, "Work order");
    return expectedVersion != null ? { id: current.id, version: expectedVersion } : { id: current.id };
  }

  private async closeActiveLabourSessions(
    workOrderId: string,
    technicianUserId: string | undefined,
    tenantId: string
  ) {
    const activeEntries = await this.prisma.workOrderLabourEntry.findMany({
      where: {
        tenantId,
        workOrderId,
        endedAt: null,
        ...(technicianUserId ? { technicianUserId } : {})
      },
      select: {
        id: true,
        startedAt: true
      }
    });

    if (activeEntries.length === 0) {
      return [];
    }

    return Promise.all(
      activeEntries.map((entry) =>
        this.prisma.workOrderLabourEntry.update({
          where: { id: entry.id },
          data: closeLabourSessionTimestamps(entry.startedAt)
        })
      )
    );
  }

  private async startLabourSession(workOrderId: string, technicianUserId: string, tenantId: string) {
    const activeEntries = await this.prisma.workOrderLabourEntry.findMany({
      where: {
        tenantId,
        technicianUserId,
        endedAt: null
      },
      select: {
        id: true,
        workOrderId: true,
        technicianUserId: true,
        startedAt: true,
        endedAt: true,
        durationMinutes: true
      }
    });

    const activeOnThisWorkOrder = activeEntries.filter((entry) => entry.workOrderId === workOrderId);
    assertSingleActiveSessionOnWorkOrder(activeOnThisWorkOrder);
    assertNoActiveLabourForTechnician(activeEntries, workOrderId);

    if (activeOnThisWorkOrder.length === 1) {
      return activeOnThisWorkOrder[0];
    }

    return this.prisma.workOrderLabourEntry.create({
      data: {
        tenantId,
        workOrderId,
        technicianUserId,
        startedAt: new Date()
      }
    });
  }

  private async computeAuthoritativeHoursAndCost(workOrderId: string, actor?: Actor) {
    const entries = (await this.prisma.workOrderLabourEntry.findMany({
      where: { workOrderId }
    })) as Array<{
      id: string;
      technicianUserId?: string | null;
      startedAt: Date;
      endedAt?: Date | null;
      durationMinutes?: number | null;
      correctedDurationMinutes?: number | null;
      labourRateSnapshot?: number | null;
    }>;
    const actualHours = sumLabourHours(
      entries.map((entry) => ({
        id: entry.id,
        technicianUserId: entry.technicianUserId,
        startedAt: entry.startedAt,
        endedAt: entry.endedAt,
        durationMinutes: entry.correctedDurationMinutes ?? entry.durationMinutes
      }))
    );
    const labourCost =
      Math.round(
        entries.reduce((sum, entry) => {
          const minutes = Number(entry.correctedDurationMinutes ?? entry.durationMinutes ?? 0) || 0;
          const rate = Number(entry.labourRateSnapshot ?? 0) || 0;
          return sum + (minutes / 60) * rate;
        }, 0) * 100
      ) / 100;
    const costSummary = await this.workOrderPartsService.getCostSummary(workOrderId, actor);
    const partsCost = Number(costSummary.netPartCost ?? 0) || 0;
    const actualCost = deriveActualCost({ partsCost, labourCost });
    return { actualHours, actualCost, partsCost };
  }

  private async assertPartsReconciledForCompletion(workOrderId: string, actor?: Actor) {
    const costSummary = await this.workOrderPartsService.getCostSummary(workOrderId, actor);
    if ((costSummary.unaccountedLines ?? 0) > 0) {
      throw new BadRequestException("All issued parts must be reconciled before completion.");
    }
  }

  private async assertSegregationOfDuties(
    current: {
      id: string;
      woNumber?: string | null;
      technicianId?: string | null;
    },
    actor: Actor | undefined,
    sodOverrideReason?: string
  ) {
    const approver = this.assertActor(actor);
    const latestCompletion = await this.prisma.workOrderStatusHistory.findFirst({
      where: {
        workOrderId: current.id,
        OR: [{ toStatus: WorkOrderStatus.TECHNICIAN_COMPLETED }, { action: "TECHNICIAN_COMPLETED" }]
      },
      orderBy: { createdAt: "desc" },
      select: { actorId: true }
    });
    const technicianActorId = latestCompletion?.actorId ?? current.technicianId ?? null;
    if (!technicianActorId || technicianActorId !== approver.sub) {
      return;
    }

    const trimmedOverride = sodOverrideReason?.trim() ?? "";
    const canOverride =
      (approver.role === RoleName.ADMIN || approver.role === RoleName.SUPER_ADMIN) &&
      trimmedOverride.length >= 3;
    if (!canOverride) {
      throw new ForbiddenException(
        "Separation of duties violation: the completing technician cannot verify this work order."
      );
    }

    await this.recordAudit({
      entity: "WorkOrder",
      entityId: current.id,
      action: AuditAction.UPDATE,
      actor,
      reason: trimmedOverride,
      metadata: {
        event: "work_order_sod_override",
        woNumber: current.woNumber ?? null,
        technicianActorId
      }
    });
  }

  private async appendStatusHistory(
    tenantId: string | null | undefined,
    workOrderId: string,
    input: {
      fromStatus: WorkOrderStatus | null;
      toStatus: WorkOrderStatus;
      action: string;
      actorId?: string;
      reason?: string | null;
      metadata?: Record<string, unknown>;
    },
    db: Prisma.TransactionClient | PrismaService = this.prisma
  ) {
    try {
      await db.workOrderStatusHistory.create({
        data: {
          tenantId: requireTenantId(tenantId),
          workOrderId,
          fromStatus: input.fromStatus ?? undefined,
          toStatus: input.toStatus,
          action: input.action,
          actorId: input.actorId,
          reason: input.reason?.trim() || undefined,
          metadata: input.metadata != null ? JSON.stringify(input.metadata) : undefined
        }
      });
    } catch {
      // History must not block primary status transitions
    }
  }

  private async slaHours(tenantId: string, priority: Priority): Promise<number> {
    if (this.maintenanceConfig) {
      return this.maintenanceConfig.resolveCompletionHours(tenantId, priority);
    }
    switch (priority) {
      case Priority.CRITICAL:
        return 4;
      case Priority.HIGH:
        return 24;
      case Priority.MEDIUM:
        return 72;
      case Priority.LOW:
      default:
        return 168;
    }
  }

  private requiresFinanceApproval(totalCost: number, pettyCash?: boolean): boolean {
    const tier = resolvePartApprovalTier(totalCost);
    return requiresFinanceApprovalForTier(tier, pettyCash);
  }

  private canAutoApproveWorkOrder(roleName?: string | null): boolean {
    if (!roleName) {
      return false;
    }

    return (
      roleName === RoleName.SUPER_ADMIN ||
      roleName === RoleName.ADMIN ||
      roleName === RoleName.MANAGER ||
      roleName === RoleName.OPERATIONS_MANAGER ||
      roleName === RoleName.ASSET_MANAGER
    );
  }

  private assertWorkOrderApprovedForExecution(workOrder: {
    approvalStatus: WorkOrderApprovalStatus;
  }) {
    if (workOrder.approvalStatus === WorkOrderApprovalStatus.REJECTED) {
      throw new BadRequestException("Work order was rejected and cannot be executed");
    }

    if (workOrder.approvalStatus === WorkOrderApprovalStatus.PENDING) {
      throw new BadRequestException("Work order requires manager approval before execution");
    }
  }

  /**
   * Phase 7 — evaluate configurable rules. Missing approver fails safely (no silent auto-approve).
   * Emergency override may allow start while leaving post-review pending.
   */
  private async enforceConfigurableApproval(input: {
    actor?: Actor;
    workOrder: {
      id: string;
      priority: Priority;
      type: WorkOrderType;
      estimatedCost?: number | null;
      actualCost?: number | null;
      siteId?: string | null;
      departmentId?: string | null;
      domainId?: string | null;
      status?: WorkOrderStatus;
      approvalStatus?: WorkOrderApprovalStatus;
    };
    processType: ApprovalProcessType;
    trigger: ApprovalTrigger;
    blockMessage: string;
    allowEmergencyProceed?: boolean;
    sourceContext?: Prisma.InputJsonValue;
  }) {
    if (!this.approvalsService || !input.actor?.sub) return;

    const result = await this.approvalsService.ensureApprovalRequired({
      actor: input.actor,
      processType: input.processType,
      trigger: input.trigger,
      subjectEntityType: "WorkOrder",
      subjectEntityId: input.workOrder.id,
      context: {
        processType: input.processType,
        priority: input.workOrder.priority,
        workType: input.workOrder.type,
        estimatedCost: input.workOrder.estimatedCost,
        actualCost: input.workOrder.actualCost,
        siteId: input.workOrder.siteId,
        departmentId: input.workOrder.departmentId,
        domainId: input.workOrder.domainId,
        status: input.workOrder.status,
        executionType:
          input.workOrder.type === WorkOrderType.VENDOR_REPAIR ||
          input.workOrder.type === WorkOrderType.EXTERNAL_REPAIR
            ? "EXTERNAL"
            : "INTERNAL"
      },
      sourceContext: input.sourceContext
    });

    if (result.configError) {
      throw new BadRequestException(result.configError);
    }

    if (!result.required) return;

    if (
      result.status === ApprovalRequestStatus.EMERGENCY_OVERRIDE_PENDING_REVIEW &&
      input.allowEmergencyProceed
    ) {
      return;
    }

    if (
      result.status === ApprovalRequestStatus.PENDING ||
      result.status === ApprovalRequestStatus.EMERGENCY_OVERRIDE_PENDING_REVIEW
    ) {
      if (input.workOrder.approvalStatus !== WorkOrderApprovalStatus.PENDING) {
        await this.prisma.workOrder.update({
          where: { id: input.workOrder.id },
          data: { approvalStatus: WorkOrderApprovalStatus.PENDING }
        });
      }
      throw new BadRequestException({
        message: input.blockMessage,
        code: "APPROVAL_REQUIRED",
        approvalRequestId: result.approvalRequestId,
        processType: input.processType
      });
    }
  }

  private async syncCreateTimeApprovals<T extends {
    id: string;
    priority: Priority;
    type: WorkOrderType;
    estimatedCost?: number | null;
    siteId?: string | null;
    departmentId?: string | null;
    domainId?: string | null;
    status: WorkOrderStatus;
    approvalStatus: WorkOrderApprovalStatus;
  }>(created: T, actor?: Actor): Promise<T> {
    if (!this.approvalsService || !actor?.sub) return created;

    const checks: Array<{ processType: ApprovalProcessType; trigger: ApprovalTrigger }> = [];
    if (created.priority === Priority.CRITICAL) {
      checks.push({
        processType: ApprovalProcessType.CRITICAL_WORK_ORDER,
        trigger: ApprovalTrigger.BEFORE_START
      });
    }
    if (created.estimatedCost != null) {
      checks.push({
        processType: ApprovalProcessType.HIGH_COST_WORK_ORDER,
        trigger: ApprovalTrigger.BEFORE_START
      });
    }
    if (
      created.type === WorkOrderType.VENDOR_REPAIR ||
      created.type === WorkOrderType.EXTERNAL_REPAIR
    ) {
      checks.push({
        processType: ApprovalProcessType.VENDOR_REPAIR,
        trigger: ApprovalTrigger.BEFORE_ASSIGN_VENDOR
      });
    }

    let approvalStatus = created.approvalStatus;
    for (const check of checks) {
      const result = await this.approvalsService.ensureApprovalRequired({
        actor,
        processType: check.processType,
        trigger: check.trigger,
        subjectEntityType: "WorkOrder",
        subjectEntityId: created.id,
        context: {
          processType: check.processType,
          priority: created.priority,
          workType: created.type,
          estimatedCost: created.estimatedCost,
          siteId: created.siteId,
          departmentId: created.departmentId,
          domainId: created.domainId,
          executionType:
            created.type === WorkOrderType.VENDOR_REPAIR ||
            created.type === WorkOrderType.EXTERNAL_REPAIR
              ? "EXTERNAL"
              : "INTERNAL"
        }
      });
      if (result.configError) {
        throw new BadRequestException(result.configError);
      }
      if (result.required && result.status === ApprovalRequestStatus.PENDING) {
        approvalStatus = WorkOrderApprovalStatus.PENDING;
      }
    }

    if (approvalStatus !== created.approvalStatus) {
      await this.prisma.workOrder.update({
        where: { id: created.id },
        data: { approvalStatus, approvedAt: null, approvedById: null }
      });
      return { ...created, approvalStatus };
    }
    return created;
  }

  private async nextWoNumber(
    actor?: Actor,
    db: Prisma.TransactionClient | PrismaService = this.prisma
  ): Promise<string> {
    const year = new Date().getFullYear();
    const tenantId = this.resolveTenantId(actor);
    const prefix = `WO-${year}-`;
    const latest = await db.workOrder.findFirst({
      where: {
        tenantId,
        woNumber: { startsWith: prefix }
      },
      orderBy: { woNumber: "desc" },
      select: { woNumber: true }
    });
    let seq = 1;
    if (latest?.woNumber) {
      const parsed = Number.parseInt(latest.woNumber.slice(prefix.length), 10);
      if (Number.isFinite(parsed)) seq = parsed + 1;
    }
    return `${prefix}${String(seq).padStart(4, "0")}`;
  }

  private async createWithNumberRetry(
    data: Omit<Prisma.WorkOrderUncheckedCreateInput, "woNumber">,
    actor?: Actor,
    db: Prisma.TransactionClient | PrismaService = this.prisma
  ) {
    let lastError: unknown;
    for (let attempt = 0; attempt < 8; attempt += 1) {
      const woNumber = await this.nextWoNumber(actor, db);
      try {
        return await db.workOrder.create({
          data: { ...data, woNumber }
        });
      } catch (error) {
        lastError = error;
        if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
          continue;
        }
        throw error;
      }
    }
    throw lastError instanceof Error
      ? lastError
      : new BadRequestException("Unable to allocate a unique work order number");
  }

  findAll(actor?: Actor) {
    const tenantId = this.resolveTenantId(actor);
    const where: Prisma.WorkOrderWhereInput = {};

    where.tenantId = tenantId;

    return this.prisma.workOrder.findMany({
      where,
      include: this.workOrderListInclude(),
      orderBy: { createdAt: "desc" }
    });
  }

  async findAllPaginated(actor: Actor | undefined, page: number, pageSize: number) {
    const tenantId = this.resolveTenantId(actor);
    const where: Prisma.WorkOrderWhereInput = {};

    where.tenantId = tenantId;

    const safePage = Math.max(1, Math.trunc(page) || 1);
    const safePageSize = Math.min(100, Math.max(1, Math.trunc(pageSize) || 25));

    const [total, data] = await Promise.all([
      this.prisma.workOrder.count({ where }),
      this.prisma.workOrder.findMany({
        where,
        include: this.workOrderListInclude(),
        orderBy: { createdAt: "desc" },
        skip: (safePage - 1) * safePageSize,
        take: safePageSize
      })
    ]);

    return {
      data,
      total,
      page: safePage,
      pageSize: safePageSize
    };
  }

  private workOrderListInclude(): Prisma.WorkOrderInclude {
    return {
      asset: true,
      vehicle: true,
      technician: { select: PUBLIC_USER_SUMMARY_SELECT },
      createdBy: { select: PUBLIC_USER_SUMMARY_SELECT },
      parts: {
        include: {
          part: true
        }
      }
    };
  }

  async findOne(id: string, actor?: Actor) {
    const tenantId = this.resolveTenantId(actor);
    const where: Prisma.WorkOrderWhereInput = { id };

    where.tenantId = tenantId;

    const workOrder = await this.prisma.workOrder.findFirst({
      where,
      include: {
        parts: {
          include: {
            part: true
          }
        }
      }
    });

    if (!workOrder) {
      throw new NotFoundException("Work order not found");
    }

    return workOrder;
  }

  async create(
    data: {
      title: string;
      description: string;
      priority: Priority;
      type: "PREVENTIVE" | "CORRECTIVE" | "EMERGENCY" | "INSPECTION" | "INSTALLATION" | "ACCIDENT_REPAIR" | "BREAKDOWN" | "VENDOR_REPAIR" | "EXTERNAL_REPAIR" | "IMPROVEMENT" | "INSPECTION_CORRECTIVE" | "CALIBRATION_CORRECTIVE";
      assetId?: string;
      vehicleId?: string;
      siteId?: string;
      functionalLocationId?: string;
      scheduleId?: string;
      createdById: string;
      dueDate?: string;
      expectedCompletionDate?: string;
      requiresApproval?: boolean;
      taxonomyCategoryId?: string;
      taxonomyTypeId?: string;
      taxonomyIssueId?: string;
      isTriage?: boolean;
      triageReason?: string;
      reportedAt?: string;
      failedAt?: string;
      idempotencyKey?: string;
      /** MACHINERY | SERVICE | VEHICLE — optional; inferred when omitted */
      jobDomain?: string;
      domainId?: string;
      /** Apply versioned MaintenanceTemplate — snapshot frozen on the WO */
      maintenanceTemplateId?: string;
    },
    actor?: Actor,
    options?: { tx?: Prisma.TransactionClient }
  ) {
    const db = options?.tx ?? this.prisma;
    if (!data.title?.trim()) {
      throw new BadRequestException("Title is required");
    }
    if (!data.description?.trim()) {
      throw new BadRequestException("Description is required");
    }

    const assetId = assertValidOptionalObjectId("assetId", data.assetId);
    const vehicleId = assertValidOptionalObjectId("vehicleId", data.vehicleId);
    const siteId = assertValidOptionalObjectId("siteId", data.siteId);
    const functionalLocationId = assertValidOptionalObjectId(
      "functionalLocationId",
      data.functionalLocationId
    );
    const scheduleId = assertValidOptionalObjectId("scheduleId", data.scheduleId);
    assertWorkOrderAssetRules({ type: data.type as WorkOrderType, assetId, vehicleId, functionalLocationId });

    const tenantId = this.resolveTenantId(actor);
    const actorId = actor?.sub;
    if (!actorId) {
      throw new ForbiddenException("Authenticated actor is required to create a work order.");
    }

    // Prefer authenticated actor. Client-supplied createdById is accepted for compatibility.
    // Spoofing another user requires create-on-behalf (admin only) and is audited.
    const requestedCreatorId = data.createdById
      ? assertValidEntityId("createdById", data.createdById)
      : actorId;

    let authoritativeCreatorId = actorId;
    if (requestedCreatorId !== actorId) {
      const canCreateOnBehalf =
        actor?.role === RoleName.SUPER_ADMIN || actor?.role === RoleName.ADMIN;
      if (!canCreateOnBehalf) {
        throw new ForbiddenException(
          "createdById must match the authenticated actor unless create-on-behalf is authorized."
        );
      }
      const onBehalf = await this.prisma.user.findFirst({
        where: { id: requestedCreatorId, tenantId }
      });
      if (!onBehalf) {
        throw new BadRequestException("createdById does not match any existing user in your tenant context.");
      }
      authoritativeCreatorId = onBehalf.id;
    }

    const creator = await this.prisma.user.findFirst({
      where: {
        id: authoritativeCreatorId,
        tenantId
      }
    });

    if (!creator) {
      throw new BadRequestException("createdById does not match any existing user in your tenant context.");
    }

    // Cross-tenant FK validation: referenced asset/vehicle must belong to the active tenant.
    if (assetId) {
      await assertTenantEntityExists(this.prisma.asset, assetId, { tenantId, entityName: "Asset" });
    }
    if (vehicleId) {
      await assertTenantEntityExists(this.prisma.vehicle, vehicleId, { tenantId, entityName: "Vehicle" });
    }
    if (siteId) {
      await assertTenantEntityExists(this.prisma.site, siteId, { tenantId, entityName: "Site" });
    }
    if (functionalLocationId) {
      await assertTenantEntityExists(this.prisma.functionalLocation, functionalLocationId, {
        tenantId,
        entityName: "FunctionalLocation"
      });
    }

    // Phase 11: inherit domainId from the linked asset when not supplied by the caller.
    // This ensures work orders are automatically scoped to the asset's maintenance domain
    // without requiring every client to pass the field explicitly.
    let resolvedDomainId: string | undefined = data.domainId?.trim() || undefined;
    let assetDomainCode: string | null | undefined;
    if (assetId) {
      const asset = await this.prisma.asset.findFirst({
        where: { id: assetId, tenantId },
        select: { domainId: true, domain: { select: { code: true } } }
      });
      resolvedDomainId = resolvedDomainId ?? asset?.domainId ?? undefined;
      assetDomainCode = asset?.domain?.code;
    }

    const resolvedJobDomain = resolveJobDomain({
      jobDomain: data.jobDomain,
      vehicleId,
      assetId,
      assetDomainCode
    });

    let taxonomyFields: {
      taxonomyCategoryId?: string;
      taxonomyTypeId?: string;
      taxonomyIssueId?: string;
      categoryNameSnapshot?: string;
      typeNameSnapshot?: string;
      issueNameSnapshot?: string;
      isTriage?: boolean;
      triageReason?: string;
    } = {};
    if (data.isTriage || data.taxonomyCategoryId || data.taxonomyTypeId || data.taxonomyIssueId) {
      const taxonomy = await this.workOrderTaxonomyService.resolveTaxonomySelection(tenantId, {
        taxonomyCategoryId: data.taxonomyCategoryId,
        taxonomyTypeId: data.taxonomyTypeId,
        taxonomyIssueId: data.taxonomyIssueId,
        isTriage: data.isTriage
      });

      if (taxonomy.rules?.requiresVehicle && !vehicleId) {
        throw new BadRequestException("Selected category requires a vehicle.");
      }
      if (taxonomy.rules?.requiresAsset && !assetId) {
        throw new BadRequestException("Selected category requires an asset.");
      }

      taxonomyFields = {
        taxonomyCategoryId: taxonomy.taxonomyCategoryId,
        taxonomyTypeId: taxonomy.taxonomyTypeId,
        taxonomyIssueId: taxonomy.taxonomyIssueId,
        categoryNameSnapshot: taxonomy.categoryNameSnapshot,
        typeNameSnapshot: taxonomy.typeNameSnapshot,
        issueNameSnapshot: taxonomy.issueNameSnapshot,
        isTriage: taxonomy.isTriage,
        triageReason: data.isTriage ? data.triageReason ?? data.description : undefined
      };
    }

    const approvalStatus =
      data.requiresApproval === true
        ? WorkOrderApprovalStatus.PENDING
        : this.canAutoApproveWorkOrder(actor?.role)
          ? WorkOrderApprovalStatus.APPROVED
          : WorkOrderApprovalStatus.PENDING;

    let templateFields: {
      maintenanceTemplateId?: string;
      maintenanceTemplateVersion?: number;
      maintenanceTemplateSnapshot?: string;
      estimatedHours?: number;
      priority?: Priority;
      executionMode?: string;
      riskLevel?: string;
      lotoRequired?: boolean;
      permitReference?: string;
    } = {};

    if (data.maintenanceTemplateId && this.maintenanceTemplates) {
      const template = await this.maintenanceTemplates.resolveActiveTemplate(
        tenantId,
        data.maintenanceTemplateId
      );
      if (!template) {
        throw new BadRequestException("Active maintenance template not found");
      }
      const snapshot = this.maintenanceTemplates.buildSnapshot(template);
      templateFields = {
        maintenanceTemplateId: template.id,
        maintenanceTemplateVersion: template.version,
        maintenanceTemplateSnapshot: JSON.stringify(snapshot),
        estimatedHours: template.estimatedHours ?? undefined,
        priority: (template.defaultPriority as Priority) || data.priority,
        executionMode: template.defaultExecutionMode ?? undefined,
        permitReference: template.permitRequirement ?? undefined,
        lotoRequired: JSON.stringify(snapshot.safetyRequirements || []).includes("LOTO")
      };
    }

    let underWarranty = false;
    if (this.warranties) {
      const subjects: Array<{ subjectType: string; subjectId: string }> = [];
      if (assetId) {
        subjects.push({ subjectType: "ASSET", subjectId: assetId });
        subjects.push({ subjectType: "MACHINE", subjectId: assetId });
      }
      if (vehicleId) subjects.push({ subjectType: "VEHICLE", subjectId: vehicleId });
      const active = await this.warranties.findActiveForSubjects(tenantId, subjects);
      underWarranty = active.length > 0;
    }

    try {
      const created = await this.createWithNumberRetry(
        {
          tenantId: tenantId,
          title: data.title,
          description: data.description,
          priority: templateFields.priority ?? data.priority,
          type: data.type as WorkOrderType,
          assetId,
          vehicleId,
          siteId,
          functionalLocationId,
          scheduleId,
          createdById: authoritativeCreatorId,
          domainId: resolvedDomainId,
          jobDomain: resolvedJobDomain,
          ...taxonomyFields,
          dueDate: data.dueDate ? new Date(data.dueDate) : undefined,
          expectedCompletionDate: data.expectedCompletionDate
            ? new Date(data.expectedCompletionDate)
            : data.dueDate
              ? new Date(data.dueDate)
              : undefined,
          reportedAt: data.reportedAt ? new Date(data.reportedAt) : new Date(),
          failedAt: data.failedAt ? new Date(data.failedAt) : undefined,
          lastIdempotencyKey: data.idempotencyKey?.trim() || undefined,
          status: WorkOrderStatus.OPEN,
          approvalStatus,
          approvedAt: approvalStatus === WorkOrderApprovalStatus.APPROVED ? new Date() : undefined,
          approvedById:
            approvalStatus === WorkOrderApprovalStatus.APPROVED && actor?.sub ? actor.sub : undefined,
          qrVerificationStatus: requiresQrVerification(data.type as never, assetId, vehicleId)
            ? QrVerificationStatus.PENDING
            : QrVerificationStatus.NOT_REQUIRED,
          maintenanceTemplateId: templateFields.maintenanceTemplateId,
          maintenanceTemplateVersion: templateFields.maintenanceTemplateVersion,
          maintenanceTemplateSnapshot: templateFields.maintenanceTemplateSnapshot,
          estimatedHours: templateFields.estimatedHours,
          executionMode: templateFields.executionMode || undefined,
          permitReference: templateFields.permitReference,
          lotoRequired: templateFields.lotoRequired ?? false,
          underWarranty
        },
        actor,
        db
      );

      await this.appendStatusHistory(
        tenantId,
        created.id,
        {
          fromStatus: null,
          toStatus: created.status,
          action: "CREATED",
          actorId: actorId,
          metadata: { woNumber: created.woNumber }
        },
        db
      );

      if (!options?.tx) {
        await this.recordAudit({
          entity: "WorkOrder",
          entityId: created.id,
          action: AuditAction.CREATE,
          actor,
          reason: "Work order created",
          metadata: {
            event: "work_order_created",
            woNumber: created.woNumber,
            approvalStatus: created.approvalStatus,
          priority: created.priority,
          type: created.type,
          createdById: authoritativeCreatorId,
          createOnBehalf: authoritativeCreatorId !== actorId
        },
        afterData: {
          status: created.status,
          approvalStatus: created.approvalStatus,
          title: created.title
        }
      });
      }

      return this.syncCreateTimeApprovals(created, actor);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to create work order";
      throw new BadRequestException(`Failed to create work order: ${message}`);
    }
  }

  async update(
    id: string,
    data: Partial<{
      title: string;
      description: string;
      dueDate: string;
      expectedCompletionDate: string;
      plannedStartAt: string;
      plannedEndAt: string;
      estimatedCost: number;
      estimatedHours: number;
      overrideReason?: string;
      expectedVersion?: number;
    }>,
    actor?: Actor
  ) {
    const existing = await this.findOne(id, actor);
    assertSensitiveFieldsUnlocked(
      existing.status,
      {
        dueDate: data.dueDate,
        expectedCompletionDate: data.expectedCompletionDate,
        plannedStartAt: data.plannedStartAt,
        plannedEndAt: data.plannedEndAt
      },
      { overrideReason: data.overrideReason, actorRole: actor?.role as RoleName | undefined }
    );

    if (data.estimatedHours !== undefined && (!Number.isFinite(data.estimatedHours) || data.estimatedHours <= 0)) {
      throw new BadRequestException("Estimated hours must be greater than 0");
    }

    const plannedStartAt = data.plannedStartAt ? new Date(data.plannedStartAt) : existing.plannedStartAt;
    const plannedEndAt = data.plannedEndAt ? new Date(data.plannedEndAt) : existing.plannedEndAt;
    if (plannedStartAt && plannedEndAt && plannedEndAt.getTime() < plannedStartAt.getTime()) {
      throw new BadRequestException("Planned end must not be earlier than planned start");
    }

    assertVersionMatch(
      (existing as { version?: number }).version,
      data.expectedVersion,
      "Work order"
    );

    const versionWhere =
      data.expectedVersion != null
        ? { id, version: data.expectedVersion }
        : { id };

    const updatedCount = await this.prisma.workOrder.updateMany({
      where: versionWhere,
      data: {
        title: data.title,
        description: data.description,
        dueDate: data.dueDate ? new Date(data.dueDate) : undefined,
        expectedCompletionDate: data.expectedCompletionDate
          ? new Date(data.expectedCompletionDate)
          : undefined,
        plannedStartAt: data.plannedStartAt ? new Date(data.plannedStartAt) : undefined,
        plannedEndAt: data.plannedEndAt ? new Date(data.plannedEndAt) : undefined,
        estimatedCost: data.estimatedCost,
        estimatedHours: data.estimatedHours,
        version: { increment: 1 }
      }
    });

    if (updatedCount.count !== 1) {
      throw new ConflictException("Work order was updated by someone else. Refresh and retry.");
    }

    const updated = await this.findOne(id, actor);
    if (data.plannedStartAt || data.plannedEndAt || data.expectedCompletionDate) {
      await this.recordAudit({
        entity: "WorkOrder",
        entityId: id,
        action: AuditAction.UPDATE,
        actor,
        reason: data.overrideReason ?? "Work order schedule fields updated",
        metadata: {
          event: existing.status === WorkOrderStatus.COMPLETED ? "work_order_edited_after_completion" : "work_order_schedule_updated",
          woNumber: existing.woNumber
        },
        beforeData: {
          plannedStartAt: existing.plannedStartAt?.toISOString() ?? null,
          plannedEndAt: existing.plannedEndAt?.toISOString() ?? null,
          expectedCompletionDate: existing.expectedCompletionDate?.toISOString() ?? null
        },
        afterData: {
          plannedStartAt: updated.plannedStartAt?.toISOString() ?? null,
          plannedEndAt: updated.plannedEndAt?.toISOString() ?? null,
          expectedCompletionDate: updated.expectedCompletionDate?.toISOString() ?? null
        }
      });
    }

    return updated;
  }

  async planWork(
    id: string,
    data: {
      plannedStartAt: string;
      dueDate?: string;
      expectedCompletionDate?: string;
      estimatedHours?: number;
      estimatedDurationMinutes?: number;
      notes?: string;
      delayReason?: string;
      vendorSupplierId?: string;
      expectedVersion?: number;
    },
    actor?: Actor
  ) {
    const current = await this.findOne(id, actor);
    if (current.status !== WorkOrderStatus.OPEN && current.status !== WorkOrderStatus.PLANNED) {
      throw new BadRequestException("Work planning is only allowed from OPEN or PLANNED status.");
    }

    const plannedStartAt = new Date(data.plannedStartAt);
    const dueDate = data.dueDate ? new Date(data.dueDate) : current.dueDate;
    const expectedCompletionDate = data.expectedCompletionDate
      ? new Date(data.expectedCompletionDate)
      : current.expectedCompletionDate;
    if (Number.isNaN(plannedStartAt.getTime())) {
      throw new BadRequestException("A valid planned start date is required.");
    }
    if (dueDate && dueDate.getTime() < plannedStartAt.getTime()) {
      throw new BadRequestException("Due date must not be earlier than planned start.");
    }
    if (expectedCompletionDate && expectedCompletionDate.getTime() < plannedStartAt.getTime()) {
      throw new BadRequestException("Expected completion must not be earlier than planned start.");
    }
    if (
      data.estimatedHours != null &&
      (!Number.isFinite(data.estimatedHours) || Number(data.estimatedHours) < 0)
    ) {
      throw new BadRequestException("Estimated hours must be zero or greater.");
    }
    if (
      data.estimatedDurationMinutes != null &&
      (!Number.isFinite(data.estimatedDurationMinutes) || Number(data.estimatedDurationMinutes) < 0)
    ) {
      throw new BadRequestException("Estimated duration minutes must be zero or greater.");
    }

    const where = this.assertOptimisticVersion(current, data.expectedVersion);
    const planData = {
      status: WorkOrderStatus.PLANNED,
      plannedStartAt,
      dueDate,
      expectedCompletionDate,
      estimatedHours: data.estimatedHours ?? current.estimatedHours,
      estimatedDurationMinutes: data.estimatedDurationMinutes ?? current.estimatedDurationMinutes,
      notes: data.notes?.trim() || current.notes,
      delayReason: data.delayReason?.trim() || current.delayReason,
      vendorSupplierId: data.vendorSupplierId ?? current.vendorSupplierId,
      version: { increment: 1 as const }
    };

    if (data.expectedVersion != null) {
      const updatedCount = await this.prisma.workOrder.updateMany({
        where,
        data: planData
      });
      if (updatedCount.count !== 1) {
        throw new ConflictException("Work order was updated by someone else. Refresh and retry.");
      }
    } else {
      await this.prisma.workOrder.update({
        where: { id },
        data: planData
      });
    }

    const updated = await this.findOneWithRelations(id, actor);
    await this.appendStatusHistory(current.tenantId, id, {
      fromStatus: current.status,
      toStatus: WorkOrderStatus.PLANNED,
      action: "PLANNED",
      actorId: actor?.sub,
      reason: data.notes ?? data.delayReason,
      metadata: {
        plannedStartAt: updated.plannedStartAt?.toISOString() ?? null,
        dueDate: updated.dueDate?.toISOString() ?? null
      }
    });
    if ((current.dueDate?.toISOString() ?? null) !== (updated.dueDate?.toISOString() ?? null)) {
      await this.recordAudit({
        entity: "WorkOrder",
        entityId: id,
        action: AuditAction.UPDATE,
        actor,
        reason: data.notes ?? "Work order due date planned",
        metadata: { event: "work_order_due_date_planned", woNumber: current.woNumber },
        beforeData: { dueDate: current.dueDate?.toISOString() ?? null },
        afterData: { dueDate: updated.dueDate?.toISOString() ?? null }
      });
    }

    return updated;
  }

  async remove(id: string, actor?: Actor) {
    const existing = await this.findOne(id, actor);

    if (existing.status === WorkOrderStatus.CANCELLED) {
      return { deleted: false, cancelled: true, id, status: existing.status, message: "Work order already cancelled" };
    }

    if (existing.status !== WorkOrderStatus.OPEN) {
      throw new BadRequestException(
        "Only OPEN work orders can be cancelled through this action. Use the governed cancel transition for work already in progress."
      );
    }

    const reason = "Cancelled instead of hard delete — historical record retained";
    const updated = await this.prisma.workOrder.update({
      where: { id },
      data: {
        status: WorkOrderStatus.CANCELLED,
        cancelledReason: reason
      }
    });

    await this.appendStatusHistory(existing.tenantId, id, {
      fromStatus: existing.status as WorkOrderStatus,
      toStatus: WorkOrderStatus.CANCELLED,
      action: "CANCEL_INSTEAD_OF_DELETE",
      actorId: actor?.sub,
      reason
    });

    await this.recordAudit({
      entity: "WorkOrder",
      entityId: id,
      action: AuditAction.UPDATE,
      actor,
      reason,
      metadata: { event: "work_order_cancelled_instead_of_delete", woNumber: updated.woNumber },
      beforeData: { status: existing.status },
      afterData: { status: updated.status }
    });

    return { deleted: false, cancelled: true, id, status: updated.status };
  }

  async assign(
    id: string,
    technicianId: string,
    actorOrOptions?: Actor | AssignOptions,
    maybeOptions?: AssignOptions | Actor
  ) {
    const actor =
      actorOrOptions && "sub" in actorOrOptions
        ? (actorOrOptions as Actor)
        : (maybeOptions as Actor | undefined);
    const options =
      actorOrOptions && !("sub" in actorOrOptions)
        ? (actorOrOptions as AssignOptions)
        : (maybeOptions as AssignOptions | undefined);
    const current = await this.findOne(id, actor);
    if (current.status !== WorkOrderStatus.PLANNED && current.status !== WorkOrderStatus.ASSIGNED) {
      throw new BadRequestException("Work orders can only be assigned from PLANNED or ASSIGNED status.");
    }
    this.assertWorkOrderApprovedForExecution(current);
    const tenantId = this.resolveTenantId(actor);
    const technician = await this.prisma.user.findFirst({
      where: {
        id: technicianId,
        tenantId
      },
      include: { role: true }
    });

    if (!technician) {
      throw new NotFoundException("Technician user not found");
    }

    if (technician.role.name === RoleName.DRIVER || technician.role.name === RoleName.VIEWER) {
      throw new BadRequestException("Cannot assign a work order to a VIEWER or DRIVER role user");
    }

    if (
      !TECHNICIAN_EXECUTION_ROLES.has(technician.role.name) &&
      technician.role.name !== RoleName.ASSET_MANAGER &&
      technician.role.name !== RoleName.MECHANIC
    ) {
      // Prefer technician/mechanic; allow other non-viewer operational roles already filtered above.
    }

    const isReassignment =
      Boolean(current.technicianId) && current.technicianId !== technicianId;
    const trimmedReason = options?.reason?.trim();
    if (isReassignment && (!trimmedReason || trimmedReason.length < 3)) {
      throw new BadRequestException("Reassignment reason is required when changing technician.");
    }

    const where = this.assertOptimisticVersion(current, options?.expectedVersion);
    const assignmentData = {
      technicianId,
      status: WorkOrderStatus.ASSIGNED,
      version: { increment: 1 as const }
    };

    if (options?.expectedVersion != null) {
      const updatedCount = await this.prisma.workOrder.updateMany({
        where,
        data: assignmentData
      });
      if (updatedCount.count !== 1) {
        throw new ConflictException("Work order was updated by someone else. Refresh and retry.");
      }
    } else {
      await this.prisma.workOrder.update({
        where: { id },
        data: assignmentData
      });
    }

    const updated = await this.findOneWithRelations(id, actor);

    // Canonical assignee model: sync WorkOrderAssignee from legacy technicianId when a linked employee exists.
    let employee = await this.prisma.employee.findFirst({
      where: { linkedUserId: technicianId, tenantId, active: true }
    });
    if (!employee) {
      employee = await this.prisma.employee.create({
        data: {
          tenantId,
          fullName: `${technician.firstName} ${technician.lastName}`.trim() || technician.email,
          email: technician.email,
          designation: "Technician",
          linkedUserId: technicianId,
          canReceiveWorkOrders: true,
          canLogin: true,
          active: true,
          skills: stringArrayToText([]),
          workCategories: stringArrayToText(["CORRECTIVE"])
        }
      });
    }

    try {
      await this.workOrderAssigneesService.addAssignee(
        id,
        { employeeId: employee.id, isPrimary: true },
        actor
      );
    } catch (error) {
      if (!(error instanceof BadRequestException && String(error.message).includes("already assigned"))) {
        throw error;
      }
    }

    await this.notificationsService.createNotification({
      userId: technicianId,
      title: "Work order assigned",
      message: `Work order ${updated.woNumber} assigned to you${updated.dueDate ? ` - due ${updated.dueDate.toISOString()}` : ""}`,
      type: NotificationType.WORK_ORDER_ASSIGNED,
      priority: NotificationPriority.WARNING,
      channel: "IN_APP",
      referenceId: updated.id,
      referenceType: "WorkOrder",
      dueAt: updated.dueDate ?? null,
      metadata: {
        woNumber: updated.woNumber,
        status: updated.status,
        priority: updated.priority
      }
    });

    await this.recordAudit({
      entity: "WorkOrder",
      entityId: id,
      action: AuditAction.UPDATE,
      actor,
      reason: trimmedReason ?? "Technician assigned",
      metadata: {
        event: isReassignment ? "work_order_reassigned" : "work_order_assigned",
        woNumber: updated.woNumber,
        technicianId,
        employeeId: employee.id,
        previousTechnicianId: current.technicianId ?? null
      },
      beforeData: { technicianId: current.technicianId ?? null },
      afterData: { technicianId: updated.technicianId ?? null, employeeId: employee.id }
    });

    await this.appendStatusHistory(current.tenantId, id, {
      fromStatus: current.status,
      toStatus: WorkOrderStatus.ASSIGNED,
      action: isReassignment ? "REASSIGNED" : "ASSIGNED",
      actorId: actor?.sub,
      reason: trimmedReason,
      metadata: {
        previousTechnicianId: current.technicianId ?? null,
        technicianId,
        employeeId: employee.id
      }
    });

    return this.findOneWithRelations(id, actor);
  }

  async submitForApproval(id: string, notes: string | undefined, actor?: Actor) {
    const current = await this.findOne(id, actor);

    if (current.approvalStatus === WorkOrderApprovalStatus.APPROVED) {
      throw new BadRequestException("Work order is already approved");
    }

    if (current.approvalStatus === WorkOrderApprovalStatus.REJECTED) {
      throw new BadRequestException("Rejected work orders cannot be resubmitted");
    }

    if (current.status === WorkOrderStatus.COMPLETED || current.status === WorkOrderStatus.CANCELLED) {
      throw new BadRequestException("Closed work orders cannot be submitted for approval");
    }

    const updated = await this.prisma.workOrder.update({
      where: { id },
      data: {
        approvalStatus: WorkOrderApprovalStatus.PENDING,
        approvedById: null,
        approvedAt: null,
        rejectionReason: null
      }
    });

    await this.recordAudit({
      entity: "WorkOrder",
      entityId: id,
      action: AuditAction.UPDATE,
      actor,
      reason: notes ?? "Submitted for manager approval",
      metadata: { event: "work_order_submitted_for_approval", woNumber: updated.woNumber },
      beforeData: { approvalStatus: current.approvalStatus },
      afterData: { approvalStatus: updated.approvalStatus }
    });

    return updated;
  }

  async approveWorkOrder(
    id: string,
    notes: string | undefined,
    actor?: Actor,
    options?: { emergencyOverrideReason?: string }
  ) {
    const current = await this.findOne(id, actor);

    if (current.approvalStatus !== WorkOrderApprovalStatus.PENDING) {
      throw new BadRequestException("Only pending work orders can be approved");
    }

    if (current.status === WorkOrderStatus.COMPLETED || current.status === WorkOrderStatus.CANCELLED) {
      throw new BadRequestException("Cannot approve a closed work order");
    }

    const approver = this.assertActor(actor);

    // Maker-checker: creator cannot approve their own controlled work order without emergency override.
    if (current.createdById === approver.sub) {
      const override = options?.emergencyOverrideReason?.trim() ?? "";
      const canOverride =
        (approver.role === RoleName.SUPER_ADMIN || approver.role === RoleName.ADMIN) &&
        override.length >= 3;
      if (!canOverride) {
        throw new ForbiddenException(
          "Maker-checker separation required: the work-order creator cannot approve their own request."
        );
      }
      await this.recordAudit({
        entity: "WorkOrder",
        entityId: id,
        action: AuditAction.UPDATE,
        actor,
        reason: override,
        metadata: {
          event: "work_order_approval_maker_checker_override",
          woNumber: current.woNumber
        }
      });
    }

    const updated = await this.prisma.workOrder.update({
      where: { id },
      data: {
        approvalStatus: WorkOrderApprovalStatus.APPROVED,
        approvedById: approver.sub,
        approvedAt: new Date(),
        rejectionReason: null
      }
    });

    await this.recordAudit({
      entity: "WorkOrder",
      entityId: id,
      action: AuditAction.UPDATE,
      actor,
      reason: notes ?? "Work order approved",
      metadata: { event: "work_order_approved", woNumber: updated.woNumber },
      beforeData: { approvalStatus: current.approvalStatus },
      afterData: { approvalStatus: updated.approvalStatus, approvedById: updated.approvedById }
    });

    return updated;
  }

  async rejectWorkOrder(id: string, reason: string, actor?: Actor) {
    const trimmedReason = reason?.trim();
    if (!trimmedReason || trimmedReason.length < 3) {
      throw new BadRequestException("Rejection reason is required (minimum 3 characters)");
    }

    const current = await this.findOne(id, actor);

    if (current.approvalStatus !== WorkOrderApprovalStatus.PENDING) {
      throw new BadRequestException("Only pending work orders can be rejected");
    }

    if (current.status === WorkOrderStatus.COMPLETED) {
      throw new BadRequestException("Cannot reject a completed work order");
    }

    const updated = await this.prisma.workOrder.update({
      where: { id },
      data: {
        approvalStatus: WorkOrderApprovalStatus.REJECTED,
        status: WorkOrderStatus.CANCELLED,
        rejectionReason: trimmedReason,
        approvedById: null,
        approvedAt: null
      }
    });

    await this.recordAudit({
      entity: "WorkOrder",
      entityId: id,
      action: AuditAction.UPDATE,
      actor,
      reason: trimmedReason,
      metadata: { event: "work_order_rejected", woNumber: updated.woNumber },
      beforeData: {
        approvalStatus: current.approvalStatus,
        status: current.status
      },
      afterData: {
        approvalStatus: updated.approvalStatus,
        status: updated.status,
        rejectionReason: updated.rejectionReason
      }
    });

    return updated;
  }

  async updateStatus(
    id: string,
    data: {
      status: WorkOrderStatus;
      actualCost?: number;
      actualHours?: number;
      delayReason?: string;
      notes?: string;
      holdReasonCode?: string;
      expectedResumeAt?: string;
      cancelReason?: string;
      completionNote?: string;
      emergencyCloseReason?: string;
      completionCondition?: WorkOrderCompletionCondition;
      followUpRequired?: boolean;
      followUpNote?: string;
      overrideReason?: string;
      expectedVersion?: number;
      idempotencyKey?: string;
      failureCode?: string;
      causeCode?: string;
      remedyCode?: string;
    },
    actor?: Actor
  ) {
    const current = await this.findOne(id, actor);
    const tenantId = this.resolveTenantId(actor);
    const targetStatus =
      data.status === WorkOrderStatus.COMPLETED && TECHNICIAN_EXECUTION_ROLES.has(actor?.role as RoleName)
        ? WorkOrderStatus.TECHNICIAN_COMPLETED
        : data.status;
    const trimmedIdempotencyKey = data.idempotencyKey?.trim();

    if (trimmedIdempotencyKey && current.lastIdempotencyKey === trimmedIdempotencyKey && current.status === targetStatus) {
      return this.findOneWithRelations(id, actor);
    }

    this.assertOptimisticVersion(current, data.expectedVersion);
    assertAllowedStatusTransition(current.status, targetStatus);
    assertRoleCanSetStatus(actor?.role as RoleName | undefined, current.status, targetStatus, {
      emergencyCloseReason: data.emergencyCloseReason
    });

    if (targetStatus === WorkOrderStatus.IN_PROGRESS) {
      await this.enforceConfigurableApproval({
        actor,
        workOrder: current,
        processType: ApprovalProcessType.CRITICAL_WORK_ORDER,
        trigger: ApprovalTrigger.BEFORE_START,
        blockMessage: "Critical work order requires approval before start",
        allowEmergencyProceed: true
      });
      await this.enforceConfigurableApproval({
        actor,
        workOrder: current,
        processType: ApprovalProcessType.HIGH_COST_WORK_ORDER,
        trigger: ApprovalTrigger.BEFORE_START,
        blockMessage: "High-cost work order requires approval before start",
        allowEmergencyProceed: true
      });
      if (
        current.type === WorkOrderType.VENDOR_REPAIR ||
        current.type === WorkOrderType.EXTERNAL_REPAIR
      ) {
        await this.enforceConfigurableApproval({
          actor,
          workOrder: current,
          processType: ApprovalProcessType.VENDOR_REPAIR,
          trigger: ApprovalTrigger.BEFORE_ASSIGN_VENDOR,
          blockMessage: "Vendor/external repair requires approval before start",
          allowEmergencyProceed: true
        });
      }

      if (this.reliability) {
        const emergencyOverride = Boolean(
          (data as { emergencySafetyOverride?: boolean }).emergencySafetyOverride &&
            data.emergencyCloseReason?.trim()
        );
        await this.reliability.assertPermitReadyForStart({
          tenantId,
          workOrderId: id,
          assetId: current.assetId,
          allowEmergencyOverride: emergencyOverride
        });
        await this.reliability.assertLotoReadyForStart({
          tenantId,
          workOrderId: id,
          allowEmergencyOverride: emergencyOverride
        });
        if (emergencyOverride) {
          await this.recordAudit({
            entity: "WorkOrder",
            entityId: id,
            action: AuditAction.UPDATE,
            actor,
            reason: data.emergencyCloseReason ?? "Emergency safety override on start",
            metadata: { event: "permit_start_override", safetyBlock: "PERMIT" }
          });
        }

        if (current.assetId || current.failureCodeSnapshot) {
          await this.reliability.detectRepeatFailure({
            tenantId,
            workOrderId: id,
            assetId: current.assetId,
            failureCode: current.failureCodeSnapshot
          });
        }
      }
    }

    if (
      targetStatus === WorkOrderStatus.IN_PROGRESS ||
      targetStatus === WorkOrderStatus.TECHNICIAN_COMPLETED ||
      targetStatus === WorkOrderStatus.COMPLETED
    ) {
      this.assertWorkOrderApprovedForExecution(current);
    }

    if (targetStatus === WorkOrderStatus.ON_HOLD) {
      const holdNotes = data.delayReason?.trim() || data.notes?.trim();
      assertReasonProvided("Hold reason", holdNotes);
      const holdCode = (data.holdReasonCode ?? current.holdReasonCode ?? "OTHER").toString();
      if (this.maintenanceConfig) {
        await this.maintenanceConfig.assertHoldReason(tenantId, holdCode, holdNotes);
      } else {
        assertValidHoldReason(holdCode, holdNotes);
      }
      await this.closeActiveLabourSessions(id, actor?.sub ?? current.technicianId ?? undefined, tenantId);
    }

    if (targetStatus === WorkOrderStatus.IN_PROGRESS) {
      const assigneeCount = await this.prisma.workOrderAssignee.count({
        where: {
          workOrderId: id,
          assignmentStatus: { not: "REMOVED" }
        }
      });
      const labourActorId = actor?.sub ?? current.technicianId ?? undefined;
      if (!current.technicianId && assigneeCount === 0) {
        throw new BadRequestException("Cannot start work without an assigned technician or employee.");
      }
      if (!labourActorId) {
        throw new BadRequestException("Cannot start work without a technician labour actor.");
      }
      await this.startLabourSession(id, labourActorId, tenantId);
    }

    if (targetStatus === WorkOrderStatus.CANCELLED) {
      assertReasonProvided("Cancel reason", data.cancelReason);
    }

    let authoritativeCompletion: { actualHours: number; actualCost: number; partsCost: number } | null = null;
    if (targetStatus === WorkOrderStatus.TECHNICIAN_COMPLETED) {
      assertReasonProvided("Technician completion note", data.completionNote);

      const assigneeCount = await this.prisma.workOrderAssignee.count({
        where: {
          workOrderId: id,
          assignmentStatus: { not: "REMOVED" }
        }
      });
      if (assigneeCount === 0) {
        throw new BadRequestException("Cannot complete work order without an assigned employee.");
      }

      const evidenceItems = await this.prisma.evidenceAttachment.findMany({
        where: { workOrderId: id, deletedAt: null, status: { not: "DELETED" } },
        select: { evidenceType: true, status: true, verificationStatus: true }
      });

      const overrideAllowed =
        Boolean(data.overrideReason?.trim()) && canOverrideCompletionBlock(actor?.role as RoleName);

      try {
        assertEvidenceForTechnicianCompletion({
          workOrderType: current.type,
          items: evidenceItems,
          completionNote: data.completionNote,
          qrStatus: current.qrVerificationStatus,
          assetId: current.assetId,
          vehicleId: current.vehicleId,
          overrideReason: overrideAllowed ? data.overrideReason : undefined
        });
      } catch (error) {
        if (error instanceof BadRequestException) {
          await this.recordAudit({
            entity: "WorkOrder",
            entityId: id,
            action: AuditAction.UPDATE,
            actor,
            reason: error.message,
            metadata: { event: "completion_blocked_missing_evidence", woNumber: current.woNumber }
          });
        }
        throw error;
      }

      await this.closeActiveLabourSessions(id, actor?.sub ?? current.technicianId ?? undefined, tenantId);
      await this.assertPartsReconciledForCompletion(id, actor);
      authoritativeCompletion = await this.computeAuthoritativeHoursAndCost(id, actor);

      if (overrideAllowed) {
        await this.recordAudit({
          entity: "WorkOrder",
          entityId: id,
          action: AuditAction.UPDATE,
          actor,
          reason: data.overrideReason,
          metadata: { event: "completion_override_missing_evidence", woNumber: current.woNumber }
        });
      }
    }

    if (targetStatus === WorkOrderStatus.COMPLETED) {
      if (current.status !== WorkOrderStatus.TECHNICIAN_COMPLETED && !canDirectlyCloseWorkOrder(actor?.role as RoleName)) {
        throw new BadRequestException("Supervisor verification required before closing.");
      }
      if (current.status !== WorkOrderStatus.TECHNICIAN_COMPLETED) {
        assertReasonProvided("Emergency close reason", data.emergencyCloseReason);
      }
      if (requiresEvidenceForCompletion(current.type)) {
        const evidenceCount = await this.prisma.evidenceAttachment.count({
          where: { workOrderId: id, status: "UPLOADED" }
        });
        const storageEnabled = /^(1|true|yes)$/i.test((process.env.STORAGE_UPLOADS_ENABLED ?? "").trim());
        const isProduction = String(process.env.NODE_ENV ?? "").toLowerCase() === "production";
        if (!storageEnabled && isProduction) {
          throw new BadRequestException(
            "Evidence storage is unavailable. Completion is blocked while required photo evidence cannot be stored (fail closed)."
          );
        }
        if (storageEnabled && evidenceCount < 2) {
          throw new BadRequestException(
            "Before and after evidence are required for this work order category when uploads are enabled."
          );
        }
      }
      await this.closeActiveLabourSessions(id, actor?.sub ?? current.technicianId ?? undefined, tenantId);
      await this.assertPartsReconciledForCompletion(id, actor);
      authoritativeCompletion = await this.computeAuthoritativeHoursAndCost(id, actor);
    }

    const slaRisk = calculateSlaRisk({
      dueDate: current.dueDate,
      expectedCompletionDate: current.expectedCompletionDate,
      plannedEndAt: current.plannedEndAt,
      status: current.status
    });

    if (targetStatus === WorkOrderStatus.COMPLETED && slaRisk.level === "OVERDUE" && !data.delayReason?.trim()) {
      throw new BadRequestException("Delay reason is required when completing an overdue work order");
    }

    let slaDeadline = current.slaDeadline;
    let startDate = current.startDate;

    if (targetStatus === WorkOrderStatus.IN_PROGRESS && !current.startDate) {
      startDate = new Date();
      const hours = await this.slaHours(tenantId, current.priority as Priority);
      slaDeadline = new Date(startDate.getTime() + hours * 60 * 60 * 1000);
    }

    const completedDate =
      targetStatus === WorkOrderStatus.TECHNICIAN_COMPLETED || targetStatus === WorkOrderStatus.COMPLETED
        ? current.completedDate ?? new Date()
        : current.completedDate;

    const verificationStatus =
      targetStatus === WorkOrderStatus.TECHNICIAN_COMPLETED &&
      requiresSupervisorVerification({ type: current.type, priority: current.priority })
        ? WorkOrderVerificationStatus.PENDING
        : current.verificationStatus;

    const repairStartedAt =
      targetStatus === WorkOrderStatus.IN_PROGRESS
        ? current.repairStartedAt ?? startDate ?? new Date()
        : current.repairStartedAt;
    const repairCompletedAt =
      targetStatus === WorkOrderStatus.TECHNICIAN_COMPLETED || targetStatus === WorkOrderStatus.COMPLETED
        ? current.repairCompletedAt ?? new Date()
        : current.repairCompletedAt;
    const heldAt =
      targetStatus === WorkOrderStatus.ON_HOLD ? current.heldAt ?? new Date() : current.heldAt;
    const resumedAt =
      current.status === WorkOrderStatus.ON_HOLD && targetStatus === WorkOrderStatus.IN_PROGRESS
        ? new Date()
        : current.resumedAt;

    if (targetStatus === WorkOrderStatus.ON_HOLD) {
      await this.prisma.workOrderHoldHistory.create({
        data: {
          tenantId,
          workOrderId: id,
          holdReasonCode: (data.holdReasonCode ?? current.holdReasonCode ?? "OTHER").toString().toUpperCase(),
          notes: data.delayReason?.trim() || data.notes?.trim() || null,
          heldAt: heldAt ?? new Date(),
          expectedResumeAt: data.expectedResumeAt ? new Date(data.expectedResumeAt) : null,
          heldById: actor?.sub
        }
      });
    }

    if (current.status === WorkOrderStatus.ON_HOLD && targetStatus === WorkOrderStatus.IN_PROGRESS) {
      const openHold = await this.prisma.workOrderHoldHistory.findFirst({
        where: { workOrderId: id, resumedAt: null },
        orderBy: { heldAt: "desc" }
      });
      if (openHold) {
        const resumed = resumedAt ?? new Date();
        const durationMinutes = Math.max(0, Math.round((resumed.getTime() - openHold.heldAt.getTime()) / 60_000));
        await this.prisma.workOrderHoldHistory.update({
          where: { id: openHold.id },
          data: {
            resumedAt: resumed,
            resumedById: actor?.sub,
            durationMinutes
          }
        });
      }
    }

    const mutationData = {
      status: targetStatus,
      startDate,
      slaDeadline,
      repairStartedAt,
      repairCompletedAt,
      heldAt,
      resumedAt,
      holdNotes:
        targetStatus === WorkOrderStatus.ON_HOLD
          ? data.delayReason?.trim() || data.notes?.trim() || current.holdNotes
          : current.status === WorkOrderStatus.ON_HOLD && targetStatus === WorkOrderStatus.IN_PROGRESS
            ? null
            : current.holdNotes,
      holdReasonCode:
        targetStatus === WorkOrderStatus.ON_HOLD
          ? (data.holdReasonCode ?? current.holdReasonCode ?? "OTHER").toString().toUpperCase()
          : current.status === WorkOrderStatus.ON_HOLD && targetStatus === WorkOrderStatus.IN_PROGRESS
            ? null
            : current.holdReasonCode,
      expectedResumeAt:
        targetStatus === WorkOrderStatus.ON_HOLD
          ? data.expectedResumeAt
            ? new Date(data.expectedResumeAt)
            : current.expectedResumeAt
          : current.status === WorkOrderStatus.ON_HOLD && targetStatus === WorkOrderStatus.IN_PROGRESS
            ? null
            : current.expectedResumeAt,
      acknowledgedAt:
        (targetStatus === WorkOrderStatus.ASSIGNED || targetStatus === WorkOrderStatus.IN_PROGRESS) &&
        !current.acknowledgedAt
          ? new Date()
          : current.acknowledgedAt,
      actualCost: authoritativeCompletion?.actualCost ?? current.actualCost,
      actualHours: authoritativeCompletion?.actualHours ?? current.actualHours,
      delayReason: data.delayReason?.trim() || current.delayReason,
      cancelledReason:
        targetStatus === WorkOrderStatus.CANCELLED
          ? assertReasonProvided("Cancel reason", data.cancelReason)
          : current.cancelledReason,
      technicianCompletionNote:
        targetStatus === WorkOrderStatus.TECHNICIAN_COMPLETED
          ? assertReasonProvided("Technician completion note", data.completionNote)
          : current.technicianCompletionNote,
      completionCondition:
        targetStatus === WorkOrderStatus.TECHNICIAN_COMPLETED
          ? data.completionCondition ?? current.completionCondition
          : current.completionCondition,
      followUpRequired:
        targetStatus === WorkOrderStatus.TECHNICIAN_COMPLETED
          ? Boolean(data.followUpRequired)
          : current.followUpRequired,
      followUpNote:
        targetStatus === WorkOrderStatus.TECHNICIAN_COMPLETED
          ? data.followUpNote?.trim() || null
          : current.followUpNote,
      verificationStatus,
      completedDate,
      failureCodeSnapshot:
        targetStatus === WorkOrderStatus.TECHNICIAN_COMPLETED
          ? data.failureCode?.trim() || current.failureCodeSnapshot
          : current.failureCodeSnapshot,
      causeCodeSnapshot:
        targetStatus === WorkOrderStatus.TECHNICIAN_COMPLETED
          ? data.causeCode?.trim() || current.causeCodeSnapshot
          : current.causeCodeSnapshot,
      remedyCodeSnapshot:
        targetStatus === WorkOrderStatus.TECHNICIAN_COMPLETED
          ? data.remedyCode?.trim() || current.remedyCodeSnapshot
          : current.remedyCodeSnapshot,
      lastIdempotencyKey: trimmedIdempotencyKey || current.lastIdempotencyKey,
      slaBreached: Boolean(slaDeadline && completedDate && completedDate.getTime() > slaDeadline.getTime()),
      version: { increment: 1 as const }
    };

    if (data.expectedVersion != null) {
      const updatedCount = await this.prisma.workOrder.updateMany({
        where: { id, version: data.expectedVersion },
        data: mutationData
      });
      if (updatedCount.count !== 1) {
        throw new ConflictException("Work order was updated by someone else. Refresh and retry.");
      }
    } else {
      await this.prisma.workOrder.update({
        where: { id },
        data: mutationData
      });
    }

    const updated = await this.findOneWithRelations(id, actor);

    if (
      authoritativeCompletion &&
      (targetStatus === WorkOrderStatus.TECHNICIAN_COMPLETED || targetStatus === WorkOrderStatus.COMPLETED)
    ) {
      await this.prisma.workOrderCostSnapshot.upsert({
        where: { workOrderId: id },
        update: {
          partsCost: authoritativeCompletion.partsCost,
          internalLabourCost: Math.max(0, authoritativeCompletion.actualCost - authoritativeCompletion.partsCost),
          totalCost: authoritativeCompletion.actualCost,
          snappedById: actor?.sub,
          notes:
            targetStatus === WorkOrderStatus.TECHNICIAN_COMPLETED
              ? "Authoritative snapshot at technician completion"
              : "Authoritative snapshot at close",
          lineItems: JSON.stringify(authoritativeCompletion)
        },
        create: {
          tenantId,
          workOrderId: id,
          partsCost: authoritativeCompletion.partsCost,
          internalLabourCost: Math.max(0, authoritativeCompletion.actualCost - authoritativeCompletion.partsCost),
          totalCost: authoritativeCompletion.actualCost,
          snappedById: actor?.sub,
          notes:
            targetStatus === WorkOrderStatus.TECHNICIAN_COMPLETED
              ? "Authoritative snapshot at technician completion"
              : "Authoritative snapshot at close",
          lineItems: JSON.stringify(authoritativeCompletion)
        }
      });
    }

    await this.appendStatusHistory(current.tenantId, id, {
      fromStatus: current.status,
      toStatus: targetStatus,
      action:
        targetStatus === WorkOrderStatus.ON_HOLD
          ? "ON_HOLD"
          : current.status === WorkOrderStatus.ON_HOLD && targetStatus === WorkOrderStatus.IN_PROGRESS
            ? "RESUMED"
            : targetStatus === WorkOrderStatus.TECHNICIAN_COMPLETED
              ? "TECHNICIAN_COMPLETED"
              : targetStatus === WorkOrderStatus.COMPLETED
                ? "COMPLETED"
                : "STATUS_CHANGE",
      actorId: actor?.sub,
      reason: data.delayReason || data.cancelReason || data.completionNote || data.emergencyCloseReason,
      metadata: trimmedIdempotencyKey ? { idempotencyKey: trimmedIdempotencyKey } : undefined
    });

    const auditEvent =
      targetStatus === WorkOrderStatus.COMPLETED
        ? "work_order_closed"
        : targetStatus === WorkOrderStatus.TECHNICIAN_COMPLETED
          ? "technician_completion_submitted"
          : targetStatus === WorkOrderStatus.CANCELLED
            ? "work_order_cancelled"
            : "work_order_status_updated";

    await this.recordAudit({
      entity: "WorkOrder",
      entityId: id,
      action: AuditAction.UPDATE,
      actor,
      reason:
        targetStatus === WorkOrderStatus.CANCELLED
          ? data.cancelReason
          : targetStatus === WorkOrderStatus.TECHNICIAN_COMPLETED
            ? data.completionNote
            : targetStatus === WorkOrderStatus.COMPLETED
              ? data.emergencyCloseReason ?? "Work order closed"
              : `Work order status updated to ${targetStatus}`,
      metadata: {
        event: auditEvent,
        woNumber: updated.woNumber,
        previousStatus: current.status,
        nextStatus: updated.status,
        actualCost: authoritativeCompletion?.actualCost ?? updated.actualCost ?? null,
        actualHours: authoritativeCompletion?.actualHours ?? updated.actualHours ?? null,
        idempotencyKey: trimmedIdempotencyKey ?? null
      },
      beforeData: {
        status: current.status,
        actualCost: current.actualCost ?? null,
        actualHours: current.actualHours ?? null
      },
      afterData: {
        status: updated.status,
        actualCost: updated.actualCost ?? null,
        actualHours: updated.actualHours ?? null,
        completedDate: updated.completedDate?.toISOString() ?? null
      }
    });

    try {
      await this.enterpriseOps?.onWorkOrderTransition(updated);
    } catch {
      // Status change remains authoritative; SLA/event side effects are non-blocking.
    }

    if (targetStatus === WorkOrderStatus.COMPLETED) {
      await this.notifyEnterpriseCompleted(updated, actor);
    }

    return this.findOneWithRelations(id, actor);
  }

  async verifySupervisor(
    id: string,
    data: {
      verificationNote?: string;
      actualCost?: number;
      actualHours?: number;
      delayReason?: string;
      overrideReason?: string;
      expectedVersion?: number;
      sodOverrideReason?: string;
    },
    actor?: Actor
  ) {
    if (!canVerifySupervisor(actor?.role as RoleName)) {
      throw new BadRequestException("Supervisor verification requires manager or admin role.");
    }

    const current = await this.findOne(id, actor);
    if (current.status !== WorkOrderStatus.TECHNICIAN_COMPLETED) {
      throw new BadRequestException("Only technician-completed work orders can be supervisor verified.");
    }

    await this.assertSegregationOfDuties(current, actor, data.sodOverrideReason);
    // Client actualCost/actualHours are ignored — server labour/parts are authoritative.
    const authoritative = await this.computeAuthoritativeHoursAndCost(id, actor);
    const actualCost =
      current.actualCost != null ? Number(current.actualCost) : authoritative.actualCost;
    const actualHours =
      current.actualHours != null ? Number(current.actualHours) : authoritative.actualHours;
    if (actualCost == null || actualHours == null || Number.isNaN(actualCost) || Number.isNaN(actualHours)) {
      throw new BadRequestException("Actual cost and hours are required before closing.");
    }

    const evidenceItems = await this.prisma.evidenceAttachment.findMany({
      where: { workOrderId: id, deletedAt: null, status: { not: "DELETED" } },
      select: { evidenceType: true, status: true, verificationStatus: true }
    });

    const overrideAllowed =
      Boolean(data.overrideReason?.trim()) && canOverrideCompletionBlock(actor?.role as RoleName);

    try {
      assertEvidenceForSupervisorVerification({
        workOrderType: current.type,
        items: evidenceItems,
        overrideReason: overrideAllowed ? data.overrideReason : undefined
      });
    } catch (error) {
      if (error instanceof BadRequestException) {
        await this.recordAudit({
          entity: "WorkOrder",
          entityId: id,
          action: AuditAction.UPDATE,
          actor,
          reason: error.message,
          metadata: { event: "supervisor_verification_blocked_missing_evidence", woNumber: current.woNumber }
        });
      }
      throw error;
    }

    const approver = this.assertActor(actor);
    const currentWithRequester = current as typeof current & {
      requesterConfirmationPolicyHours?: number | null;
    };
    const now = new Date();
    const requesterConfirmationPolicyHours = currentWithRequester.requesterConfirmationPolicyHours ?? 48;
    const requesterConfirmationDueAt = new Date(
      now.getTime() + requesterConfirmationPolicyHours * 60 * 60 * 1000
    );
    if (data.expectedVersion != null) {
      const updatedCount = await this.prisma.workOrder.updateMany({
        where: { id, version: data.expectedVersion },
        data: {
          status: WorkOrderStatus.VERIFIED,
          verificationStatus: WorkOrderVerificationStatus.VERIFIED,
          verifiedById: approver.sub,
          verifiedAt: now,
          verificationNote: data.verificationNote?.trim() || null,
          verificationRejectionReason: null,
          actualCost,
          actualHours,
          completedDate: current.completedDate ?? now,
          delayReason: data.delayReason?.trim() || current.delayReason,
          requesterConfirmationStatus: "PENDING",
          requesterConfirmationDueAt,
          requesterConfirmationPolicyHours,
          version: { increment: 1 }
        } as any
      });
      if (updatedCount.count !== 1) {
        throw new ConflictException("Work order was updated by someone else. Refresh and retry.");
      }
    } else {
      await this.prisma.workOrder.update({
        where: { id },
        data: {
          status: WorkOrderStatus.VERIFIED,
          verificationStatus: WorkOrderVerificationStatus.VERIFIED,
          verifiedById: approver.sub,
          verifiedAt: now,
          verificationNote: data.verificationNote?.trim() || null,
          verificationRejectionReason: null,
          actualCost,
          actualHours,
          completedDate: current.completedDate ?? now,
          delayReason: data.delayReason?.trim() || current.delayReason,
          requesterConfirmationStatus: "PENDING",
          requesterConfirmationDueAt,
          requesterConfirmationPolicyHours,
          version: { increment: 1 }
        } as any
      });
    }
    const updated = await this.findOneWithRelations(id, actor);

    await this.appendStatusHistory(current.tenantId, id, {
      fromStatus: current.status,
      toStatus: WorkOrderStatus.VERIFIED,
      action: "VERIFIED",
      actorId: approver.sub,
      reason: data.verificationNote
    });

    await this.recordAudit({
      entity: "WorkOrder",
      entityId: id,
      action: AuditAction.UPDATE,
      actor,
      reason: data.verificationNote ?? "Supervisor verified work order",
      metadata: { event: "work_order_supervisor_verified", woNumber: updated.woNumber },
      beforeData: { status: current.status, verificationStatus: current.verificationStatus },
      afterData: { status: updated.status, verificationStatus: updated.verificationStatus }
    });

    return this.findOneWithRelations(id, actor);
  }

  /** VERIFIED → CLOSED — final historical truth */
  async closeWorkOrder(
    id: string,
    note: string | undefined,
    actor?: Actor,
    options?: { expectedVersion?: number; overrideReason?: string }
  ) {
    if (!canVerifySupervisor(actor?.role as RoleName) && !canDirectlyCloseWorkOrder(actor?.role as RoleName)) {
      throw new ForbiddenException("Close requires supervisor or admin permission.");
    }
    const current = await this.findOne(id, actor);
    if (current.status === WorkOrderStatus.CLOSED) {
      // Idempotent replay: already closed — do not append duplicate CLOSED history.
      return this.findOneWithRelations(id, actor);
    }
    const currentWithRequester = current as typeof current & {
      requesterConfirmationStatus?: string | null;
      requesterConfirmationOutcome?: string | null;
      requesterConfirmationDueAt?: Date | null;
      requesterConfirmedAt?: Date | null;
      requesterConfirmationNote?: string | null;
    };
    assertAllowedStatusTransition(current.status, WorkOrderStatus.CLOSED);
    const overrideReason = options?.overrideReason?.trim();
    const now = new Date();
    if (
      currentWithRequester.requesterConfirmationStatus === "PENDING" &&
      (currentWithRequester.requesterConfirmationOutcome == null ||
        currentWithRequester.requesterConfirmationOutcome === "UNRESOLVED")
    ) {
      const dueAt = currentWithRequester.requesterConfirmationDueAt;
      const isHighPriority = current.priority === Priority.HIGH || current.priority === Priority.CRITICAL;
      const duePassed = Boolean(dueAt && dueAt.getTime() <= now.getTime());
      if (isHighPriority && !duePassed && !overrideReason) {
        throw new BadRequestException(
          "Requester confirmation is still pending for this priority work order. Provide an override reason to close early."
        );
      }
      if (!isHighPriority && duePassed && !currentWithRequester.requesterConfirmedAt) {
        await this.prisma.workOrder.update({
          where: { id },
          data: {
            requesterConfirmationOutcome: "AUTO_CLOSED",
            requesterConfirmationNote:
              currentWithRequester.requesterConfirmationNote ??
              "Auto-closed after requester confirmation window expired."
          } as any
        });
      }
    }
    const approver = this.assertActor(actor);
    if (options?.expectedVersion != null) {
      const updatedCount = await this.prisma.workOrder.updateMany({
        where: { id, version: options.expectedVersion },
        data: {
          status: WorkOrderStatus.CLOSED,
          closedAt: now,
          notes: note?.trim() || current.notes,
          version: { increment: 1 }
        }
      });
      if (updatedCount.count !== 1) {
        throw new ConflictException("Work order was updated by someone else. Refresh and retry.");
      }
    } else {
      await this.prisma.workOrder.update({
        where: { id },
        data: {
          status: WorkOrderStatus.CLOSED,
          closedAt: now,
          notes: note?.trim() || current.notes,
          version: { increment: 1 }
        }
      });
    }
    const updated = await this.findOneWithRelations(id, actor);
    await this.appendStatusHistory(current.tenantId, id, {
      fromStatus: current.status,
      toStatus: WorkOrderStatus.CLOSED,
      action: "CLOSED",
      actorId: approver.sub,
      reason: note
    });
    await this.recordAudit({
      entity: "WorkOrder",
      entityId: id,
      action: AuditAction.UPDATE,
      actor,
      reason: overrideReason ?? note ?? "Work order closed",
      metadata: {
        event: "work_order_closed",
        woNumber: updated.woNumber,
        closedById: approver.sub,
        requesterConfirmationOutcome: (updated as { requesterConfirmationOutcome?: string | null }).requesterConfirmationOutcome ?? null
      },
      beforeData: { status: current.status },
      afterData: { status: updated.status, closedAt: updated.closedAt }
    });
    await this.completePmOccurrenceForClosedWorkOrder(current);
    return this.findOneWithRelations(id, actor);
  }

  /**
   * Governed PM baseline advance: occurrence completes only when the WO is CLOSED
   * (not when the WO was merely generated).
   */
  private async completePmOccurrenceForClosedWorkOrder(workOrder: {
    id: string;
    tenantId: string;
    pmPlanId?: string | null;
    pmOccurrenceKey?: string | null;
  }) {
    if (!workOrder.pmPlanId) return;
    try {
      const occurrence = await this.prisma.pmOccurrence.findFirst({
        where: {
          tenantId: workOrder.tenantId,
          workOrderId: workOrder.id,
          status: { not: "COMPLETED" }
        }
      });
      const now = new Date();
      if (occurrence) {
        await this.prisma.pmOccurrence.update({
          where: { id: occurrence.id },
          data: { status: "COMPLETED", completedAt: now }
        });
      } else if (workOrder.pmOccurrenceKey) {
        await this.prisma.pmOccurrence.upsert({
          where: {
            tenantId_planId_generationKey: {
              tenantId: workOrder.tenantId,
              planId: workOrder.pmPlanId,
              generationKey: workOrder.pmOccurrenceKey
            }
          },
          create: {
            tenantId: workOrder.tenantId,
            planId: workOrder.pmPlanId,
            status: "COMPLETED",
            generationKey: workOrder.pmOccurrenceKey,
            workOrderId: workOrder.id,
            completedAt: now
          },
          update: {
            status: "COMPLETED",
            workOrderId: workOrder.id,
            completedAt: now
          }
        });
      }
      await this.prisma.pmPlan.update({
        where: { id: workOrder.pmPlanId },
        data: { lastCompletionAt: now }
      });
    } catch {
      // Baseline advance must not block WO close; Technical Admin can reconcile.
    }
  }

  async rejectSupervisor(id: string, reason: string, actor?: Actor) {
    if (!canVerifySupervisor(actor?.role as RoleName)) {
      throw new BadRequestException("Supervisor rejection requires manager or admin role.");
    }

    const trimmedReason = assertReasonProvided("Supervisor rejection reason", reason);
    const current = await this.findOne(id, actor);
    if (current.status !== WorkOrderStatus.TECHNICIAN_COMPLETED) {
      throw new BadRequestException("Only technician-completed work orders can be rejected by a supervisor.");
    }

    const updated = await this.prisma.workOrder.update({
      where: { id },
      data: {
        status: WorkOrderStatus.REWORK_REQUIRED,
        verificationStatus: WorkOrderVerificationStatus.REJECTED,
        verificationRejectionReason: trimmedReason,
        version: { increment: 1 }
      }
    });

    await this.appendStatusHistory(current.tenantId, id, {
      fromStatus: current.status,
      toStatus: WorkOrderStatus.REWORK_REQUIRED,
      action: "REWORK_REQUIRED",
      actorId: actor?.sub,
      reason: trimmedReason
    });

    await this.recordAudit({
      entity: "WorkOrder",
      entityId: id,
      action: AuditAction.UPDATE,
      actor,
      reason: trimmedReason,
      metadata: { event: "work_order_supervisor_rejected", woNumber: updated.woNumber },
      beforeData: { status: current.status },
      afterData: { status: updated.status, verificationRejectionReason: trimmedReason }
    });

    return this.findOneWithRelations(id, actor);
  }

  async recordRequesterConfirmation(
    id: string,
    data: {
      outcome: "RESOLVED" | "UNRESOLVED";
      note?: string;
      overrideReason?: string;
    },
    actor?: Actor
  ) {
    const approver = this.assertActor(actor);
    const current = await this.findOne(id, actor);
    const updated = await this.prisma.workOrder.update({
      where: { id },
      data: {
        requesterConfirmationStatus: "CONFIRMED",
        requesterConfirmationOutcome: data.outcome,
        requesterConfirmationNote: data.note?.trim() || null,
        requesterConfirmedAt: new Date(),
        requesterConfirmedById: approver.sub,
        version: { increment: 1 }
      } as any
    });

    await this.recordAudit({
      entity: "WorkOrder",
      entityId: id,
      action: AuditAction.UPDATE,
      actor,
      reason: data.overrideReason?.trim() || data.note?.trim() || "Requester confirmation recorded",
      metadata: {
        event: "work_order_requester_confirmation_recorded",
        woNumber: current.woNumber,
        outcome: data.outcome
      }
    });

    return updated;
  }

  async correctLabourEntry(
    workOrderId: string,
    entryId: string,
    data: { requestedDurationMinutes: number; reason: string },
    actor?: Actor
  ) {
    await this.findOne(workOrderId, actor);
    const approver = this.assertActor(actor);
    const trimmedReason = assertLabourCorrectionReason(data.reason);
    if (!Number.isFinite(data.requestedDurationMinutes) || data.requestedDurationMinutes < 0) {
      throw new BadRequestException("Corrected duration must be zero or greater.");
    }
    const entry = await this.prisma.workOrderLabourEntry.findFirst({
      where: { id: entryId, workOrderId }
    }) as
      | ({
          id: string;
          durationMinutes?: number | null;
          correctedDurationMinutes?: number | null;
          correctionApprovedById?: string | null;
        } & Record<string, unknown>)
      | null;
    if (!entry) {
      throw new NotFoundException("Labour entry not found");
    }

    const canApprove =
      actor?.role === RoleName.SUPER_ADMIN ||
      actor?.role === RoleName.ADMIN ||
      actor?.role === RoleName.MANAGER ||
      actor?.role === RoleName.OPERATIONS_MANAGER ||
      actor?.role === RoleName.ASSET_MANAGER ||
      actor?.role === RoleName.SUPERVISOR;
    const updated = await this.prisma.workOrderLabourEntry.update({
      where: { id: entryId },
      data: {
        correctedDurationMinutes: Math.round(data.requestedDurationMinutes),
        correctionReason: trimmedReason,
        correctedById: approver.sub,
        correctedAt: new Date(),
        correctionApprovedById: canApprove ? approver.sub : entry.correctionApprovedById
      } as any
    }) as {
      correctedDurationMinutes?: number | null;
      correctionApprovedById?: string | null;
    };

    await this.recordAudit({
      entity: "WorkOrderLabourEntry",
      entityId: entryId,
      action: AuditAction.UPDATE,
      actor,
      reason: trimmedReason,
      metadata: {
        event: "work_order_labour_corrected",
        workOrderId,
        requestedDurationMinutes: data.requestedDurationMinutes
      },
      beforeData: {
        correctedDurationMinutes: entry.correctedDurationMinutes ?? entry.durationMinutes ?? null
      },
      afterData: {
        correctedDurationMinutes: updated.correctedDurationMinutes ?? null,
        correctionApprovedById: updated.correctionApprovedById ?? null
      }
    });

    return updated;
  }

  async getNextActions(id: string, actor?: Actor) {
    const current = await this.findOneWithRelations(id, actor);
    const assigneeCount = await this.prisma.workOrderAssignee.count({
      where: {
        workOrderId: id,
        assignmentStatus: { not: "REMOVED" }
      }
    });
    const partsSummary = await this.workOrderPartsService.getCostSummary(id, actor);
    return {
      actions: getValidWorkOrderActions(current.status),
      readiness: deriveReadiness({
        status: current.status,
        hasTechnician: Boolean(current.technicianId) || assigneeCount > 0,
        plannedStartAt: current.plannedStartAt,
        dueDate: current.dueDate,
        approvalOk:
          current.approvalStatus !== WorkOrderApprovalStatus.PENDING &&
          current.approvalStatus !== WorkOrderApprovalStatus.REJECTED,
        partsBlocked: (partsSummary.unaccountedLines ?? 0) > 0
      })
    };
  }

  async reopenWorkOrder(id: string, reason: string, actor?: Actor) {
    if (!canReopenWorkOrder(actor?.role as RoleName)) {
      throw new BadRequestException("Reopening work orders requires admin permission.");
    }

    const trimmedReason = assertReasonProvided("Reopen reason", reason);
    const current = await this.findOne(id, actor);
    const reopenable = new Set<WorkOrderStatus>([
      WorkOrderStatus.COMPLETED,
      WorkOrderStatus.CLOSED,
      WorkOrderStatus.CANCELLED,
      WorkOrderStatus.VERIFIED
    ]);
    if (!reopenable.has(current.status) && !TERMINAL_WORK_ORDER_STATUSES.has(current.status)) {
      throw new BadRequestException(
        "Only verified, closed, completed, or cancelled work orders can be reopened."
      );
    }

    // Cancelled/closed reopen must not casually bypass Phase 7 controls when rules exist.
    const processType =
      current.status === WorkOrderStatus.CANCELLED ||
      current.status === WorkOrderStatus.CLOSED ||
      current.status === WorkOrderStatus.COMPLETED
        ? ApprovalProcessType.WORK_ORDER_REOPEN
        : ApprovalProcessType.CLOSED_RECORD_CORRECTION;

    if (this.approvalsService && actor?.sub) {
      const ensure = await this.approvalsService.ensureApprovalRequired({
        actor,
        processType,
        trigger:
          processType === ApprovalProcessType.WORK_ORDER_REOPEN
            ? ApprovalTrigger.BEFORE_REOPEN
            : ApprovalTrigger.BEFORE_CORRECTION,
        subjectEntityType: "WorkOrder",
        subjectEntityId: id,
        context: {
          processType,
          priority: current.priority,
          workType: current.type,
          estimatedCost: current.estimatedCost != null ? Number(current.estimatedCost) : null,
          actualCost: current.actualCost != null ? Number(current.actualCost) : null,
          siteId: current.siteId,
          departmentId: current.departmentId,
          domainId: current.domainId,
          status: current.status
        },
        sourceContext: {
          reason: trimmedReason,
          previousStatus: current.status
        }
      });

      if (ensure.configError) {
        throw new BadRequestException(ensure.configError);
      }

      if (ensure.required && ensure.status !== ApprovalRequestStatus.APPROVED) {
        throw new BadRequestException({
          message:
            "Reopening this work order requires approval. It will reopen when the approval completes.",
          code: "APPROVAL_REQUIRED",
          approvalRequestId: ensure.approvalRequestId,
          processType,
          previousStatus: current.status
        });
      }
    }

    const approver = this.assertActor(actor);
    const updated = await this.prisma.workOrder.update({
      where: { id },
      data: {
        status: WorkOrderStatus.IN_PROGRESS,
        completedDate: null,
        closedAt: null,
        verificationStatus: WorkOrderVerificationStatus.PENDING,
        verifiedById: null,
        verifiedAt: null,
        verificationNote: null,
        verificationRejectionReason: null,
        reopenReason: trimmedReason,
        reopenedAt: new Date(),
        reopenedById: approver.sub,
        correctionReason: trimmedReason
      }
    });

    await this.recordAudit({
      entity: "WorkOrder",
      entityId: id,
      action: AuditAction.UPDATE,
      actor,
      reason: trimmedReason,
      metadata: { event: "work_order_reopened", woNumber: updated.woNumber },
      beforeData: { status: current.status },
      afterData: { status: updated.status, reopenReason: trimmedReason }
    });

    return this.findOneWithRelations(id, actor);
  }

  private async findOneWithRelations(id: string, actor?: Actor) {
    const tenantId = this.resolveTenantId(actor);
    const where: Prisma.WorkOrderWhereInput = { id };

    where.tenantId = tenantId;

    const workOrder = await this.prisma.workOrder.findFirst({
      where,
      include: {
        asset: true,
        vehicle: true,
        technician: { select: PUBLIC_USER_SUMMARY_SELECT },
        createdBy: { select: PUBLIC_USER_SUMMARY_SELECT },
        parts: {
          include: {
            part: true
          }
        }
      }
    });

    if (!workOrder) {
      throw new NotFoundException("Work order not found");
    }

    return workOrder;
  }

  async addPart(
    id: string,
    data: { partId: string; quantity: number; unitCost: number; reason?: string; overrideReason?: string },
    actor?: Actor
  ) {
    this.workOrderPartsService.assertStorekeeperCanIssue(actor?.role as RoleName);
    const tenantId = this.resolveTenantId(actor);
    const workOrder = await this.findOne(id, actor);
    await this.workOrderPartsService.assertWorkOrderForParts(id, actor);

    if (FRAUD_CONTROL_ENABLED) {
      assertFraudReasonProvided(
        "Emergency parts issue override reason",
        data.overrideReason ?? data.reason
      );
    }

    if (!Number.isFinite(data.quantity) || data.quantity <= 0) {
      throw new BadRequestException("Part quantity must be greater than 0");
    }

    const existingLine = await this.prisma.workOrderPart.findFirst({
      where: { workOrderId: id, partId: data.partId }
    });
    if (existingLine) {
      throw new BadRequestException(
        "This part is already linked to the work order. Request additional quantity through a controlled issue with reason."
      );
    }

    const part = await this.prisma.sparePart.findFirst({
      where: {
        id: data.partId,
        isActive: true,
        tenantId
      }
    });

    if (!part) {
      throw new NotFoundException("Spare part not found");
    }

    if ((part.availableQuantity ?? Math.max(0, part.quantityInStock - (part.reservedQuantity ?? 0))) < data.quantity) {
      throw new BadRequestException("Parts used in a work order cannot exceed available stock");
    }

    const totalCost = data.quantity * data.unitCost;
    const issuer = this.assertActor(actor);

    const issued = await this.stockEngine.issue({
      actor,
      partId: data.partId,
      quantity: data.quantity,
      workOrderId: workOrder.id,
      vehicleId: workOrder.vehicleId ?? undefined,
      notes: "Deducted via work order add-part",
      reason: data.overrideReason?.trim() || data.reason?.trim(),
      sourceType: "WORK_ORDER",
      sourceDocument: workOrder.woNumber,
      sourceLineKey: `wo-add-part:${workOrder.id}:${data.partId}`
    });

    const createdPart = await this.prisma.workOrderPart.create({
      data: {
        tenantId,
        workOrderId: id,
        partId: data.partId,
        quantity: data.quantity,
        unitCost: data.unitCost,
        totalCost,
        lineStatus: "ISSUED",
        requestedQuantity: data.quantity,
        approvedQuantity: data.quantity,
        issuedQuantity: data.quantity,
        usedQuantity: 0,
        returnedQuantity: 0,
        requestedById: issuer.sub,
        approvedById: null,
        issuedById: issuer.sub,
        issueReason: data.overrideReason?.trim() || data.reason?.trim() || null
      }
    });

    await this.recordAudit({
      entity: "PART_STOCK_ISSUE",
      entityId: createdPart.id,
      action: AuditAction.UPDATE,
      actor,
      reason: "Stock issued from direct work-order part add",
      metadata: {
        workOrderId: workOrder.id,
        partId: data.partId,
        quantity: data.quantity,
        unitCost: data.unitCost,
        totalCost,
        event: FRAUD_CONTROL_ENABLED ? FRAUD_AUDIT_EVENTS.PARTS_ISSUE_OVERRIDE : "parts_issued_against_work_order",
        overrideFlag: FRAUD_CONTROL_ENABLED,
        source: "work_orders.addPart",
        movementId: issued.movement.id
      }
    });

    return createdPart;
  }

  async listPartRequests(workOrderId: string, actor?: Actor) {
    await this.findOne(workOrderId, actor);
    const tenantId = this.resolveTenantId(actor);

    return this.prisma.partRequest.findMany({
      where: {
        workOrderId,
        tenantId
      },
      include: {
        part: true,
        requestedBy: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true
          }
        },
        approvals: {
          include: {
            actor: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                email: true
              }
            }
          },
          orderBy: {
            sequence: "asc"
          }
        },
        issues: {
          orderBy: {
            createdAt: "desc"
          }
        }
      },
      orderBy: {
        createdAt: "desc"
      }
    });
  }

  async createPartRequest(
    workOrderId: string,
    data: {
      partId: string;
      quantity: number;
      unitCost?: number;
      reason?: string;
      pettyCash?: boolean;
    },
    actor?: Actor
  ) {
    const requester = this.assertActor(actor);
    const tenantId = this.resolveTenantId(actor);
    const workOrder = await this.findOne(workOrderId, actor);
    await this.workOrderPartsService.assertWorkOrderForParts(workOrderId, actor);

    if (!Number.isFinite(data.quantity) || data.quantity <= 0) {
      throw new BadRequestException("Requested quantity must be greater than 0");
    }

    const duplicateRequest = await this.prisma.partRequest.findFirst({
      where: {
        workOrderId,
        partId: data.partId,
        status: { notIn: [PartRequestStatus.REJECTED, PartRequestStatus.CANCELLED] }
      }
    });
    if (duplicateRequest) {
      throw new BadRequestException("A pending or approved part request already exists for this part on this work order.");
    }

    const part = await this.prisma.sparePart.findFirst({
      where: {
        id: data.partId,
        isActive: true,
        tenantId
      }
    });

    if (!part) {
      throw new NotFoundException("Spare part not found");
    }

    const unitCostSnapshot = Number(data.unitCost ?? part.unitCost);
    if (!Number.isFinite(unitCostSnapshot) || unitCostSnapshot <= 0) {
      throw new BadRequestException("Unit cost must be greater than 0");
    }

    const totalCost = unitCostSnapshot * data.quantity;
    const approvalTier = resolvePartApprovalTier(totalCost);
    const requiresFinanceApproval = this.requiresFinanceApproval(totalCost, data.pettyCash);
    const procurementRequired = requiresProcurement(part.quantityInStock, data.quantity);

    const created = await this.prisma.$transaction(async (tx) => {
      const partRequest = await tx.partRequest.create({
        data: {
          tenantId,
          workOrderId,
          partId: data.partId,
          requestedById: requester.sub,
          requestedQuantity: data.quantity,
          unitCostSnapshot,
          reason: data.reason?.trim() || null,
          requiresFinanceApproval,
          status: PartRequestStatus.PENDING_OPERATIONAL
        }
      });

      const approvalRows = [
        {
          tenantId,
          partRequestId: partRequest.id,
          stage: ApprovalStage.OPERATIONAL,
          sequence: 1,
          status: ApprovalDecisionStatus.PENDING
        },
        {
          tenantId,
          partRequestId: partRequest.id,
          stage: ApprovalStage.FINANCE,
          sequence: 2,
          status: requiresFinanceApproval
            ? ApprovalDecisionStatus.PENDING
            : ApprovalDecisionStatus.SKIPPED,
          reason: requiresFinanceApproval
            ? null
            : "Finance approval not required"
        }
      ];

      for (const approvalRow of approvalRows) {
        await tx.partRequestApproval.create({ data: approvalRow });
      }

      return partRequest;
    });

    await this.workOrderPartsService.createRequestedLine({
      workOrderId,
      partRequestId: created.id,
      partId: data.partId,
      requestedQuantity: data.quantity,
      unitCost: unitCostSnapshot,
      requestedById: requester.sub,
      tenantId,
      approvalTier,
      procurementRequired,
      actor
    });

    await this.recordAudit({
      entity: "PART_REQUEST",
      entityId: created.id,
      action: AuditAction.CREATE,
      actor,
      reason: data.reason,
      metadata: {
        workOrderId,
        partId: data.partId,
        requestedQuantity: data.quantity,
        unitCostSnapshot,
        totalCost,
        requiresFinanceApproval,
        pettyCash: Boolean(data.pettyCash),
        approvalTier,
        procurementRequired
      }
    });

    await this.notificationsService.createNotification({
      userId: workOrder.createdById,
      title: "Part request submitted",
      message: `Part request submitted for work order ${workOrder.woNumber}`,
      type: NotificationType.PART_REQUEST_SUBMITTED,
      priority: NotificationPriority.WARNING,
      referenceId: created.id,
      referenceType: "PartRequest",
      metadata: {
        workOrderId,
        partId: data.partId,
        quantity: data.quantity,
        requiresFinanceApproval
      }
    });

    return this.getPartRequest(workOrderId, created.id, actor);
  }

  async approvePartRequestOperational(
    workOrderId: string,
    requestId: string,
    data: { approvedQuantity?: number; reason?: string },
    actor?: Actor
  ) {
    const approver = this.assertActor(actor);
    const request = await this.getPartRequest(workOrderId, requestId, actor);

    assertMakerCheckerSeparation({
      requesterId: request.requestedById,
      approverId: approver.sub,
      approverRole: actor?.role,
      flow: "part request operational approval"
    });

    if (request.status !== PartRequestStatus.PENDING_OPERATIONAL) {
      throw new BadRequestException("Part request is not awaiting operational approval");
    }

    const approvedQuantity = data.approvedQuantity ?? request.requestedQuantity;

    if (!Number.isFinite(approvedQuantity) || approvedQuantity <= 0) {
      throw new BadRequestException("Approved quantity must be greater than 0");
    }

    if (approvedQuantity > request.requestedQuantity) {
      throw new BadRequestException("Approved quantity cannot exceed requested quantity");
    }

    const nextStatus = request.requiresFinanceApproval
      ? PartRequestStatus.PENDING_FINANCE
      : PartRequestStatus.APPROVED;

    await this.prisma.$transaction(async (tx) => {
      await tx.partRequest.update({
        where: { id: requestId },
        data: {
          approvedQuantity,
          status: nextStatus,
          rejectionReason: null
        }
      });

      await tx.partRequestApproval.update({
        where: {
          partRequestId_stage: {
            partRequestId: requestId,
            stage: ApprovalStage.OPERATIONAL
          }
        },
        data: {
          status: ApprovalDecisionStatus.APPROVED,
          actorId: approver.sub,
          actedAt: new Date(),
          reason: data.reason?.trim() || null
        }
      });

      if (!request.requiresFinanceApproval) {
        await tx.partRequestApproval.update({
          where: {
            partRequestId_stage: {
              partRequestId: requestId,
              stage: ApprovalStage.FINANCE
            }
          },
          data: {
            status: ApprovalDecisionStatus.SKIPPED,
            reason: "Finance approval not required"
          }
        });
      }
    });

    if (!request.requiresFinanceApproval) {
      await this.workOrderPartsService.syncApprovedLine(requestId, approvedQuantity, approver.sub, actor);
      await this.reserveApprovedPartRequest(workOrderId, requestId, approvedQuantity, actor);
    }

    await this.recordAudit({
      entity: "PART_REQUEST_APPROVAL",
      entityId: requestId,
      action: AuditAction.UPDATE,
      actor,
      reason: data.reason,
      metadata: {
        stage: ApprovalStage.OPERATIONAL,
        approvedQuantity,
        nextStatus
      }
    });

    await this.notificationsService.createNotification({
      userId: request.requestedById,
      title: request.requiresFinanceApproval ? "Part request pending finance approval" : "Part request approved",
      message: request.requiresFinanceApproval
        ? "Operational approval complete. Finance approval is pending."
        : "Your part request has been approved.",
      type: NotificationType.PART_REQUEST_APPROVED,
      priority: NotificationPriority.INFO,
      referenceId: request.id,
      referenceType: "PartRequest",
      metadata: {
        stage: "OPERATIONAL",
        approvedQuantity,
        requiresFinanceApproval: request.requiresFinanceApproval
      }
    });

    return this.getPartRequest(workOrderId, requestId, actor);
  }

  async approvePartRequestFinance(
    workOrderId: string,
    requestId: string,
    data: { approvedQuantity?: number; reason?: string },
    actor?: Actor
  ) {
    const approver = this.assertActor(actor);
    const request = await this.getPartRequest(workOrderId, requestId, actor);

    assertMakerCheckerSeparation({
      requesterId: request.requestedById,
      approverId: approver.sub,
      approverRole: actor?.role,
      flow: "part request finance approval"
    });

    const operationalApproval = request.approvals?.find((item) => item.stage === ApprovalStage.OPERATIONAL);
    if (operationalApproval?.actorId) {
      assertMakerCheckerSeparation({
        requesterId: operationalApproval.actorId,
        approverId: approver.sub,
        approverRole: actor?.role,
        flow: "part request operational and finance approval"
      });
    }

    if (request.status !== PartRequestStatus.PENDING_FINANCE) {
      throw new BadRequestException("Part request is not awaiting finance approval");
    }

    const approvedQuantity = data.approvedQuantity ?? request.approvedQuantity ?? request.requestedQuantity;

    if (!Number.isFinite(approvedQuantity) || approvedQuantity <= 0) {
      throw new BadRequestException("Approved quantity must be greater than 0");
    }

    if (approvedQuantity > request.requestedQuantity) {
      throw new BadRequestException("Approved quantity cannot exceed requested quantity");
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.partRequest.update({
        where: { id: requestId },
        data: {
          approvedQuantity,
          status: PartRequestStatus.APPROVED,
          rejectionReason: null
        }
      });

      await tx.partRequestApproval.update({
        where: {
          partRequestId_stage: {
            partRequestId: requestId,
            stage: ApprovalStage.FINANCE
          }
        },
        data: {
          status: ApprovalDecisionStatus.APPROVED,
          actorId: approver.sub,
          actedAt: new Date(),
          reason: data.reason?.trim() || null
        }
      });
    });

    await this.workOrderPartsService.syncApprovedLine(requestId, approvedQuantity, approver.sub, actor);
    await this.reserveApprovedPartRequest(workOrderId, requestId, approvedQuantity, actor);

    await this.recordAudit({
      entity: "PART_REQUEST_APPROVAL",
      entityId: requestId,
      action: AuditAction.UPDATE,
      actor,
      reason: data.reason,
      metadata: {
        stage: ApprovalStage.FINANCE,
        approvedQuantity,
        nextStatus: PartRequestStatus.APPROVED
      }
    });

    await this.notificationsService.createNotification({
      userId: request.requestedById,
      title: "Part request approved",
      message: "Finance approval complete. Your part request is approved.",
      type: NotificationType.PART_REQUEST_APPROVED,
      priority: NotificationPriority.INFO,
      referenceId: request.id,
      referenceType: "PartRequest",
      metadata: {
        stage: "FINANCE",
        approvedQuantity
      }
    });

    return this.getPartRequest(workOrderId, requestId, actor);
  }

  async rejectPartRequest(
    workOrderId: string,
    requestId: string,
    data: { reason: string; stage?: "OPERATIONAL" | "FINANCE" },
    actor?: Actor
  ) {
    const approver = this.assertActor(actor);
    const request = await this.getPartRequest(workOrderId, requestId, actor);

    if (!data.reason?.trim()) {
      throw new BadRequestException("Rejection reason is required");
    }

    if (request.status === PartRequestStatus.ISSUED || request.status === PartRequestStatus.PARTIALLY_ISSUED) {
      throw new BadRequestException("Cannot reject a request that has already been issued");
    }

    const stage = data.stage
      ? (data.stage as ApprovalStage)
      : request.status === PartRequestStatus.PENDING_FINANCE
        ? ApprovalStage.FINANCE
        : ApprovalStage.OPERATIONAL;

    await this.prisma.$transaction(async (tx) => {
      await tx.partRequest.update({
        where: { id: requestId },
        data: {
          status: PartRequestStatus.REJECTED,
          rejectionReason: data.reason.trim()
        }
      });

      await tx.partRequestApproval.update({
        where: {
          partRequestId_stage: {
            partRequestId: requestId,
            stage
          }
        },
        data: {
          status: ApprovalDecisionStatus.REJECTED,
          actorId: approver.sub,
          actedAt: new Date(),
          reason: data.reason.trim()
        }
      });
    });

    await this.releaseReservedPartRequest(requestId, actor);
    await this.workOrderPartsService.syncRejectedLine(requestId, data.reason.trim(), actor);

    await this.recordAudit({
      entity: "PART_REQUEST_APPROVAL",
      entityId: requestId,
      action: AuditAction.UPDATE,
      actor,
      reason: data.reason,
      metadata: {
        stage,
        nextStatus: PartRequestStatus.REJECTED
      }
    });

    await this.notificationsService.createNotification({
      userId: request.requestedById,
      title: "Part request rejected",
      message: "Your part request was rejected. Please review the reason and resubmit if needed.",
      type: NotificationType.PART_REQUEST_REJECTED,
      priority: NotificationPriority.WARNING,
      referenceId: request.id,
      referenceType: "PartRequest",
      metadata: {
        stage,
        reason: data.reason.trim()
      }
    });

    return this.getPartRequest(workOrderId, requestId, actor);
  }

  async issuePartRequest(
    workOrderId: string,
    requestId: string,
    data: { quantity?: number; notes?: string; storeLocation?: string },
    actor?: Actor
  ) {
    const issuer = this.assertActor(actor);
    this.workOrderPartsService.assertStorekeeperCanIssue(actor?.role as RoleName);
    await this.workOrderPartsService.assertWorkOrderForParts(workOrderId, actor);
    const request = await this.getPartRequest(workOrderId, requestId, actor);

    if (request.requestedById === issuer.sub) {
      await this.recordAudit({
        entity: "PART_ISSUE",
        entityId: requestId,
        action: AuditAction.UPDATE,
        actor,
        reason: "technician_self_issue_blocked",
        metadata: {
          event: FRAUD_AUDIT_EVENTS.TECHNICIAN_SELF_ISSUE_BLOCKED,
          workOrderId,
          partRequestId: requestId,
          requestedById: request.requestedById
        }
      });
      throw new ForbiddenException("The same user cannot request and issue parts for this work order.");
    }

    if (request.status !== PartRequestStatus.APPROVED && request.status !== PartRequestStatus.PARTIALLY_ISSUED) {
      throw new BadRequestException("Part request must be approved before stock issue");
    }

    const approvedQuantity = request.approvedQuantity ?? request.requestedQuantity;
    const remaining = approvedQuantity - request.issuedQuantity;
    const issueQuantity = data.quantity ?? remaining;

    assertIssueQuantity(approvedQuantity, request.issuedQuantity, issueQuantity);

    if (!Number.isFinite(issueQuantity) || issueQuantity <= 0) {
      throw new BadRequestException("Issue quantity must be greater than 0");
    }

    if (issueQuantity > remaining) {
      throw new BadRequestException("Issue quantity cannot exceed remaining approved quantity");
    }

    const line = await this.prisma.workOrderPart.findFirst({
      where: { partRequestId: request.id, tenantId: request.tenantId ?? this.resolveTenantId(actor) }
    });
    const consumeReservation = (line?.reservedQuantity ?? 0) >= issueQuantity;
    const available = request.part.availableQuantity ?? Math.max(0, request.part.quantityInStock - (request.part.reservedQuantity ?? 0));
    if (!consumeReservation && available < issueQuantity) {
      throw new BadRequestException("Insufficient available stock for this issue request");
    }
    if (consumeReservation && (request.part.reservedQuantity ?? 0) < issueQuantity) {
      throw new BadRequestException("Insufficient reserved stock for this issue request");
    }

    const result = await this.prisma.$transaction(async (tx) => {
      await this.stockEngine.issue(
        {
          actor,
          partId: request.partId,
          quantity: issueQuantity,
          workOrderId: request.workOrderId,
          vehicleId: request.workOrder?.vehicleId ?? undefined,
          notes: data.notes?.trim() || "Issued via approved part request",
          consumeReservation,
          sourceType: "WORK_ORDER",
          sourceDocument: `part-request:${request.id}`,
          sourceLineKey: `wo-issue:${request.id}:${issueQuantity}:${request.issuedQuantity}`
        },
        tx
      );

      if (consumeReservation && line) {
        await tx.workOrderPart.update({
          where: { id: line.id },
          data: { reservedQuantity: { decrement: issueQuantity } }
        });
      }

      const issue = await tx.partIssue.create({
        data: {
          tenantId: request.tenantId,
          partRequestId: request.id,
          workOrderId: request.workOrderId,
          partId: request.partId,
          issuedById: issuer.sub,
          quantity: issueQuantity,
          notes: data.notes?.trim() || null
        }
      });

      const issuedQuantity = request.issuedQuantity + issueQuantity;
      await tx.partRequest.update({
        where: { id: request.id },
        data: {
          issuedQuantity,
          status: issuedQuantity >= approvedQuantity
            ? PartRequestStatus.ISSUED
            : PartRequestStatus.PARTIALLY_ISSUED
        }
      });

      return issue;
    });

    await this.workOrderPartsService.syncIssuedLine({
      partRequestId: requestId,
      issueQuantity,
      issuedById: issuer.sub,
      issueNote: data.notes,
      storeLocation: data.storeLocation,
      actor
    });

    await this.recordAudit({
      entity: "PART_ISSUE",
      entityId: result.id,
      action: AuditAction.UPDATE,
      actor,
      reason: data.notes,
      metadata: {
        event: FRAUD_AUDIT_EVENTS.PARTS_ISSUED_AGAINST_WORK_ORDER,
        partRequestId: request.id,
        workOrderId: request.workOrderId,
        partId: request.partId,
        quantity: issueQuantity,
        remainingAfterIssue: remaining - issueQuantity
      }
    });

    await this.notificationsService.createNotification({
      userId: request.requestedById,
      title: "Part issue completed",
      message: "Stock has been issued against your approved request.",
      type: NotificationType.PART_ISSUE_COMPLETED,
      priority: NotificationPriority.INFO,
      referenceId: request.id,
      referenceType: "PartRequest",
      metadata: {
        issueId: result.id,
        quantity: issueQuantity
      }
    });

    return this.getPartRequest(workOrderId, requestId, actor);
  }

  async getPartRequest(workOrderId: string, requestId: string, actor?: Actor) {
    await this.findOne(workOrderId, actor);
    const tenantId = this.resolveTenantId(actor);

    const request = await this.prisma.partRequest.findFirst({
      where: {
        id: requestId,
        workOrderId,
        tenantId
      },
      include: {
        part: true,
        workOrder: true,
        approvals: {
          include: {
            actor: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                email: true
              }
            }
          },
          orderBy: {
            sequence: "asc"
          }
        },
        issues: {
          orderBy: {
            createdAt: "desc"
          }
        }
      }
    });

    if (!request) {
      throw new NotFoundException("Part request not found");
    }

    return request;
  }

  async parts(id: string, actor?: Actor) {
    await this.findOne(id, actor);
    return this.workOrderPartsService.listLines(id, actor);
  }

  async addNote(id: string, note: string, actor?: Actor) {
    const trimmed = note?.trim() ?? "";
    if (trimmed.length < 1) {
      throw new BadRequestException("Note cannot be blank.");
    }
    if (trimmed.length > 4000) {
      throw new BadRequestException("Note exceeds maximum length.");
    }

    const current = await this.findOne(id, actor);
    const existing = current.notes ? `${current.notes}\n` : "";
    const stamped = `[${new Date().toISOString()}] ${trimmed}`;

    const updated = await this.prisma.workOrder.update({
      where: { id },
      data: {
        notes: `${existing}${stamped}`
      }
    });

    await this.recordAudit({
      entity: "WorkOrder",
      entityId: id,
      action: AuditAction.UPDATE,
      actor,
      reason: "Work note added",
      metadata: {
        event: "work_order_note_added",
        woNumber: current.woNumber,
        noteLength: trimmed.length
      }
    });

    return updated;
  }

  async addAttachment(id: string, attachmentUrl: string, actor?: Actor) {
    const current = await this.findOne(id, actor);

    return this.prisma.workOrder.update({
      where: { id },
      data: {
        attachments: stringArrayToText([...toStringArray(current.attachments), attachmentUrl])
      }
    });
  }

  async changeTaxonomy(
    id: string,
    input: {
      taxonomyCategoryId: string;
      taxonomyTypeId: string;
      taxonomyIssueId?: string;
      reason: string;
    },
    actor?: Actor
  ) {
    const existing = await this.findOne(id, actor);
    this.assertActor(actor);
    assertReasonProvided(input.reason, "Category change reason is required");

    const role = actor!.role as RoleName;
    const started =
      existing.status !== WorkOrderStatus.OPEN &&
      existing.status !== WorkOrderStatus.ON_HOLD &&
      !TERMINAL_WORK_ORDER_STATUSES.has(existing.status);

    const closed =
      existing.status === WorkOrderStatus.COMPLETED ||
      existing.status === WorkOrderStatus.TECHNICIAN_COMPLETED ||
      existing.status === WorkOrderStatus.CANCELLED;

    const supervisorRoles = new Set<RoleName>([
      RoleName.SUPERVISOR,
      RoleName.MANAGER,
      RoleName.OPERATIONS_MANAGER,
      RoleName.ASSET_MANAGER,
      RoleName.ADMIN,
      RoleName.SUPER_ADMIN
    ]);
    const managerRoles = new Set<RoleName>([
      RoleName.MANAGER,
      RoleName.OPERATIONS_MANAGER,
      RoleName.ASSET_MANAGER,
      RoleName.ADMIN,
      RoleName.SUPER_ADMIN
    ]);
    const adminRoles = new Set<RoleName>([RoleName.ADMIN, RoleName.SUPER_ADMIN]);

    if (closed && !adminRoles.has(role)) {
      throw new ForbiddenException("Only administrators can change category after completion or closure.");
    }
    if (started && !closed && !managerRoles.has(role)) {
      throw new ForbiddenException("Only managers or administrators can change category after work has started.");
    }
    if (!started && !supervisorRoles.has(role)) {
      throw new ForbiddenException("You do not have permission to change work order category.");
    }

    const tenantId = this.resolveTenantId(actor);
    const taxonomy = await this.workOrderTaxonomyService.resolveTaxonomySelection(tenantId, {
      taxonomyCategoryId: input.taxonomyCategoryId,
      taxonomyTypeId: input.taxonomyTypeId,
      taxonomyIssueId: input.taxonomyIssueId,
      isTriage: false
    });

    const updated = await this.prisma.workOrder.update({
      where: { id },
      data: {
        taxonomyCategoryId: taxonomy.taxonomyCategoryId,
        taxonomyTypeId: taxonomy.taxonomyTypeId,
        taxonomyIssueId: taxonomy.taxonomyIssueId,
        categoryNameSnapshot: taxonomy.categoryNameSnapshot,
        typeNameSnapshot: taxonomy.typeNameSnapshot,
        issueNameSnapshot: taxonomy.issueNameSnapshot,
        isTriage: false,
        triageClassifiedAt: existing.isTriage ? new Date() : existing.triageClassifiedAt,
        triageClassifiedById: existing.isTriage ? actor!.sub : existing.triageClassifiedById
      }
    });

    await this.recordAudit({
      entity: "WorkOrder",
      entityId: id,
      action: AuditAction.UPDATE,
      actor,
      reason: input.reason,
      metadata: {
        event: "work_order_category_changed",
        previousCategory: existing.categoryNameSnapshot,
        previousType: existing.typeNameSnapshot,
        previousIssue: existing.issueNameSnapshot
      },
      beforeData: {
        taxonomyCategoryId: existing.taxonomyCategoryId,
        taxonomyTypeId: existing.taxonomyTypeId,
        taxonomyIssueId: existing.taxonomyIssueId,
        categoryNameSnapshot: existing.categoryNameSnapshot,
        typeNameSnapshot: existing.typeNameSnapshot,
        issueNameSnapshot: existing.issueNameSnapshot
      },
      afterData: {
        taxonomyCategoryId: updated.taxonomyCategoryId,
        taxonomyTypeId: updated.taxonomyTypeId,
        taxonomyIssueId: updated.taxonomyIssueId,
        categoryNameSnapshot: updated.categoryNameSnapshot,
        typeNameSnapshot: updated.typeNameSnapshot,
        issueNameSnapshot: updated.issueNameSnapshot
      }
    });

    return updated;
  }

  async classifyTriage(
    id: string,
    input: {
      taxonomyCategoryId: string;
      taxonomyTypeId: string;
      taxonomyIssueId?: string;
      reason: string;
    },
    actor?: Actor
  ) {
    const existing = await this.findOne(id, actor);
    this.assertActor(actor);

    const role = actor!.role as RoleName;
    const allowed = new Set<RoleName>([
      RoleName.SUPERVISOR,
      RoleName.MANAGER,
      RoleName.OPERATIONS_MANAGER,
      RoleName.ASSET_MANAGER,
      RoleName.ADMIN,
      RoleName.SUPER_ADMIN
    ]);
    if (!allowed.has(role)) {
      throw new ForbiddenException("Only supervisors or managers can classify triage work orders.");
    }
    if (!existing.isTriage) {
      throw new BadRequestException("Work order is not in triage.");
    }
    assertReasonProvided(input.reason, "Triage classification reason is required");

    return this.changeTaxonomy(id, input, actor);
  }

  private assertBulkOperationalPermission(actor?: Actor) {
    const role = actor?.role as RoleName;
    const allowed = new Set<RoleName>([
      RoleName.SUPERVISOR,
      RoleName.MANAGER,
      RoleName.OPERATIONS_MANAGER,
      RoleName.ASSET_MANAGER,
      RoleName.ADMIN,
      RoleName.SUPER_ADMIN
    ]);
    if (!actor || !allowed.has(role)) {
      throw new ForbiddenException("You do not have permission for bulk work order actions.");
    }
  }

  async bulkAssign(
    input: {
      workOrderIds: string[];
      assigneeEmployeeIds: string[];
      expectedCompletionDate?: string;
      reason?: string;
    },
    actor?: Actor
  ) {
    this.assertBulkOperationalPermission(actor);

    if (!Array.isArray(input.workOrderIds) || input.workOrderIds.length === 0) {
      throw new BadRequestException("workOrderIds is required");
    }
    if (!Array.isArray(input.assigneeEmployeeIds) || input.assigneeEmployeeIds.length === 0) {
      throw new BadRequestException("assigneeEmployeeIds is required");
    }

    const success: string[] = [];
    const failed: Array<{ workOrderId: string; reason: string }> = [];

    for (const workOrderId of input.workOrderIds) {
      try {
        const current = await this.findOne(workOrderId, actor);
        if (TERMINAL_WORK_ORDER_STATUSES.has(current.status)) {
          throw new BadRequestException("Cannot assign completed or cancelled work order");
        }

        this.assertWorkOrderApprovedForExecution(current);

        for (let index = 0; index < input.assigneeEmployeeIds.length; index += 1) {
          const employeeId = input.assigneeEmployeeIds[index];
          await this.workOrderAssigneesService.addAssignee(
            workOrderId,
            { employeeId, isPrimary: index === 0 },
            actor
          );
        }

        if (input.expectedCompletionDate) {
          await this.prisma.workOrder.update({
            where: { id: workOrderId },
            data: { expectedCompletionDate: new Date(input.expectedCompletionDate) }
          });
        }

        await this.recordAudit({
          entity: "WorkOrder",
          entityId: workOrderId,
          action: AuditAction.UPDATE,
          actor,
          reason: input.reason ?? "Bulk assign",
          metadata: {
            event: "work_order_bulk_assign",
            assigneeEmployeeIds: input.assigneeEmployeeIds,
            expectedCompletionDate: input.expectedCompletionDate ?? null
          }
        });

        success.push(workOrderId);
      } catch (error) {
        failed.push({
          workOrderId,
          reason: error instanceof Error ? error.message : "Bulk assign failed"
        });
      }
    }

    return { success, failed };
  }

  async bulkStatus(
    input: {
      workOrderIds: string[];
      targetStatus: WorkOrderStatus;
      reason?: string;
      cancelReason?: string;
    },
    actor?: Actor
  ) {
    this.assertBulkOperationalPermission(actor);

    if (!Array.isArray(input.workOrderIds) || input.workOrderIds.length === 0) {
      throw new BadRequestException("workOrderIds is required");
    }

    if (
      input.targetStatus === WorkOrderStatus.COMPLETED ||
      input.targetStatus === WorkOrderStatus.TECHNICIAN_COMPLETED
    ) {
      throw new BadRequestException(
        "Bulk completion is not allowed. Complete work orders individually with evidence, cost, and governance checks."
      );
    }

    if (input.targetStatus === WorkOrderStatus.CANCELLED) {
      assertReasonProvided("Cancel reason", input.cancelReason ?? input.reason);
    }

    const success: string[] = [];
    const failed: Array<{ workOrderId: string; reason: string }> = [];

    for (const workOrderId of input.workOrderIds) {
      try {
        await this.updateStatus(
          workOrderId,
          {
            status: input.targetStatus,
            cancelReason: input.cancelReason ?? input.reason
          },
          actor
        );
        success.push(workOrderId);
      } catch (error) {
        failed.push({
          workOrderId,
          reason: error instanceof Error ? error.message : "Bulk status update failed"
        });
      }
    }

    return { success, failed };
  }

  private async reserveApprovedPartRequest(workOrderId: string, requestId: string, quantity: number, actor?: Actor) {
    const request = await this.getPartRequest(workOrderId, requestId, actor);
    try {
      await this.stockEngine.reserve({
        actor,
        partId: request.partId,
        quantity,
        workOrderId,
        vehicleId: request.workOrder?.vehicleId ?? undefined,
        sourceType: "WO_RESERVATION",
        sourceDocument: request.id,
        sourceLineKey: `wo-res:${request.id}`,
        idempotencyKey: `wo-res:${request.id}`
      });
      await this.prisma.workOrderPart.updateMany({
        where: { partRequestId: requestId },
        data: { reservedQuantity: quantity }
      });
    } catch (error) {
      if (error instanceof BadRequestException) {
        await this.prisma.workOrderPart.updateMany({
          where: { partRequestId: requestId },
          data: { procurementRequired: true, reservedQuantity: 0 }
        });
        await this.recordAudit({
          entity: "PART_REQUEST",
          entityId: requestId,
          action: AuditAction.UPDATE,
          actor,
          reason: "Reservation skipped — insufficient available stock",
          metadata: {
            event: "reservation_failed_procurement_required",
            quantity,
            fulfillment:
              "PART_REQUEST_APPROVED + STOCK_NOT_RESERVED + PROCUREMENT_REQUIRED — part is not physically available"
          }
        });
        return;
      }
      throw error;
    }
  }

  private async releaseReservedPartRequest(requestId: string, actor?: Actor) {
    const line = await this.prisma.workOrderPart.findFirst({ where: { partRequestId: requestId } });
    if (!line || line.reservedQuantity <= 0) {
      return;
    }
    await this.stockEngine.releaseReservation({
      actor,
      partId: line.partId,
      quantity: line.reservedQuantity,
      workOrderId: line.workOrderId,
      sourceType: "WO_RESERVATION_RELEASE",
      sourceLineKey: `wo-res-release:${requestId}`,
      idempotencyKey: `wo-res-release:${requestId}`
    });
    await this.prisma.workOrderPart.update({
      where: { id: line.id },
      data: { reservedQuantity: 0 }
    });
  }

  private async notifyEnterpriseCompleted(
    workOrder: {
      id: string;
      tenantId?: string | null;
      type: WorkOrderType;
      scheduleId?: string | null;
      vehicleId?: string | null;
      completedDate?: Date | null;
      actualHours?: number | null;
      verificationStatus?: string | null;
      taxonomyIssueId?: string | null;
      issueNameSnapshot?: string | null;
    },
    actor?: Actor
  ) {
    try {
      await this.enterpriseOps?.onWorkOrderCompleted(workOrder, actor);
    } catch {
      // Completion remains authoritative; downstream forecast/health failures are non-blocking.
    }
  }
}
