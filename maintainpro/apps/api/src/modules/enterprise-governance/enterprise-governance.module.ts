import { Module } from "@nestjs/common";

import { PrismaModule } from "../../database/prisma.module";
import { EnterpriseGovernanceController } from "./enterprise-governance.controller";
import { EnterpriseGovernanceService } from "./enterprise-governance.service";

@Module({
  imports: [PrismaModule],
  controllers: [EnterpriseGovernanceController],
  providers: [EnterpriseGovernanceService],
  exports: [EnterpriseGovernanceService]
})
export class EnterpriseGovernanceModule {}
