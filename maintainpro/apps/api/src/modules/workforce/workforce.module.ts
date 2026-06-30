import { Module } from "@nestjs/common";

import { WorkforceController } from "./workforce.controller";
import { WorkforceEmployeesService } from "./workforce-employees.service";
import { WorkforcePlanningService } from "./workforce-planning.service";

@Module({
  controllers: [WorkforceController],
  providers: [WorkforcePlanningService, WorkforceEmployeesService],
  exports: [WorkforcePlanningService, WorkforceEmployeesService]
})
export class WorkforceModule {}
