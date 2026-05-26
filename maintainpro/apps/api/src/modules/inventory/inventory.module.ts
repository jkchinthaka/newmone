import { Module } from "@nestjs/common";

import { NotificationsModule } from "../notifications/notifications.module";
import { ErpSyncProviderService } from "./erp-sync-provider.service";
import { InventoryController } from "./inventory.controller";
import { InventoryService } from "./inventory.service";

@Module({
  imports: [NotificationsModule],
  controllers: [InventoryController],
  providers: [InventoryService, ErpSyncProviderService],
  exports: [InventoryService, ErpSyncProviderService]
})
export class InventoryModule {}
