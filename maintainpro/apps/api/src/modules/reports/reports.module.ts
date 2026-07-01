import { Module } from "@nestjs/common";

import { DriverIntelligenceModule } from "../driver-intelligence/driver-intelligence.module";
import { VehiclesModule } from "../vehicles/vehicles.module";
import { WorkforceModule } from "../workforce/workforce.module";
import { MaintenanceReportsController } from "./maintenance-reports.controller";
import { MaintenanceReportsService } from "./maintenance-reports.service";
import { ReportsController } from "./reports.controller";
import { ReportsService } from "./reports.service";
import { WorkOrderCategoryReportsController } from "./work-order-category-reports.controller";
import { WorkOrderCategoryReportsService } from "./work-order-category-reports.service";

@Module({
  imports: [DriverIntelligenceModule, VehiclesModule, WorkforceModule],
  controllers: [ReportsController, MaintenanceReportsController, WorkOrderCategoryReportsController],
  providers: [ReportsService, MaintenanceReportsService, WorkOrderCategoryReportsService],
  exports: [ReportsService, MaintenanceReportsService, WorkOrderCategoryReportsService]
})
export class ReportsModule {}
