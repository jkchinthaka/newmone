import { Module } from "@nestjs/common";

import { AdminGovernanceController } from "./admin-governance.controller";
import { AdminGovernanceService } from "./admin-governance.service";

@Module({
  controllers: [AdminGovernanceController],
  providers: [AdminGovernanceService],
  exports: [AdminGovernanceService]
})
export class AdminGovernanceModule {}
