import { Module } from "@nestjs/common";

import { NotificationsModule } from "../notifications/notifications.module";

import { WorkOrdersController } from "./work-orders.controller";
import { WorkOrdersService } from "./work-orders.service";

@Module({
  imports: [NotificationsModule],
  controllers: [WorkOrdersController],
  providers: [WorkOrdersService],
  exports: [WorkOrdersService]
})
export class WorkOrdersModule {}
