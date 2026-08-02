import { Module, forwardRef } from "@nestjs/common";
import { BullModule } from "@nestjs/bull";

import { NotificationsModule } from "../notifications/notifications.module";
import { QueuesModule } from "../queues/queues.module";
import { QueueStartupReconciliationService } from "../queues/reconciliation/queue-startup-reconciliation.service";
import { OperationalAlertEvaluatorService } from "./alerts/operational-alert-evaluator.service";
import { OperationalAlertService } from "./alerts/operational-alert.service";
import { OperationalMetricsService } from "./alerts/operational-metrics.service";
import { OperationsController } from "./operations.controller";
import { OperationsService } from "./operations.service";

@Module({
  imports: [
    QueuesModule,
    BullModule.registerQueue({ name: "notifications" }),
    forwardRef(() => NotificationsModule)
  ],
  controllers: [OperationsController],
  providers: [
    OperationsService,
    OperationalAlertService,
    OperationalAlertEvaluatorService,
    OperationalMetricsService,
    QueueStartupReconciliationService
  ],
  exports: [
    OperationsService,
    OperationalAlertService,
    OperationalAlertEvaluatorService,
    OperationalMetricsService,
    QueueStartupReconciliationService
  ]
})
export class OperationsModule {}
