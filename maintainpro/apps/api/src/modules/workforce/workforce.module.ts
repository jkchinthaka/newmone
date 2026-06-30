import { Module } from "@nestjs/common";

import { WorkforceController } from "./workforce.controller";
import { WorkforcePlanningService } from "./workforce-planning.service";

@Module({
  controllers: [WorkforceController],
  providers: [WorkforcePlanningService],
  exports: [WorkforcePlanningService]
})
export class WorkforceModule {}
