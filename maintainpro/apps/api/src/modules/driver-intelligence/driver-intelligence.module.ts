import { Module } from "@nestjs/common";

import { DriverIntelligenceController } from "./driver-intelligence.controller";
import { DriverIntelligenceService } from "./driver-intelligence.service";

@Module({
  controllers: [DriverIntelligenceController],
  providers: [DriverIntelligenceService],
  exports: [DriverIntelligenceService]
})
export class DriverIntelligenceModule {}