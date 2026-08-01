import { Module } from "@nestjs/common";

import { DriverIntelligenceModule } from "../driver-intelligence/driver-intelligence.module";
import { InventoryModule } from "../inventory/inventory.module";
import { VehiclesModule } from "../vehicles/vehicles.module";
import { WorkforceModule } from "../workforce/workforce.module";
import { ErpMonitoringService } from "./erp-monitoring.service";
import { MaintenanceReportsController } from "./maintenance-reports.controller";
import { MaintenanceReportsService } from "./maintenance-reports.service";
import { ReportsController } from "./reports.controller";
import { ReportsService } from "./reports.service";
import { WorkOrderCategoryReportsController } from "./work-order-category-reports.controller";
import { WorkOrderCategoryReportsService } from "./work-order-category-reports.service";

@Module({
  imports: [DriverIntelligenceModule, VehiclesModule, WorkforceModule, InventoryModule],
  controllers: [ReportsController, MaintenanceReportsController, WorkOrderCategoryReportsController],
  providers: [ReportsService, MaintenanceReportsService, WorkOrderCategoryReportsService, ErpMonitoringService],
  exports: [ReportsService, MaintenanceReportsService, WorkOrderCategoryReportsService, ErpMonitoringService]
})
export class ReportsModule {}
