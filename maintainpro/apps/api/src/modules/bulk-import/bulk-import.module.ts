import { Module } from "@nestjs/common";

import { AssetBulkImportAdapter } from "./adapters/asset.adapter";
import { DepartmentBulkImportAdapter } from "./adapters/department.adapter";
import { JobCodeBulkImportAdapter } from "./adapters/job-code.adapter";
import { SupplierBulkImportAdapter } from "./adapters/supplier.adapter";
import { VehicleBulkImportAdapter } from "./adapters/vehicle.adapter";
import { BulkImportAdapterRegistry } from "./bulk-import-adapter-registry.service";
import { BulkImportAuthService } from "./bulk-import-auth.service";
import { BulkImportController } from "./bulk-import.controller";
import { BulkImportParserService } from "./bulk-import-parser.service";
import { BulkImportService } from "./bulk-import.service";

@Module({
  controllers: [BulkImportController],
  providers: [
    BulkImportService,
    BulkImportAuthService,
    BulkImportParserService,
    BulkImportAdapterRegistry,
    VehicleBulkImportAdapter,
    AssetBulkImportAdapter,
    DepartmentBulkImportAdapter,
    SupplierBulkImportAdapter,
    JobCodeBulkImportAdapter
  ]
})
export class BulkImportModule {}
