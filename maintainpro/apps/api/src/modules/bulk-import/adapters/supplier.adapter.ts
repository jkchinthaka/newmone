import { Inject, Injectable } from "@nestjs/common";
import { BulkImportEntity } from "@prisma/client";

import { PrismaService } from "../../../database/prisma.service";
import {
  BulkImportAdapter,
  BulkImportExistingRecord,
  BulkImportFieldIssue,
  BulkImportNormalizedRow,
  BulkImportTemplateColumn
} from "../bulk-import-adapter";
import { requireTrimmedString, trimToNull } from "../util/bulk-import-normalize.util";

const TEMPLATE_COLUMNS: BulkImportTemplateColumn[] = [
  { key: "vendorCode", header: "Vendor Code", required: true, example: "SUP-001" },
  { key: "name", header: "Name", required: true, example: "ABC Suppliers (Pvt) Ltd" },
  { key: "contactName", header: "Contact Name", required: false, example: "Jane Silva" },
  { key: "email", header: "Email", required: false, example: "sales@abcsuppliers.example" },
  { key: "phone", header: "Phone", required: false, example: "+94 11 234 5678" },
  { key: "address", header: "Address", required: false, example: "" },
  { key: "website", header: "Website", required: false, example: "" },
  { key: "taxNumber", header: "Tax Number", required: false, example: "" }
];

@Injectable()
export class SupplierBulkImportAdapter implements BulkImportAdapter {
  readonly entityType = BulkImportEntity.SUPPLIER;
  readonly label = "Supplier";
  readonly naturalKeyLabel = "Vendor Code";
  /** Supplier uses @@unique([tenantId, vendorCode]) — scoped per tenant. */
  readonly naturalKeyTenantScoped = true;
  readonly templateColumns = TEMPLATE_COLUMNS;

  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  normalizeRow(raw: Record<string, unknown>): BulkImportNormalizedRow {
    const errors: BulkImportFieldIssue[] = [];
    const warnings: BulkImportFieldIssue[] = [];

    // vendorCode is nullable in the schema, but bulk import requires a stable
    // natural key for every row — never guess, always require it here.
    const vendorCode = requireTrimmedString(raw, "vendorCode", errors, "Vendor Code");
    const name = requireTrimmedString(raw, "name", errors, "Name");

    const email = trimToNull(raw.email);
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      errors.push({ field: "email", code: "INVALID_FORMAT", message: "Email is not a valid address" });
    }

    return {
      naturalKey: vendorCode,
      data: {
        vendorCode,
        name,
        contactName: trimToNull(raw.contactName),
        email,
        phone: trimToNull(raw.phone),
        address: trimToNull(raw.address),
        website: trimToNull(raw.website),
        taxNumber: trimToNull(raw.taxNumber)
      },
      errors,
      warnings
    };
  }

  async findExisting(tenantId: string, naturalKeys: string[]): Promise<Map<string, BulkImportExistingRecord>> {
    if (naturalKeys.length === 0) return new Map();
    const suppliers = await this.prisma.supplier.findMany({
      where: { tenantId, vendorCode: { in: naturalKeys } },
      select: { id: true, tenantId: true, vendorCode: true, name: true, isActive: true, blacklisted: true }
    });
    const map = new Map<string, BulkImportExistingRecord>();
    for (const supplier of suppliers) {
      if (!supplier.vendorCode) continue;
      map.set(supplier.vendorCode, {
        id: supplier.id,
        tenantId: supplier.tenantId,
        snapshot: { vendorCode: supplier.vendorCode, name: supplier.name, isActive: supplier.isActive, blacklisted: supplier.blacklisted }
      });
    }
    return map;
  }

  async create(tenantId: string, data: Record<string, unknown>): Promise<string> {
    const created = await this.prisma.supplier.create({
      data: {
        tenantId,
        vendorCode: data.vendorCode as string,
        name: data.name as string,
        contactName: (data.contactName as string | null) ?? undefined,
        email: (data.email as string | null) ?? undefined,
        phone: (data.phone as string | null) ?? undefined,
        address: (data.address as string | null) ?? undefined,
        website: (data.website as string | null) ?? undefined,
        taxNumber: (data.taxNumber as string | null) ?? undefined,
        serviceCategories: []
      },
      select: { id: true }
    });
    return created.id;
  }

  buildUpdate(existing: BulkImportExistingRecord, data: Record<string, unknown>): Record<string, unknown> | null {
    const patch: Record<string, unknown> = {};
    for (const key of ["name", "contactName", "email", "phone", "address", "website", "taxNumber"]) {
      const value = data[key];
      if (typeof value === "string" && value.length > 0) patch[key] = value;
    }
    return Object.keys(patch).length > 0 ? patch : null;
  }

  async applyUpdate(id: string, data: Record<string, unknown>): Promise<void> {
    await this.prisma.supplier.update({ where: { id }, data: data as never });
  }
}
