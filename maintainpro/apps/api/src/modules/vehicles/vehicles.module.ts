import { Module, forwardRef } from "@nestjs/common";

import { ApprovalsModule } from "../approvals/approvals.module";
import { ComplianceModule } from "../compliance/compliance.module";
import { EnterpriseOpsModule } from "../enterprise-ops/enterprise-ops.module";
import { FleetModule } from "../fleet/fleet.module";
import { VehiclesController } from "./vehicles.controller";
import { VehiclesService } from "./vehicles.service";

@Module({
  imports: [
    FleetModule,
    ComplianceModule,
    forwardRef(() => EnterpriseOpsModule),
    // Phase 10: ApprovalsModule imported for gate override approval path.
    // forwardRef avoids circular dependency since ApprovalsModule may import other modules.
    forwardRef(() => ApprovalsModule)
  ],
  controllers: [VehiclesController],
  providers: [VehiclesService],
  exports: [VehiclesService]
})
export class VehiclesModule {}
