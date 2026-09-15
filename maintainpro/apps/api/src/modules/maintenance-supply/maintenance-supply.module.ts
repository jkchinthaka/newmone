import { Module, forwardRef } from "@nestjs/common";

import { ApprovalsModule } from "../approvals/approvals.module";
import { InventoryModule } from "../inventory/inventory.module";
import { MaintenanceSupplyController } from "./maintenance-supply.controller";
import { MaintenanceSupplyService } from "./maintenance-supply.service";

@Module({
  imports: [InventoryModule, forwardRef(() => ApprovalsModule)],
  controllers: [MaintenanceSupplyController],
  providers: [MaintenanceSupplyService],
  exports: [MaintenanceSupplyService]
})
export class MaintenanceSupplyModule {}
