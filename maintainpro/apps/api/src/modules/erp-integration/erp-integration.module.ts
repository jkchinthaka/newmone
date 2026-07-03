import { Module } from "@nestjs/common";

import { ErpAccessChecklistService } from "./erp-access-checklist.service";
import { ErpConfigService } from "./erp-config.service";
import { ErpDashboardService } from "./erp-dashboard.service";
import { ErpImportService } from "./erp-import.service";
import { ErpIntegrationController } from "./erp-integration.controller";
import { ErpMappingService } from "./erp-mapping.service";
import { ErpMockSyncService } from "./erp-mock-sync.service";
import { ErpReconciliationService } from "./erp-reconciliation.service";

@Module({
  controllers: [ErpIntegrationController],
  providers: [
    ErpConfigService,
    ErpDashboardService,
    ErpMappingService,
    ErpMockSyncService,
    ErpImportService,
    ErpReconciliationService,
    ErpAccessChecklistService
  ],
  exports: [ErpConfigService, ErpDashboardService]
})
export class ErpIntegrationModule {}
