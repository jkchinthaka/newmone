import { Module } from "@nestjs/common";

import { NotificationsModule } from "../notifications/notifications.module";
import {
  DisabledInventoryErpAdapter,
  InventoryErpAdapterService
} from "./inventory-erp-adapter.service";
import { ErpSyncProviderService } from "./erp-sync-provider.service";
import { BileetaInventoryErpAdapter } from "./bileeta-inventory-erp.adapter";
import { ErpStockSyncService } from "./erp-stock-sync.service";
import { ErpExcelImportService } from "./erp-excel-import.service";
import { InventoryController } from "./inventory.controller";
import { InventoryService } from "./inventory.service";
import { InventoryTransactionEngine } from "./inventory-transaction.engine";
import { InventoryExcelImportService } from "./inventory-excel-import.service";
import { InventoryDailyService } from "./inventory-daily.service";

@Module({
  imports: [NotificationsModule],
  controllers: [InventoryController],
  providers: [
    InventoryService,
    InventoryTransactionEngine,
    InventoryExcelImportService,
    InventoryDailyService,
    ErpSyncProviderService,
    DisabledInventoryErpAdapter,
    InventoryErpAdapterService,
    BileetaInventoryErpAdapter,
    ErpStockSyncService,
    ErpExcelImportService
  ],
  exports: [
    InventoryService,
    InventoryTransactionEngine,
    InventoryExcelImportService,
    InventoryDailyService,
    ErpSyncProviderService,
    InventoryErpAdapterService,
    ErpStockSyncService,
    ErpExcelImportService
  ]
})
export class InventoryModule {}
