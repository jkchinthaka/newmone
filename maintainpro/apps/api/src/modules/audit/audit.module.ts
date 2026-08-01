import { Module } from "@nestjs/common";

import { AuditController } from "./audit.controller";
import { AuditService } from "./audit.service";
import { SecurityEventsService } from "./security-events.service";

@Module({
  controllers: [AuditController],
  providers: [AuditService, SecurityEventsService],
  exports: [AuditService, SecurityEventsService]
})
export class AuditModule {}
