import { Module, forwardRef } from "@nestjs/common";

import { PrismaModule } from "../../database/prisma.module";
import { ApprovalsModule } from "../approvals/approvals.module";
import { FleetLifecycleController } from "./fleet-lifecycle.controller";
import { FleetLifecycleService } from "./fleet-lifecycle.service";

@Module({
  imports: [
    PrismaModule,
    // Optional: Approval engine for gate override approval path (Phase 7 integration)
    forwardRef(() => ApprovalsModule)
  ],
  controllers: [FleetLifecycleController],
  providers: [FleetLifecycleService],
  exports: [FleetLifecycleService]
})
export class FleetLifecycleModule {}
