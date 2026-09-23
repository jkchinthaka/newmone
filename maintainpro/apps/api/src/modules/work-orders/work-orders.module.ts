import { Module, forwardRef } from "@nestjs/common";

import { EvidenceModule } from "../evidence/evidence.module";
import { EnterpriseOpsModule } from "../enterprise-ops/enterprise-ops.module";
import { NotificationsModule } from "../notifications/notifications.module";
import { ApprovalsModule } from "../approvals/approvals.module";
import { ReportsModule } from "../reports/reports.module";
import { WorkOrderTaxonomyModule } from "../work-order-taxonomy/work-order-taxonomy.module";
import { WorkforceModule } from "../workforce/workforce.module";

import { WorkOrderActivityService } from "./work-order-activity.service";
import { WorkOrderAssigneesService } from "./work-order-assignees.service";
import { WorkOrderHistoryService } from "./work-order-history.service";
import { WorkOrderGovernanceService } from "./work-order-governance.service";
import { WorkOrderPartsService } from "./work-order-parts.service";
import { WorkOrderQueuesService } from "./work-order-queues.service";
import { WorkOrderDomainService } from "./work-order-domain.service";
import { VendorRepairService } from "./vendor-repair.service";
import { WorkOrdersController } from "./work-orders.controller";
import { WorkOrdersService } from "./work-orders.service";

import { InventoryModule } from "../inventory/inventory.module";
import { MaintenanceConfigModule } from "../maintenance-config/maintenance-config.module";
import { WarrantiesModule } from "../warranties/warranties.module";
import { ReliabilityModule } from "../reliability/reliability.module";

@Module({
  imports: [
    NotificationsModule,
    EvidenceModule,
    WorkforceModule,
    ReportsModule,
    WorkOrderTaxonomyModule,
    InventoryModule,
    ApprovalsModule,
    MaintenanceConfigModule,
    WarrantiesModule,
    ReliabilityModule,
    forwardRef(() => EnterpriseOpsModule)
  ],
  controllers: [WorkOrdersController],
  providers: [
    WorkOrdersService,
    WorkOrderActivityService,
    WorkOrderAssigneesService,
    WorkOrderHistoryService,
    WorkOrderGovernanceService,
    WorkOrderPartsService,
    WorkOrderQueuesService,
    WorkOrderDomainService,
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
    WorkOrderDomainService,
    VendorRepairService
  ]
})
export class WorkOrdersModule {}
