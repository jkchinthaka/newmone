import { createHash } from "crypto";
import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import {
  ApprovalDecisionStatus,
  ApprovalStage,
  AuditAction,
  ErpSyncStatus,
  MovementType,
  NotificationPriority,
  NotificationType,
  PartRequestStatus,
  POStatus,
  Prisma,
  PurchaseOrderWorkflowStatus,
  RoleName
} from "@prisma/client";

import { requestContext } from "../../common/context/request-context";
import { PUBLIC_USER_SUMMARY_SELECT } from "../../common/selects/public-user.select";
import { PrismaService } from "../../database/prisma.service";
import { assertTenantEntityExists, requireTenantId } from "../../common/utils/tenant-scope.util";
import type { JwtPayload } from "../auth/auth.types";
import { NotificationsService } from "../notifications/notifications.service";
import {
  assertMakerCheckerSeparation,
  assertReasonProvided,
  isAdminRole
} from "../../common/utils/fraud-control.util";
import {
  buildSafeErpRequestPayload,
  buildSafeErpResponsePayload,
  sanitizeErpErrorCode,
  sanitizeErpErrorMessage
} from "./erp-error-sanitize.util";
import {
  calculatePurchaseOrderTotals,
  clientTotalMismatch,
  roundMoney
} from "./procurement-money.util";
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

  private resolveTenantId(actor?: Actor): string {
    return requireTenantId(actor?.tenantId);
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
        tenantId
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
        tenantId
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
        tenantId
      }
    });

    if (existing) {
      throw new BadRequestException("Part number must be unique within tenant context");
    }

    if ((data.reorderPoint ?? 0) >= (data.minimumStock ?? 0) && (data.minimumStock ?? 0) > 0) {
      throw new BadRequestException("Reorder point must be less than minimum stock");
    }

    // Cross-tenant FK validation: referenced supplier must belong to the active tenant.
    if (data.supplierId) {
      await assertTenantEntityExists(this.prisma.supplier, data.supplierId, {
        tenantId,
        entityName: "Supplier"
      });
    }

    return this.prisma.sparePart.create({
      data: {
        tenantId,
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
        tenantId
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
        tenantId
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

  async stockOut(
    id: string,
    quantity: number,
    options: {
      workOrderId?: string;
      notes?: string;
      overrideReason?: string;
      idempotencyKey?: string;
    },
    actor?: Actor
  ) {
    const part = await this.part(id, actor);
    const tenantId = this.resolveTenantId(actor);
    const idempotencyKey = options.idempotencyKey?.trim() || undefined;

    if (!options.workOrderId?.trim()) {
      await this.recordAudit({
        entity: "PART_STOCK_ISSUE",
        entityId: id,
        action: AuditAction.UPDATE,
        actor,
        reason: options.notes,
        metadata: {
          event: "parts_issue_blocked_no_work_order",
          quantity,
          source: "inventory.stockOut",
          overrideFlag: false
        }
      });
      throw new BadRequestException(
        "Parts cannot be issued without a valid work order. Use an approved work order part request."
      );
    }

    if (idempotencyKey) {
      const existing = await this.prisma.inventoryStockIssueIdempotency.findUnique({
        where: {
          tenantId_key: {
            tenantId,
            key: idempotencyKey
          }
        }
      });
      if (existing) {
        if (existing.partId !== id || existing.quantity !== quantity || existing.workOrderId !== options.workOrderId) {
          throw new BadRequestException(
            "Idempotency key was already used with a different stock-out payload for this tenant."
          );
        }
        // Replay: return current part without a second deduction.
        return this.part(id, actor);
      }
    }

    const workOrder = await this.prisma.workOrder.findFirst({
      where: {
        id: options.workOrderId,
        tenantId
      },
      select: { id: true, status: true, woNumber: true }
    });

    if (!workOrder) {
      throw new BadRequestException("Work order not found for stock issue.");
    }

    if (workOrder.status === "COMPLETED" || workOrder.status === "CANCELLED") {
      if (!options.overrideReason?.trim()) {
        throw new BadRequestException("Cannot issue parts against a closed work order without override reason.");
      }
    }

    if (!Number.isFinite(quantity) || quantity <= 0) {
      throw new BadRequestException("Stock-out quantity must be greater than 0");
    }

    try {
      const updated = await this.prisma.$transaction(async (tx) => {
        // Atomic conditional decrement — concurrent issues cannot both consume the same units.
        const decremented = await tx.sparePart.updateMany({
          where: {
            id,
            tenantId,
            isActive: true,
            quantityInStock: { gte: quantity }
          },
          data: {
            quantityInStock: { decrement: quantity }
          }
        });

        if (decremented.count !== 1) {
          throw new BadRequestException("Stock quantity cannot go below 0");
        }

        const movement = await tx.stockMovement.create({
          data: {
            tenantId,
            partId: id,
            type: "OUT",
            quantity,
            workOrderId: workOrder.id,
            actorUserId: actor?.sub,
            reference: `work-order:${workOrder.id}`,
            notes: options.notes
          }
        });

        if (idempotencyKey) {
          await tx.inventoryStockIssueIdempotency.create({
            data: {
              tenantId,
              key: idempotencyKey,
              partId: id,
              movementId: movement.id,
              workOrderId: workOrder.id,
              quantity
            }
          });
        }

        return tx.sparePart.findFirstOrThrow({
          where: { id, tenantId }
        });
      });

      await this.recordAudit({
        entity: "PART_STOCK_ISSUE",
        entityId: id,
        action: AuditAction.UPDATE,
        actor,
        reason: options.overrideReason ?? options.notes,
        metadata: {
          quantity,
          workOrderId: workOrder.id,
          woNumber: workOrder.woNumber,
          source: "inventory.stockOut",
          event: options.overrideReason ? "parts_issue_override" : "parts_issued_against_work_order",
          overrideFlag: Boolean(options.overrideReason?.trim()),
          idempotencyKey: idempotencyKey ?? null
        }
      });

      return updated;
    } catch (error) {
      if (error instanceof BadRequestException && error.message.includes("cannot go below 0")) {
        await this.recordAudit({
          entity: "PART_STOCK_ISSUE",
          entityId: id,
          action: AuditAction.UPDATE,
          actor,
          reason: "negative_stock_blocked",
          metadata: { event: "negative_stock_blocked", quantity, available: part.quantityInStock }
        });
      }
      // Concurrent first-writer wins on idempotency unique key — treat as replay.
      if (
        idempotencyKey &&
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === "P2002"
      ) {
        const raced = await this.prisma.inventoryStockIssueIdempotency.findUnique({
          where: { tenantId_key: { tenantId, key: idempotencyKey } }
        });
        if (raced) {
          return this.part(id, actor);
        }
      }
      throw error;
    }
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
        tenantId,
        parts: {
          some: {
            partId
          }
        }
      },
      include: {
        asset: true,
        vehicle: true,
        technician: { select: PUBLIC_USER_SUMMARY_SELECT },
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
        tenantId
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
          tenantId
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
          tenantId
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
        tenantId,
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
        tenantId
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
        tenantId
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
        },
        receipts: {
          include: { lines: true },
          orderBy: { createdAt: "desc" }
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
      totalAmount?: number;
      notes?: string;
      pettyCash?: boolean;
      emergencyOverride?: boolean;
      emergencyOverrideReason?: string;
      lines: Array<{
        partId?: string;
        partRequestId?: string;
        description: string;
        quantity: number;
        unitCost: number;
      }>;
    },
    actor?: Actor
  ) {
    const creator = this.assertActor(actor);
    const tenantId = this.resolveTenantId(actor);

    if (!Array.isArray(data.lines) || data.lines.length === 0) {
      throw new BadRequestException("Purchase order requires at least one line");
    }

    const supplier = await this.prisma.supplier.findFirst({
      where: { id: data.supplierId, tenantId }
    });
    if (!supplier) {
      throw new BadRequestException("Supplier not found in tenant context");
    }
    if (!supplier.isActive) {
      throw new BadRequestException("Supplier is inactive");
    }
    if (supplier.blacklisted) {
      if (!(data.emergencyOverride && isAdminRole(creator.role))) {
        throw new BadRequestException("Supplier is blacklisted");
      }
      assertReasonProvided("emergencyOverrideReason", data.emergencyOverrideReason);
    }

    const { lineTotals, headerTotal } = calculatePurchaseOrderTotals(data.lines);
    if (clientTotalMismatch(headerTotal, data.totalAmount)) {
      throw new BadRequestException(
        `Client totalAmount differs from server-calculated total by more than 0.009 (client=${data.totalAmount}, server=${headerTotal})`
      );
    }

    for (const line of data.lines) {
      if (!line.partId) {
        throw new BadRequestException("Each purchase order line requires partId");
      }
      const part = await this.prisma.sparePart.findFirst({
        where: { id: line.partId, tenantId, isActive: true }
      });
      if (!part) {
        throw new BadRequestException(`Part ${line.partId} not found or inactive in tenant`);
      }
      if (line.partRequestId) {
        await this.assertPartRequestEligibleForProcurement(line.partRequestId, line.partId, line.quantity, tenantId);
      }
    }

    const requiresFinanceApproval = this.requiresFinanceApproval(headerTotal, data.pettyCash);

    const created = await this.prisma.$transaction(async (tx) => {
      const purchaseOrder = await tx.purchaseOrder.create({
        data: {
          tenantId,
          poNumber: data.poNumber,
          supplierId: data.supplierId,
          orderDate: new Date(data.orderDate),
          expectedDate: data.expectedDate ? new Date(data.expectedDate) : undefined,
          totalAmount: headerTotal,
          notes: data.notes,
          workflowStatus: PurchaseOrderWorkflowStatus.PENDING_OPERATIONAL,
          requiresFinanceApproval,
          createdById: creator.sub,
          lastModifiedById: creator.sub
        }
      });

      for (const approvalRow of [
        {
          tenantId,
          purchaseOrderId: purchaseOrder.id,
          stage: ApprovalStage.OPERATIONAL,
          sequence: 1,
          status: ApprovalDecisionStatus.PENDING
        },
        {
          tenantId,
          purchaseOrderId: purchaseOrder.id,
          stage: ApprovalStage.FINANCE,
          sequence: 2,
          status: requiresFinanceApproval ? ApprovalDecisionStatus.PENDING : ApprovalDecisionStatus.SKIPPED,
          reason: requiresFinanceApproval ? null : "Finance approval not required"
        }
      ]) {
        await tx.purchaseOrderApproval.create({ data: approvalRow });
      }

      for (let i = 0; i < data.lines.length; i += 1) {
        const line = data.lines[i];
        await tx.purchaseOrderLine.create({
          data: {
            tenantId,
            purchaseOrderId: purchaseOrder.id,
            partId: line.partId,
            partRequestId: line.partRequestId,
            description: line.description,
            quantity: line.quantity,
            unitCost: roundMoney(line.unitCost),
            totalCost: lineTotals[i]
          }
        });
      }

      return purchaseOrder;
    });

    await this.recordAudit({
      entity: "PURCHASE_ORDER",
      entityId: created.id,
      action: AuditAction.CREATE,
      actor,
      metadata: {
        poNumber: created.poNumber,
        totalAmount: headerTotal,
        lineCount: data.lines.length
      }
    });

    return this.getPurchaseOrder(created.id, actor);
  }

  private async assertPartRequestEligibleForProcurement(
    partRequestId: string,
    partId: string,
    quantity: number,
    tenantId: string
  ) {
    const partRequest = await this.prisma.partRequest.findFirst({
      where: { id: partRequestId, tenantId }
    });
    if (!partRequest) {
      throw new BadRequestException("Part request not found in tenant context");
    }
    if (partRequest.partId !== partId) {
      throw new BadRequestException("Part request partId does not match line partId");
    }
    if (
      partRequest.status !== PartRequestStatus.APPROVED &&
      partRequest.status !== PartRequestStatus.PARTIALLY_ISSUED
    ) {
      throw new BadRequestException("Part request must be APPROVED (procurement eligible)");
    }

    const approvedQty = partRequest.approvedQuantity ?? partRequest.requestedQuantity;
    const linked = await this.prisma.purchaseOrderLine.aggregate({
      where: { tenantId, partRequestId },
      _sum: { quantity: true }
    });
    const outstanding = approvedQty - partRequest.issuedQuantity - (linked._sum.quantity ?? 0);
    if (outstanding <= 0) {
      throw new BadRequestException("Part request has no outstanding procurement quantity");
    }
    if (quantity > outstanding) {
      throw new BadRequestException(`Line quantity exceeds outstanding procurement qty (${outstanding})`);
    }
  }

  async updatePurchaseOrder(
    id: string,
    data: Partial<{ status: "PENDING" | "ORDERED" | "PARTIALLY_RECEIVED" | "RECEIVED" | "CANCELLED"; receivedDate: string; notes: string }>,
    actor?: Actor
  ) {
    const order = await this.getPurchaseOrder(id, actor);
    const modifier = this.assertActor(actor);

    if (data.status === POStatus.PARTIALLY_RECEIVED || data.status === POStatus.RECEIVED) {
      throw new BadRequestException(
        "Cannot set PARTIALLY_RECEIVED or RECEIVED via PATCH; use POST /purchase-orders/:id/receipts"
      );
    }

    if (data.status === POStatus.ORDERED) {
      throw new BadRequestException("ORDERED status is set by successful ERP sync only");
    }

    if (data.status === POStatus.CANCELLED && order.workflowStatus === PurchaseOrderWorkflowStatus.APPROVED) {
      throw new BadRequestException("Approved purchase orders cannot be cancelled via PATCH without reject flow");
    }

    return this.prisma.purchaseOrder.update({
      where: { id },
      data: {
        status: data.status,
        receivedDate: data.receivedDate ? new Date(data.receivedDate) : undefined,
        notes: data.notes,
        lastModifiedById: modifier.sub
      }
    });
  }
  async approvePurchaseOrderOperational(
    id: string,
    data: { reason?: string; emergencyOverrideReason?: string },
    actor?: Actor
  ) {
    const approver = this.assertActor(actor);
    const order = await this.getPurchaseOrder(id, actor);

    if (order.workflowStatus !== PurchaseOrderWorkflowStatus.PENDING_OPERATIONAL) {
      throw new BadRequestException("Purchase order is not awaiting operational approval");
    }

    if (order.createdById) {
      try {
        assertMakerCheckerSeparation({
          requesterId: order.createdById,
          approverId: approver.sub,
          approverRole: approver.role,
          flow: "purchase order operational approval"
        });
      } catch (error) {
        if (data.emergencyOverrideReason && isAdminRole(approver.role)) {
          assertReasonProvided("emergencyOverrideReason", data.emergencyOverrideReason);
        } else {
          throw error;
        }
      }
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
          reason: data.reason?.trim() || data.emergencyOverrideReason?.trim() || null
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
          workflowStatus: nextWorkflow,
          lastModifiedById: approver.sub
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

    await this.notifyPurchaseOrderActor(order.createdById || approver.sub, {
      title: "Purchase order approval recorded",
      message: order.requiresFinanceApproval
        ? "Operational approval completed. Finance approval pending."
        : "Purchase order fully approved (finance step skipped).",
      type: NotificationType.PURCHASE_ORDER_APPROVED,
      priority: NotificationPriority.INFO,
      referenceId: id,
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
    data: { reason?: string; emergencyOverrideReason?: string },
    actor?: Actor
  ) {
    const approver = this.assertActor(actor);
    const order = await this.getPurchaseOrder(id, actor);

    if (order.workflowStatus !== PurchaseOrderWorkflowStatus.PENDING_FINANCE) {
      throw new BadRequestException("Purchase order is not awaiting finance approval");
    }

    if (order.createdById) {
      try {
        assertMakerCheckerSeparation({
          requesterId: order.createdById,
          approverId: approver.sub,
          approverRole: approver.role,
          flow: "purchase order finance approval"
        });
      } catch (error) {
        if (data.emergencyOverrideReason && isAdminRole(approver.role)) {
          assertReasonProvided("emergencyOverrideReason", data.emergencyOverrideReason);
        } else {
          throw error;
        }
      }
    }

    const operationalApproval = order.approvals.find((a) => a.stage === ApprovalStage.OPERATIONAL);
    if (
      operationalApproval?.actorId &&
      operationalApproval.actorId === approver.sub &&
      !isAdminRole(approver.role)
    ) {
      throw new BadRequestException(
        "Same actor cannot perform both operational and finance approval unless admin override with reason"
      );
    }
    if (
      operationalApproval?.actorId &&
      operationalApproval.actorId === approver.sub &&
      isAdminRole(approver.role)
    ) {
      assertReasonProvided("emergencyOverrideReason", data.emergencyOverrideReason || data.reason);
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
          reason: data.reason?.trim() || data.emergencyOverrideReason?.trim() || null
        }
      });

      await tx.purchaseOrder.update({
        where: { id },
        data: {
          workflowStatus: PurchaseOrderWorkflowStatus.APPROVED,
          lastModifiedById: approver.sub
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

    await this.notifyPurchaseOrderActor(order.createdById || approver.sub, {
      title: "Purchase order finance approval recorded",
      message: "Purchase order is now fully approved.",
      type: NotificationType.PURCHASE_ORDER_APPROVED,
      priority: NotificationPriority.INFO,
      referenceId: id,
      metadata: {
        stage: "FINANCE",
        nextWorkflow: PurchaseOrderWorkflowStatus.APPROVED
      }
    });

    return this.getPurchaseOrder(id, actor);
  }

  private async notifyPurchaseOrderActor(
    userId: string,
    payload: {
      title: string;
      message: string;
      type: NotificationType;
      priority: NotificationPriority;
      referenceId: string;
      metadata?: Record<string, unknown>;
    }
  ) {
    if (!userId) {
      return;
    }
    await this.notificationsService.createNotification({
      userId,
      title: payload.title,
      message: payload.message,
      type: payload.type,
      priority: payload.priority,
      referenceId: payload.referenceId,
      referenceType: "PurchaseOrder",
      metadata: payload.metadata as Prisma.InputJsonValue | undefined
    });
  }

  async rejectPurchaseOrder(id: string, data: { reason: string }, actor?: Actor) {
    const approver = this.assertActor(actor);
    const order = await this.getPurchaseOrder(id, actor);

    if (!data.reason?.trim() || data.reason.trim().length < 3) {
      throw new BadRequestException("Rejection reason is required (minimum 3 characters)");
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
          lastModifiedById: approver.sub,
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

    await this.notifyPurchaseOrderActor(order.createdById || approver.sub, {
      title: "Purchase order rejected",
      message: "Purchase order has been rejected.",
      type: NotificationType.PURCHASE_ORDER_REJECTED,
      priority: NotificationPriority.WARNING,
      referenceId: id,
      metadata: {
        stage,
        reason: data.reason.trim()
      }
    });

    return this.getPurchaseOrder(id, actor);
  }
  async listPurchaseReceipts(purchaseOrderId: string, actor?: Actor) {
    const order = await this.getPurchaseOrder(purchaseOrderId, actor);
    return this.prisma.purchaseReceipt.findMany({
      where: {
        tenantId: order.tenantId ?? this.resolveTenantId(actor),
        purchaseOrderId
      },
      include: { lines: true, receivedBy: { select: { id: true, firstName: true, lastName: true, email: true } } },
      orderBy: { createdAt: "desc" }
    });
  }

  async createPurchaseReceipt(
    purchaseOrderId: string,
    data: {
      receiptNumber: string;
      supplierDeliveryNote?: string;
      notes?: string;
      idempotencyKey?: string;
      lines: Array<{
        purchaseOrderLineId: string;
        acceptedQuantity: number;
        rejectedQuantity: number;
        rejectionReason?: string;
      }>;
    },
    actor?: Actor
  ) {
    const receiver = this.assertActor(actor);
    const tenantId = this.resolveTenantId(actor);
    const order = await this.getPurchaseOrder(purchaseOrderId, actor);

    if (order.workflowStatus !== PurchaseOrderWorkflowStatus.APPROVED) {
      throw new BadRequestException("Purchase order must be workflow-APPROVED before receiving");
    }
    if (order.status !== POStatus.ORDERED && order.status !== POStatus.PARTIALLY_RECEIVED) {
      throw new BadRequestException("Purchase order status must be ORDERED or PARTIALLY_RECEIVED to receive");
    }
    if (!Array.isArray(data.lines) || data.lines.length === 0) {
      throw new BadRequestException("Receipt requires at least one line");
    }

    const idempotencyKey = data.idempotencyKey?.trim() || undefined;
    const requestHash = createHash("sha256")
      .update(JSON.stringify({ receiptNumber: data.receiptNumber, lines: data.lines }))
      .digest("hex");

    if (idempotencyKey) {
      const existing = await this.prisma.purchaseReceiptIdempotency.findUnique({
        where: { tenantId_key: { tenantId, key: idempotencyKey } }
      });
      if (existing) {
        if (existing.requestHash !== requestHash) {
          throw new BadRequestException("Idempotency key reused with a different receipt payload");
        }
        return this.prisma.purchaseReceipt.findFirstOrThrow({
          where: { id: existing.receiptId, tenantId },
          include: { lines: true }
        });
      }
    }

    const lineById = new Map(order.lines.map((line) => [line.id, line]));

    for (const line of data.lines) {
      const poLine = lineById.get(line.purchaseOrderLineId);
      if (!poLine) {
        throw new BadRequestException(`Purchase order line ${line.purchaseOrderLineId} not found on PO`);
      }
      const accepted = Number(line.acceptedQuantity) || 0;
      const rejected = Number(line.rejectedQuantity) || 0;
      if (accepted < 0 || rejected < 0) {
        throw new BadRequestException("Receipt quantities cannot be negative");
      }
      if (accepted + rejected <= 0) {
        throw new BadRequestException("Each receipt line needs accepted or rejected quantity");
      }
      if (rejected > 0 && !(line.rejectionReason && line.rejectionReason.trim().length >= 3)) {
        throw new BadRequestException("rejectionReason required when rejectedQuantity > 0");
      }
      const remaining = poLine.quantity - (poLine.receivedQuantity ?? 0);
      if (accepted + rejected > remaining) {
        throw new BadRequestException(
          `Over-receipt blocked for line ${poLine.id}: remaining=${remaining}, attempted=${accepted + rejected}`
        );
      }
    }

    const receipt = await this.prisma.$transaction(async (tx) => {
      const createdReceipt = await tx.purchaseReceipt.create({
        data: {
          tenantId,
          purchaseOrderId,
          receiptNumber: data.receiptNumber,
          receivedById: receiver.sub,
          receivedAt: new Date(),
          supplierDeliveryNote: data.supplierDeliveryNote,
          notes: data.notes
        }
      });

      for (const line of data.lines) {
        const poLine = lineById.get(line.purchaseOrderLineId)!;
        const accepted = Number(line.acceptedQuantity) || 0;
        const rejected = Number(line.rejectedQuantity) || 0;

        await tx.purchaseReceiptLine.create({
          data: {
            tenantId,
            receiptId: createdReceipt.id,
            purchaseOrderLineId: poLine.id,
            acceptedQuantity: accepted,
            rejectedQuantity: rejected,
            rejectionReason: line.rejectionReason?.trim() || null
          }
        });

        await tx.purchaseOrderLine.update({
          where: { id: poLine.id },
          data: {
            receivedQuantity: (poLine.receivedQuantity ?? 0) + accepted,
            rejectedQuantity: (poLine.rejectedQuantity ?? 0) + rejected
          }
        });

        if (accepted > 0) {
          if (!poLine.partId) {
            throw new BadRequestException("Cannot receive stock for a line without partId");
          }
          await tx.sparePart.update({
            where: { id: poLine.partId },
            data: { quantityInStock: { increment: accepted } }
          });
          await tx.stockMovement.create({
            data: {
              tenantId,
              partId: poLine.partId,
              type: MovementType.IN,
              quantity: accepted,
              reference: `PO:${order.poNumber}/GRN:${data.receiptNumber}`,
              notes: data.notes ?? "Purchase receipt",
              actorUserId: receiver.sub
            }
          });
        }
      }

      const refreshedLines = await tx.purchaseOrderLine.findMany({ where: { purchaseOrderId } });
      const allReceived = refreshedLines.every(
        (line) => (line.receivedQuantity ?? 0) + (line.rejectedQuantity ?? 0) >= line.quantity
      );
      const anyReceived = refreshedLines.some((line) => (line.receivedQuantity ?? 0) > 0);
      const nextStatus = allReceived
        ? POStatus.RECEIVED
        : anyReceived
          ? POStatus.PARTIALLY_RECEIVED
          : order.status;

      await tx.purchaseOrder.update({
        where: { id: purchaseOrderId },
        data: {
          status: nextStatus,
          receivedDate: allReceived ? new Date() : order.receivedDate,
          lastModifiedById: receiver.sub
        }
      });

      if (idempotencyKey) {
        await tx.purchaseReceiptIdempotency.create({
          data: {
            tenantId,
            key: idempotencyKey,
            purchaseOrderId,
            receiptId: createdReceipt.id,
            requestHash
          }
        });
      }

      return createdReceipt;
    });

    await this.recordAudit({
      entity: "PURCHASE_RECEIPT",
      entityId: receipt.id,
      action: AuditAction.CREATE,
      actor,
      metadata: {
        purchaseOrderId,
        receiptNumber: data.receiptNumber,
        lineCount: data.lines.length
      }
    });

    return this.prisma.purchaseReceipt.findFirstOrThrow({
      where: { id: receipt.id, tenantId },
      include: { lines: true }
    });
  }

  private assertTestModeErpFailClosed() {
    const e2e = /^(1|true|yes)$/i.test(String(process.env.E2E_TEST_MODE || ""));
    const testEnv = process.env.NODE_ENV === "test";
    if (!(e2e || testEnv)) {
      return;
    }
    const mode = this.erpSyncProviderService.mode;
    if (mode === "live") {
      throw new BadRequestException(
        "Live ERP provider is blocked when E2E_TEST_MODE or NODE_ENV=test (fail closed)"
      );
    }
  }

  private async assertErpSyncGuards(
    order: Awaited<ReturnType<InventoryService["getPurchaseOrder"]>>,
    data: { idempotencyKey?: string; forceResync?: boolean; overrideRetryWindow?: boolean }
  ) {
    this.assertTestModeErpFailClosed();

    if (order.workflowStatus !== PurchaseOrderWorkflowStatus.APPROVED) {
      throw new BadRequestException("Purchase order must be approved before ERP sync");
    }

    const attempts = order.erpSyncAttempts || [];
    const success = attempts.find((a) => a.status === ErpSyncStatus.SUCCESS);
    if (success && !data.forceResync) {
      throw new BadRequestException("ERP sync already succeeded; pass forceResync to resync explicitly");
    }

    const pending = attempts.find((a) => a.status === ErpSyncStatus.PENDING || a.status === ErpSyncStatus.RETRYING);
    if (pending) {
      throw new BadRequestException("ERP sync already in progress for this purchase order");
    }

    if (attempts.length >= 5 && !data.forceResync) {
      throw new BadRequestException("Maximum ERP sync attempts (5) exceeded");
    }

    const key = data.idempotencyKey?.trim();
    if (key) {
      const existingKey = attempts.find((a) => a.idempotencyKey === key);
      if (existingKey) {
        return existingKey;
      }
    }

    const latestFailed = attempts.find((a) => a.status === ErpSyncStatus.FAILED);
    if (latestFailed?.nextRetryAt && !data.overrideRetryWindow) {
      const next = new Date(latestFailed.nextRetryAt).getTime();
      if (Date.now() < next) {
        throw new BadRequestException("ERP sync retry window not elapsed (15 minutes); pass overrideRetryWindow");
      }
    }

    return null;
  }
  private async executeMockErpSync(
    orderId: string,
    data: {
      forceFailure?: boolean;
      note?: string;
      idempotencyKey?: string;
      forceResync?: boolean;
      overrideRetryWindow?: boolean;
    },
    actor?: Actor
  ) {
    const order = await this.getPurchaseOrder(orderId, actor);
    const replay = await this.assertErpSyncGuards(order, data);
    if (replay) {
      return replay;
    }

    const attempt = (order.erpSyncAttempts[0]?.attempt ?? 0) + 1;
    const shouldFail = Boolean(data.forceFailure) || order.notes?.includes("[ERP_FAIL]") === true;
    const safeRequest = buildSafeErpRequestPayload({
      poNumber: order.poNumber,
      totalAmount: order.totalAmount,
      lineCount: order.lines.length,
      note: data.note ?? null
    });

    const created = await this.prisma.purchaseOrderErpSync.create({
      data: {
        tenantId: order.tenantId,
        purchaseOrderId: order.id,
        provider: "MOCK_ERP",
        status: ErpSyncStatus.PENDING,
        attempt,
        triggeredById: actor?.sub,
        idempotencyKey: data.idempotencyKey?.trim() || null,
        requestPayload: safeRequest as Prisma.InputJsonValue
      }
    });

    if (shouldFail) {
      const failed = await this.prisma.purchaseOrderErpSync.update({
        where: { id: created.id },
        data: {
          status: ErpSyncStatus.FAILED,
          lastAttemptAt: new Date(),
          nextRetryAt: new Date(Date.now() + 15 * 60 * 1000),
          errorMessage: sanitizeErpErrorMessage("Mock ERP rejected payload"),
          errorCode: sanitizeErpErrorCode("MOCK_REJECTED")
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
          errorCode: failed.errorCode
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
            errorCode: failed.errorCode
          }
        });
      }

      return failed;
    }

    const providerReference = `MOCK-ERP-${order.poNumber}-${attempt}`;
    const succeeded = await this.prisma.purchaseOrderErpSync.update({
      where: { id: created.id },
      data: {
        status: ErpSyncStatus.SUCCESS,
        lastAttemptAt: new Date(),
        providerReference,
        responsePayload: buildSafeErpResponsePayload({
          accepted: true,
          providerRef: providerReference
        }) as Prisma.InputJsonValue
      }
    });

    if (order.status === POStatus.PENDING) {
      await this.prisma.purchaseOrder.update({
        where: { id: order.id },
        data: { status: POStatus.ORDERED, lastModifiedById: actor?.sub }
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
    data: {
      forceFailure?: boolean;
      note?: string;
      idempotencyKey?: string;
      forceResync?: boolean;
      overrideRetryWindow?: boolean;
    },
    actor?: Actor
  ) {
    const order = await this.getPurchaseOrder(orderId, actor);
    const replay = await this.assertErpSyncGuards(order, data);
    if (replay) {
      return replay;
    }

    const attempt = (order.erpSyncAttempts[0]?.attempt ?? 0) + 1;
    const provider = this.erpSyncProviderService.describeProvider();
    const safeRequest = buildSafeErpRequestPayload({
      poNumber: order.poNumber,
      totalAmount: order.totalAmount,
      lineCount: order.lines.length,
      note: data.note ?? null
    });

    const created = await this.prisma.purchaseOrderErpSync.create({
      data: {
        tenantId: order.tenantId,
        purchaseOrderId: order.id,
        provider: provider.providerId,
        status: ErpSyncStatus.PENDING,
        attempt,
        triggeredById: actor?.sub,
        idempotencyKey: data.idempotencyKey?.trim() || null,
        requestPayload: safeRequest as Prisma.InputJsonValue
      }
    });

    try {
      if (data.forceFailure) {
        throw new Error("Forced ERP failure");
      }
      const response = await this.erpSyncProviderService.syncPurchaseOrder({
        poNumber: order.poNumber,
        totalAmount: order.totalAmount,
        note: data.note ?? null
      });
      if (!response.accepted) {
        throw new Error("ERP provider rejected payload");
      }

      const succeeded = await this.prisma.purchaseOrderErpSync.update({
        where: { id: created.id },
        data: {
          status: ErpSyncStatus.SUCCESS,
          lastAttemptAt: new Date(),
          providerReference: response.providerRef ?? null,
          responsePayload: buildSafeErpResponsePayload({
            accepted: true,
            providerRef: response.providerRef ?? null
          }) as Prisma.InputJsonValue
        }
      });

      if (order.status === POStatus.PENDING) {
        await this.prisma.purchaseOrder.update({
          where: { id: order.id },
          data: { status: POStatus.ORDERED, lastModifiedById: actor?.sub }
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

      return succeeded;
    } catch (error) {
      const failed = await this.prisma.purchaseOrderErpSync.update({
        where: { id: created.id },
        data: {
          status: ErpSyncStatus.FAILED,
          lastAttemptAt: new Date(),
          nextRetryAt: new Date(Date.now() + 15 * 60 * 1000),
          errorMessage: sanitizeErpErrorMessage((error as Error).message),
          errorCode: sanitizeErpErrorCode("ERP_SYNC_FAILED")
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
          errorCode: failed.errorCode
        }
      });

      return failed;
    }
  }

  async syncPurchaseOrderToErp(
    id: string,
    data: {
      forceFailure?: boolean;
      note?: string;
      idempotencyKey?: string;
      forceResync?: boolean;
      overrideRetryWindow?: boolean;
    },
    actor?: Actor
  ) {
    try {
      this.erpSyncProviderService.assertCanUseSelectedProvider();
    } catch (error) {
      throw new BadRequestException(sanitizeErpErrorMessage((error as Error).message));
    }

    this.assertTestModeErpFailClosed();

    return this.erpSyncProviderService.mode === "mock"
      ? this.executeMockErpSync(id, data, actor)
      : this.executeConfiguredErpSync(id, data, actor);
  }

  async retryPurchaseOrderErpSync(
    id: string,
    data: {
      forceFailure?: boolean;
      note?: string;
      idempotencyKey?: string;
      overrideRetryWindow?: boolean;
    },
    actor?: Actor
  ) {
    const order = await this.getPurchaseOrder(id, actor);
    const latestFailedAttempt = order.erpSyncAttempts.find((attempt) => attempt.status === ErpSyncStatus.FAILED);

    if (!latestFailedAttempt) {
      throw new BadRequestException("No failed ERP sync attempt found for retry");
    }

    const retried = await this.syncPurchaseOrderToErp(
      id,
      {
        ...data,
        overrideRetryWindow: data.overrideRetryWindow
      },
      actor
    );

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

    return retried;
  }
}
