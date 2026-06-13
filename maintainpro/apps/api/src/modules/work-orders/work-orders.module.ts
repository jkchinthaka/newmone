import { Module } from "@nestjs/common";

import { EvidenceModule } from "../evidence/evidence.module";
import { NotificationsModule } from "../notifications/notifications.module";

import { WorkOrderActivityService } from "./work-order-activity.service";
import { WorkOrdersController } from "./work-orders.controller";
import { WorkOrdersService } from "./work-orders.service";

@Module({
  imports: [NotificationsModule, EvidenceModule],
  controllers: [WorkOrdersController],
  providers: [WorkOrdersService, WorkOrderActivityService],
  exports: [WorkOrdersService, WorkOrderActivityService]
})
export class WorkOrdersModule {}
