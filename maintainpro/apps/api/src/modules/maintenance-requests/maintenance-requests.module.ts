import { Module, forwardRef } from "@nestjs/common";

import { AssetsModule } from "../assets/assets.module";
import { NotificationsModule } from "../notifications/notifications.module";
import { WorkOrdersModule } from "../work-orders/work-orders.module";
import { MaintenanceRequestsController } from "./maintenance-requests.controller";
import { MaintenanceRequestsService } from "./maintenance-requests.service";

@Module({
  imports: [AssetsModule, NotificationsModule, forwardRef(() => WorkOrdersModule)],
  controllers: [MaintenanceRequestsController],
  providers: [MaintenanceRequestsService],
  exports: [MaintenanceRequestsService]
})
export class MaintenanceRequestsModule {}
