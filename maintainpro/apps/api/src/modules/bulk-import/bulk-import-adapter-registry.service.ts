import { Injectable, NotFoundException } from "@nestjs/common";
import { BulkImportEntity } from "@prisma/client";

import { AssetBulkImportAdapter } from "./adapters/asset.adapter";
import { DepartmentBulkImportAdapter } from "./adapters/department.adapter";
import { JobCodeBulkImportAdapter } from "./adapters/job-code.adapter";
import { SupplierBulkImportAdapter } from "./adapters/supplier.adapter";
import { VehicleBulkImportAdapter } from "./adapters/vehicle.adapter";
import { BulkImportAdapter } from "./bulk-import-adapter";
import { BULK_IMPORT_ENTITY_SLUGS } from "./bulk-import.constants";

@Injectable()
export class BulkImportAdapterRegistry {
  private readonly adapters: Map<BulkImportEntity, BulkImportAdapter>;

  constructor(
    vehicleAdapter: VehicleBulkImportAdapter,
    assetAdapter: AssetBulkImportAdapter,
    departmentAdapter: DepartmentBulkImportAdapter,
    supplierAdapter: SupplierBulkImportAdapter,
    jobCodeAdapter: JobCodeBulkImportAdapter
  ) {
    this.adapters = new Map<BulkImportEntity, BulkImportAdapter>([
      [BulkImportEntity.VEHICLE, vehicleAdapter],
      [BulkImportEntity.ASSET, assetAdapter],
      [BulkImportEntity.DEPARTMENT, departmentAdapter],
      [BulkImportEntity.SUPPLIER, supplierAdapter],
      [BulkImportEntity.JOB_CODE, jobCodeAdapter]
    ]);
  }

  /** Resolves a URL slug (e.g. "job-code") to its adapter, 404-ing on anything not explicitly wired up. */
  resolveSlug(slug: string): BulkImportAdapter {
    const entityType = BULK_IMPORT_ENTITY_SLUGS[slug];
    if (!entityType) {
      throw new NotFoundException(`Unknown or unsupported bulk import entity: ${slug}`);
    }
    return this.resolve(entityType);
  }

  resolve(entityType: BulkImportEntity): BulkImportAdapter {
    const adapter = this.adapters.get(entityType);
    if (!adapter) {
      throw new NotFoundException(`No bulk import adapter registered for ${entityType}`);
    }
    return adapter;
  }

  list(): BulkImportAdapter[] {
    return Array.from(this.adapters.values());
  }
}
