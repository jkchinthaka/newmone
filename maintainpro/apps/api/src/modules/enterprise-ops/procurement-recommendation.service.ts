import { BadRequestException, Injectable, Optional } from "@nestjs/common";
import { AuditAction, POStatus, Prisma, PurchaseOrderWorkflowStatus } from "@prisma/client";

import { writeAuditTrail } from "../../common/utils/audit-trail.util";
import { requireTenantId } from "../../common/utils/tenant-scope.util";
import { PrismaService } from "../../database/prisma.service";
import type { JwtPayload } from "../auth/auth.types";
import { InventoryService } from "../inventory/inventory.service";
import { canPurchaseRecommendationCreate, evaluateReorder } from "../policies/procurement-policies";
import { assertPolicy } from "../policies/policy-decision";
import { DataQualityService } from "./data-quality.service";
import { DomainNotificationService } from "./domain-notification.service";
import { PmForecastService } from "./pm-forecast.service";

type Actor = Pick<JwtPayload, "sub" | "email" | "role" | "tenantId">;

@Injectable()
export class ProcurementRecommendationService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly forecasts: PmForecastService,
    private readonly notifications: DomainNotificationService,
    private readonly dataQuality: DataQualityService,
    @Optional() private readonly inventory?: InventoryService
  ) {}

  async evaluate(actor: Actor) {
    const tenantId = requireTenantId(actor.tenantId);
    const demand = await this.forecasts.upcomingPartDemand(tenantId, 14);
    const parts = await this.prisma.sparePart.findMany({
      where: { tenantId, isActive: true },
      take: 500
    });
    const openPos = await this.prisma.purchaseOrder.findMany({
      where: {
        tenantId,
        status: { in: [POStatus.PENDING, POStatus.ORDERED, POStatus.PARTIALLY_RECEIVED] },
        workflowStatus: { not: PurchaseOrderWorkflowStatus.REJECTED }
      },
      include: { lines: true }
    });
    const incomingByPart = new Map<string, number>();
    const pendingByPart = new Map<string, number>();
    for (const order of openPos) {
      for (const line of order.lines) {
        if (!line.partId) continue;
        const remaining = Math.max(0, line.quantity - line.receivedQuantity);
        if (order.status === POStatus.ORDERED || order.status === POStatus.PARTIALLY_RECEIVED) {
          incomingByPart.set(line.partId, (incomingByPart.get(line.partId) ?? 0) + remaining);
        } else {
          pendingByPart.set(line.partId, (pendingByPart.get(line.partId) ?? 0) + remaining);
        }
      }
    }

    const results = [];
    for (const part of parts) {
      const forecastNeed = demand.get(part.id) ?? 0;
      const incoming = incomingByPart.get(part.id) ?? 0;
      const pending = pendingByPart.get(part.id) ?? 0;
      const evaluated = evaluateReorder({
        onHand: part.quantityInStock,
        reserved: part.reservedQuantity,
        incoming,
        pendingPurchase: pending,
        expectedUsage: 0,
        upcomingPmNeed: forecastNeed,
        targetStock: part.maximumStock,
        reorderPoint: part.reorderPoint,
        minimum: part.minimumStock
      });
      if (evaluated.suggestedQuantity <= 0 && evaluated.priority === "NO_PURCHASE_REQUIRED") {
        continue;
      }
      const fingerprint = `OPEN:${part.id}`;
      const duplicate = pending > 0 || incoming > 0;
      const decision = canPurchaseRecommendationCreate({
        tenantId,
        suggestedQuantity: evaluated.suggestedQuantity,
        duplicateOpen: duplicate && evaluated.suggestedQuantity <= incoming + pending
      });
      if (!decision.allowed && decision.code === "PROCUREMENT_DUPLICATE") {
        continue;
      }
      const priority =
        part.criticality === "CRITICAL" && evaluated.priority !== "NO_PURCHASE_REQUIRED"
          ? evaluated.priority === "OUT_OF_STOCK"
            ? "OUT_OF_STOCK"
            : "CRITICAL"
          : evaluated.priority;
      const saved = await this.prisma.procurementRecommendation.upsert({
        where: { tenantId_fingerprint: { tenantId, fingerprint } },
        update: {
          onHand: part.quantityInStock,
          reserved: part.reservedQuantity,
          available: part.availableQuantity,
          incoming,
          forecastNeed,
          reorderPoint: part.reorderPoint,
          targetStock: part.maximumStock,
          suggestedQuantity: evaluated.suggestedQuantity,
          priority,
          reasonCodes: evaluated.reasonCodes,
          status: "OPEN"
        },
        create: {
          tenantId,
          partId: part.id,
          fingerprint,
          onHand: part.quantityInStock,
          reserved: part.reservedQuantity,
          available: part.availableQuantity,
          incoming,
          forecastNeed,
          reorderPoint: part.reorderPoint,
          targetStock: part.maximumStock,
          suggestedQuantity: evaluated.suggestedQuantity,
          priority,
          reasonCodes: evaluated.reasonCodes,
          status: "OPEN"
        }
      });
      if (priority === "OUT_OF_STOCK" || priority === "FORECAST_SHORTAGE") {
        await this.notifications.emit({
          type: priority === "OUT_OF_STOCK" ? "OUT_OF_STOCK" : "FORECAST_SHORTAGE",
          tenantId,
          entityType: "SparePart",
          entityId: part.id,
          severity: priority === "OUT_OF_STOCK" ? "CRITICAL" : "WARNING",
          metadata: { suggestedQuantity: evaluated.suggestedQuantity }
        });
      }
      results.push(saved);
    }
    return results.sort((a, b) => this.rank(a.priority) - this.rank(b.priority));
  }

  async list(actor: Actor) {
    const tenantId = requireTenantId(actor.tenantId);
    return this.prisma.procurementRecommendation.findMany({
      where: { tenantId, status: { in: ["OPEN", "REVIEWED"] } },
      include: { part: { select: { name: true, partNumber: true, supplierId: true, unitCost: true } } },
      orderBy: { updatedAt: "desc" },
      take: 200
    });
  }

  async review(id: string, actor: Actor) {
    const tenantId = requireTenantId(actor.tenantId);
    const row = await this.prisma.procurementRecommendation.findFirst({ where: { id, tenantId } });
    if (!row) {
      throw new BadRequestException("Recommendation not found");
    }
    return this.prisma.procurementRecommendation.update({
      where: { id },
      data: { status: "REVIEWED", reviewedById: actor.sub, reviewedAt: new Date() }
    });
  }

  async convertToPurchaseOrder(id: string, actor: Actor) {
    const tenantId = requireTenantId(actor.tenantId);
    const row = await this.prisma.procurementRecommendation.findFirst({
      where: { id, tenantId },
      include: { part: true }
    });
    if (!row) {
      throw new BadRequestException("Recommendation not found");
    }
    if (!row.part.supplierId) {
      throw new BadRequestException("Part has no supplier; cannot create a purchase order");
    }
    if (!this.inventory) {
      throw new BadRequestException("Inventory service is unavailable");
    }
    assertPolicy(
      canPurchaseRecommendationCreate({
        tenantId,
        suggestedQuantity: row.suggestedQuantity,
        duplicateOpen: Boolean(row.purchaseOrderId)
      })
    );
    const po = await this.inventory.createPurchaseOrder(
      {
        poNumber: `PRC-${Date.now().toString().slice(-8)}`,
        supplierId: row.part.supplierId,
        orderDate: new Date().toISOString(),
        notes: `Created from procurement recommendation ${row.id}`,
        lines: [
          {
            partId: row.partId,
            description: row.part.name,
            quantity: row.suggestedQuantity,
            unitCost: row.part.unitCost
          }
        ]
      },
      actor
    );
    const updated = await this.prisma.procurementRecommendation.update({
      where: { id: row.id },
      data: {
        status: "CONVERTED",
        purchaseOrderId: po.id,
        fingerprint: `CONVERTED:${row.partId}:${po.id}`,
        reviewedById: actor.sub,
        reviewedAt: new Date()
      }
    });
    await writeAuditTrail(this.prisma, {
      entity: "ProcurementRecommendation",
      entityId: row.id,
      action: AuditAction.UPDATE,
      module: "procurement",
      actor,
      reason: "Converted recommendation to purchase order",
      metadata: { purchaseOrderId: po.id } as Prisma.InputJsonValue
    });
    return { recommendation: updated, purchaseOrder: po };
  }

  private rank(priority: string): number {
    const order = ["OUT_OF_STOCK", "CRITICAL", "FORECAST_SHORTAGE", "LOW_STOCK", "NORMAL", "NO_PURCHASE_REQUIRED"];
    const idx = order.indexOf(priority);
    return idx === -1 ? 99 : idx;
  }
}
