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
  { key: "code", header: "Code", required: true, example: "MAINT" },
  { key: "name", header: "Name", required: true, example: "Maintenance" },
  { key: "description", header: "Description", required: false, example: "" }
];

@Injectable()
export class DepartmentBulkImportAdapter implements BulkImportAdapter {
  readonly entityType = BulkImportEntity.DEPARTMENT;
  readonly label = "Department";
  readonly naturalKeyLabel = "Code";
  /** Department uses @@unique([tenantId, code]) — scoped per tenant. */
  readonly naturalKeyTenantScoped = true;
  readonly templateColumns = TEMPLATE_COLUMNS;

  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  normalizeRow(raw: Record<string, unknown>): BulkImportNormalizedRow {
    const errors: BulkImportFieldIssue[] = [];
    const warnings: BulkImportFieldIssue[] = [];

    const codeRaw = requireTrimmedString(raw, "code", errors, "Code");
    const name = requireTrimmedString(raw, "name", errors, "Name");
    const code = codeRaw ? codeRaw.toUpperCase() : null;

    return {
      naturalKey: code,
      data: {
        code,
        name,
        description: trimToNull(raw.description)
      },
      errors,
      warnings
    };
  }

  async findExisting(tenantId: string, naturalKeys: string[]): Promise<Map<string, BulkImportExistingRecord>> {
    if (naturalKeys.length === 0) return new Map();
    const departments = await this.prisma.department.findMany({
      where: { tenantId, code: { in: naturalKeys } },
      select: { id: true, tenantId: true, code: true, name: true, isActive: true }
    });
    const map = new Map<string, BulkImportExistingRecord>();
    for (const department of departments) {
      map.set(department.code, {
        id: department.id,
        tenantId: department.tenantId,
        snapshot: { code: department.code, name: department.name, isActive: department.isActive }
      });
    }
    return map;
  }

  async create(tenantId: string, data: Record<string, unknown>): Promise<string> {
    const created = await this.prisma.department.create({
      data: {
        tenantId,
        code: data.code as string,
        name: data.name as string,
        description: (data.description as string | null) ?? undefined
      },
      select: { id: true }
    });
    return created.id;
  }

  buildUpdate(existing: BulkImportExistingRecord, data: Record<string, unknown>): Record<string, unknown> | null {
    const patch: Record<string, unknown> = {};
    if (typeof data.name === "string" && data.name.length > 0) patch.name = data.name;
    if (typeof data.description === "string" && data.description.length > 0) patch.description = data.description;
    return Object.keys(patch).length > 0 ? patch : null;
  }

  async applyUpdate(id: string, data: Record<string, unknown>): Promise<void> {
    await this.prisma.department.update({ where: { id }, data: data as never });
  }
}
