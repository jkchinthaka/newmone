import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import {
  ApprovalDecisionStatus,
  ApprovalStage,
  AuditAction,
  NotificationPriority,
  NotificationType,
  PartRequestStatus,
  Priority,
  Prisma,
  RoleName,
  WorkOrderApprovalStatus,
  WorkOrderStatus,
  QrVerificationStatus,
  WorkOrderCompletionCondition,
  WorkOrderVerificationStatus
} from "@prisma/client";

import { requestContext } from "../../common/context/request-context";
import { PUBLIC_USER_SUMMARY_SELECT } from "../../common/selects/public-user.select";
import {
  assertTenantEntitiesExist,
  assertTenantEntityExists,
  requireTenantId
} from "../../common/utils/tenant-scope.util";
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
import { NotificationsService } from "../notifications/notifications.service";
import { WorkOrderTaxonomyService } from "../work-order-taxonomy/work-order-taxonomy.service";
import { WorkOrderPartsService } from "./work-order-parts.service";
import { WorkOrderAssigneesService } from "./work-order-assignees.service";

type Actor = Pick<JwtPayload, "sub" | "email" | "role" | "tenantId">;

@Injectable()
export class WorkOrdersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notificationsService: NotificationsService,
    private readonly workOrderPartsService: WorkOrderPartsService,
    private readonly workOrderTaxonomyService: WorkOrderTaxonomyService,
    private readonly workOrderAssigneesService: WorkOrderAssigneesService
  ) {}

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

  private slaHours(priority: Priority): number {
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

  private async nextWoNumber(actor?: Actor): Promise<string> {
    const year = new Date().getFullYear();
    const tenantId = this.resolveTenantId(actor);
    const where: Prisma.WorkOrderWhereInput = {
      createdAt: {
        gte: new Date(`${year}-01-01T00:00:00.000Z`),
        lte: new Date(`${year}-12-31T23:59:59.999Z`)
      }
    };

    where.tenantId = tenantId;

    const count = await this.prisma.workOrder.count({ where });
    const sequence = String(count + 1).padStart(4, "0");
    return `WO-${year}-${sequence}`;
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
      type: "PREVENTIVE" | "CORRECTIVE" | "EMERGENCY" | "INSPECTION" | "INSTALLATION" | "ACCIDENT_REPAIR";
      assetId?: string;
      vehicleId?: string;
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
    },
    actor?: Actor
  ) {
    if (!data.title?.trim()) {
      throw new BadRequestException("Title is required");
    }
    if (!data.description?.trim()) {
      throw new BadRequestException("Description is required");
    }
    if (!data.createdById) {
      throw new BadRequestException("createdById is required");
    }

    const assetId = assertValidOptionalObjectId("assetId", data.assetId);
    const vehicleId = assertValidOptionalObjectId("vehicleId", data.vehicleId);
    const scheduleId = assertValidOptionalObjectId("scheduleId", data.scheduleId);
    assertWorkOrderAssetRules({ type: data.type, assetId, vehicleId });

    if (!/^[a-fA-F0-9]{24}$/.test(data.createdById)) {
      throw new BadRequestException("Invalid createdById. Please log in again to refresh your session.");
    }

    const tenantId = this.resolveTenantId(actor);
    const creator = await this.prisma.user.findFirst({
      where: {
        id: data.createdById,
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

    const woNumber = await this.nextWoNumber(actor);
    
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

    try {
      const created = await this.prisma.workOrder.create({
        data: {
          tenantId: tenantId,
          woNumber,
          title: data.title,
          description: data.description,
          priority: data.priority,
          type: data.type,
          assetId,
          vehicleId,
          scheduleId,
          createdById: data.createdById,
          ...taxonomyFields,
          dueDate: data.dueDate ? new Date(data.dueDate) : undefined,
          expectedCompletionDate: data.expectedCompletionDate
            ? new Date(data.expectedCompletionDate)
            : data.dueDate
              ? new Date(data.dueDate)
              : undefined,
          approvalStatus,
          approvedAt: approvalStatus === WorkOrderApprovalStatus.APPROVED ? new Date() : undefined,
          approvedById:
            approvalStatus === WorkOrderApprovalStatus.APPROVED && actor?.sub ? actor.sub : undefined,
          qrVerificationStatus: requiresQrVerification(data.type as never, assetId, vehicleId)
            ? QrVerificationStatus.PENDING
            : QrVerificationStatus.NOT_REQUIRED
        }
      });

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
          type: created.type
        },
        afterData: {
          status: created.status,
          approvalStatus: created.approvalStatus,
          title: created.title
        }
      });

      return created;
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

    const updated = await this.prisma.workOrder.update({
      where: { id },
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
        estimatedHours: data.estimatedHours
      }
    });

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

  async remove(id: string, actor?: Actor) {
    const existing = await this.findOne(id, actor);

    if (existing.status !== WorkOrderStatus.OPEN) {
      throw new BadRequestException("Work order deletion only allowed when status is OPEN");
    }

    await this.prisma.workOrder.delete({ where: { id } });
    return { deleted: true };
  }

  async assign(id: string, technicianId: string, actor?: Actor) {
    const current = await this.findOne(id, actor);
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

    const updated = await this.prisma.workOrder.update({
      where: { id },
      data: { technicianId }
    });

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
      reason: "Technician assigned",
      metadata: {
        event: "work_order_assigned",
        woNumber: updated.woNumber,
        technicianId
      },
      beforeData: { technicianId: current.technicianId ?? null },
      afterData: { technicianId: updated.technicianId ?? null }
    });

    return updated;
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

  async approveWorkOrder(id: string, notes: string | undefined, actor?: Actor) {
    const current = await this.findOne(id, actor);

    if (current.approvalStatus !== WorkOrderApprovalStatus.PENDING) {
      throw new BadRequestException("Only pending work orders can be approved");
    }

    if (current.status === WorkOrderStatus.COMPLETED || current.status === WorkOrderStatus.CANCELLED) {
      throw new BadRequestException("Cannot approve a closed work order");
    }

    const approver = this.assertActor(actor);
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
      cancelReason?: string;
      completionNote?: string;
      emergencyCloseReason?: string;
      completionCondition?: WorkOrderCompletionCondition;
      followUpRequired?: boolean;
      followUpNote?: string;
      overrideReason?: string;
    },
    actor?: Actor
  ) {
    const current = await this.findOne(id, actor);
    const targetStatus =
      data.status === WorkOrderStatus.COMPLETED && TECHNICIAN_EXECUTION_ROLES.has(actor?.role as RoleName)
        ? WorkOrderStatus.TECHNICIAN_COMPLETED
        : data.status;

    assertAllowedStatusTransition(current.status, targetStatus);
    assertRoleCanSetStatus(actor?.role as RoleName | undefined, current.status, targetStatus, {
      emergencyCloseReason: data.emergencyCloseReason
    });

    if (
      targetStatus === WorkOrderStatus.IN_PROGRESS ||
      targetStatus === WorkOrderStatus.TECHNICIAN_COMPLETED ||
      targetStatus === WorkOrderStatus.COMPLETED
    ) {
      this.assertWorkOrderApprovedForExecution(current);
    }

    if (targetStatus === WorkOrderStatus.CANCELLED) {
      assertReasonProvided("Cancel reason", data.cancelReason);
    }

    if (targetStatus === WorkOrderStatus.TECHNICIAN_COMPLETED) {
      assertReasonProvided("Technician completion note", data.completionNote);
      if (!data.actualCost || !data.actualHours) {
        throw new BadRequestException("Cannot mark technician completion without actual cost and hours");
      }

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
      if (!data.actualCost || !data.actualHours) {
        throw new BadRequestException("Cannot complete a work order without entering actual cost and hours");
      }
      if (current.status !== WorkOrderStatus.TECHNICIAN_COMPLETED && !canDirectlyCloseWorkOrder(actor?.role as RoleName)) {
        throw new BadRequestException("Supervisor verification required before closing.");
      }
      if (requiresEvidenceForCompletion(current.type)) {
        const evidenceCount = await this.prisma.evidenceAttachment.count({
          where: { workOrderId: id, status: "UPLOADED" }
        });
        const storageEnabled = /^(1|true|yes)$/i.test((process.env.STORAGE_UPLOADS_ENABLED ?? "").trim());
        if (storageEnabled && evidenceCount < 2) {
          throw new BadRequestException(
            "Before and after evidence are required for this work order category when uploads are enabled."
          );
        }
      }
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
      slaDeadline = new Date(startDate.getTime() + this.slaHours(current.priority) * 60 * 60 * 1000);
    }

    const completedDate =
      targetStatus === WorkOrderStatus.COMPLETED ? new Date() : current.completedDate;

    const verificationStatus =
      targetStatus === WorkOrderStatus.TECHNICIAN_COMPLETED &&
      requiresSupervisorVerification({ type: current.type, priority: current.priority })
        ? WorkOrderVerificationStatus.PENDING
        : current.verificationStatus;

    const updated = await this.prisma.workOrder.update({
      where: { id },
      data: {
        status: targetStatus,
        startDate,
        slaDeadline,
        actualCost: data.actualCost ?? current.actualCost,
        actualHours: data.actualHours ?? current.actualHours,
        delayReason: data.delayReason?.trim() || current.delayReason,
        cancelledReason:
          targetStatus === WorkOrderStatus.CANCELLED ? assertReasonProvided("Cancel reason", data.cancelReason) : current.cancelledReason,
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
        slaBreached: Boolean(slaDeadline && completedDate && completedDate.getTime() > slaDeadline.getTime())
      }
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
        actualCost: data.actualCost ?? null,
        actualHours: data.actualHours ?? null
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

    const actualCost = data.actualCost ?? current.actualCost;
    const actualHours = data.actualHours ?? current.actualHours;
    if (!actualCost || !actualHours) {
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
    const updated = await this.prisma.workOrder.update({
      where: { id },
      data: {
        status: WorkOrderStatus.COMPLETED,
        verificationStatus: WorkOrderVerificationStatus.VERIFIED,
        verifiedById: approver.sub,
        verifiedAt: new Date(),
        verificationNote: data.verificationNote?.trim() || null,
        verificationRejectionReason: null,
        actualCost,
        actualHours,
        completedDate: new Date(),
        delayReason: data.delayReason?.trim() || current.delayReason
      }
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
        verificationRejectionReason: trimmedReason
      }
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

  async reopenWorkOrder(id: string, reason: string, actor?: Actor) {
    if (!canReopenWorkOrder(actor?.role as RoleName)) {
      throw new BadRequestException("Reopening work orders requires admin permission.");
    }

    const trimmedReason = assertReasonProvided("Reopen reason", reason);
    const current = await this.findOne(id, actor);
    if (!TERMINAL_WORK_ORDER_STATUSES.has(current.status)) {
      throw new BadRequestException("Only completed or cancelled work orders can be reopened.");
    }

    const approver = this.assertActor(actor);
    const updated = await this.prisma.workOrder.update({
      where: { id },
      data: {
        status: WorkOrderStatus.OPEN,
        completedDate: null,
        verificationStatus: WorkOrderVerificationStatus.NOT_REQUIRED,
        verifiedById: null,
        verifiedAt: null,
        verificationNote: null,
        verificationRejectionReason: null,
        reopenReason: trimmedReason,
        reopenedAt: new Date(),
        reopenedById: approver.sub
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

    if (part.quantityInStock < data.quantity) {
      throw new BadRequestException("Parts used in a work order cannot exceed available stock");
    }

    const totalCost = data.quantity * data.unitCost;
    const issuer = this.assertActor(actor);

    const createdPart = await this.prisma.workOrderPart.create({
      data: {
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

    await this.prisma.sparePart.update({
      where: { id: data.partId },
      data: {
        quantityInStock: {
          decrement: data.quantity
        }
      }
    });

    await this.prisma.stockMovement.create({
      data: {
        partId: data.partId,
        type: "OUT",
        quantity: data.quantity,
        reference: `work-order:${workOrder.id}`,
        notes: "Deducted via work order add-part"
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
        source: "work_orders.addPart"
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

    const unitCostSnapshot = data.unitCost ?? part.unitCost;
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

    if (request.part.quantityInStock < issueQuantity) {
      throw new BadRequestException("Insufficient stock for this issue request");
    }

    const result = await this.prisma.$transaction(async (tx) => {
      await tx.sparePart.update({
        where: { id: request.partId },
        data: {
          quantityInStock: {
            decrement: issueQuantity
          }
        }
      });

      await tx.stockMovement.create({
        data: {
          partId: request.partId,
          type: "OUT",
          quantity: issueQuantity,
          reference: `part-request:${request.id}`,
          notes: data.notes?.trim() || "Issued via approved part request"
        }
      });

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
    const current = await this.findOne(id, actor);
    const existing = current.notes ? `${current.notes}\n` : "";

    return this.prisma.workOrder.update({
      where: { id },
      data: {
        notes: `${existing}[${new Date().toISOString()}] ${note}`
      }
    });
  }

  async addAttachment(id: string, attachmentUrl: string, actor?: Actor) {
    const current = await this.findOne(id, actor);

    return this.prisma.workOrder.update({
      where: { id },
      data: {
        attachments: [...current.attachments, attachmentUrl]
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
}
