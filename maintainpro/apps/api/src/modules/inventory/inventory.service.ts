import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import {
  ApprovalDecisionStatus,
  ApprovalStage,
  AuditAction,
  ErpSyncStatus,
  NotificationPriority,
  NotificationType,
  POStatus,
  Prisma,
  PurchaseOrderWorkflowStatus
} from "@prisma/client";

import { requestContext } from "../../common/context/request-context";
import { PrismaService } from "../../database/prisma.service";
import type { JwtPayload } from "../auth/auth.types";
import { NotificationsService } from "../notifications/notifications.service";
import { ErpSyncProviderService } from "./erp-sync-provider.service";

type Actor = Pick<JwtPayload, "sub" | "email" | "role" | "tenantId">;

@Injectable()
export class InventoryService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notificationsService: NotificationsService,
    private readonly erpSyncProviderService: ErpSyncProviderService
  ) {}

  private readonly financeApprovalThreshold = Number(process.env.PHASE3_FINANCE_THRESHOLD ?? 5000);

  private toDateKey(date: Date): string {
    return date.toISOString().slice(0, 10);
  }

  private resolveTenantId(actor?: Actor): string | null | undefined {
    if (!actor) {
      return undefined;
    }

    return actor.tenantId ?? null;
  }

  private assertActor(actor?: Actor) {
    if (!actor?.sub) {
      throw new BadRequestException("Authenticated actor context is required");
    }

    return actor;
  }

  private requiresFinanceApproval(totalAmount: number, pettyCash?: boolean) {
    return Boolean(pettyCash) || totalAmount >= this.financeApprovalThreshold;
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
        module: "inventory",
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

  async parts(actor?: Actor) {
    const tenantId = this.resolveTenantId(actor);

    return this.prisma.sparePart.findMany({
      where: {
        isActive: true,
        ...(tenantId !== undefined ? { tenantId } : {})
      },
      include: {
        supplier: true,
        stockMovements: {
          select: {
            createdAt: true,
            type: true,
            quantity: true,
            reference: true,
            notes: true
          },
          orderBy: {
            createdAt: "desc"
          },
          take: 1
        }
      },
      orderBy: {
        createdAt: "desc"
      }
    });
  }

  async part(id: string, actor?: Actor) {
    const tenantId = this.resolveTenantId(actor);
    const part = await this.prisma.sparePart.findFirst({
      where: {
        id,
        ...(tenantId !== undefined ? { tenantId } : {})
      },
      include: { supplier: true }
    });

    if (!part || !part.isActive) {
      throw new NotFoundException("Spare part not found");
    }

    return part;
  }

  async createPart(
    data: {
      partNumber: string;
      name: string;
      category: string;
      unitCost: number;
      unit?: string;
      minimumStock?: number;
      reorderPoint?: number;
      quantityInStock?: number;
      location?: string;
      supplierId?: string;
    },
    actor?: Actor
  ) {
    const tenantId = this.resolveTenantId(actor);
    const existing = await this.prisma.sparePart.findFirst({
      where: {
        partNumber: data.partNumber,
        ...(tenantId !== undefined ? { tenantId } : {})
      }
    });

    if (existing) {
      throw new BadRequestException("Part number must be unique within tenant context");
    }

    if ((data.reorderPoint ?? 0) >= (data.minimumStock ?? 0) && (data.minimumStock ?? 0) > 0) {
      throw new BadRequestException("Reorder point must be less than minimum stock");
    }

    return this.prisma.sparePart.create({
      data: {
        tenantId: tenantId ?? null,
        partNumber: data.partNumber,
        name: data.name,
        category: data.category,
        unitCost: data.unitCost,
        unit: data.unit ?? "pcs",
        minimumStock: data.minimumStock ?? 0,
        reorderPoint: data.reorderPoint ?? 0,
        quantityInStock: data.quantityInStock ?? 0,
        location: data.location,
        supplierId: data.supplierId,
        images: []
      }
    });
  }

  async updatePart(
    id: string,
    data: Partial<{
      name: string;
      category: string;
      unitCost: number;
      minimumStock: number;
      reorderPoint: number;
      location: string;
    }>,
    actor?: Actor
  ) {
    const current = await this.part(id, actor);
    const minimumStock = data.minimumStock ?? current.minimumStock;
    const reorderPoint = data.reorderPoint ?? current.reorderPoint;

    if (reorderPoint >= minimumStock && minimumStock > 0) {
      throw new BadRequestException("Reorder point must be less than minimum stock");
    }

    return this.prisma.sparePart.update({ where: { id }, data });
  }

  async removePart(id: string, actor?: Actor) {
    await this.part(id, actor);

    return this.prisma.sparePart.update({
      where: { id },
      data: {
        isActive: false
      }
    });
  }

  async bulkDeleteParts(ids: string[], actor?: Actor) {
    if (!Array.isArray(ids) || ids.length === 0) {
      throw new BadRequestException("At least one part id is required");
    }

    const tenantId = this.resolveTenantId(actor);
    const result = await this.prisma.sparePart.updateMany({
      where: {
        id: {
          in: ids
        },
        ...(tenantId !== undefined ? { tenantId } : {})
      },
      data: {
        isActive: false
      }
    });

    return { count: result.count };
  }

  async bulkUpdateCategory(ids: string[], category: string, actor?: Actor) {
    if (!Array.isArray(ids) || ids.length === 0) {
      throw new BadRequestException("At least one part id is required");
    }

    if (!category?.trim()) {
      throw new BadRequestException("Category is required");
    }

    const tenantId = this.resolveTenantId(actor);
    const result = await this.prisma.sparePart.updateMany({
      where: {
        id: {
          in: ids
        },
        isActive: true,
        ...(tenantId !== undefined ? { tenantId } : {})
      },
      data: {
        category: category.trim()
      }
    });

    return { count: result.count };
  }

  async stockIn(id: string, quantity: number, notes?: string, actor?: Actor) {
    await this.part(id, actor);

    if (!Number.isFinite(quantity) || quantity <= 0) {
      throw new BadRequestException("Stock-in quantity must be greater than 0");
    }

    const part = await this.prisma.sparePart.update({
      where: { id },
      data: {
        quantityInStock: {
          increment: quantity
        }
      }
    });

    await this.prisma.stockMovement.create({
      data: {
        partId: id,
        type: "IN",
        quantity,
        notes
      }
    });

    return part;
  }

  async stockOut(id: string, quantity: number, notes?: string, actor?: Actor) {
    const part = await this.part(id, actor);

    if (!Number.isFinite(quantity) || quantity <= 0) {
      throw new BadRequestException("Stock-out quantity must be greater than 0");
    }

    if (part.quantityInStock < quantity) {
      throw new BadRequestException("Stock quantity cannot go below 0");
    }

    const updated = await this.prisma.sparePart.update({
      where: { id },
      data: {
        quantityInStock: {
          decrement: quantity
        }
      }
    });

    await this.prisma.stockMovement.create({
      data: {
        partId: id,
        type: "OUT",
        quantity,
        notes
      }
    });

    await this.recordAudit({
      entity: "PART_STOCK_ISSUE",
      entityId: id,
      action: AuditAction.UPDATE,
      actor,
      reason: notes,
      metadata: {
        quantity,
        source: "inventory.stockOut"
      }
    });

    return updated;
  }

  async movements(id: string, actor?: Actor) {
    await this.part(id, actor);
    return this.prisma.stockMovement.findMany({
      where: { partId: id },
      orderBy: { createdAt: "desc" }
    });
  }

  async linkedWorkOrders(partId: string, actor?: Actor) {
    await this.part(partId, actor);
    const tenantId = this.resolveTenantId(actor);

    return this.prisma.workOrder.findMany({
      where: {
        ...(tenantId !== undefined ? { tenantId } : {}),
        parts: {
          some: {
            partId
          }
        }
      },
      include: {
        asset: true,
        vehicle: true,
        technician: true,
        parts: {
          where: {
            partId
          },
          include: {
            part: true
          }
        }
      },
      orderBy: {
        createdAt: "desc"
      }
    });
  }

  async purchaseHistoryForPart(partId: string, actor?: Actor) {
    const part = await this.part(partId, actor);
    const tenantId = this.resolveTenantId(actor);

    if (!part.supplierId) {
      return [];
    }

    return this.prisma.purchaseOrder.findMany({
      where: {
        supplierId: part.supplierId,
        ...(tenantId !== undefined ? { tenantId } : {})
      },
      include: {
        supplier: true
      },
      orderBy: {
        orderDate: "desc"
      }
    });
  }

  async usageTrend(days = 30, actor?: Actor) {
    const safeDays = Math.max(1, Math.min(365, Math.floor(days)));
    const since = new Date();
    since.setHours(0, 0, 0, 0);
    since.setDate(since.getDate() - (safeDays - 1));
    const tenantId = this.resolveTenantId(actor);

    const movements = await this.prisma.stockMovement.findMany({
      where: {
        type: "OUT",
        createdAt: {
          gte: since
        },
        part: {
          isActive: true,
          ...(tenantId !== undefined ? { tenantId } : {})
        }
      },
      select: {
        quantity: true,
        createdAt: true
      }
    });

    const dateTotals = new Map<string, number>();

    for (let offset = 0; offset < safeDays; offset += 1) {
      const day = new Date(since);
      day.setDate(since.getDate() + offset);
      dateTotals.set(this.toDateKey(day), 0);
    }

    for (const movement of movements) {
      const key = this.toDateKey(movement.createdAt);
      dateTotals.set(key, (dateTotals.get(key) ?? 0) + movement.quantity);
    }

    return Array.from(dateTotals.entries()).map(([date, quantity]) => ({
      date,
      quantity
    }));
  }

  async topUsedParts(limit = 5, days = 30, actor?: Actor) {
    const safeLimit = Math.max(1, Math.min(25, Math.floor(limit)));
    const safeDays = Math.max(1, Math.min(365, Math.floor(days)));
    const since = new Date();
    since.setHours(0, 0, 0, 0);
    since.setDate(since.getDate() - (safeDays - 1));
    const tenantId = this.resolveTenantId(actor);

    const movements = await this.prisma.stockMovement.findMany({
      where: {
        type: "OUT",
        createdAt: {
          gte: since
        },
        part: {
          isActive: true,
          ...(tenantId !== undefined ? { tenantId } : {})
        }
      },
      select: {
        quantity: true,
        part: {
          select: {
            id: true,
            name: true,
            partNumber: true
          }
        }
      }
    });

    const totals = new Map<string, { partId: string; partName: string; partNumber: string; quantity: number }>();

    for (const movement of movements) {
      const existing = totals.get(movement.part.id);

      if (existing) {
        existing.quantity += movement.quantity;
      } else {
        totals.set(movement.part.id, {
          partId: movement.part.id,
          partName: movement.part.name,
          partNumber: movement.part.partNumber,
          quantity: movement.quantity
        });
      }
    }

    return Array.from(totals.values())
      .sort((a, b) => b.quantity - a.quantity)
      .slice(0, safeLimit);
  }

  async lowStock(actor?: Actor) {
    const tenantId = this.resolveTenantId(actor);

    return this.prisma.sparePart.findMany({
      where: {
        isActive: true,
        ...(tenantId !== undefined ? { tenantId } : {}),
        quantityInStock: {
          lte: this.prisma.sparePart.fields.reorderPoint
        }
      }
    });
  }

  async purchaseOrders(actor?: Actor) {
    const tenantId = this.resolveTenantId(actor);

    return this.prisma.purchaseOrder.findMany({
      where: {
        ...(tenantId !== undefined ? { tenantId } : {})
      },
      include: {
        supplier: true,
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
        erpSyncAttempts: {
          orderBy: {
            createdAt: "desc"
          }
        },
        lines: true
      },
      orderBy: { createdAt: "desc" }
    });
  }

  async getPurchaseOrder(id: string, actor?: Actor) {
    const tenantId = this.resolveTenantId(actor);
    const order = await this.prisma.purchaseOrder.findFirst({
      where: {
        id,
        ...(tenantId !== undefined ? { tenantId } : {})
      },
      include: {
        supplier: true,
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
        erpSyncAttempts: {
          orderBy: {
            createdAt: "desc"
          }
        },
        lines: {
          include: {
            part: true
          }
        }
      }
    });

    if (!order) {
      throw new NotFoundException("Purchase order not found");
    }

    return order;
  }

  async createPurchaseOrder(
    data: {
      poNumber: string;
      supplierId: string;
      orderDate: string;
      expectedDate?: string;
      totalAmount: number;
      notes?: string;
      pettyCash?: boolean;
      lines?: Array<{ partId?: string; description: string; quantity: number; unitCost: number }>;
    },
    actor?: Actor
  ) {
    const tenantId = this.resolveTenantId(actor);

    const supplier = await this.prisma.supplier.findFirst({
      where: {
        id: data.supplierId,
        ...(tenantId !== undefined ? { tenantId } : {})
      }
    });

    if (!supplier) {
      throw new BadRequestException("Supplier not found in tenant context");
    }

    const requiresFinanceApproval = this.requiresFinanceApproval(data.totalAmount, data.pettyCash);

    const created = await this.prisma.$transaction(async (tx) => {
      const purchaseOrder = await tx.purchaseOrder.create({
        data: {
          tenantId: tenantId ?? supplier.tenantId ?? null,
          poNumber: data.poNumber,
          supplierId: data.supplierId,
          orderDate: new Date(data.orderDate),
          expectedDate: data.expectedDate ? new Date(data.expectedDate) : undefined,
          totalAmount: data.totalAmount,
          notes: data.notes,
          workflowStatus: PurchaseOrderWorkflowStatus.PENDING_OPERATIONAL,
          requiresFinanceApproval
        }
      });

      const approvalRows = [
        {
          tenantId: tenantId ?? supplier.tenantId ?? null,
          purchaseOrderId: purchaseOrder.id,
          stage: ApprovalStage.OPERATIONAL,
          sequence: 1,
          status: ApprovalDecisionStatus.PENDING
        },
        {
          tenantId: tenantId ?? supplier.tenantId ?? null,
          purchaseOrderId: purchaseOrder.id,
          stage: ApprovalStage.FINANCE,
          sequence: 2,
          status: requiresFinanceApproval ? ApprovalDecisionStatus.PENDING : ApprovalDecisionStatus.SKIPPED,
          reason: requiresFinanceApproval ? null : "Finance approval not required"
        }
      ];

      for (const approvalRow of approvalRows) {
        await tx.purchaseOrderApproval.create({ data: approvalRow });
      }

      if (Array.isArray(data.lines) && data.lines.length > 0) {
        const lineRows = data.lines.map((line) => ({
          tenantId: tenantId ?? supplier.tenantId ?? null,
          purchaseOrderId: purchaseOrder.id,
          partId: line.partId,
          description: line.description,
          quantity: line.quantity,
          unitCost: line.unitCost,
          totalCost: line.quantity * line.unitCost
        }));

        for (const lineRow of lineRows) {
          await tx.purchaseOrderLine.create({ data: lineRow });
        }
      }

      return purchaseOrder;
    });

    return this.getPurchaseOrder(created.id, actor);
  }

  async updatePurchaseOrder(
    id: string,
    data: Partial<{ status: "PENDING" | "ORDERED" | "PARTIALLY_RECEIVED" | "RECEIVED" | "CANCELLED"; receivedDate: string; notes: string }>,
    actor?: Actor
  ) {
    const order = await this.getPurchaseOrder(id, actor);
    const isPostApprovalProgression =
      data.status === POStatus.ORDERED ||
      data.status === POStatus.PARTIALLY_RECEIVED ||
      data.status === POStatus.RECEIVED;

    if (isPostApprovalProgression && order.workflowStatus !== PurchaseOrderWorkflowStatus.APPROVED) {
      throw new BadRequestException("Purchase order cannot advance to ordered/received states before approvals are complete");
    }

    return this.prisma.purchaseOrder.update({
      where: { id },
      data: {
        status: data.status,
        receivedDate: data.receivedDate ? new Date(data.receivedDate) : undefined,
        notes: data.notes
      }
    });
  }

  async approvePurchaseOrderOperational(
    id: string,
    data: { reason?: string },
    actor?: Actor
  ) {
    const approver = this.assertActor(actor);
    const order = await this.getPurchaseOrder(id, actor);

    if (order.workflowStatus !== PurchaseOrderWorkflowStatus.PENDING_OPERATIONAL) {
      throw new BadRequestException("Purchase order is not awaiting operational approval");
    }

    const nextWorkflow = order.requiresFinanceApproval
      ? PurchaseOrderWorkflowStatus.PENDING_FINANCE
      : PurchaseOrderWorkflowStatus.APPROVED;

    await this.prisma.$transaction(async (tx) => {
      await tx.purchaseOrderApproval.update({
        where: {
          purchaseOrderId_stage: {
            purchaseOrderId: id,
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

      if (!order.requiresFinanceApproval) {
        await tx.purchaseOrderApproval.update({
          where: {
            purchaseOrderId_stage: {
              purchaseOrderId: id,
              stage: ApprovalStage.FINANCE
            }
          },
          data: {
            status: ApprovalDecisionStatus.SKIPPED,
            reason: "Finance approval not required"
          }
        });
      }

      await tx.purchaseOrder.update({
        where: { id },
        data: {
          workflowStatus: nextWorkflow
        }
      });
    });

    await this.recordAudit({
      entity: "PURCHASE_ORDER_APPROVAL",
      entityId: id,
      action: AuditAction.UPDATE,
      actor,
      reason: data.reason,
      metadata: {
        stage: ApprovalStage.OPERATIONAL,
        nextWorkflow
      }
    });

    await this.notificationsService.createNotification({
      userId: approver.sub,
      title: "Purchase order approval recorded",
      message: order.requiresFinanceApproval
        ? "Operational approval completed. Finance approval pending."
        : "Purchase order fully approved (finance step skipped).",
      type: NotificationType.PURCHASE_ORDER_APPROVED,
      priority: NotificationPriority.INFO,
      referenceId: id,
      referenceType: "PurchaseOrder",
      metadata: {
        stage: "OPERATIONAL",
        nextWorkflow,
        requiresFinanceApproval: order.requiresFinanceApproval
      }
    });

    return this.getPurchaseOrder(id, actor);
  }

  async approvePurchaseOrderFinance(
    id: string,
    data: { reason?: string },
    actor?: Actor
  ) {
    const approver = this.assertActor(actor);
    const order = await this.getPurchaseOrder(id, actor);

    if (order.workflowStatus !== PurchaseOrderWorkflowStatus.PENDING_FINANCE) {
      throw new BadRequestException("Purchase order is not awaiting finance approval");
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.purchaseOrderApproval.update({
        where: {
          purchaseOrderId_stage: {
            purchaseOrderId: id,
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

      await tx.purchaseOrder.update({
        where: { id },
        data: {
          workflowStatus: PurchaseOrderWorkflowStatus.APPROVED
        }
      });
    });

    await this.recordAudit({
      entity: "PURCHASE_ORDER_APPROVAL",
      entityId: id,
      action: AuditAction.UPDATE,
      actor,
      reason: data.reason,
      metadata: {
        stage: ApprovalStage.FINANCE,
        nextWorkflow: PurchaseOrderWorkflowStatus.APPROVED
      }
    });

    await this.notificationsService.createNotification({
      userId: approver.sub,
      title: "Purchase order finance approval recorded",
      message: "Purchase order is now fully approved.",
      type: NotificationType.PURCHASE_ORDER_APPROVED,
      priority: NotificationPriority.INFO,
      referenceId: id,
      referenceType: "PurchaseOrder",
      metadata: {
        stage: "FINANCE",
        nextWorkflow: PurchaseOrderWorkflowStatus.APPROVED
      }
    });

    return this.getPurchaseOrder(id, actor);
  }

  async rejectPurchaseOrder(id: string, data: { reason: string }, actor?: Actor) {
    const approver = this.assertActor(actor);
    const order = await this.getPurchaseOrder(id, actor);

    if (!data.reason?.trim()) {
      throw new BadRequestException("Rejection reason is required");
    }

    if (order.workflowStatus === PurchaseOrderWorkflowStatus.REJECTED) {
      throw new BadRequestException("Purchase order is already rejected");
    }

    const stage =
      order.workflowStatus === PurchaseOrderWorkflowStatus.PENDING_FINANCE
        ? ApprovalStage.FINANCE
        : ApprovalStage.OPERATIONAL;

    await this.prisma.$transaction(async (tx) => {
      await tx.purchaseOrderApproval.update({
        where: {
          purchaseOrderId_stage: {
            purchaseOrderId: id,
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

      await tx.purchaseOrder.update({
        where: { id },
        data: {
          workflowStatus: PurchaseOrderWorkflowStatus.REJECTED,
          status: POStatus.CANCELLED,
          notes: order.notes
            ? `${order.notes}\n[${new Date().toISOString()}] REJECTION: ${data.reason.trim()}`
            : `[${new Date().toISOString()}] REJECTION: ${data.reason.trim()}`
        }
      });
    });

    await this.recordAudit({
      entity: "PURCHASE_ORDER_APPROVAL",
      entityId: id,
      action: AuditAction.UPDATE,
      actor,
      reason: data.reason,
      metadata: {
        stage,
        nextWorkflow: PurchaseOrderWorkflowStatus.REJECTED
      }
    });

    await this.notificationsService.createNotification({
      userId: approver.sub,
      title: "Purchase order rejected",
      message: "Purchase order has been rejected.",
      type: NotificationType.PURCHASE_ORDER_REJECTED,
      priority: NotificationPriority.WARNING,
      referenceId: id,
      referenceType: "PurchaseOrder",
      metadata: {
        stage,
        reason: data.reason.trim()
      }
    });

    return this.getPurchaseOrder(id, actor);
  }

  private async executeMockErpSync(
    orderId: string,
    data: { forceFailure?: boolean; note?: string },
    actor?: Actor
  ) {
    const order = await this.getPurchaseOrder(orderId, actor);

    if (order.workflowStatus !== PurchaseOrderWorkflowStatus.APPROVED) {
      throw new BadRequestException("Purchase order must be approved before ERP sync");
    }

    const attempt = (order.erpSyncAttempts[0]?.attempt ?? 0) + 1;
    const shouldFail = Boolean(data.forceFailure) || order.notes?.includes("[ERP_FAIL]") === true;

    const created = await this.prisma.purchaseOrderErpSync.create({
      data: {
        tenantId: order.tenantId,
        purchaseOrderId: order.id,
        provider: "MOCK_ERP",
        status: ErpSyncStatus.PENDING,
        attempt,
        triggeredById: actor?.sub,
        requestPayload: {
          poNumber: order.poNumber,
          totalAmount: order.totalAmount,
          note: data.note ?? null
        }
      }
    });

    if (shouldFail) {
      const failed = await this.prisma.purchaseOrderErpSync.update({
        where: { id: created.id },
        data: {
          status: ErpSyncStatus.FAILED,
          lastAttemptAt: new Date(),
          nextRetryAt: new Date(Date.now() + 15 * 60 * 1000),
          errorMessage: "Mock ERP rejected payload"
        }
      });

      await this.recordAudit({
        entity: "PURCHASE_ORDER_ERP_SYNC",
        entityId: failed.id,
        action: AuditAction.UPDATE,
        actor,
        reason: "ERP sync failed",
        metadata: {
          purchaseOrderId: order.id,
          attempt: failed.attempt,
          status: failed.status,
          errorMessage: failed.errorMessage
        }
      });

      if (actor?.sub) {
        await this.notificationsService.createNotification({
          userId: actor.sub,
          title: "ERP sync failed",
          message: `ERP sync failed for PO ${order.poNumber}. Retry is available.`,
          type: NotificationType.ERP_SYNC_FAILED,
          priority: NotificationPriority.CRITICAL,
          referenceId: order.id,
          referenceType: "PurchaseOrder",
          metadata: {
            syncId: failed.id,
            attempt: failed.attempt,
            errorMessage: failed.errorMessage
          }
        });
      }

      return failed;
    }

    const succeeded = await this.prisma.purchaseOrderErpSync.update({
      where: { id: created.id },
      data: {
        status: ErpSyncStatus.SUCCESS,
        lastAttemptAt: new Date(),
        responsePayload: {
          accepted: true,
          providerRef: `MOCK-ERP-${order.poNumber}-${attempt}`
        }
      }
    });

    if (order.status === POStatus.PENDING) {
      await this.prisma.purchaseOrder.update({
        where: { id: order.id },
        data: {
          status: POStatus.ORDERED
        }
      });
    }

    await this.recordAudit({
      entity: "PURCHASE_ORDER_ERP_SYNC",
      entityId: succeeded.id,
      action: AuditAction.UPDATE,
      actor,
      reason: "ERP sync succeeded",
      metadata: {
        purchaseOrderId: order.id,
        attempt: succeeded.attempt,
        status: succeeded.status
      }
    });

    if (actor?.sub) {
      await this.notificationsService.createNotification({
        userId: actor.sub,
        title: "ERP sync completed",
        message: `ERP sync completed for PO ${order.poNumber}.`,
        type: NotificationType.ERP_SYNC_SUCCESS,
        priority: NotificationPriority.INFO,
        referenceId: order.id,
        referenceType: "PurchaseOrder",
        metadata: {
          syncId: succeeded.id,
          attempt: succeeded.attempt
        }
      });
    }

    return succeeded;
  }

  private async executeConfiguredErpSync(
    orderId: string,
    data: { forceFailure?: boolean; note?: string },
    actor?: Actor
  ) {
    const order = await this.getPurchaseOrder(orderId, actor);

    if (order.workflowStatus !== PurchaseOrderWorkflowStatus.APPROVED) {
      throw new BadRequestException("Purchase order must be approved before ERP sync");
    }

    const attempt = (order.erpSyncAttempts[0]?.attempt ?? 0) + 1;
    const provider = this.erpSyncProviderService.describeProvider();
    const requestPayload = {
      poNumber: order.poNumber,
      totalAmount: order.totalAmount,
      note: data.note ?? null,
      supplier: order.supplier,
      lines: order.lines
    };

    const created = await this.prisma.purchaseOrderErpSync.create({
      data: {
        tenantId: order.tenantId,
        purchaseOrderId: order.id,
        provider: provider.providerId,
        status: ErpSyncStatus.PENDING,
        attempt,
        triggeredById: actor?.sub,
        requestPayload: requestPayload as Prisma.InputJsonValue
      }
    });

    try {
      const response = await this.erpSyncProviderService.syncPurchaseOrder(requestPayload);
      if (!response.accepted) {
        throw new Error("ERP provider rejected payload");
      }

      const succeeded = await this.prisma.purchaseOrderErpSync.update({
        where: { id: created.id },
        data: {
          status: ErpSyncStatus.SUCCESS,
          lastAttemptAt: new Date(),
          responsePayload: {
            accepted: true,
            providerRef: response.providerRef ?? null,
            raw: response.raw ?? null
          } as Prisma.InputJsonValue
        }
      });

      if (order.status === POStatus.PENDING) {
        await this.prisma.purchaseOrder.update({
          where: { id: order.id },
          data: { status: POStatus.ORDERED }
        });
      }

      await this.recordAudit({
        entity: "PURCHASE_ORDER_ERP_SYNC",
        entityId: succeeded.id,
        action: AuditAction.UPDATE,
        actor,
        reason: "ERP sync succeeded",
        metadata: {
          purchaseOrderId: order.id,
          attempt: succeeded.attempt,
          status: succeeded.status,
          provider: provider.providerId
        }
      });

      if (actor?.sub) {
        await this.notificationsService.createNotification({
          userId: actor.sub,
          title: "ERP sync completed",
          message: `ERP sync completed for PO ${order.poNumber}.`,
          type: NotificationType.ERP_SYNC_SUCCESS,
          priority: NotificationPriority.INFO,
          referenceId: order.id,
          referenceType: "PurchaseOrder",
          metadata: {
            syncId: succeeded.id,
            attempt: succeeded.attempt,
            provider: provider.providerId
          }
        });
      }

      return succeeded;
    } catch (error) {
      const failed = await this.prisma.purchaseOrderErpSync.update({
        where: { id: created.id },
        data: {
          status: ErpSyncStatus.FAILED,
          lastAttemptAt: new Date(),
          nextRetryAt: new Date(Date.now() + 15 * 60 * 1000),
          errorMessage: (error as Error).message
        }
      });

      await this.recordAudit({
        entity: "PURCHASE_ORDER_ERP_SYNC",
        entityId: failed.id,
        action: AuditAction.UPDATE,
        actor,
        reason: "ERP sync failed",
        metadata: {
          purchaseOrderId: order.id,
          attempt: failed.attempt,
          status: failed.status,
          provider: provider.providerId,
          errorMessage: failed.errorMessage
        }
      });

      if (actor?.sub) {
        await this.notificationsService.createNotification({
          userId: actor.sub,
          title: "ERP sync failed",
          message: `ERP sync failed for PO ${order.poNumber}. Retry is available.`,
          type: NotificationType.ERP_SYNC_FAILED,
          priority: NotificationPriority.CRITICAL,
          referenceId: order.id,
          referenceType: "PurchaseOrder",
          metadata: {
            syncId: failed.id,
            attempt: failed.attempt,
            provider: provider.providerId,
            errorMessage: failed.errorMessage
          }
        });
      }

      return failed;
    }
  }

  async syncPurchaseOrderToErp(
    id: string,
    data: { forceFailure?: boolean; note?: string },
    actor?: Actor
  ) {
    try {
      this.erpSyncProviderService.assertCanUseSelectedProvider();
    } catch (error) {
      throw new BadRequestException((error as Error).message);
    }

    return this.erpSyncProviderService.mode === "mock"
      ? this.executeMockErpSync(id, data, actor)
      : this.executeConfiguredErpSync(id, data, actor);
  }

  async retryPurchaseOrderErpSync(
    id: string,
    data: { forceFailure?: boolean; note?: string },
    actor?: Actor
  ) {
    const order = await this.getPurchaseOrder(id, actor);
    const latestFailedAttempt = order.erpSyncAttempts.find((attempt) => attempt.status === ErpSyncStatus.FAILED);

    if (!latestFailedAttempt) {
      throw new BadRequestException("No failed ERP sync attempt found for retry");
    }

    const retried = await this.syncPurchaseOrderToErp(id, data, actor);

    await this.recordAudit({
      entity: "PURCHASE_ORDER_ERP_SYNC",
      entityId: retried.id,
      action: AuditAction.UPDATE,
      actor,
      reason: "ERP sync retry triggered",
      metadata: {
        purchaseOrderId: id,
        previousFailedSyncId: latestFailedAttempt.id,
        retrySyncId: retried.id
      }
    });

    if (actor?.sub) {
      await this.notificationsService.createNotification({
        userId: actor.sub,
        title: "ERP sync retry executed",
        message: "ERP sync retry was executed for the selected purchase order.",
        type: NotificationType.ERP_SYNC_RETRIED,
        priority: NotificationPriority.WARNING,
        referenceId: id,
        referenceType: "PurchaseOrder",
        metadata: {
          retrySyncId: retried.id,
          previousFailedSyncId: latestFailedAttempt.id
        }
      });
    }

    return retried;
  }
}
