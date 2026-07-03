import { Module } from "@nestjs/common";

import { ChangeRequestsController, PostGoLiveController } from "./post-go-live.controller";
import { ReleasesController, SupportController } from "./support.controller";
import { ChangeRequestsService } from "./change-requests.service";
import { HandoverService } from "./handover.service";
import { HypercareService } from "./hypercare.service";
import { OperationsDashboardService } from "./operations-dashboard.service";
import { ReleasesService } from "./releases.service";
import { SupportTicketsService } from "./support-tickets.service";
import { TrainingService } from "./training.service";

@Module({
  controllers: [PostGoLiveController, SupportController, ChangeRequestsController, ReleasesController],
  providers: [
    SupportTicketsService,
    TrainingService,
    ChangeRequestsService,
    ReleasesService,
    HypercareService,
    HandoverService,
    OperationsDashboardService
  ],
  exports: [SupportTicketsService, OperationsDashboardService]
})
export class PostGoLiveModule {}
