import { Module } from "@nestjs/common";

import { ReportsModule } from "../reports/reports.module";
import { WorkOrdersModule } from "../work-orders/work-orders.module";
import { FraudControlController } from "./fraud-control.controller";
import { FraudControlService } from "./fraud-control.service";

@Module({
  imports: [ReportsModule, WorkOrdersModule],
  controllers: [FraudControlController],
  providers: [FraudControlService],
  exports: [FraudControlService]
})
export class FraudControlModule {}
