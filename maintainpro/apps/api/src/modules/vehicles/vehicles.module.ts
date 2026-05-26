import { Module } from "@nestjs/common";

import { ComplianceModule } from "../compliance/compliance.module";
import { FleetModule } from "../fleet/fleet.module";
import { VehiclesController } from "./vehicles.controller";
import { VehiclesService } from "./vehicles.service";

@Module({
  imports: [FleetModule, ComplianceModule],
  controllers: [VehiclesController],
  providers: [VehiclesService],
  exports: [VehiclesService]
})
export class VehiclesModule {}
