import { Module } from "@nestjs/common";

import { NotificationsModule } from "../notifications/notifications.module";
import {
  DisabledInventoryErpAdapter,
  InventoryErpAdapterService
} from "./inventory-erp-adapter.service";
import { ErpSyncProviderService } from "./erp-sync-provider.service";
import { BileetaInventoryErpAdapter } from "./bileeta-inventory-erp.adapter";
import { ErpStockSyncService } from "./erp-stock-sync.service";
import { InventoryController } from "./inventory.controller";
import { InventoryService } from "./inventory.service";

@Module({
  imports: [NotificationsModule],
  controllers: [InventoryController],
  providers: [
    InventoryService,
    ErpSyncProviderService,
    DisabledInventoryErpAdapter,
    InventoryErpAdapterService,
    BileetaInventoryErpAdapter,
    ErpStockSyncService
  ],
  exports: [
    InventoryService,
    ErpSyncProviderService,
    InventoryErpAdapterService,
    ErpStockSyncService
  ]
})
export class InventoryModule {}
