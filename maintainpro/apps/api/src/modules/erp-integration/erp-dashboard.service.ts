import { ForbiddenException, Injectable } from "@nestjs/common";

import { requestContext } from "../../common/context/request-context";
import { writeAuditTrail } from "../../common/utils/audit-trail.util";
import { PrismaService } from "../../database/prisma.service";
import { AuditAction, Prisma, RoleName } from "@prisma/client";
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
