import { Injectable } from "@nestjs/common";
import { ErpSyncStatus, POStatus, PurchaseOrderWorkflowStatus } from "@prisma/client";

import { PrismaService } from "../../database/prisma.service";
import { ErpSyncProviderService } from "../inventory/erp-sync-provider.service";

export type ErpMonitoringSummary = {
  providerCategory: string;
  readinessStatus: "READY" | "NOT_READY" | "UNKNOWN";
  approvedNotSynced: number;
  pendingAttempts: number;
  failedAttempts: number;
  retriesDue: number;
  attemptsAtMaxLimit: number;
  lastSuccessfulSyncAt: string | null;
  receiptBacklog: number;
  reconciliationFailures: number;
  coverageStatus: "COMPLETE" | "DEGRADED" | "UNAVAILABLE";
  generatedAt: string;
};

@Injectable()
export class ErpMonitoringService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly erpSyncProviderService: ErpSyncProviderService
  ) {}

  async getSafeSummary(tenantId: string | null): Promise<ErpMonitoringSummary> {
    const generatedAt = new Date().toISOString();
    const tenantWhere = tenantId ? { tenantId } : {};
    const now = new Date();

    try {
      const provider = this.erpSyncProviderService.describeProvider();
      const providerCategory = provider.mode === "mock" ? "MOCK" : provider.mode === "live" ? "LIVE" : "DISABLED";

      let readinessStatus: ErpMonitoringSummary["readinessStatus"] = "UNKNOWN";
      try {
        this.erpSyncProviderService.assertCanUseSelectedProvider();
        readinessStatus = "READY";
      } catch {
        readinessStatus = provider.mode === "disabled" ? "NOT_READY" : "NOT_READY";
      }

      const [
        approvedNotSynced,
        pendingAttempts,
        failedAttempts,
        retriesDue,
        attemptsAtMaxLimit,
        lastSuccess,
        receiptBacklog
      ] = await Promise.all([
        this.prisma.purchaseOrder.count({
          where: {
            ...tenantWhere,
            workflowStatus: PurchaseOrderWorkflowStatus.APPROVED,
            erpSyncAttempts: { none: { status: ErpSyncStatus.SUCCESS } }
          }
        }),
        this.prisma.purchaseOrderErpSync.count({
          where: { ...tenantWhere, status: ErpSyncStatus.PENDING }
        }),
        this.prisma.purchaseOrderErpSync.count({
          where: { ...tenantWhere, status: ErpSyncStatus.FAILED }
        }),
        this.prisma.purchaseOrderErpSync.count({
          where: {
            ...tenantWhere,
            status: ErpSyncStatus.FAILED,
            nextRetryAt: { lte: now }
          }
        }),
        this.prisma.purchaseOrderErpSync.count({
          where: { ...tenantWhere, status: ErpSyncStatus.FAILED, attempt: { gte: 5 } }
        }),
        this.prisma.purchaseOrderErpSync.findFirst({
          where: { ...tenantWhere, status: ErpSyncStatus.SUCCESS },
          orderBy: { lastAttemptAt: "desc" },
          select: { lastAttemptAt: true, createdAt: true }
        }),
        this.prisma.purchaseOrder.count({
          where: {
            ...tenantWhere,
            status: { in: [POStatus.ORDERED, POStatus.PARTIALLY_RECEIVED] }
          }
        })
      ]);

      return {
        providerCategory,
        readinessStatus,
        approvedNotSynced,
        pendingAttempts,
        failedAttempts,
        retriesDue,
        attemptsAtMaxLimit,
        lastSuccessfulSyncAt: (lastSuccess?.lastAttemptAt ?? lastSuccess?.createdAt)?.toISOString() ?? null,
        receiptBacklog,
        reconciliationFailures: 0,
        coverageStatus: "COMPLETE",
        generatedAt
      };
    } catch {
      return {
        providerCategory: "UNKNOWN",
        readinessStatus: "UNKNOWN",
        approvedNotSynced: 0,
        pendingAttempts: 0,
        failedAttempts: 0,
        retriesDue: 0,
        attemptsAtMaxLimit: 0,
        lastSuccessfulSyncAt: null,
        receiptBacklog: 0,
        reconciliationFailures: 0,
        coverageStatus: "UNAVAILABLE",
        generatedAt
      };
    }
  }
}
