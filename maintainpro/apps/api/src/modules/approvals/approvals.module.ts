import { Module } from "@nestjs/common";

import { NotificationsModule } from "../notifications/notifications.module";
import { ApprovalInboxService } from "./approval-inbox.service";
import { ApprovalsController } from "./approvals.controller";
import { ApprovalsService } from "./approvals.service";

@Module({
  imports: [NotificationsModule],
  controllers: [ApprovalsController],
  providers: [ApprovalsService, ApprovalInboxService],
  exports: [ApprovalsService]
})
export class ApprovalsModule {}
