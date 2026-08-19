import { Module, forwardRef } from "@nestjs/common";

import { ComplianceModule } from "../compliance/compliance.module";
import { EnterpriseOpsModule } from "../enterprise-ops/enterprise-ops.module";
import { FleetModule } from "../fleet/fleet.module";
import { VehiclesController } from "./vehicles.controller";
import { VehiclesService } from "./vehicles.service";

@Module({
  imports: [FleetModule, ComplianceModule, forwardRef(() => EnterpriseOpsModule)],
  controllers: [VehiclesController],
  providers: [VehiclesService],
  exports: [VehiclesService]
})
export class VehiclesModule {}
