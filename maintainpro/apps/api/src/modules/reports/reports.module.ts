import { Module } from "@nestjs/common";

import { DriverIntelligenceModule } from "../driver-intelligence/driver-intelligence.module";
import { VehiclesModule } from "../vehicles/vehicles.module";
import { WorkforceModule } from "../workforce/workforce.module";
import { MaintenanceReportsController } from "./maintenance-reports.controller";
import { MaintenanceReportsService } from "./maintenance-reports.service";
import { ReportsController } from "./reports.controller";
import { ReportsService } from "./reports.service";

@Module({
  imports: [DriverIntelligenceModule, VehiclesModule, WorkforceModule],
  controllers: [ReportsController, MaintenanceReportsController],
  providers: [ReportsService, MaintenanceReportsService],
  exports: [ReportsService, MaintenanceReportsService]
})
export class ReportsModule {}
