import { Module } from "@nestjs/common";

import { FleetController } from "./fleet.controller";
import { FleetGateway } from "./fleet.gateway";
import { FleetService } from "./fleet.service";

@Module({
  controllers: [FleetController],
  providers: [FleetService, FleetGateway],
  exports: [FleetService]
})
export class FleetModule {}
