import { Injectable } from "@nestjs/common";
import { WorkOrderStatus, WorkOrderVerificationStatus } from "@prisma/client";

import { PrismaService } from "../../database/prisma.service";
import type { JwtPayload } from "../auth/auth.types";

type Actor = Pick<JwtPayload, "sub" | "email" | "role" | "tenantId">;

export type WorkOrderGovernanceExceptions = {
  completedWithoutEvidence: number;
  closedWithoutSupervisorVerification: number;
  partsIssuedJobNotCompleted: number;
  repeatedAssetBreakdowns: number;
  highCostWorkOrders: number;
  cancelledWorkOrders: number;
  reopenedWorkOrders: number;
  editedAfterCompletion: number;
  generatedAt: string;
  notes: string[];
};

@Injectable()
export class WorkOrderGovernanceService {
  constructor(private readonly prisma: PrismaService) {}

  private resolveTenantId(actor?: Actor) {
    return actor?.tenantId ?? undefined;
  }

  async getExceptionSummary(actor?: Actor): Promise<WorkOrderGovernanceExceptions> {
    const tenantId = this.resolveTenantId(actor);
    const tenantFilter = tenantId !== undefined ? { tenantId } : {};
    const highCostThreshold = Number(process.env.WORK_ORDER_HIGH_COST_THRESHOLD ?? 25000);
    const now = new Date();
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    const [
      completedWithoutEvidence,
      closedWithoutSupervisorVerification,
      partsIssuedJobNotCompleted,
      cancelledWorkOrders,
      reopenedWorkOrders,
      highCostWorkOrders,
      activeWithParts
    ] = await Promise.all([
      this.prisma.workOrder.count({
        where: {
          ...tenantFilter,
          status: WorkOrderStatus.COMPLETED,
          evidenceAttachments: { none: {} }
        }
      }),
      this.prisma.workOrder.count({
        where: {
          ...tenantFilter,
          status: WorkOrderStatus.COMPLETED,
          verificationStatus: { in: [WorkOrderVerificationStatus.PENDING, WorkOrderVerificationStatus.NOT_REQUIRED] },
          type: { in: ["CORRECTIVE", "EMERGENCY", "ACCIDENT_REPAIR"] }
        }
      }),
      this.prisma.workOrder.count({
        where: {
          ...tenantFilter,
          status: { in: [WorkOrderStatus.OPEN, WorkOrderStatus.IN_PROGRESS, WorkOrderStatus.ON_HOLD, WorkOrderStatus.TECHNICIAN_COMPLETED, WorkOrderStatus.REWORK_REQUIRED] },
          OR: [{ parts: { some: {} } }, { partIssues: { some: {} } }]
        }
      }),
      this.prisma.workOrder.count({
        where: {
          ...tenantFilter,
          status: WorkOrderStatus.CANCELLED,
          updatedAt: { gte: thirtyDaysAgo }
        }
      }),
      this.prisma.workOrder.count({
        where: {
          ...tenantFilter,
          reopenedAt: { not: null },
          updatedAt: { gte: thirtyDaysAgo }
        }
      }),
      this.prisma.workOrder.count({
        where: {
          ...tenantFilter,
          actualCost: { gte: highCostThreshold }
        }
      }),
      this.prisma.workOrder.findMany({
        where: {
          ...tenantFilter,
          assetId: { not: null },
          type: { in: ["CORRECTIVE", "EMERGENCY"] },
          createdAt: { gte: thirtyDaysAgo }
        },
        select: { assetId: true }
      })
    ]);

    const assetCounts = new Map<string, number>();
    for (const row of activeWithParts) {
      if (!row.assetId) continue;
      assetCounts.set(row.assetId, (assetCounts.get(row.assetId) ?? 0) + 1);
    }
    const repeatedAssetBreakdowns = [...assetCounts.values()].filter((count) => count >= 3).length;

    const editedAfterCompletion = await this.prisma.workOrder.count({
      where: {
        ...tenantFilter,
        status: WorkOrderStatus.COMPLETED,
        completedDate: { not: null },
        updatedAt: { gte: thirtyDaysAgo }
      }
    });

    return {
      completedWithoutEvidence,
      closedWithoutSupervisorVerification,
      partsIssuedJobNotCompleted,
      repeatedAssetBreakdowns,
      highCostWorkOrders,
      cancelledWorkOrders,
      reopenedWorkOrders,
      editedAfterCompletion,
      generatedAt: now.toISOString(),
      notes: [
        "Assignments during approved leave and daily capacity overload are tracked in workforce planning APIs (UAT-007).",
        "Before/after evidence tagging is roadmap — completion checks count uploaded evidence when storage is enabled.",
        "Full ERP procurement return approval remains partial; part line statuses track issued/used/returned quantities."
      ]
    };
  }
}
