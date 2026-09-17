import { ForbiddenException, Injectable } from "@nestjs/common";

import { requestContext } from "../../common/context/request-context";
import { writeAuditTrail } from "../../common/utils/audit-trail.util";
import { PrismaService } from "../../database/prisma.service";
import { AuditAction, Prisma, RoleName } from "@prisma/client";
import { sanitizeErpErrorMessage } from "../inventory/erp-error-sanitize.util";
import { ErpAccessChecklistService } from "./erp-access-checklist.service";
import { ErpConfigService } from "./erp-config.service";
import { ErpImportService } from "./erp-import.service";
import { ErpMappingService } from "./erp-mapping.service";
import { ErpMockSyncService } from "./erp-mock-sync.service";
import { ErpReconciliationService } from "./erp-reconciliation.service";

@Injectable()
export class ErpDashboardService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ErpConfigService,
    private readonly mappings: ErpMappingService,
    private readonly mockSync: ErpMockSyncService,
    private readonly imports: ErpImportService,
    private readonly reconciliation: ErpReconciliationService,
    private readonly checklist: ErpAccessChecklistService
  ) {}

  private canView() {
    const c = requestContext.get();
    const role = c?.actorRole;
    const permissions = c?.permissions ?? [];
    if (role === RoleName.SUPER_ADMIN || role === RoleName.ADMIN) return true;
    return permissions.includes("erp.view") || permissions.includes("erp.manage");
  }

  async getStatus() {
    if (!this.canView()) throw new ForbiddenException("You do not have permission to view ERP integration");
    return this.config.getSafeConfigStatus();
  }

  async getDashboard() {
    if (!this.canView()) throw new ForbiddenException("You do not have permission to view ERP integration");
    const [config, mockStatus, readiness, openMismatches] = await Promise.all([
      this.config.getSafeConfigStatus(),
      this.mockSync.getStatus(),
      this.checklist.getReadiness(),
      this.reconciliation.countOpen().catch(() => 0)
    ]);

    let pendingMappings = 0;
    try {
      pendingMappings = await this.mappings.countPending();
    } catch {
      pendingMappings = 0;
    }

    const lastImport = await this.prisma.erpImportBatch.findFirst({
      orderBy: { createdAt: "desc" }
    });

    return {
      syncMode: config.syncMode,
      credentialsConfigured: config.credentialsConfigured,
      liveIntegrationAvailable: config.liveIntegrationAvailable,
      liveNotConfiguredMessage: config.liveNotConfiguredMessage,
      lastMockSync: mockStatus.lastMockSync,
      lastFileImport: lastImport,
      openMismatches,
      pendingMappingFields: pendingMappings,
      reconciliationStatus: openMismatches > 0 ? "MISMATCHES_OPEN" : "CLEAR",
      readinessVerdict: readiness.verdict,
      apiAccessChecklistVerdict: readiness.verdict,
      message:
        config.syncMode === "live" && !config.credentialsConfigured
          ? config.liveNotConfiguredMessage
          : "Live ERP API not configured yet — mock and file import modes available"
    };
  }

  async getReport() {
    const dashboard = await this.getDashboard();
    const readiness = await this.checklist.getReadiness();
    const mappings = await this.mappings.findAll().catch(() => []);
    const mismatches = await this.reconciliation.findAll({}).catch(() => []);
    return {
      generatedAt: new Date().toISOString(),
      dashboard,
      readiness,
      mappingCount: mappings.length,
      openMismatchCount: mismatches.filter((m) => m.status === "OPEN").length,
      integrationLive: false
    };
  }

  /**
   * Operational exception center — failed PO syncs, failed imports, open mismatches.
   * Payloads are never returned; error text is sanitized.
   */
  async getExceptions(query: { status?: string; limit?: number } = {}) {
    if (!this.canView()) throw new ForbiddenException("You do not have permission to view ERP integration");
    const c = requestContext.get();
    const tenantId = c?.tenantId ?? undefined;
    const limit = Math.min(Math.max(query.limit ?? 50, 1), 200);

    const [failedSyncs, failedImports, openMismatches] = await Promise.all([
      this.prisma.purchaseOrderErpSync.findMany({
        where: {
          ...(tenantId ? { tenantId } : {}),
          status: "FAILED"
        },
        orderBy: { createdAt: "desc" },
        take: limit,
        select: {
          id: true,
          tenantId: true,
          purchaseOrderId: true,
          provider: true,
          status: true,
          attempt: true,
          lastAttemptAt: true,
          nextRetryAt: true,
          errorMessage: true,
          errorCode: true,
          idempotencyKey: true,
          createdAt: true
        }
      }),
      this.prisma.erpImportBatch.findMany({
        where: {
          ...(tenantId ? { tenantId } : {}),
          OR: [{ status: "FAILED" }, { failedRows: { gt: 0 } }]
        },
        orderBy: { createdAt: "desc" },
        take: limit,
        select: {
          id: true,
          batchNo: true,
          importType: true,
          status: true,
          failedRows: true,
          errorMessage: true,
          createdAt: true
        }
      }),
      this.prisma.erpReconciliationMismatch.findMany({
        where: {
          ...(tenantId ? { tenantId } : {}),
          status: "OPEN"
        },
        orderBy: { createdAt: "desc" },
        take: limit,
        select: {
          id: true,
          status: true,
          createdAt: true,
          partId: true,
          sourceRecordCode: true,
          variance: true,
          mismatchType: true,
          fieldName: true
        }
      }).catch(() => [])
    ]);

    const items = [
      ...failedSyncs.map((s) => ({
        id: s.id,
        source: "PURCHASE_ORDER_ERP_SYNC",
        target: s.provider,
        entity: "PurchaseOrder",
        entityId: s.purchaseOrderId,
        operation: "ERP_SYNC",
        status: s.status,
        attemptCount: s.attempt,
        lastError: sanitizeErpErrorMessage(s.errorMessage),
        errorCode: s.errorCode,
        correlationId: s.idempotencyKey,
        timestamp: s.lastAttemptAt ?? s.createdAt,
        nextRetryAt: s.nextRetryAt,
        retryPath: `/inventory/purchase-orders/${s.purchaseOrderId}/erp-sync/retry`,
        resolved: false
      })),
      ...failedImports.map((b) => ({
        id: b.id,
        source: "ERP_IMPORT_BATCH",
        target: "FILE_IMPORT",
        entity: "ErpImportBatch",
        entityId: b.id,
        operation: b.importType,
        status: b.status,
        attemptCount: 1,
        lastError: sanitizeErpErrorMessage(b.errorMessage) || `${b.failedRows} failed rows`,
        errorCode: null,
        correlationId: b.batchNo,
        timestamp: b.createdAt,
        nextRetryAt: null,
        retryPath: null,
        resolved: false
      })),
      ...openMismatches.map((m) => ({
        id: m.id,
        source: "ERP_RECONCILIATION",
        target: "STOCK_SNAPSHOT",
        entity: "ErpReconciliationMismatch",
        entityId: m.id,
        operation: m.mismatchType || "RECONCILE",
        status: m.status,
        attemptCount: 1,
        lastError: `${m.fieldName}: variance=${m.variance ?? "?"}`,
        errorCode: null,
        correlationId: m.sourceRecordCode,
        timestamp: m.createdAt,
        nextRetryAt: null,
        retryPath: `/erp/reconciliation/${m.id}`,
        resolved: false
      }))
    ].sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

    return {
      generatedAt: new Date().toISOString(),
      count: items.length,
      items: items.slice(0, limit),
      note: "Live Bileeta credentials/contracts remain an external dependency — retries use existing mock/adapter paths."
    };
  }

  async exportReport() {
    const report = await this.getReport();
    await writeAuditTrail(this.prisma, {
      entity: "ErpIntegration",
      entityId: "report",
      action: AuditAction.UPDATE,
      module: "erp-integration",
      metadata: { event: "erp_report_exported" } as Prisma.InputJsonValue
    });
    return report;
  }
}
