import { Module } from "@nestjs/common";

import { DriverIntelligenceModule } from "../driver-intelligence/driver-intelligence.module";
import { VehiclesModule } from "../vehicles/vehicles.module";
import { ReportsController } from "./reports.controller";
import { ReportsService } from "./reports.service";

@Module({
  imports: [DriverIntelligenceModule, VehiclesModule],
  controllers: [ReportsController],
  providers: [ReportsService],
  exports: [ReportsService]
})
export class ReportsModule {}
