import { Module } from "@nestjs/common";

import { PredictiveAiController } from "./predictive-ai.controller";
import { PredictiveAiService } from "./predictive-ai.service";

@Module({
  controllers: [PredictiveAiController],
  providers: [PredictiveAiService],
  exports: [PredictiveAiService]
})
export class PredictiveAiModule {}
