import { Module } from "@nestjs/common";
import { MaintenanceModule } from "../maintenance/maintenance.module";
import { ReportsModule } from "../reports/reports.module";
import { WorkOrdersModule } from "../work-orders/work-orders.module";

import { PredictiveAiController } from "./predictive-ai.controller";
import { PredictiveAiService } from "./predictive-ai.service";

@Module({
  imports: [WorkOrdersModule, MaintenanceModule, ReportsModule],
  controllers: [PredictiveAiController],
  providers: [PredictiveAiService],
  exports: [PredictiveAiService]
})
export class PredictiveAiModule {}
