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
import { parseNumberValue, requireTrimmedString, trimToNull } from "../util/bulk-import-normalize.util";

const TEMPLATE_COLUMNS: BulkImportTemplateColumn[] = [
  { key: "code", header: "Code", required: true, example: "JC-100" },
  { key: "name", header: "Name", required: true, example: "Engine Oil Change" },
  { key: "category", header: "Category", required: false, example: "Preventive Maintenance" },
  { key: "estimatedHours", header: "Estimated Hours", required: false, example: "1.5" },
  { key: "description", header: "Description", required: false, example: "" }
];

@Injectable()
export class JobCodeBulkImportAdapter implements BulkImportAdapter {
  readonly entityType = BulkImportEntity.JOB_CODE;
  readonly label = "Job Code";
  readonly naturalKeyLabel = "Code";
  /** JobCode uses @@unique([tenantId, code]) — scoped per tenant. */
  readonly naturalKeyTenantScoped = true;
  readonly templateColumns = TEMPLATE_COLUMNS;

  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  normalizeRow(raw: Record<string, unknown>): BulkImportNormalizedRow {
    const errors: BulkImportFieldIssue[] = [];
    const warnings: BulkImportFieldIssue[] = [];

    const code = requireTrimmedString(raw, "code", errors, "Code");
    const name = requireTrimmedString(raw, "name", errors, "Name");

    const hoursParsed = parseNumberValue(raw.estimatedHours);
    if (hoursParsed.error) {
      errors.push({ field: "estimatedHours", code: "INVALID_NUMBER", message: hoursParsed.error });
    } else if (hoursParsed.value !== null && hoursParsed.value < 0) {
      errors.push({ field: "estimatedHours", code: "OUT_OF_RANGE", message: "Estimated hours cannot be negative" });
    }

    return {
      naturalKey: code,
      data: {
        code,
        name,
        category: trimToNull(raw.category),
        estimatedHours: hoursParsed.value ?? undefined,
        description: trimToNull(raw.description)
      },
      errors,
      warnings
    };
  }

  async findExisting(tenantId: string, naturalKeys: string[]): Promise<Map<string, BulkImportExistingRecord>> {
    if (naturalKeys.length === 0) return new Map();
    const jobCodes = await this.prisma.jobCode.findMany({
      where: { tenantId, code: { in: naturalKeys } },
      select: { id: true, tenantId: true, code: true, name: true, isActive: true }
    });
    const map = new Map<string, BulkImportExistingRecord>();
    for (const jobCode of jobCodes) {
      map.set(jobCode.code, {
        id: jobCode.id,
        tenantId: jobCode.tenantId,
        snapshot: { code: jobCode.code, name: jobCode.name, isActive: jobCode.isActive }
      });
    }
    return map;
  }

  async create(tenantId: string, data: Record<string, unknown>): Promise<string> {
    const created = await this.prisma.jobCode.create({
      data: {
        tenantId,
        code: data.code as string,
        name: data.name as string,
        category: (data.category as string | null) ?? undefined,
        estimatedHours: (data.estimatedHours as number | undefined) ?? undefined,
        description: (data.description as string | null) ?? undefined,
        requiredSkills: [],
        requiredPartIds: []
      },
      select: { id: true }
    });
    return created.id;
  }

  buildUpdate(existing: BulkImportExistingRecord, data: Record<string, unknown>): Record<string, unknown> | null {
    const patch: Record<string, unknown> = {};
    if (typeof data.name === "string" && data.name.length > 0) patch.name = data.name;
    if (typeof data.category === "string" && data.category.length > 0) patch.category = data.category;
    if (typeof data.description === "string" && data.description.length > 0) patch.description = data.description;
    if (typeof data.estimatedHours === "number") patch.estimatedHours = data.estimatedHours;
    return Object.keys(patch).length > 0 ? patch : null;
  }

  async applyUpdate(id: string, data: Record<string, unknown>): Promise<void> {
    await this.prisma.jobCode.update({ where: { id }, data: data as never });
  }
}
