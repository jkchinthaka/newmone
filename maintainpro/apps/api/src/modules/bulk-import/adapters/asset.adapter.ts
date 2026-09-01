import { Inject, Injectable } from "@nestjs/common";
import { AssetCategory, AssetCondition, BulkImportEntity } from "@prisma/client";

import { PrismaService } from "../../../database/prisma.service";
import {
  BulkImportAdapter,
  BulkImportExistingRecord,
  BulkImportFieldIssue,
  BulkImportNormalizedRow,
  BulkImportTemplateColumn
} from "../bulk-import-adapter";
import { normalizeEnumValue, requireTrimmedString, trimToNull } from "../util/bulk-import-normalize.util";

const ASSET_CATEGORIES = Object.values(AssetCategory);
const ASSET_CONDITIONS = Object.values(AssetCondition);

const TEMPLATE_COLUMNS: BulkImportTemplateColumn[] = [
  { key: "assetTag", header: "Asset Tag", required: true, example: "AT-1001" },
  { key: "name", header: "Name", required: true, example: "Backup Generator" },
  {
    key: "category",
    header: "Category",
    required: true,
    example: "EQUIPMENT",
    notes: `One of: ${ASSET_CATEGORIES.join(", ")}`
  },
  {
    key: "condition",
    header: "Condition",
    required: false,
    example: "GOOD",
    notes: `One of: ${ASSET_CONDITIONS.join(", ")} (default GOOD)`
  },
  { key: "manufacturer", header: "Manufacturer", required: false, example: "Cummins" },
  { key: "model", header: "Model", required: false, example: "C150D5" },
  { key: "serialNumber", header: "Serial Number", required: false, example: "SN-88421" },
  { key: "location", header: "Location", required: false, example: "Main Warehouse" },
  { key: "supplier", header: "Supplier", required: false, example: "ABC Suppliers" },
  { key: "ownerName", header: "Owner Name", required: false, example: "" },
  { key: "description", header: "Description", required: false, example: "" }
];

@Injectable()
export class AssetBulkImportAdapter implements BulkImportAdapter {
  readonly entityType = BulkImportEntity.ASSET;
  readonly label = "Asset";
  readonly naturalKeyLabel = "Asset Tag";
  /** Asset.assetTag is globally unique in the schema, not per-tenant. */
  readonly naturalKeyTenantScoped = false;
  readonly templateColumns = TEMPLATE_COLUMNS;

  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  normalizeRow(raw: Record<string, unknown>): BulkImportNormalizedRow {
    const errors: BulkImportFieldIssue[] = [];
    const warnings: BulkImportFieldIssue[] = [];

    const assetTag = requireTrimmedString(raw, "assetTag", errors, "Asset Tag");
    const name = requireTrimmedString(raw, "name", errors, "Name");

    const categoryParsed = normalizeEnumValue(raw.category, ASSET_CATEGORIES);
    if (categoryParsed.error) errors.push({ field: "category", code: "INVALID_ENUM", message: categoryParsed.error });
    else if (!categoryParsed.value) errors.push({ field: "category", code: "REQUIRED", message: "Category is required" });

    const conditionParsed = normalizeEnumValue(raw.condition, ASSET_CONDITIONS);
    if (conditionParsed.error) {
      errors.push({ field: "condition", code: "INVALID_ENUM", message: conditionParsed.error });
    }

    return {
      naturalKey: assetTag,
      data: {
        assetTag,
        name,
        category: categoryParsed.value,
        condition: conditionParsed.value ?? undefined,
        manufacturer: trimToNull(raw.manufacturer),
        model: trimToNull(raw.model),
        serialNumber: trimToNull(raw.serialNumber),
        location: trimToNull(raw.location),
        supplier: trimToNull(raw.supplier),
        ownerName: trimToNull(raw.ownerName),
        description: trimToNull(raw.description)
      },
      errors,
      warnings
    };
  }

  async findExisting(_tenantId: string, naturalKeys: string[]): Promise<Map<string, BulkImportExistingRecord>> {
    if (naturalKeys.length === 0) return new Map();
    const assets = await this.prisma.asset.findMany({
      where: { assetTag: { in: naturalKeys } },
      select: { id: true, tenantId: true, assetTag: true, name: true, category: true, status: true }
    });
    const map = new Map<string, BulkImportExistingRecord>();
    for (const asset of assets) {
      map.set(asset.assetTag, {
        id: asset.id,
        tenantId: asset.tenantId,
        snapshot: { assetTag: asset.assetTag, name: asset.name, category: asset.category, status: asset.status }
      });
    }
    return map;
  }

  async create(tenantId: string, data: Record<string, unknown>): Promise<string> {
    const created = await this.prisma.asset.create({
      data: {
        tenantId,
        assetTag: data.assetTag as string,
        name: data.name as string,
        category: data.category as AssetCategory,
        condition: (data.condition as AssetCondition | undefined) ?? AssetCondition.GOOD,
        manufacturer: (data.manufacturer as string | null) ?? undefined,
        model: (data.model as string | null) ?? undefined,
        serialNumber: (data.serialNumber as string | null) ?? undefined,
        location: (data.location as string | null) ?? undefined,
        supplier: (data.supplier as string | null) ?? undefined,
        ownerName: (data.ownerName as string | null) ?? undefined,
        description: (data.description as string | null) ?? undefined,
        images: [],
        documents: []
      },
      select: { id: true }
    });
    return created.id;
  }

  buildUpdate(existing: BulkImportExistingRecord, data: Record<string, unknown>): Record<string, unknown> | null {
    const patch: Record<string, unknown> = {};
    for (const key of ["name", "manufacturer", "model", "serialNumber", "location", "supplier", "ownerName", "description"]) {
      const value = data[key];
      if (typeof value === "string" && value.length > 0) patch[key] = value;
    }
    if (typeof data.category === "string") patch.category = data.category;
    if (typeof data.condition === "string") patch.condition = data.condition;
    return Object.keys(patch).length > 0 ? patch : null;
  }

  async applyUpdate(id: string, data: Record<string, unknown>): Promise<void> {
    await this.prisma.asset.update({ where: { id }, data: data as never });
  }
}
