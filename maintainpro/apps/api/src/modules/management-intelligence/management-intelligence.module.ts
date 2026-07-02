import { Module } from "@nestjs/common";

import { ManagementIntelligenceController } from "./management-intelligence.controller";
import { ManagementIntelligenceService } from "./management-intelligence.service";

@Module({
  controllers: [ManagementIntelligenceController],
  providers: [ManagementIntelligenceService],
  exports: [ManagementIntelligenceService]
})
export class ManagementIntelligenceModule {}
