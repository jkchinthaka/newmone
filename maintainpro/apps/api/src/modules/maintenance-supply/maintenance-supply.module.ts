import { Module } from "@nestjs/common";

import { MaintenanceSupplyController } from "./maintenance-supply.controller";
import { MaintenanceSupplyService } from "./maintenance-supply.service";

@Module({
  controllers: [MaintenanceSupplyController],
  providers: [MaintenanceSupplyService],
  exports: [MaintenanceSupplyService]
})
export class MaintenanceSupplyModule {}
