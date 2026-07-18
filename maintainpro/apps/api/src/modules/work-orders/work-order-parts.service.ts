import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import {
  AuditAction,
  PartApprovalTier,
  PartReturnCondition,
  Prisma,
  RoleName,
  WorkOrderPartLineStatus,
  WorkOrderStatus
} from "@prisma/client";

import { requestContext } from "../../common/context/request-context";
import { TERMINAL_WORK_ORDER_STATUSES } from "../../common/utils/work-order-governance";
import {
  assertPositiveQuantity,
  assertQuantityBalance,
  assertWorkOrderAllowsParts,
  deriveLineStatus,
  PART_APPROVAL_HIGH_THRESHOLD,
  pendingQuantity,
  requiresProcurement
} from "../../common/utils/work-order-parts-governance";
import { PrismaService } from "../../database/prisma.service";
import { requireTenantId } from "../../common/utils/tenant-scope.util";
import type { JwtPayload } from "../auth/auth.types";

type Actor = Pick<JwtPayload, "sub" | "email" | "role" | "tenantId">;

const STOREKEEPER_ROLES = new Set<RoleName>([
  RoleName.SUPER_ADMIN,
  RoleName.ADMIN,
  RoleName.INVENTORY_KEEPER,
  RoleName.OPERATIONS_MANAGER,
  RoleName.ASSET_MANAGER
]);

const TECHNICIAN_ROLES = new Set<RoleName>([RoleName.TECHNICIAN, RoleName.MECHANIC]);

@Injectable()
export class WorkOrderPartsService {
  constructor(private readonly prisma: PrismaService) {}

  private resolveTenantId(actor?: Actor) {
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

  async assertWorkOrderForParts(workOrderId: string, actor?: Actor, overrideReason?: string) {
    const tenantId = this.resolveTenantId(actor);
    const workOrder = await this.prisma.workOrder.findFirst({
      where: { id: workOrderId, tenantId }
    });
    if (!workOrder) {
      throw new NotFoundException("Work order not found");
    }
    assertWorkOrderAllowsParts(workOrder.status, overrideReason);
    return workOrder;
  }

  async createRequestedLine(input: {
    workOrderId: string;
    partRequestId: string;
    partId: string;
    requestedQuantity: number;
    unitCost: number;
    requestedById: string;
    tenantId?: string | null;
    approvalTier: PartApprovalTier;
    procurementRequired: boolean;
    actor?: Actor;
  }) {
    const totalCost = input.unitCost * input.requestedQuantity;
    const line = await this.prisma.workOrderPart.create({
      data: {
        tenantId: requireTenantId(input.tenantId),
        workOrderId: input.workOrderId,
        partRequestId: input.partRequestId,
        partId: input.partId,
        quantity: input.requestedQuantity,
        unitCost: input.unitCost,
        totalCost,
        lineStatus: WorkOrderPartLineStatus.REQUESTED,
        approvalTier: input.approvalTier,
        procurementRequired: input.procurementRequired,
        requestedQuantity: input.requestedQuantity,
        requestedById: input.requestedById
      },
      include: { part: true }
    });

    await this.recordAudit({
      entity: "WorkOrderPart",
      entityId: line.id,
      action: AuditAction.CREATE,
      actor: input.actor,
      reason: "Part requested for work order",
      metadata: {
        event: "part_requested",
        workOrderId: input.workOrderId,
        partRequestId: input.partRequestId,
        partId: input.partId,
        requestedQuantity: input.requestedQuantity,
        approvalTier: input.approvalTier,
        procurementRequired: input.procurementRequired
      },
      afterData: { lineStatus: line.lineStatus, requestedQuantity: line.requestedQuantity }
    });

    return line;
  }

  async syncApprovedLine(partRequestId: string, approvedQuantity: number, approvedById: string, actor?: Actor) {
    const line = await this.prisma.workOrderPart.findFirst({ where: { partRequestId } });
    if (!line) {
      return null;
    }

    const updated = await this.prisma.workOrderPart.update({
      where: { id: line.id },
      data: {
        approvedQuantity,
        approvedById,
        lineStatus: WorkOrderPartLineStatus.APPROVED
      }
    });

    await this.recordAudit({
      entity: "WorkOrderPart",
      entityId: line.id,
      action: AuditAction.UPDATE,
      actor,
      reason: "Part request approved",
      metadata: {
        event: "part_approved",
        partRequestId,
        approvedQuantity
      },
      beforeData: { lineStatus: line.lineStatus, approvedQuantity: line.approvedQuantity },
      afterData: { lineStatus: updated.lineStatus, approvedQuantity: updated.approvedQuantity }
    });

    return updated;
  }

  async syncRejectedLine(partRequestId: string, reason: string, actor?: Actor) {
    const line = await this.prisma.workOrderPart.findFirst({ where: { partRequestId } });
    if (!line) {
      return null;
    }

    await this.recordAudit({
      entity: "WorkOrderPart",
      entityId: line.id,
      action: AuditAction.UPDATE,
      actor,
      reason,
      metadata: { event: "part_rejected", partRequestId }
    });

    return line;
  }

  async syncIssuedLine(input: {
    partRequestId: string;
    issueQuantity: number;
    issuedById: string;
    issueNote?: string;
    storeLocation?: string;
    actor?: Actor;
  }) {
    const line = await this.prisma.workOrderPart.findFirst({
      where: { partRequestId: input.partRequestId },
      include: { part: true }
    });
    if (!line) {
      return null;
    }

    const issuedQuantity = line.issuedQuantity + input.issueQuantity;
    const snapshot = {
      requestedQuantity: line.requestedQuantity,
      approvedQuantity: line.approvedQuantity,
      issuedQuantity,
      usedQuantity: line.usedQuantity,
      returnedQuantity: line.returnedQuantity,
      damagedQuantity: line.damagedQuantity,
      pendingReturnQuantity: line.pendingReturnQuantity
    };

    const updated = await this.prisma.workOrderPart.update({
      where: { id: line.id },
      data: {
        issuedQuantity,
        quantity: issuedQuantity,
        totalCost: issuedQuantity * line.unitCost,
        issuedById: input.issuedById,
        issuedAt: new Date(),
        issueNote: input.issueNote?.trim() || line.issueNote,
        storeLocation: input.storeLocation?.trim() || line.storeLocation,
        lineStatus: deriveLineStatus(snapshot)
      },
      include: { part: true }
    });

    await this.recordAudit({
      entity: "WorkOrderPart",
      entityId: line.id,
      action: AuditAction.UPDATE,
      actor: input.actor,
      reason: input.issueNote ?? "Part issued to work order",
      metadata: {
        event: "part_issued",
        partRequestId: input.partRequestId,
        issuedQuantity: input.issueQuantity,
        stockBefore: line.part.quantityInStock
      },
      beforeData: { issuedQuantity: line.issuedQuantity, lineStatus: line.lineStatus },
      afterData: { issuedQuantity: updated.issuedQuantity, lineStatus: updated.lineStatus }
    });

    return updated;
  }

  async listLines(workOrderId: string, actor?: Actor) {
    const tenantId = this.resolveTenantId(actor);
    return this.prisma.workOrderPart.findMany({
      where: {
        workOrderId,
        tenantId
      },
      include: {
        part: {
          include: {
            supplier: { select: { id: true, name: true } }
          }
        },
        partRequest: {
          select: {
            id: true,
            status: true,
            reason: true,
            requiresFinanceApproval: true
          }
        }
      },
      orderBy: { createdAt: "asc" }
    });
  }

  async getCostSummary(workOrderId: string, actor?: Actor) {
    const lines = await this.listLines(workOrderId, actor);
    const summary = lines.reduce(
      (acc, line) => {
        const requested = line.requestedQuantity * line.unitCost;
        const approved = (line.approvedQuantity ?? line.requestedQuantity) * line.unitCost;
        const issued = line.issuedQuantity * line.unitCost;
        const used = line.usedQuantity * line.unitCost;
        const returned = line.returnedQuantity * line.unitCost;
        acc.requestedCost += requested;
        acc.approvedCost += approved;
        acc.issuedCost += issued;
        acc.usedCost += used;
        acc.returnedValue += returned;
        return acc;
      },
      {
        requestedCost: 0,
        approvedCost: 0,
        issuedCost: 0,
        usedCost: 0,
        returnedValue: 0
      }
    );

    return {
      ...summary,
      netPartCost: summary.usedCost,
      lineCount: lines.length,
      unaccountedLines: lines.filter((line) => pendingQuantity(line) > 0 && line.issuedQuantity > 0).length
    };
  }

  assertTechnicianCanMarkUsed(role?: RoleName | null) {
    if (!role || (!TECHNICIAN_ROLES.has(role) && !STOREKEEPER_ROLES.has(role))) {
      throw new ForbiddenException("Only technicians or maintenance staff can record part usage.");
    }
  }

  assertStorekeeperCanIssue(role?: RoleName | null) {
    if (!role || !STOREKEEPER_ROLES.has(role)) {
      throw new ForbiddenException("Only inventory keepers or managers can issue stock.");
    }
  }

  async markUsed(
    workOrderId: string,
    lineId: string,
    data: { usedQuantity: number; note?: string },
    actor?: Actor
  ) {
    this.assertTechnicianCanMarkUsed(actor?.role as RoleName);
    await this.assertWorkOrderForParts(workOrderId, actor);

    const line = await this.getLine(workOrderId, lineId, actor);
    if (line.issuedQuantity <= 0) {
      throw new BadRequestException("Cannot mark usage before parts are issued.");
    }

    assertPositiveQuantity("Used quantity", data.usedQuantity);
    const nextUsed = line.usedQuantity + data.usedQuantity;
    if (nextUsed + line.returnedQuantity + line.damagedQuantity + line.pendingReturnQuantity > line.issuedQuantity) {
      throw new BadRequestException("Used, returned, and damaged quantities cannot exceed issued quantity.");
    }

    const snapshot = {
      requestedQuantity: line.requestedQuantity,
      approvedQuantity: line.approvedQuantity,
      issuedQuantity: line.issuedQuantity,
      usedQuantity: nextUsed,
      returnedQuantity: line.returnedQuantity,
      damagedQuantity: line.damagedQuantity,
      pendingReturnQuantity: line.pendingReturnQuantity
    };

    const updated = await this.prisma.workOrderPart.update({
      where: { id: lineId },
      data: {
        usedQuantity: nextUsed,
        lineStatus: deriveLineStatus(snapshot),
        issueNote: data.note?.trim() ? `${line.issueNote ?? ""}\nUsage: ${data.note.trim()}`.trim() : line.issueNote
      },
      include: { part: true }
    });

    await this.recordAudit({
      entity: "WorkOrderPart",
      entityId: lineId,
      action: AuditAction.UPDATE,
      actor,
      reason: data.note ?? "Part usage recorded",
      metadata: {
        event: "part_used",
        workOrderId,
        usedQuantity: data.usedQuantity,
        totalUsed: nextUsed
      },
      beforeData: { usedQuantity: line.usedQuantity },
      afterData: { usedQuantity: updated.usedQuantity, lineStatus: updated.lineStatus }
    });

    return updated;
  }

  async requestReturn(
    workOrderId: string,
    lineId: string,
    data: { returnedQuantity: number; returnCondition: PartReturnCondition; returnNote?: string },
    actor?: Actor
  ) {
    this.assertTechnicianCanMarkUsed(actor?.role as RoleName);
    await this.assertWorkOrderForParts(workOrderId, actor);

    const line = await this.getLine(workOrderId, lineId, actor);
    assertPositiveQuantity("Return quantity", data.returnedQuantity);

    const maxReturn =
      line.issuedQuantity - line.usedQuantity - line.returnedQuantity - line.damagedQuantity - line.pendingReturnQuantity;
    if (data.returnedQuantity > maxReturn) {
      throw new BadRequestException("Returned quantity cannot exceed issued minus used, returned, and pending returns.");
    }

    const actorId = actor?.sub;
    if (!actorId) {
      throw new BadRequestException("Authenticated actor required");
    }

    const updated = await this.prisma.workOrderPart.update({
      where: { id: lineId },
      data: {
        pendingReturnQuantity: line.pendingReturnQuantity + data.returnedQuantity,
        returnedById: actorId,
        returnedAt: new Date(),
        returnCondition: data.returnCondition,
        returnNote: data.returnNote?.trim() || null,
        lineStatus: WorkOrderPartLineStatus.PARTIALLY_RETURNED
      },
      include: { part: true }
    });

    await this.recordAudit({
      entity: "WorkOrderPart",
      entityId: lineId,
      action: AuditAction.UPDATE,
      actor,
      reason: data.returnNote ?? "Part return requested",
      metadata: {
        event: "part_return_requested",
        workOrderId,
        returnedQuantity: data.returnedQuantity,
        returnCondition: data.returnCondition
      }
    });

    return updated;
  }

  async confirmReturn(
    workOrderId: string,
    lineId: string,
    data: { confirmedQuantity: number; note?: string },
    actor?: Actor
  ) {
    this.assertStorekeeperCanIssue(actor?.role as RoleName);
    await this.assertWorkOrderForParts(workOrderId, actor);

    const line = await this.getLine(workOrderId, lineId, actor);
    assertPositiveQuantity("Confirmed return quantity", data.confirmedQuantity);

    if (data.confirmedQuantity > line.pendingReturnQuantity) {
      throw new BadRequestException("Confirmed return cannot exceed pending return quantity.");
    }

    const actorId = actor?.sub;
    if (!actorId) {
      throw new BadRequestException("Authenticated actor required");
    }

    const nextReturned = line.returnedQuantity + data.confirmedQuantity;
    const nextPending = line.pendingReturnQuantity - data.confirmedQuantity;
    const nextDamaged =
      line.returnCondition === PartReturnCondition.SCRAP || line.returnCondition === PartReturnCondition.USED_DAMAGED
        ? line.damagedQuantity + data.confirmedQuantity
        : line.damagedQuantity;

    const shouldRestock =
      line.returnCondition === PartReturnCondition.UNUSED || line.returnCondition === PartReturnCondition.WRONG_PART;

    const snapshot = {
      requestedQuantity: line.requestedQuantity,
      approvedQuantity: line.approvedQuantity,
      issuedQuantity: line.issuedQuantity,
      usedQuantity: line.usedQuantity,
      returnedQuantity: nextReturned,
      damagedQuantity: nextDamaged,
      pendingReturnQuantity: nextPending
    };

    const updated = await this.prisma.$transaction(async (tx) => {
      if (shouldRestock) {
        await tx.sparePart.update({
          where: { id: line.partId },
          data: { quantityInStock: { increment: data.confirmedQuantity } }
        });
        await tx.stockMovement.create({
          data: {
            partId: line.partId,
            type: "RETURN",
            quantity: data.confirmedQuantity,
            reference: `work-order-part:${line.id}`,
            notes: data.note?.trim() || "Work order part return confirmed"
          }
        });
      }

      return tx.workOrderPart.update({
        where: { id: lineId },
        data: {
          returnedQuantity: nextReturned,
          pendingReturnQuantity: nextPending,
          damagedQuantity: nextDamaged,
          confirmedByStorekeeperId: actorId,
          returnConfirmedAt: new Date(),
          lineStatus: deriveLineStatus(snapshot)
        },
        include: { part: true }
      });
    });

    await this.recordAudit({
      entity: "WorkOrderPart",
      entityId: lineId,
      action: AuditAction.UPDATE,
      actor,
      reason: data.note ?? "Part return confirmed by storekeeper",
      metadata: {
        event: "part_return_confirmed",
        workOrderId,
        confirmedQuantity: data.confirmedQuantity,
        restocked: shouldRestock
      },
      beforeData: {
        returnedQuantity: line.returnedQuantity,
        pendingReturnQuantity: line.pendingReturnQuantity
      },
      afterData: {
        returnedQuantity: updated.returnedQuantity,
        pendingReturnQuantity: updated.pendingReturnQuantity,
        lineStatus: updated.lineStatus
      }
    });

    return updated;
  }

  async hasUnaccountedParts(workOrderId: string): Promise<boolean> {
    const lines = await this.prisma.workOrderPart.findMany({
      where: { workOrderId, issuedQuantity: { gt: 0 } }
    });
    return lines.some((line) => pendingQuantity(line) > 0);
  }

  private async getLine(workOrderId: string, lineId: string, actor?: Actor) {
    const tenantId = this.resolveTenantId(actor);
    const line = await this.prisma.workOrderPart.findFirst({
      where: {
        id: lineId,
        workOrderId,
        tenantId
      },
      include: { part: true }
    });
    if (!line) {
      throw new NotFoundException("Work order part line not found");
    }
    assertQuantityBalance(line);
    return line;
  }

  async getPartsExceptions(actor?: Actor) {
    const tenantId = this.resolveTenantId(actor);
    const tenantFilter = { tenantId };
    const highCostThreshold = PART_APPROVAL_HIGH_THRESHOLD;
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

    const lines = await this.prisma.workOrderPart.findMany({
      where: tenantFilter,
      include: {
        workOrder: { select: { id: true, status: true, woNumber: true, assetId: true, completedDate: true } },
        part: { select: { id: true, name: true, partNumber: true } }
      }
    });

    const duplicateRequests = lines.filter((line, index, all) =>
      all.some(
        (other, otherIndex) =>
          otherIndex !== index &&
          other.workOrderId === line.workOrderId &&
          other.partId === line.partId &&
          other.lineStatus !== WorkOrderPartLineStatus.REQUESTED
      )
    ).length;

    const issuedNotCompleted = lines.filter(
      (line) =>
        line.issuedQuantity > 0 &&
        line.workOrder.status !== WorkOrderStatus.COMPLETED &&
        line.workOrder.status !== WorkOrderStatus.CANCELLED
    ).length;

    const issuedAfterCompletion = lines.filter(
      (line) =>
        line.issuedAt &&
        line.workOrder.completedDate &&
        line.issuedAt.getTime() > line.workOrder.completedDate.getTime()
    ).length;

    const unaccounted = lines.filter((line) => line.issuedQuantity > 0 && pendingQuantity(line) > 0).length;
    const pendingReturns = lines.filter((line) => line.pendingReturnQuantity > 0).length;
    const highCostIssues = lines.filter((line) => line.issuedQuantity * line.unitCost >= highCostThreshold).length;
    const procurementRequired = lines.filter((line) => line.procurementRequired).length;

    const assetPartCounts = new Map<string, number>();
    for (const line of lines) {
      if (!line.workOrder.assetId || line.createdAt < thirtyDaysAgo) continue;
      const key = `${line.workOrder.assetId}:${line.partId}`;
      assetPartCounts.set(key, (assetPartCounts.get(key) ?? 0) + 1);
    }
    const frequentAssetPartUsage = [...assetPartCounts.values()].filter((count) => count >= 3).length;

    const thirtyDayAudit = await this.prisma.auditLog.findMany({
      where: {
        ...tenantFilter,
        createdAt: { gte: thirtyDaysAgo }
      },
      select: { metadata: true },
      take: 5000
    });
    const partsIssuedWithoutWorkOrderAttempt = thirtyDayAudit.filter((row) => {
      const metadata = row.metadata as { event?: string } | null;
      return metadata?.event === "parts_issue_blocked_no_work_order";
    }).length;

    return {
      duplicatePartRequests: duplicateRequests,
      partsIssuedJobNotCompleted: issuedNotCompleted,
      partsIssuedAfterCompletion: issuedAfterCompletion,
      issuedPartsNotAccounted: unaccounted,
      pendingReturnConfirmations: pendingReturns,
      highCostPartIssues: highCostIssues,
      procurementRequiredParts: procurementRequired,
      frequentAssetPartUsage,
      partsIssuedWithoutWorkOrderAttempt,
      generatedAt: new Date().toISOString(),
      notes: [
        "Reserved stock and warehouse locations remain partial until inventory module adds reservedStock.",
        "Before/after evidence for high-cost parts is tracked under UAT-009 governance.",
        "Full ERP procurement workflow is roadmap — procurementRequired flags parts needing purchase."
      ]
    };
  }
}
