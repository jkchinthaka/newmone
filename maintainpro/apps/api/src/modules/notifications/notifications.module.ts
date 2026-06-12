import { Module } from "@nestjs/common";
import { BullModule } from "@nestjs/bull";

import { NotificationsController } from "./notifications.controller";
import { EmailDispatchService } from "./email-dispatch.service";
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
    NoopPushProvider
  ],
  exports: [NotificationsService, EmailDispatchService, SmsDispatchService, PushDispatchService]
})
export class NotificationsModule {}
