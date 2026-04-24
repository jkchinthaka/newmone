import { Module } from "@nestjs/common";

import { NotificationsModule } from "../notifications/notifications.module";
import { PredictiveAiController } from "./predictive-ai.controller";
import { PredictiveAiService } from "./predictive-ai.service";

@Module({
  imports: [NotificationsModule],
  controllers: [PredictiveAiController],
  providers: [PredictiveAiService],
  exports: [PredictiveAiService]
})
export class PredictiveAiModule {}
