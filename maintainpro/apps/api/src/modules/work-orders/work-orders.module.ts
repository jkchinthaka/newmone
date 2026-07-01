import { Module } from "@nestjs/common";

import { EvidenceModule } from "../evidence/evidence.module";
import { NotificationsModule } from "../notifications/notifications.module";
import { ReportsModule } from "../reports/reports.module";
import { WorkforceModule } from "../workforce/workforce.module";

import { WorkOrderActivityService } from "./work-order-activity.service";
import { WorkOrderAssigneesService } from "./work-order-assignees.service";
import { WorkOrderHistoryService } from "./work-order-history.service";
import { WorkOrderGovernanceService } from "./work-order-governance.service";
import { WorkOrderPartsService } from "./work-order-parts.service";
import { WorkOrderQueuesService } from "./work-order-queues.service";
import { VendorRepairService } from "./vendor-repair.service";
import { WorkOrdersController } from "./work-orders.controller";
import { WorkOrdersService } from "./work-orders.service";

@Module({
  imports: [NotificationsModule, EvidenceModule, WorkforceModule, ReportsModule],
  controllers: [WorkOrdersController],
  providers: [
    WorkOrdersService,
    WorkOrderActivityService,
    WorkOrderAssigneesService,
    WorkOrderHistoryService,
    WorkOrderGovernanceService,
    WorkOrderPartsService,
    WorkOrderQueuesService,
    VendorRepairService
  ],
  exports: [
    WorkOrdersService,
    WorkOrderActivityService,
    WorkOrderAssigneesService,
    WorkOrderHistoryService,
    WorkOrderGovernanceService,
    WorkOrderPartsService,
    WorkOrderQueuesService,
    VendorRepairService
  ]
})
export class WorkOrdersModule {}
