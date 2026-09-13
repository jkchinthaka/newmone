import { Module } from "@nestjs/common";

import { FleetLifecycleController } from "./fleet-lifecycle.controller";
import { FleetLifecycleService } from "./fleet-lifecycle.service";

@Module({
  controllers: [FleetLifecycleController],
  providers: [FleetLifecycleService],
  exports: [FleetLifecycleService]
})
export class FleetLifecycleModule {}
