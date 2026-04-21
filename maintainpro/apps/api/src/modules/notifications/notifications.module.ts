import { Module } from "@nestjs/common";
import { BullModule } from "@nestjs/bull";

import { NotificationsController } from "./notifications.controller";
import { NotificationsGateway } from "./notifications.gateway";
import { NotificationsProcessor } from "./notifications.processor";
import { NotificationsService } from "./notifications.service";

@Module({
  imports: [
    BullModule.registerQueue({
      name: "notifications"
    })
  ],
  controllers: [NotificationsController],
  providers: [NotificationsService, NotificationsGateway, NotificationsProcessor],
  exports: [NotificationsService]
})
export class NotificationsModule {}
