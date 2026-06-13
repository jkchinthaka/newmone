import { Module, forwardRef } from "@nestjs/common";

import { QrCodeService } from "../../common/services/qr-code.service";
import { NotificationsModule } from "../notifications/notifications.module";
import { WorkOrdersModule } from "../work-orders/work-orders.module";
import { CleaningController } from "./cleaning.controller";
import { CleaningService } from "./cleaning.service";
import { DuplicateFacilityIssueService } from "./duplicate-facility-issue.service";

@Module({
  imports: [NotificationsModule, forwardRef(() => WorkOrdersModule)],
  controllers: [CleaningController],
  providers: [CleaningService, DuplicateFacilityIssueService, QrCodeService],
  exports: [CleaningService, DuplicateFacilityIssueService]
})
export class CleaningModule {}
