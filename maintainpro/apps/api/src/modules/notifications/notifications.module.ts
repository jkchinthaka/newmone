import { BullModule } from "@nestjs/bull";
import { Module } from "@nestjs/common";

import { NotificationsController } from "./notifications.controller";
import { EmailDispatchService } from "./email-dispatch.service";
import { NotificationReadinessService } from "./notification-readiness.service";
import { NotificationTemplatesService } from "./notification-templates.service";
import { NotificationsGateway } from "./notifications.gateway";
import { NotificationsProcessor } from "./notifications.processor";
import { NotificationsQueueMonitor } from "./notifications-queue.monitor";
import { NotificationsService } from "./notifications.service";
import { HttpPushProvider, NoopPushProvider, PushDispatchService } from "./push-dispatch.service";
import { SmsDispatchService } from "./sms-dispatch.service";

@Module({
  imports: [
    BullModule.registerQueue({
      name: "notifications"
    })
  ],
  controllers: [NotificationsController],
  providers: [
    NotificationsService,
    NotificationsGateway,
    NotificationsProcessor,
    NotificationsQueueMonitor,
    EmailDispatchService,
    SmsDispatchService,
    PushDispatchService,
    HttpPushProvider,
    NoopPushProvider,
    NotificationReadinessService,
    NotificationTemplatesService
  ],
  exports: [
    NotificationsService,
    EmailDispatchService,
    SmsDispatchService,
    PushDispatchService,
    NotificationReadinessService,
    NotificationTemplatesService
  ]
})
export class NotificationsModule {}
