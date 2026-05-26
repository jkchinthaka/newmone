import { Module } from "@nestjs/common";
import { BullModule } from "@nestjs/bull";

import { NotificationsController } from "./notifications.controller";
import { NotificationsGateway } from "./notifications.gateway";
import { NotificationsProcessor } from "./notifications.processor";
import { NotificationsService } from "./notifications.service";
import { NoopPushProvider, PushDispatchService } from "./push-dispatch.service";

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
    PushDispatchService,
    NoopPushProvider
  ],
  exports: [NotificationsService]
})
export class NotificationsModule {}
