import { Module } from "@nestjs/common";

import { EvidenceModule } from "../evidence/evidence.module";
import { NotificationsModule } from "../notifications/notifications.module";
import { WorkforceModule } from "../workforce/workforce.module";

import { WorkOrderActivityService } from "./work-order-activity.service";
import { WorkOrderAssigneesService } from "./work-order-assignees.service";
import { WorkOrderHistoryService } from "./work-order-history.service";
import { WorkOrdersController } from "./work-orders.controller";
import { WorkOrdersService } from "./work-orders.service";

@Module({
  imports: [NotificationsModule, EvidenceModule, WorkforceModule],
  controllers: [WorkOrdersController],
  providers: [WorkOrdersService, WorkOrderActivityService, WorkOrderAssigneesService, WorkOrderHistoryService],
  exports: [WorkOrdersService, WorkOrderActivityService, WorkOrderAssigneesService, WorkOrderHistoryService]
})
export class WorkOrdersModule {}
