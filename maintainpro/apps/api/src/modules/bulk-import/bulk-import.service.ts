import { createHash } from "crypto";

import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException
} from "@nestjs/common";
import { BulkImportMode, BulkImportRowAction, BulkImportRunStatus, Prisma } from "@prisma/client";

import { writeAuditTrail } from "../../common/utils/audit-trail.util";
import { PrismaService } from "../../database/prisma.service";
import type { JwtPayload } from "../auth/auth.types";

import { BulkImportAdapterRegistry } from "./bulk-import-adapter-registry.service";
import { BulkImportAdapter, BulkImportExistingRecord, BulkImportFieldIssue } from "./bulk-import-adapter";
import { BulkImportFileError, BulkImportParserService } from "./bulk-import-parser.service";
import { BULK_IMPORT_COMMIT_BATCH_SIZE, BULK_IMPORT_SESSION_TTL_MS } from "./bulk-import.constants";

type Actor = Pick<JwtPayload, "sub" | "email" | "role" | "tenantId">;

interface RowClassification {
  action: BulkImportRowAction;
  errors: BulkImportFieldIssue[];
  warnings: BulkImportFieldIssue[];
  createdEntityId?: string | null;
  message?: string;
}

@Injectable()
export class BulkImportService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    private readonly parser: BulkImportParserService,
    private readonly adapters: BulkImportAdapterRegistry
  ) {}

  private requireTenantId(actor: Actor): string {
    if (!actor.tenantId) {
      throw new ForbiddenException("Tenant context is required for bulk import");
    }
    return actor.tenantId;
  }

  async getTemplate(entitySlug: string, format: "csv" | "xlsx"): Promise<{ filename: string; contentType: string; buffer: Buffer }> {
    const adapter = this.adapters.resolveSlug(entitySlug);
    const headers = adapter.templateColumns.map((column) => column.header);
    const example = adapter.templateColumns.map((column) => column.example);

    if (format === "csv") {
      const lines = [headers, example].map((row) => row.map((value) => this.csvEscape(value)).join(","));
      return {
        filename: `${entitySlug}-bulk-import-template.csv`,
        contentType: "text/csv; charset=utf-8",
        buffer: Buffer.from(`${lines.join("\n")}\n`, "utf-8")
      };
    }

    const ExcelJS = (await import("exceljs")).default;
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet("Template");
    sheet.addRow(headers);
    sheet.addRow(example);
    const notesSheet = workbook.addWorksheet("Field Notes");
    notesSheet.addRow(["Field", "Required", "Notes"]);
    for (const column of adapter.templateColumns) {
      notesSheet.addRow([column.header, column.required ? "Yes" : "No", column.notes ?? ""]);
    }
    const buffer = Buffer.from(await workbook.xlsx.writeBuffer());
    return {
      filename: `${entitySlug}-bulk-import-template.xlsx`,
      contentType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      buffer
    };
  }

  async preview(
    entitySlug: string,
    actor: Actor,
    mode: BulkImportMode | undefined,
    file: { originalname?: string; mimetype?: string; size?: number; buffer?: Buffer }
  ) {
    const tenantId = this.requireTenantId(actor);
    const adapter = this.adapters.resolveSlug(entitySlug);
    const importMode = mode ?? BulkImportMode.CREATE_NEW_SKIP_EXISTING;

    let parsed;
    try {
      parsed = await this.parser.parse(file);
    } catch (error) {
      if (error instanceof BulkImportFileError) {
        throw new BadRequestException({ code: error.code, message: error.message });
      }
      throw error;
    }

    const fileSha256 = createHash("sha256").update(file.buffer as Buffer).digest("hex");

    // The file's column headers are display text (e.g. "Registration No"),
    // not the adapter's internal field keys (e.g. "registrationNo") — map
    // them via templateColumns before handing rows to the adapter. Extra/
    // unrecognized columns in the file are ignored.
    const headerToKey = new Map(
      adapter.templateColumns.map((column) => [this.normalizeHeaderText(column.header), column.key] as const)
    );
    const remapRow = (values: Record<string, unknown>): Record<string, unknown> => {
      const mapped: Record<string, unknown> = {};
      for (const [header, value] of Object.entries(values)) {
        const key = headerToKey.get(this.normalizeHeaderText(header));
        if (key) mapped[key] = value;
      }
      return mapped;
    };

    // Normalize every row first (pure, no DB access). `raw` is kept keyed by
    // the adapter's field keys (not the file's display headers) so the error
    // report can look up `rawData[field]` directly by the same field name
    // validation errors are reported against.
    const normalized = parsed.rows.map((row) => {
      const raw = remapRow(row.values);
      return { rowNumber: row.rowNumber, raw, ...adapter.normalizeRow(raw) };
    });

    // Detect duplicate natural keys within the file — every row sharing a
    // key is skipped (never "last row wins"); the error lists the other rows.
    const keyToRows = new Map<string, number[]>();
    for (const row of normalized) {
      if (!row.naturalKey) continue;
      const list = keyToRows.get(row.naturalKey) ?? [];
      list.push(row.rowNumber);
      keyToRows.set(row.naturalKey, list);
    }
    const duplicateKeys = new Set(Array.from(keyToRows.entries()).filter(([, rows]) => rows.length > 1).map(([key]) => key));

    const candidateKeys = normalized
      .filter((row) => row.naturalKey && row.errors.length === 0 && !duplicateKeys.has(row.naturalKey))
      .map((row) => row.naturalKey as string);
    const uniqueCandidateKeys = Array.from(new Set(candidateKeys));
    const existingMap = await adapter.findExisting(tenantId, uniqueCandidateKeys);

    let createCount = 0;
    let updateCount = 0;
    let skipCount = 0;
    let errorCount = 0;

    const rowCreates: Prisma.BulkImportRowCreateManyInput[] = [];
    for (const row of normalized) {
      let classification: RowClassification;

      if (row.errors.length > 0) {
        classification = { action: BulkImportRowAction.ERROR, errors: row.errors, warnings: row.warnings };
      } else if (!row.naturalKey) {
        classification = {
          action: BulkImportRowAction.ERROR,
          errors: [{ field: "naturalKey", code: "REQUIRED", message: `${adapter.naturalKeyLabel} is required` }],
          warnings: row.warnings
        };
      } else if (duplicateKeys.has(row.naturalKey)) {
        const otherRows = (keyToRows.get(row.naturalKey) ?? []).filter((n) => n !== row.rowNumber);
        classification = {
          action: BulkImportRowAction.SKIP_DUPLICATE_FILE_ROW,
          errors: [],
          warnings: [
            {
              field: "naturalKey",
              code: "DUPLICATE_IN_FILE",
              message: `${adapter.naturalKeyLabel} "${row.naturalKey}" also appears on row(s) ${otherRows.join(", ")}`
            }
          ]
        };
      } else {
        classification = this.classifyAgainstExisting(adapter, importMode, tenantId, row.naturalKey, row.data, existingMap);
      }

      switch (classification.action) {
        case BulkImportRowAction.CREATE:
          createCount += 1;
          break;
        case BulkImportRowAction.UPDATE:
          updateCount += 1;
          break;
        case BulkImportRowAction.SKIP_EXISTING:
        case BulkImportRowAction.SKIP_DUPLICATE_FILE_ROW:
          skipCount += 1;
          break;
        case BulkImportRowAction.ERROR:
          errorCount += 1;
          break;
      }

      rowCreates.push({
        tenantId,
        runId: "PENDING", // patched below once the run id is known
        rowNumber: row.rowNumber,
        naturalKey: row.naturalKey,
        normalizedData: row.data as Prisma.InputJsonValue,
        rawData: row.raw as Prisma.InputJsonValue,
        action: classification.action,
        errors: classification.errors.length > 0 ? (classification.errors as unknown as Prisma.InputJsonValue) : undefined,
        warnings: classification.warnings.length > 0 ? (classification.warnings as unknown as Prisma.InputJsonValue) : undefined
      });
    }

    const blocked = createCount + updateCount === 0;
    const now = new Date();

    const run = await this.prisma.bulkImportRun.create({
      data: {
        tenantId,
        entityType: adapter.entityType,
        mode: importMode,
        status: blocked ? BulkImportRunStatus.BLOCKED : BulkImportRunStatus.VALIDATED,
        originalFilename: this.sanitizeFilename(file.originalname ?? "upload"),
        fileFormat: parsed.format,
        fileSha256,
        fileSizeBytes: file.buffer?.length ?? 0,
        actorUserId: actor.sub,
        actorEmail: actor.email,
        totalRows: normalized.length,
        createCount,
        updateCount,
        skipCount,
        errorCount,
        errorSummary: blocked ? "No rows are ready to import — fix the errors below and re-upload." : null,
        validatedAt: now,
        expiresAt: new Date(now.getTime() + BULK_IMPORT_SESSION_TTL_MS)
      }
    });

    await this.prisma.bulkImportRow.createMany({
      data: rowCreates.map((row) => ({ ...row, runId: run.id }))
    });

    await writeAuditTrail(this.prisma, {
      entity: "BulkImportRun",
      entityId: run.id,
      action: "CREATE",
      module: "bulk-import",
      actor,
      reason: "Bulk import preview generated",
      metadata: {
        entityType: adapter.entityType,
        fileSha256,
        fileName: this.sanitizeFilename(file.originalname ?? "upload"),
        totalRows: normalized.length,
        createCount,
        updateCount,
        skipCount,
        errorCount,
        mode: importMode
      }
    });

    const previewRows = await this.prisma.bulkImportRow.findMany({
      where: { runId: run.id },
      orderBy: { rowNumber: "asc" },
      take: 500
    });

    return {
      run: this.toPublicRun(run),
      rows: previewRows.map((row) => this.toPublicRow(row)),
      summary: { totalRows: normalized.length, createCount, updateCount, skipCount, errorCount },
      blocked,
      commitAllowed: !blocked
    };
  }

  private classifyAgainstExisting(
    adapter: BulkImportAdapter,
    mode: BulkImportMode,
    tenantId: string,
    naturalKey: string,
    data: Record<string, unknown>,
    existingMap: Map<string, BulkImportExistingRecord>
  ): RowClassification {
    const existing = existingMap.get(naturalKey);

    if (!existing) {
      return { action: BulkImportRowAction.CREATE, errors: [], warnings: [] };
    }

    if (existing.tenantId && existing.tenantId !== tenantId) {
      return {
        action: BulkImportRowAction.ERROR,
        errors: [
          {
            field: "naturalKey",
            code: "NATURAL_KEY_CONFLICT",
            message: `${adapter.naturalKeyLabel} "${naturalKey}" is already in use.`
          }
        ],
        warnings: []
      };
    }

    if (mode === BulkImportMode.CREATE_NEW_SKIP_EXISTING) {
      return {
        action: BulkImportRowAction.SKIP_EXISTING,
        errors: [],
        warnings: [{ field: "naturalKey", code: "ALREADY_EXISTS", message: `${adapter.naturalKeyLabel} "${naturalKey}" already exists — skipped.` }]
      };
    }

    const patch = adapter.buildUpdate(existing, data);
    if (!patch) {
      return {
        action: BulkImportRowAction.SKIP_EXISTING,
        errors: [],
        warnings: [{ field: "naturalKey", code: "NO_CHANGES", message: "No changes detected — skipped." }]
      };
    }

    return { action: BulkImportRowAction.UPDATE, errors: [], warnings: [] };
  }

  async getRun(entitySlug: string, importId: string, actor: Actor) {
    const tenantId = this.requireTenantId(actor);
    const adapter = this.adapters.resolveSlug(entitySlug);
    const run = await this.prisma.bulkImportRun.findFirst({
      where: { id: importId, tenantId, entityType: adapter.entityType }
    });
    if (!run) {
      throw new NotFoundException("Import run not found");
    }
    const rows = await this.prisma.bulkImportRow.findMany({
      where: { runId: run.id },
      orderBy: { rowNumber: "asc" },
      take: 1000
    });
    return { run: this.toPublicRun(run), rows: rows.map((row) => this.toPublicRow(row)) };
  }

  async listHistory(actor: Actor, query: { page?: number; pageSize?: number; entity?: string }) {
    const tenantId = this.requireTenantId(actor);
    const page = Math.max(1, query.page ?? 1);
    const pageSize = Math.min(100, Math.max(1, query.pageSize ?? 20));
    const where: Prisma.BulkImportRunWhereInput = { tenantId };
    if (query.entity) {
      where.entityType = this.adapters.resolveSlug(query.entity).entityType;
    }

    const [total, items] = await this.prisma.$transaction([
      this.prisma.bulkImportRun.count({ where }),
      this.prisma.bulkImportRun.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * pageSize,
        take: pageSize
      })
    ]);

    return {
      items: items.map((run) => this.toPublicRun(run)),
      pagination: { page, pageSize, total, totalPages: Math.max(1, Math.ceil(total / pageSize)) }
    };
  }

  async getErrorReportRows(entitySlug: string, importId: string, actor: Actor) {
    const tenantId = this.requireTenantId(actor);
    const adapter = this.adapters.resolveSlug(entitySlug);
    const run = await this.prisma.bulkImportRun.findFirst({ where: { id: importId, tenantId, entityType: adapter.entityType } });
    if (!run) {
      throw new NotFoundException("Import run not found");
    }
    const rows = await this.prisma.bulkImportRow.findMany({
      where: { runId: run.id, action: BulkImportRowAction.ERROR },
      orderBy: { rowNumber: "asc" }
    });

    const lines: Array<{ rowNumber: number; naturalKey: string; field: string; inputValue: string; errorCode: string; message: string }> = [];
    for (const row of rows) {
      const issues = (row.errors as BulkImportFieldIssue[] | null) ?? [];
      const rawData = (row.rawData as Record<string, unknown> | null) ?? {};
      if (issues.length === 0) {
        lines.push({
          rowNumber: row.rowNumber,
          naturalKey: row.naturalKey ?? "",
          field: "",
          inputValue: "",
          errorCode: "UNKNOWN",
          message: "Row failed validation"
        });
        continue;
      }
      for (const issue of issues) {
        lines.push({
          rowNumber: row.rowNumber,
          naturalKey: row.naturalKey ?? "",
          field: issue.field,
          inputValue: String(rawData[issue.field] ?? ""),
          errorCode: issue.code,
          message: issue.message
        });
      }
    }
    return lines;
  }

  async commit(entitySlug: string, importId: string, actor: Actor, confirmed: boolean) {
    const tenantId = this.requireTenantId(actor);
    const adapter = this.adapters.resolveSlug(entitySlug);

    if (!confirmed) {
      throw new BadRequestException({ code: "CONFIRMATION_REQUIRED", message: "You must confirm the import before it can be committed." });
    }

    const run = await this.prisma.bulkImportRun.findFirst({ where: { id: importId, tenantId, entityType: adapter.entityType } });
    if (!run) {
      throw new NotFoundException("Import run not found");
    }

    // Idempotent: a completed/partial run just returns its stored result — no reprocessing, no duplicates.
    if (run.status === BulkImportRunStatus.COMPLETED || run.status === BulkImportRunStatus.PARTIAL) {
      return { run: this.toPublicRun(run), reused: true, message: "This import was already committed; returning the existing result." };
    }

    if (run.status === BulkImportRunStatus.FAILED) {
      throw new ConflictException({ code: "IMPORT_FAILED", message: "This import previously failed and cannot be retried. Re-upload the file." });
    }

    if (run.status === BulkImportRunStatus.BLOCKED) {
      throw new BadRequestException({ code: "IMPORT_BLOCKED", message: "This import has no rows ready to commit." });
    }

    if (run.status !== BulkImportRunStatus.VALIDATED) {
      // Either EXPIRED, or another concurrent commit is already COMMITTING this run.
      if (run.status === BulkImportRunStatus.COMMITTING) {
        throw new ConflictException({ code: "COMMIT_IN_PROGRESS", message: "This import is already being committed." });
      }
      throw new BadRequestException({ code: "IMPORT_NOT_READY", message: "This import is not ready to commit." });
    }

    if (run.expiresAt.getTime() < Date.now()) {
      await this.prisma.bulkImportRun.update({ where: { id: run.id }, data: { status: BulkImportRunStatus.EXPIRED } });
      throw new BadRequestException({ code: "IMPORT_EXPIRED", message: "This preview has expired. Upload the file again." });
    }

    // Atomic VALIDATED -> COMMITTING transition. If another request already
    // flipped it, updatedCount is 0 and we treat this call as a duplicate.
    const transition = await this.prisma.bulkImportRun.updateMany({
      where: { id: run.id, status: BulkImportRunStatus.VALIDATED },
      data: { status: BulkImportRunStatus.COMMITTING }
    });
    if (transition.count === 0) {
      const latest = await this.prisma.bulkImportRun.findUnique({ where: { id: run.id } });
      if (latest && (latest.status === BulkImportRunStatus.COMPLETED || latest.status === BulkImportRunStatus.PARTIAL)) {
        return { run: this.toPublicRun(latest), reused: true, message: "This import was already committed; returning the existing result." };
      }
      throw new ConflictException({ code: "COMMIT_IN_PROGRESS", message: "This import is already being committed." });
    }

    const actionableRows = await this.prisma.bulkImportRow.findMany({
      where: { runId: run.id, action: { in: [BulkImportRowAction.CREATE, BulkImportRowAction.UPDATE] } },
      orderBy: { rowNumber: "asc" }
    });

    let createCount = 0;
    let updateCount = 0;
    let commitErrorCount = 0;

    for (let offset = 0; offset < actionableRows.length; offset += BULK_IMPORT_COMMIT_BATCH_SIZE) {
      const batch = actionableRows.slice(offset, offset + BULK_IMPORT_COMMIT_BATCH_SIZE);
      const naturalKeys = Array.from(new Set(batch.map((row) => row.naturalKey).filter((key): key is string => Boolean(key))));
      // Re-check authoritative DB state right before writing — a record
      // created/removed between preview and commit must never be duplicated.
      const freshExisting = await adapter.findExisting(tenantId, naturalKeys);

      for (const row of batch) {
        const naturalKey = row.naturalKey;
        const data = (row.normalizedData as Record<string, unknown>) ?? {};

        try {
          if (row.action === BulkImportRowAction.CREATE) {
            const existing = naturalKey ? freshExisting.get(naturalKey) : undefined;
            if (existing) {
              // Someone else created this record after preview — never duplicate.
              await this.prisma.bulkImportRow.update({
                where: { id: row.id },
                data: {
                  action: BulkImportRowAction.SKIP_EXISTING,
                  warnings: [
                    { field: "naturalKey", code: "CREATED_CONCURRENTLY", message: "Created by another import between preview and commit — skipped." }
                  ] as unknown as Prisma.InputJsonValue
                }
              });
              continue;
            }
            const createdId = await adapter.create(tenantId, data);
            await this.prisma.bulkImportRow.update({ where: { id: row.id }, data: { createdEntityId: createdId } });
            createCount += 1;
          } else {
            const existing = naturalKey ? freshExisting.get(naturalKey) : undefined;
            if (!existing) {
              await this.prisma.bulkImportRow.update({
                where: { id: row.id },
                data: {
                  action: BulkImportRowAction.ERROR,
                  errors: [
                    { field: "naturalKey", code: "RECORD_NO_LONGER_EXISTS", message: "The record to update no longer exists — skipped." }
                  ] as unknown as Prisma.InputJsonValue
                }
              });
              commitErrorCount += 1;
              continue;
            }
            const patch = adapter.buildUpdate(existing, data);
            if (patch) {
              await adapter.applyUpdate(existing.id, patch);
            }
            await this.prisma.bulkImportRow.update({ where: { id: row.id }, data: { createdEntityId: existing.id } });
            updateCount += 1;
          }
        } catch (error) {
          commitErrorCount += 1;
          await this.prisma.bulkImportRow.update({
            where: { id: row.id },
            data: {
              action: BulkImportRowAction.ERROR,
              errors: [
                { field: "naturalKey", code: "WRITE_FAILED", message: this.safeErrorMessage(error) }
              ] as unknown as Prisma.InputJsonValue
            }
          });
        }
      }
    }

    const finalStatus =
      commitErrorCount === 0
        ? BulkImportRunStatus.COMPLETED
        : createCount + updateCount > 0
          ? BulkImportRunStatus.PARTIAL
          : BulkImportRunStatus.FAILED;

    const updatedRun = await this.prisma.bulkImportRun.update({
      where: { id: run.id },
      data: {
        status: finalStatus,
        createCount,
        updateCount,
        skipCount: run.skipCount,
        errorCount: run.errorCount + commitErrorCount,
        committedAt: new Date()
      }
    });

    await writeAuditTrail(this.prisma, {
      entity: "BulkImportRun",
      entityId: run.id,
      action: "UPDATE",
      module: "bulk-import",
      actor,
      reason: "Bulk import committed",
      metadata: {
        entityType: adapter.entityType,
        fileSha256: run.fileSha256,
        fileName: run.originalFilename,
        status: finalStatus,
        createCount,
        updateCount,
        skipCount: run.skipCount,
        errorCount: run.errorCount + commitErrorCount,
        mode: run.mode
      }
    });

    return { run: this.toPublicRun(updatedRun), reused: false, message: `Import ${finalStatus.toLowerCase()}.` };
  }

  private normalizeHeaderText(value: string): string {
    return value.trim().toLowerCase().replace(/[\s_-]+/g, " ");
  }

  private csvEscape(value: string): string {
    const text = value ?? "";
    return /^[=+\-@\t\r]/.test(text) ? `"'${text.replace(/"/g, '""')}"` : `"${text.replace(/"/g, '""')}"`;
  }

  private sanitizeFilename(name: string): string {
    return name.replace(/[\r\n]/g, "").slice(0, 200);
  }

  private safeErrorMessage(error: unknown): string {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return "A record with this natural key already exists.";
    }
    return "This row could not be saved.";
  }

  private toPublicRun(run: {
    id: string;
    entityType: string;
    mode: string;
    status: string;
    originalFilename: string;
    fileFormat: string;
    fileSha256: string;
    fileSizeBytes: number;
    actorEmail: string;
    totalRows: number;
    createCount: number;
    updateCount: number;
    skipCount: number;
    errorCount: number;
    errorSummary: string | null;
    createdAt: Date;
    validatedAt: Date | null;
    committedAt: Date | null;
    expiresAt: Date;
  }) {
    return {
      id: run.id,
      entityType: run.entityType,
      mode: run.mode,
      status: run.status,
      originalFilename: run.originalFilename,
      fileFormat: run.fileFormat,
      fileSha256: run.fileSha256,
      fileSizeBytes: run.fileSizeBytes,
      actorEmail: run.actorEmail,
      totalRows: run.totalRows,
      createCount: run.createCount,
      updateCount: run.updateCount,
      skipCount: run.skipCount,
      errorCount: run.errorCount,
      errorSummary: run.errorSummary,
      createdAt: run.createdAt,
      validatedAt: run.validatedAt,
      committedAt: run.committedAt,
      expiresAt: run.expiresAt
    };
  }

  private toPublicRow(row: {
    id: string;
    rowNumber: number;
    naturalKey: string | null;
    normalizedData: Prisma.JsonValue;
    action: string;
    errors: Prisma.JsonValue;
    warnings: Prisma.JsonValue;
    createdEntityId: string | null;
  }) {
    return {
      id: row.id,
      rowNumber: row.rowNumber,
      naturalKey: row.naturalKey,
      data: row.normalizedData,
      action: row.action,
      errors: row.errors ?? [],
      warnings: row.warnings ?? [],
      createdEntityId: row.createdEntityId
    };
  }
}
