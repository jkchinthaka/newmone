import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
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
  WorkOrderStatus
} from "@prisma/client";

import { requestContext } from "../../common/context/request-context";
import {
  assertValidOptionalObjectId,
  assertWorkOrderAssetRules,
  calculateSlaRisk
} from "../../common/utils/work-order-validation";
import { PrismaService } from "../../database/prisma.service";
import type { JwtPayload } from "../auth/auth.types";
import { NotificationsService } from "../notifications/notifications.service";

type Actor = Pick<JwtPayload, "sub" | "email" | "role" | "tenantId">;

@Injectable()
export class WorkOrdersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notificationsService: NotificationsService
  ) {}

  private readonly financeApprovalThreshold = Number(process.env.PHASE3_FINANCE_THRESHOLD ?? 5000);

  private resolveTenantId(actor?: Actor): string | null | undefined {
    if (!actor) {
      return undefined;
    }

    return actor.tenantId ?? null;
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
    return Boolean(pettyCash) || totalCost >= this.financeApprovalThreshold;
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

  private assertValidStatusTransition(from: WorkOrderStatus, to: WorkOrderStatus) {
    if (from === to) {
      return;
    }

    if (from === WorkOrderStatus.COMPLETED || from === WorkOrderStatus.CANCELLED) {
      throw new BadRequestException(`Cannot change status from ${from.replaceAll("_", " ")}`);
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

    if (tenantId !== undefined) {
      where.tenantId = tenantId;
    }

    const count = await this.prisma.workOrder.count({ where });
    const sequence = String(count + 1).padStart(4, "0");
    return `WO-${year}-${sequence}`;
  }

  findAll(actor?: Actor) {
    const tenantId = this.resolveTenantId(actor);
    const where: Prisma.WorkOrderWhereInput = {};

    if (tenantId !== undefined) {
      where.tenantId = tenantId;
    }

    return this.prisma.workOrder.findMany({
      where,
      include: {
        asset: true,
        vehicle: true,
        technician: true,
        createdBy: true,
        parts: {
          include: {
            part: true
          }
        }
      },
      orderBy: { createdAt: "desc" }
    });
  }

  async findOne(id: string, actor?: Actor) {
    const tenantId = this.resolveTenantId(actor);
    const where: Prisma.WorkOrderWhereInput = { id };

    if (tenantId !== undefined) {
      where.tenantId = tenantId;
    }

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
        ...(tenantId !== undefined ? { tenantId } : {})
      }
    });

    if (!creator) {
      throw new BadRequestException("createdById does not match any existing user in your tenant context.");
    }

    const woNumber = await this.nextWoNumber(actor);
    const approvalStatus =
      data.requiresApproval === true
        ? WorkOrderApprovalStatus.PENDING
        : this.canAutoApproveWorkOrder(actor?.role)
          ? WorkOrderApprovalStatus.APPROVED
          : WorkOrderApprovalStatus.PENDING;

    try {
      const created = await this.prisma.workOrder.create({
        data: {
          tenantId: tenantId === undefined ? creator.tenantId ?? null : tenantId,
          woNumber,
          title: data.title,
          description: data.description,
          priority: data.priority,
          type: data.type,
          assetId,
          vehicleId,
          scheduleId,
          createdById: data.createdById,
          dueDate: data.dueDate ? new Date(data.dueDate) : undefined,
          expectedCompletionDate: data.expectedCompletionDate
            ? new Date(data.expectedCompletionDate)
            : data.dueDate
              ? new Date(data.dueDate)
              : undefined,
          approvalStatus,
          approvedAt: approvalStatus === WorkOrderApprovalStatus.APPROVED ? new Date() : undefined,
          approvedById:
            approvalStatus === WorkOrderApprovalStatus.APPROVED && actor?.sub ? actor.sub : undefined
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
    }>,
    actor?: Actor
  ) {
    await this.findOne(id, actor);

    return this.prisma.workOrder.update({
      where: { id },
      data: {
        ...data,
        dueDate: data.dueDate ? new Date(data.dueDate) : undefined,
        expectedCompletionDate: data.expectedCompletionDate
          ? new Date(data.expectedCompletionDate)
          : undefined,
        plannedStartAt: data.plannedStartAt ? new Date(data.plannedStartAt) : undefined,
        plannedEndAt: data.plannedEndAt ? new Date(data.plannedEndAt) : undefined
      }
    });
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
        ...(tenantId !== undefined ? { tenantId } : {})
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
    },
    actor?: Actor
  ) {
    const current = await this.findOne(id, actor);
    this.assertValidStatusTransition(current.status, data.status);

    if (
      data.status === WorkOrderStatus.IN_PROGRESS ||
      data.status === WorkOrderStatus.COMPLETED
    ) {
      this.assertWorkOrderApprovedForExecution(current);
    }

    if (data.status === WorkOrderStatus.COMPLETED && (!data.actualCost || !data.actualHours)) {
      throw new BadRequestException("Cannot complete a work order without entering actual cost and hours");
    }

    const slaRisk = calculateSlaRisk({
      dueDate: current.dueDate,
      expectedCompletionDate: current.expectedCompletionDate,
      plannedEndAt: current.plannedEndAt,
      status: current.status
    });

    if (data.status === WorkOrderStatus.COMPLETED && slaRisk.level === "OVERDUE" && !data.delayReason?.trim()) {
      throw new BadRequestException("Delay reason is required when completing an overdue work order");
    }

    let slaDeadline = current.slaDeadline;
    let startDate = current.startDate;

    if (data.status === WorkOrderStatus.IN_PROGRESS && !current.startDate) {
      startDate = new Date();
      slaDeadline = new Date(startDate.getTime() + this.slaHours(current.priority) * 60 * 60 * 1000);
    }

    const completedDate = data.status === WorkOrderStatus.COMPLETED ? new Date() : current.completedDate;

    const updated = await this.prisma.workOrder.update({
      where: { id },
      data: {
        status: data.status,
        startDate,
        slaDeadline,
        actualCost: data.actualCost,
        actualHours: data.actualHours,
        delayReason: data.delayReason?.trim() || current.delayReason,
        completedDate,
        slaBreached: Boolean(slaDeadline && completedDate && completedDate.getTime() > slaDeadline.getTime())
      }
    });

    await this.recordAudit({
      entity: "WorkOrder",
      entityId: id,
      action: AuditAction.UPDATE,
      actor,
      reason:
        data.status === WorkOrderStatus.COMPLETED
          ? "Work order completed"
          : `Work order status updated to ${data.status}`,
      metadata: {
        event:
          data.status === WorkOrderStatus.COMPLETED
            ? "work_order_completed"
            : "work_order_status_updated",
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

  private async findOneWithRelations(id: string, actor?: Actor) {
    const tenantId = this.resolveTenantId(actor);
    const where: Prisma.WorkOrderWhereInput = { id };

    if (tenantId !== undefined) {
      where.tenantId = tenantId;
    }

    const workOrder = await this.prisma.workOrder.findFirst({
      where,
      include: {
        asset: true,
        vehicle: true,
        technician: true,
        createdBy: true,
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

  async addPart(id: string, data: { partId: string; quantity: number; unitCost: number }, actor?: Actor) {
    const tenantId = this.resolveTenantId(actor);
    const workOrder = await this.findOne(id, actor);

    if (!Number.isFinite(data.quantity) || data.quantity <= 0) {
      throw new BadRequestException("Part quantity must be greater than 0");
    }

    const part = await this.prisma.sparePart.findFirst({
      where: {
        id: data.partId,
        isActive: true,
        ...(tenantId !== undefined ? { tenantId } : {})
      }
    });

    if (!part) {
      throw new NotFoundException("Spare part not found");
    }

    if (part.quantityInStock < data.quantity) {
      throw new BadRequestException("Parts used in a work order cannot exceed available stock");
    }

    const totalCost = data.quantity * data.unitCost;

    const createdPart = await this.prisma.workOrderPart.create({
      data: {
        workOrderId: id,
        partId: data.partId,
        quantity: data.quantity,
        unitCost: data.unitCost,
        totalCost
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
        totalCost
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
        ...(tenantId !== undefined ? { tenantId } : {})
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

    if (!Number.isFinite(data.quantity) || data.quantity <= 0) {
      throw new BadRequestException("Requested quantity must be greater than 0");
    }

    const part = await this.prisma.sparePart.findFirst({
      where: {
        id: data.partId,
        isActive: true,
        ...(tenantId !== undefined ? { tenantId } : {})
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
    const requiresFinanceApproval = this.requiresFinanceApproval(totalCost, data.pettyCash);

    const created = await this.prisma.$transaction(async (tx) => {
      const partRequest = await tx.partRequest.create({
        data: {
          tenantId: tenantId ?? null,
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
          tenantId: tenantId ?? null,
          partRequestId: partRequest.id,
          stage: ApprovalStage.OPERATIONAL,
          sequence: 1,
          status: ApprovalDecisionStatus.PENDING
        },
        {
          tenantId: tenantId ?? null,
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
        pettyCash: Boolean(data.pettyCash)
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
    data: { quantity?: number; notes?: string },
    actor?: Actor
  ) {
    const issuer = this.assertActor(actor);
    const request = await this.getPartRequest(workOrderId, requestId, actor);

    if (request.status !== PartRequestStatus.APPROVED && request.status !== PartRequestStatus.PARTIALLY_ISSUED) {
      throw new BadRequestException("Part request must be approved before stock issue");
    }

    const approvedQuantity = request.approvedQuantity ?? request.requestedQuantity;
    const remaining = approvedQuantity - request.issuedQuantity;
    const issueQuantity = data.quantity ?? remaining;

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

    await this.recordAudit({
      entity: "PART_ISSUE",
      entityId: result.id,
      action: AuditAction.UPDATE,
      actor,
      reason: data.notes,
      metadata: {
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
        ...(tenantId !== undefined ? { tenantId } : {})
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
    return this.prisma.workOrderPart.findMany({
      where: { workOrderId: id },
      include: { part: true }
    });
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
}
