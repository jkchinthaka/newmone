import { Module } from "@nestjs/common";

import { CutoverChecklistService } from "./cutover-checklist.service";
import { DecisionBoardService } from "./decision-board.service";
import { GoLiveController } from "./go-live.controller";
import { GoLiveDashboardService } from "./go-live-dashboard.service";
import { GoLiveSignOffService } from "./go-live-signoff.service";
import { PilotRolloutService } from "./pilot-rollout.service";
import { RollbackPlanService } from "./rollback-plan.service";
import { RolloutWavesService } from "./rollout-waves.service";

@Module({
  controllers: [GoLiveController],
  providers: [
    GoLiveDashboardService,
    PilotRolloutService,
    CutoverChecklistService,
    RolloutWavesService,
    DecisionBoardService,
    RollbackPlanService,
    GoLiveSignOffService
  ],
  exports: [GoLiveDashboardService]
})
export class GoLiveModule {}
