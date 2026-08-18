import { Module, forwardRef } from "@nestjs/common";

import { InventoryModule } from "../inventory/inventory.module";
import { NotificationsModule } from "../notifications/notifications.module";
import { CostAllocationService } from "./cost-allocation.service";
import { DataQualityService } from "./data-quality.service";
import { DomainNotificationService } from "./domain-notification.service";
import { EnterpriseOpsController } from "./enterprise-ops.controller";
import { EnterpriseOpsService } from "./enterprise-ops.service";
import { PmForecastService } from "./pm-forecast.service";
import { ProcurementRecommendationService } from "./procurement-recommendation.service";
import { WarrantyHealthService } from "./warranty-health.service";

@Module({
  imports: [NotificationsModule, forwardRef(() => InventoryModule)],
  controllers: [EnterpriseOpsController],
  providers: [
    DataQualityService,
    DomainNotificationService,
    PmForecastService,
    CostAllocationService,
    WarrantyHealthService,
    ProcurementRecommendationService,
    EnterpriseOpsService
  ],
  exports: [
    DataQualityService,
    DomainNotificationService,
    PmForecastService,
    CostAllocationService,
    WarrantyHealthService,
    ProcurementRecommendationService,
    EnterpriseOpsService
  ]
})
export class EnterpriseOpsModule {}
