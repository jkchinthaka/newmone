import {
  BadRequestException,
  Injectable,
  NotFoundException
} from "@nestjs/common";
import {
  SparePartClassification,
  VendorContractStatus,
  VendorContractType,
  WorkOrderExecutionMode
} from "@prisma/client";

import { requireTenantId } from "../../common/utils/tenant-scope.util";
import { PrismaService } from "../../database/prisma.service";
import type { JwtPayload } from "../auth/auth.types";
import {
  computeWorkOrderTotalCost,
  contractExpiryStatus,
  resolveStockSourceBoundary,
  type WoCostBreakdown
} from "./supply-boundary";

type Actor = Pick<JwtPayload, "sub" | "tenantId">;

@Injectable()
export class MaintenanceSupplyService {
  constructor(private readonly prisma: PrismaService) {}

  stockBoundaryForPart(part: {
    erpCode?: string | null;
  }, opts?: { erpSyncEnabled?: boolean; productionMode?: boolean; mockSync?: boolean }) {
    return resolveStockSourceBoundary({
      erpCode: part.erpCode,
      erpSyncEnabled: opts?.erpSyncEnabled,
      productionMode: opts?.productionMode,
      mockSync: opts?.mockSync
    });
  }

  async snapshotWorkOrderCosts(
    actor: Actor,
    workOrderId: string,
    breakdown: WoCostBreakdown,
    notes?: string
  ) {
    const tenantId = requireTenantId(actor.tenantId);
    const wo = await this.prisma.workOrder.findFirst({
      where: { id: workOrderId, tenantId }
    });
    if (!wo) {
      throw new NotFoundException("Work order not found");
    }

    const existing = await this.prisma.workOrderCostSnapshot.findUnique({
      where: { workOrderId }
    });
    if (existing) {
      // Historical snapshot is immutable once taken.
      return existing;
    }

    const totalCost = computeWorkOrderTotalCost(breakdown);
    const snapshot = await this.prisma.workOrderCostSnapshot.create({
      data: {
        tenantId,
        workOrderId,
        partsCost: breakdown.partsCost,
        internalLabourCost: breakdown.internalLabourCost,
        externalServiceCost: breakdown.externalServiceCost,
        transportCost: breakdown.transportCost,
        otherCost: breakdown.otherCost,
        totalCost,
        snappedById: actor.sub,
        notes,
        lineItems: breakdown as any
      }
    });

    await this.prisma.workOrder.update({
      where: { id: workOrderId },
      data: { actualCost: totalCost }
    });

    return snapshot;
  }

  async setExecutionMode(actor: Actor, workOrderId: string, mode: WorkOrderExecutionMode) {
    const tenantId = requireTenantId(actor.tenantId);
    const wo = await this.prisma.workOrder.findFirst({ where: { id: workOrderId, tenantId } });
    if (!wo) throw new NotFoundException("Work order not found");
    return this.prisma.workOrder.update({
      where: { id: workOrderId },
      data: { executionMode: mode }
    });
  }

  async returnToolIssue(
    actor: Actor,
    issueId: string,
    input: { quantityReturned: number; notes?: string }
  ) {
    const tenantId = requireTenantId(actor.tenantId);
    const issue = await this.prisma.partIssue.findFirst({
      where: { id: issueId, tenantId },
      include: { part: true }
    });
    if (!issue) throw new NotFoundException("Part issue not found");
    if (!issue.expectsReturn && issue.part.classification !== SparePartClassification.TOOL) {
      throw new BadRequestException("Issue does not expect a tool return");
    }
    const nextReturned = issue.quantityReturned + input.quantityReturned;
    if (nextReturned > issue.quantity) {
      throw new BadRequestException("Returned quantity exceeds issued quantity");
    }
    return this.prisma.partIssue.update({
      where: { id: issueId },
      data: {
        quantityReturned: nextReturned,
        returnedAt: nextReturned >= issue.quantity ? new Date() : issue.returnedAt,
        returnedById: actor.sub,
        returnNotes: input.notes,
        expectsReturn: true
      }
    });
  }

  async createVendorContract(
    actor: Actor,
    input: {
      supplierId: string;
      contractNo: string;
      contractType?: VendorContractType;
      title: string;
      coverage?: string;
      slaSummary?: string;
      visitCount?: number;
      assetIds?: string[];
      siteIds?: string[];
      startDate: Date;
      endDate: Date;
      valueReference?: number;
      documentUrls?: string[];
      reminderDays?: number;
      notes?: string;
    }
  ) {
    const tenantId = requireTenantId(actor.tenantId);
    const supplier = await this.prisma.supplier.findFirst({
      where: { id: input.supplierId, tenantId }
    });
    if (!supplier) throw new NotFoundException("Vendor not found");

    const statusKey = contractExpiryStatus({
      endDate: input.endDate,
      reminderDays: input.reminderDays
    });
    const status =
      statusKey === "EXPIRED"
        ? VendorContractStatus.EXPIRED
        : statusKey === "EXPIRING"
          ? VendorContractStatus.EXPIRING
          : VendorContractStatus.ACTIVE;

    return this.prisma.vendorContract.create({
      data: {
        tenantId,
        supplierId: input.supplierId,
        contractNo: input.contractNo,
        contractType: input.contractType ?? VendorContractType.AMC,
        status,
        title: input.title,
        coverage: input.coverage,
        slaSummary: input.slaSummary,
        visitCount: input.visitCount,
        assetIds: input.assetIds ?? [],
        siteIds: input.siteIds ?? [],
        startDate: input.startDate,
        endDate: input.endDate,
        valueReference: input.valueReference,
        documentUrls: input.documentUrls ?? [],
        reminderDays: input.reminderDays ?? 30,
        notes: input.notes
      }
    });
  }

  async refreshContractStatuses(actor: Actor) {
    const tenantId = requireTenantId(actor.tenantId);
    const contracts = await this.prisma.vendorContract.findMany({
      where: { tenantId, isActive: true, status: { in: ["ACTIVE", "EXPIRING", "DRAFT"] } },
      take: 500
    });
    const updates = [];
    for (const c of contracts) {
      const key = contractExpiryStatus({
        endDate: c.endDate,
        reminderDays: c.reminderDays
      });
      const status =
        key === "EXPIRED"
          ? VendorContractStatus.EXPIRED
          : key === "EXPIRING"
            ? VendorContractStatus.EXPIRING
            : VendorContractStatus.ACTIVE;
      if (status !== c.status) {
        updates.push(
          this.prisma.vendorContract.update({ where: { id: c.id }, data: { status } })
        );
      }
    }
    return Promise.all(updates);
  }

  async assignVendorToWorkOrder(
    actor: Actor,
    workOrderId: string,
    supplierId: string,
    executionMode: WorkOrderExecutionMode = WorkOrderExecutionMode.EXTERNAL
  ) {
    const tenantId = requireTenantId(actor.tenantId);
    const [wo, supplier] = await Promise.all([
      this.prisma.workOrder.findFirst({ where: { id: workOrderId, tenantId } }),
      this.prisma.supplier.findFirst({ where: { id: supplierId, tenantId, isActive: true } })
    ]);
    if (!wo) throw new NotFoundException("Work order not found");
    if (!supplier) throw new NotFoundException("Vendor not found");
    return this.prisma.workOrder.update({
      where: { id: workOrderId },
      data: {
        executionMode,
        notes: [wo.notes, `Vendor assigned: ${supplier.name} (${supplier.id})`]
          .filter(Boolean)
          .join("\n")
      }
    });
  }
}
