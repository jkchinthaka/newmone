import { Module } from "@nestjs/common";

import { EvidenceModule } from "../evidence/evidence.module";
import { NotificationsModule } from "../notifications/notifications.module";
import { WorkforceModule } from "../workforce/workforce.module";

import { WorkOrderActivityService } from "./work-order-activity.service";
import { WorkOrderAssigneesService } from "./work-order-assignees.service";
import { WorkOrderHistoryService } from "./work-order-history.service";
import { WorkOrderGovernanceService } from "./work-order-governance.service";
import { WorkOrderPartsService } from "./work-order-parts.service";
import { WorkOrdersController } from "./work-orders.controller";
import { WorkOrdersService } from "./work-orders.service";

@Module({
  imports: [NotificationsModule, EvidenceModule, WorkforceModule],
  controllers: [WorkOrdersController],
  providers: [
    WorkOrdersService,
    WorkOrderActivityService,
    WorkOrderAssigneesService,
    WorkOrderHistoryService,
    WorkOrderGovernanceService,
    WorkOrderPartsService
  ],
  exports: [
    WorkOrdersService,
    WorkOrderActivityService,
    WorkOrderAssigneesService,
    WorkOrderHistoryService,
    WorkOrderGovernanceService,
    WorkOrderPartsService
  ]
})
export class WorkOrdersModule {}
