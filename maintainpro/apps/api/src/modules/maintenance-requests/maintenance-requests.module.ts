import { Module, forwardRef } from "@nestjs/common";

import { EvidenceModule } from "../evidence/evidence.module";
import { AssetsModule } from "../assets/assets.module";
import { NotificationsModule } from "../notifications/notifications.module";
import { WorkOrdersModule } from "../work-orders/work-orders.module";
import { MaintenanceRequestsController } from "./maintenance-requests.controller";
import { RequestPhotosService } from "./request-photos.service";
import { MaintenanceRequestsService } from "./maintenance-requests.service";

@Module({
  imports: [AssetsModule, EvidenceModule, NotificationsModule, forwardRef(() => WorkOrdersModule)],
  controllers: [MaintenanceRequestsController],
  providers: [MaintenanceRequestsService, RequestPhotosService],
  exports: [MaintenanceRequestsService]
})
export class MaintenanceRequestsModule {}
