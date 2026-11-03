import { Module } from "@nestjs/common";

import { ComplianceController } from "./compliance.controller";
import { ComplianceService } from "./compliance.service";
import { StatutoryService } from "./statutory.service";

@Module({
  controllers: [ComplianceController],
  providers: [ComplianceService, StatutoryService],
  exports: [ComplianceService, StatutoryService]
})
export class ComplianceModule {}
