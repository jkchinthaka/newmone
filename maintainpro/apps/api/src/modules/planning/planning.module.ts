import { Module, forwardRef } from "@nestjs/common";

import { ApprovalsModule } from "../approvals/approvals.module";
import { MaintenanceRequestsModule } from "../maintenance-requests/maintenance-requests.module";
import { ReliabilityModule } from "../reliability/reliability.module";
import { WorkOrdersModule } from "../work-orders/work-orders.module";
import { PlanningController } from "./planning.controller";
import { PlanningService } from "./planning.service";

@Module({
  imports: [
    WorkOrdersModule,
    ApprovalsModule,
    ReliabilityModule,
    forwardRef(() => MaintenanceRequestsModule)
  ],
  controllers: [PlanningController],
  providers: [PlanningService],
  exports: [PlanningService]
})
export class PlanningModule {}
