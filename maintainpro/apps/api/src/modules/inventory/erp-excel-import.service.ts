import { createHash } from "crypto";

import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException
} from "@nestjs/common";
import { AuditAction, InventoryImportRowStatus, InventoryImportStatus, Prisma } from "@prisma/client";

import { PrismaService } from "../../database/prisma.service";
import { normalizeErpItemCode } from "./erp-stock-sync.mapper";
import { ErpStockSyncService } from "./erp-stock-sync.service";
import type { StockBalanceSnapshot } from "./inventory-erp-adapter.service";
import {
  assertXlsxUpload,
  ERP_EXCEL_MULTI_STAGING_FORMAT,
  ErpExcelColumnMapping,
  ErpExcelMultiSheetStaging,
  ErpExcelStagingRecord,
  inspectErpExcelWorkbook,
  mappingIsComplete,
  materializeRowsFromStaging,
  resolveSheetStaging
} from "./erp-excel-stock.parser";

type Actor = {
  sub?: string;
  tenantId?: string | null;
  email?: string | null;
  role?: string | null;
};

const SOURCE = "ERP_EXCEL";

@Injectable()
export class ErpExcelImportService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly erpStockSyncService: ErpStockSyncService
  ) {}

  private requireTenantId(actor?: Actor): string {
    const tenantId = actor?.tenantId ?? null;
    if (!tenantId) {
      throw new ForbiddenException("Tenant context is required for ERP Excel import");
    }
    return tenantId;
  }

  private async recordAudit(payload: {
    entityId: string;
    action: AuditAction;
    actor?: Actor;
    reason?: string;
    metadata?: Prisma.InputJsonValue;
    beforeData?: Prisma.InputJsonValue;
    afterData?: Prisma.InputJsonValue;
  }) {
    await this.prisma.auditLog.create({
      data: {
        tenantId: payload.actor?.tenantId ?? null,
        actorId: payload.actor?.sub ?? null,
        module: "inventory",
        entity: "InventoryImportRun",
        entityId: payload.entityId,
        action: payload.action,
        reason: payload.reason,
        actorSnapshot: payload.actor
          ? ({
              id: payload.actor.sub ?? null,
              email: payload.actor.email ?? null,
              role: payload.actor.role ?? null
            } as Prisma.InputJsonValue)
          : undefined,
        metadata: payload.metadata,
        beforeData: payload.beforeData,
        afterData: payload.afterData
      }
    });
  }

  private mapError(code: string, fallback: string): never {
    const messages: Record<string, string> = {
      INVALID_FILE: "Only .xlsx workbooks up to 10 MB are accepted.",
      UNSUPPORTED_WORKBOOK: "The workbook could not be read. Upload a valid .xlsx file.",
      INVALID_HEADERS: "Could not detect header columns in the selected sheet.",
      COLUMN_MAPPING_REQUIRED: "Confirm Item Code and Quantity column mapping before continuing.",
      DUPLICATE_ITEM_CODE: "Duplicate item codes were found in the selected import scope.",
      UNMAPPED_ITEMS: "One or more ERP item codes are not mapped to MaintainPro parts.",
      IMPORT_ALREADY_APPLIED: "This ERP Excel file was already applied for this tenant.",
      IMPORT_NOT_READY: "Import is not ready to apply. Complete mapping and validation first.",
      IMPORT_APPLY_FAILED: "Stock synchronization failed. Inventory was not fully updated.",
      IMPORT_APPLY_IN_PROGRESS: "Another apply is already in progress for this import. Retry shortly.",
      WAREHOUSE_SCOPE_REQUIRED: "Multiple warehouses were detected. Select a warehouse scope before apply."
    };
    throw new BadRequestException({
      code,
      message: messages[code] ?? fallback
    });
  }

  async upload(
    file: { originalname: string; mimetype?: string; size?: number; buffer: Buffer },
    actor?: Actor
  ) {
    const tenantId = this.requireTenantId(actor);
    try {
      assertXlsxUpload(file);
    } catch (error) {
      const code = (error as { code?: string }).code ?? "INVALID_FILE";
      this.mapError(code, "Invalid upload");
    }

    const fileSha256 = createHash("sha256").update(file.buffer).digest("hex");

    const existing = await this.prisma.inventoryImportRun.findUnique({
      where: {
        tenantId_source_fileSha256: {
          tenantId,
          source: SOURCE,
          fileSha256
        }
      },
      include: { rows: { orderBy: { rowNumber: "asc" }, take: 200 } }
    });

    if (existing) {
      if (
        existing.status === InventoryImportStatus.COMPLETED ||
        existing.status === InventoryImportStatus.PARTIAL
      ) {
        throw new ConflictException({
          code: "IMPORT_ALREADY_APPLIED",
          message: "This ERP Excel file was already applied for this tenant.",
          data: this.toPublicRun(existing)
        });
      }
      return {
        run: this.toPublicRun(existing),
        reused: true,
        insight: this.insightFromRun(existing),
        message: "Existing import run recovered for this file fingerprint."
      };
    }

    let insight;
    try {
      insight = await inspectErpExcelWorkbook(file.buffer);
    } catch (error) {
      const code = (error as { code?: string }).code ?? "UNSUPPORTED_WORKBOOK";
      this.mapError(code, "Unsupported workbook");
    }

    const multiStaging: ErpExcelMultiSheetStaging = {
      format: ERP_EXCEL_MULTI_STAGING_FORMAT,
      activeSheet: insight.selectedSheet,
      sheets: insight.sheetsByName
    };

    const run = await this.prisma.inventoryImportRun.create({
      data: {
        tenantId,
        source: SOURCE,
        originalFilename: file.originalname,
        fileSha256,
        sheetName: insight.selectedSheet,
        status: InventoryImportStatus.UPLOADED,
        uploadedById: actor?.sub ?? null,
        totalRows: insight.rows.length,
        sheetsDetected: insight.sheetNames as Prisma.InputJsonValue,
        warehousesDetected: insight.warehousesDetected as Prisma.InputJsonValue,
        headerRowIndex: insight.headerRowIndex,
        stagingRecords: multiStaging as unknown as Prisma.InputJsonValue,
        mappingSnapshot: {
          headers: insight.headers,
          suggestedMapping: insight.suggestedMapping,
          mappingConfidence: insight.mappingConfidence,
          sheetsByName: Object.fromEntries(
            Object.entries(insight.sheetsByName).map(([name, sheet]) => [
              name,
              {
                headers: sheet.headers,
                suggestedMapping: sheet.suggestedMapping,
                mappingConfidence: sheet.mappingConfidence,
                warehousesDetected: sheet.warehousesDetected
              }
            ])
          )
        } as Prisma.InputJsonValue
      }
    });

    await this.recordAudit({
      entityId: run.id,
      action: AuditAction.CREATE,
      actor,
      reason: "ERP Excel stock import uploaded",
      metadata: {
        originalFilename: file.originalname,
        fileSha256,
        sheetName: insight.selectedSheet,
        totalRows: insight.rows.length,
        warehousesDetected: insight.warehousesDetected
      }
    });

    return {
      run: this.toPublicRun(run),
      reused: false,
      insight: {
        sheetNames: insight.sheetNames,
        selectedSheet: insight.selectedSheet,
        headers: insight.headers,
        suggestedMapping: insight.suggestedMapping,
        mappingConfidence: insight.mappingConfidence,
        warehousesDetected: insight.warehousesDetected,
        sampleRowCount: insight.rows.length,
        sheetsByName: Object.fromEntries(
          Object.entries(insight.sheetsByName).map(([name, sheet]) => [
            name,
            {
              headers: sheet.headers,
              suggestedMapping: sheet.suggestedMapping,
              mappingConfidence: sheet.mappingConfidence,
              warehousesDetected: sheet.warehousesDetected
            }
          ])
        )
      }
    };
  }

  async validate(
    importRunId: string,
    body: {
      sheetName?: string;
      mapping: ErpExcelColumnMapping;
      warehouseScope?: string | null;
      businessDate?: string | null;
      confirmMultiWarehouseAggregate?: boolean;
    },
    actor?: Actor
  ) {
    const tenantId = this.requireTenantId(actor);
    const run = await this.prisma.inventoryImportRun.findFirst({
      where: { id: importRunId, tenantId }
    });
    if (!run) {
      throw new NotFoundException("Import run not found");
    }
    if (
      run.status === InventoryImportStatus.COMPLETED ||
      run.status === InventoryImportStatus.PARTIAL
    ) {
      throw new ConflictException({
        code: "IMPORT_ALREADY_APPLIED",
        message: "This ERP Excel file was already applied for this tenant."
      });
    }

    if (!mappingIsComplete(body.mapping)) {
      this.mapError("COLUMN_MAPPING_REQUIRED", "Column mapping required");
    }

    let sheetResolved: ReturnType<typeof resolveSheetStaging>;
    try {
      sheetResolved = resolveSheetStaging(run.stagingRecords, body.sheetName ?? run.sheetName);
    } catch (error) {
      const code = (error as { code?: string }).code ?? "IMPORT_NOT_READY";
      this.mapError(code, "Import staging data is missing; upload the workbook again.");
    }
    const stagingRecords = ("records" in sheetResolved.staging
      ? sheetResolved.staging.records
      : []) as ErpExcelStagingRecord[];
    if (stagingRecords.length === 0) {
      this.mapError("IMPORT_NOT_READY", "Import staging data is missing; upload the workbook again.");
    }

    const materialized = materializeRowsFromStaging(stagingRecords, body.mapping);
    const warehouses = materialized.warehousesDetected;
    const warehouseScope = body.warehouseScope?.trim() || null;
    if (warehouses.length > 1 && !warehouseScope && !body.confirmMultiWarehouseAggregate) {
      await this.prisma.inventoryImportRun.update({
        where: { id: run.id },
        data: {
          status: InventoryImportStatus.BLOCKED,
          warehousesDetected: warehouses as Prisma.InputJsonValue,
          errorSummary: "WAREHOUSE_SCOPE_REQUIRED"
        }
      });
      this.mapError("WAREHOUSE_SCOPE_REQUIRED", "Warehouse scope required");
    }

    const scopedRows =
      warehouseScope && warehouseScope !== "*"
        ? materialized.rows.filter((row) => (row.warehouseCode ?? "") === warehouseScope)
        : materialized.rows;

    const parts = await this.prisma.sparePart.findMany({
      where: { tenantId, isActive: true },
      select: { id: true, partNumber: true, name: true, quantityInStock: true }
    });
    const partsByCode = new Map(
      parts.map((part) => [normalizeErpItemCode(part.partNumber), part] as const)
    );

    const codeCounts = new Map<string, number>();
    for (const row of scopedRows) {
      if (!row.itemCode) continue;
      codeCounts.set(row.itemCode, (codeCounts.get(row.itemCode) ?? 0) + 1);
    }

    const rowCreates: Prisma.InventoryImportRowCreateManyInput[] = [];
    let matchedRows = 0;
    let changedRows = 0;
    let unchangedRows = 0;
    let unmappedRows = 0;
    let duplicateRows = 0;
    let invalidRows = 0;

    for (const row of scopedRows) {
      let status: InventoryImportRowStatus = InventoryImportRowStatus.INVALID;
      let message = row.invalidReason;
      let partId: string | null = null;
      let partNumber: string | null = null;
      let maintainProQuantity: number | null = null;
      let difference: number | null = null;

      if (row.invalidReason || !row.itemCode || row.quantity == null) {
        status = InventoryImportRowStatus.INVALID;
        invalidRows += 1;
        message = message ?? "Invalid row";
      } else if ((codeCounts.get(row.itemCode) ?? 0) > 1) {
        status = InventoryImportRowStatus.DUPLICATE;
        duplicateRows += 1;
        message = "Duplicate item code in selected import scope";
      } else {
        const part = partsByCode.get(row.itemCode);
        if (!part) {
          status = InventoryImportRowStatus.UNMAPPED;
          unmappedRows += 1;
          message = "No matching MaintainPro partNumber";
        } else {
          partId = part.id;
          partNumber = part.partNumber;
          maintainProQuantity = part.quantityInStock;
          difference = row.quantity - part.quantityInStock;
          if (difference === 0) {
            status = InventoryImportRowStatus.UNCHANGED;
            unchangedRows += 1;
            matchedRows += 1;
          } else {
            status = InventoryImportRowStatus.CHANGE;
            changedRows += 1;
            matchedRows += 1;
          }
        }
      }

      rowCreates.push({
        tenantId,
        importRunId: run.id,
        rowNumber: row.rowNumber,
        erpItemCode: row.itemCode,
        itemName: row.itemName,
        erpQuantity: row.quantity ?? undefined,
        warehouseCode: row.warehouseCode,
        uom: row.uom,
        partId: partId ?? undefined,
        partNumber: partNumber ?? undefined,
        maintainProQuantity: maintainProQuantity ?? undefined,
        difference: difference ?? undefined,
        status,
        message: message ?? undefined
      });
    }

    await this.prisma.inventoryImportRow.deleteMany({ where: { importRunId: run.id, tenantId } });
    if (rowCreates.length > 0) {
      await this.prisma.inventoryImportRow.createMany({ data: rowCreates });
    }

    const blocked = duplicateRows > 0 || invalidRows > 0;
    const mappingSnapshot = run.mappingSnapshot as Record<string, unknown> | null;
    const updated = await this.prisma.inventoryImportRun.update({
      where: { id: run.id },
      data: {
        sheetName: sheetResolved.sheetName || body.sheetName || run.sheetName,
        warehouseScope: warehouseScope ?? (warehouses.length <= 1 ? warehouses[0] ?? null : null),
        businessDate: body.businessDate ? new Date(body.businessDate) : null,
        status: blocked ? InventoryImportStatus.BLOCKED : InventoryImportStatus.VALIDATED,
        validatedAt: new Date(),
        totalRows: scopedRows.length,
        matchedRows,
        changedRows,
        unchangedRows,
        unmappedRows,
        duplicateRows,
        invalidRows,
        mappingSnapshot: {
          headers: mappingSnapshot?.headers ?? [],
          mapping: body.mapping,
          suggestedMapping: mappingSnapshot?.suggestedMapping,
          mappingConfidence: mappingSnapshot?.mappingConfidence
        } as Prisma.InputJsonValue,
        warehousesDetected: warehouses as Prisma.InputJsonValue,
        errorSummary: blocked
          ? duplicateRows > 0
            ? "DUPLICATE_ITEM_CODE"
            : "INVALID rows present"
          : null
      },
      include: { rows: { orderBy: { rowNumber: "asc" }, take: 500 } }
    });

    await this.recordAudit({
      entityId: run.id,
      action: AuditAction.UPDATE,
      actor,
      reason: "ERP Excel stock import validated",
      metadata: {
        sheetName: updated.sheetName,
        warehouseScope: updated.warehouseScope,
        matchedRows,
        changedRows,
        unchangedRows,
        unmappedRows,
        duplicateRows,
        invalidRows,
        status: updated.status
      }
    });

    return {
      run: this.toPublicRun(updated),
      preview: updated.rows.map((row) => this.toPublicRow(row)),
      summary: {
        totalRows: updated.totalRows,
        matched: matchedRows,
        changed: changedRows,
        unchanged: unchangedRows,
        unmapped: unmappedRows,
        duplicates: duplicateRows,
        invalid: invalidRows
      },
      blocked,
      applyAllowed: !blocked && updated.status === InventoryImportStatus.VALIDATED
    };
  }

  async getRun(importRunId: string, actor?: Actor) {
    const tenantId = this.requireTenantId(actor);
    const run = await this.prisma.inventoryImportRun.findFirst({
      where: { id: importRunId, tenantId },
      include: { rows: { orderBy: { rowNumber: "asc" }, take: 1000 } }
    });
    if (!run) {
      throw new NotFoundException("Import run not found");
    }
    return {
      run: this.toPublicRun(run),
      preview: run.rows.map((row) => this.toPublicRow(row))
    };
  }

  async history(actor?: Actor, take = 50) {
    const tenantId = this.requireTenantId(actor);
    const runs = await this.prisma.inventoryImportRun.findMany({
      where: { tenantId },
      orderBy: { uploadedAt: "desc" },
      take: Math.min(Math.max(take, 1), 100)
    });
    return { items: runs.map((run) => this.toPublicRun(run)) };
  }

  async apply(importRunId: string, body: { confirmed: boolean }, actor?: Actor) {
    const tenantId = this.requireTenantId(actor);
    if (!body.confirmed) {
      throw new BadRequestException({
        code: "IMPORT_NOT_READY",
        message:
          "You must confirm: You are about to synchronize MaintainPro stock quantities to the uploaded ERP stock snapshot."
      });
    }

    const run = await this.prisma.inventoryImportRun.findFirst({
      where: { id: importRunId, tenantId },
      include: { rows: true }
    });
    if (!run) {
      throw new NotFoundException("Import run not found");
    }

    if (
      run.status === InventoryImportStatus.COMPLETED ||
      run.status === InventoryImportStatus.PARTIAL
    ) {
      return {
        run: this.toPublicRun(run),
        reused: true,
        message: "Import already applied; returning existing result."
      };
    }

    if (run.status === InventoryImportStatus.APPLYING) {
      const waited = await this.waitForApplyTerminal(importRunId, tenantId);
      if (waited) {
        return {
          run: this.toPublicRun(waited as never),
          preview: waited.rows?.map((row) => this.toPublicRow(row)),
          reused: true,
          message: "Import already applied; returning existing result."
        };
      }
      // Stale APPLYING (crash) — reclaim by resetting to VALIDATED then claiming below.
      await this.prisma.inventoryImportRun.updateMany({
        where: {
          id: run.id,
          tenantId,
          status: InventoryImportStatus.APPLYING,
          appliedAt: null
        },
        data: { status: InventoryImportStatus.VALIDATED }
      });
    }

    const ready = await this.prisma.inventoryImportRun.findFirst({
      where: { id: importRunId, tenantId },
      include: { rows: true }
    });
    if (!ready) {
      throw new NotFoundException("Import run not found");
    }
    if (
      ready.status === InventoryImportStatus.COMPLETED ||
      ready.status === InventoryImportStatus.PARTIAL
    ) {
      return {
        run: this.toPublicRun(ready),
        reused: true,
        message: "Import already applied; returning existing result."
      };
    }
    if (ready.status !== InventoryImportStatus.VALIDATED) {
      this.mapError("IMPORT_NOT_READY", "Import not ready");
    }

    // Server-side revalidation: never trust stale browser preview alone.
    if (ready.duplicateRows > 0 || ready.invalidRows > 0) {
      this.mapError(
        ready.duplicateRows > 0 ? "DUPLICATE_ITEM_CODE" : "IMPORT_NOT_READY",
        "Import blocked"
      );
    }

    const changeRows = ready.rows.filter(
      (row) => row.status === InventoryImportRowStatus.CHANGE
    );
    const stillValidChanges = changeRows.filter(
      (row) => row.erpItemCode && row.erpQuantity != null && row.partId
    );
    if (stillValidChanges.length !== changeRows.length) {
      this.mapError("IMPORT_NOT_READY", "Import rows are no longer valid; re-validate the workbook.");
    }

    // Atomic claim: only one concurrent apply may transition VALIDATED → APPLYING.
    const claimed = await this.prisma.inventoryImportRun.updateMany({
      where: {
        id: ready.id,
        tenantId,
        status: InventoryImportStatus.VALIDATED
      },
      data: { status: InventoryImportStatus.APPLYING }
    });
    if (claimed.count !== 1) {
      const raced = await this.waitForApplyTerminal(importRunId, tenantId);
      if (raced) {
        return {
          run: this.toPublicRun(raced as never),
          preview: raced.rows?.map((row) => this.toPublicRow(row)),
          reused: true,
          message: "Import already applied; returning existing result."
        };
      }
      this.mapError("IMPORT_APPLY_IN_PROGRESS", "Apply already in progress");
    }

    const erpBalances: StockBalanceSnapshot[] = stillValidChanges.map((row) => ({
      partSku: row.erpItemCode as string,
      quantityOnHand: row.erpQuantity as number,
      warehouseCode: row.warehouseCode
    }));

    const result = await this.erpStockSyncService.applyAbsoluteStockBalances(
      actor?.sub
        ? { sub: actor.sub, tenantId: actor.tenantId ?? null }
        : undefined,
      erpBalances,
      {
        movementReference: `ERP-EXCEL:${ready.id}`,
        notesPrefix: "ERP Excel stock import"
      }
    );

    const finalStatus =
      result.status === "partial"
        ? InventoryImportStatus.PARTIAL
        : result.failedCount > 0
          ? InventoryImportStatus.FAILED
          : InventoryImportStatus.COMPLETED;

    if (finalStatus === InventoryImportStatus.FAILED) {
      await this.prisma.inventoryImportRun.update({
        where: { id: ready.id },
        data: {
          status: InventoryImportStatus.FAILED,
          failedRows: result.failedCount,
          applyMessage: result.message,
          errorSummary: "IMPORT_APPLY_FAILED"
        }
      });
      this.mapError("IMPORT_APPLY_FAILED", result.message);
    }

    const updated = await this.prisma.inventoryImportRun.update({
      where: { id: ready.id },
      data: {
        status: finalStatus,
        appliedAt: new Date(),
        updatedRows: result.updatedCount,
        failedRows: result.failedCount,
        applyMessage: result.message,
        errorSummary: result.failedCount > 0 ? "PARTIAL apply" : null
      },
      include: { rows: { orderBy: { rowNumber: "asc" }, take: 500 } }
    });

    await this.recordAudit({
      entityId: ready.id,
      action: AuditAction.UPDATE,
      actor,
      reason: "ERP Excel stock import applied",
      metadata: {
        status: finalStatus,
        updatedRows: result.updatedCount,
        failedRows: result.failedCount,
        skippedCount: result.skippedCount,
        movementReference: `ERP-EXCEL:${ready.id}`,
        unmappedRows: ready.unmappedRows
      }
    });

    return {
      run: this.toPublicRun(updated),
      preview: updated.rows.map((row) => this.toPublicRow(row)),
      apply: result,
      reused: false,
      message: result.message
    };
  }

  private async waitForApplyTerminal(
    importRunId: string,
    tenantId: string,
    attempts = 20,
    delayMs = 100
  ): Promise<{
    id: string;
    status: InventoryImportStatus;
    rows?: Array<{
      id: string;
      rowNumber: number;
      erpItemCode: string | null;
      itemName: string | null;
      erpQuantity: number | null;
      warehouseCode: string | null;
      partNumber: string | null;
      maintainProQuantity: number | null;
      difference: number | null;
      status: InventoryImportRowStatus;
      message: string | null;
    }>;
    [key: string]: unknown;
  } | null> {
    for (let i = 0; i < attempts; i += 1) {
      const fresh = await this.prisma.inventoryImportRun.findFirst({
        where: { id: importRunId, tenantId },
        include: { rows: { orderBy: { rowNumber: "asc" }, take: 500 } }
      });
      if (!fresh) return null;
      if (
        fresh.status === InventoryImportStatus.COMPLETED ||
        fresh.status === InventoryImportStatus.PARTIAL ||
        fresh.status === InventoryImportStatus.FAILED
      ) {
        return fresh;
      }
      if (fresh.status !== InventoryImportStatus.APPLYING) {
        return null;
      }
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
    return null;
  }

  private insightFromRun(run: {
    sheetName: string | null;
    totalRows: number;
    mappingSnapshot: Prisma.JsonValue | null;
    sheetsDetected: Prisma.JsonValue | null;
    warehousesDetected: Prisma.JsonValue | null;
    stagingRecords: Prisma.JsonValue | null;
  }) {
    const mappingSnapshot = (run.mappingSnapshot as Record<string, unknown> | null) ?? {};
    const sheetsByNameMeta =
      (mappingSnapshot.sheetsByName as Record<
        string,
        {
          headers?: string[];
          suggestedMapping?: Partial<ErpExcelColumnMapping>;
          mappingConfidence?: string;
          warehousesDetected?: string[];
        }
      > | null) ?? null;
    const selectedSheet = run.sheetName ?? "";
    const selectedMeta = sheetsByNameMeta?.[selectedSheet];
    const sheetNames = Array.isArray(run.sheetsDetected)
      ? (run.sheetsDetected as string[])
      : selectedSheet
        ? [selectedSheet]
        : [];
    const headers =
      selectedMeta?.headers ??
      (Array.isArray(mappingSnapshot.headers) ? (mappingSnapshot.headers as string[]) : []);
    const suggestedMapping =
      selectedMeta?.suggestedMapping ??
      ((mappingSnapshot.suggestedMapping as Partial<ErpExcelColumnMapping> | undefined) ?? {});
    const warehousesDetected =
      selectedMeta?.warehousesDetected ??
      (Array.isArray(run.warehousesDetected) ? (run.warehousesDetected as string[]) : []);

    return {
      sheetNames,
      selectedSheet,
      headers,
      suggestedMapping,
      mappingConfidence:
        selectedMeta?.mappingConfidence ??
        (typeof mappingSnapshot.mappingConfidence === "string"
          ? mappingSnapshot.mappingConfidence
          : "low"),
      warehousesDetected,
      sampleRowCount: run.totalRows,
      sheetsByName: sheetsByNameMeta ?? undefined
    };
  }

  private toPublicRun(run: {
    id: string;
    tenantId: string;
    source: string;
    originalFilename: string;
    fileSha256: string;
    sheetName: string | null;
    businessDate: Date | null;
    warehouseScope: string | null;
    status: InventoryImportStatus;
    uploadedById: string | null;
    uploadedAt: Date;
    validatedAt: Date | null;
    appliedAt: Date | null;
    totalRows: number;
    matchedRows: number;
    changedRows: number;
    unchangedRows: number;
    unmappedRows: number;
    duplicateRows: number;
    invalidRows: number;
    updatedRows: number;
    failedRows: number;
    mappingSnapshot: Prisma.JsonValue | null;
    sheetsDetected: Prisma.JsonValue | null;
    warehousesDetected: Prisma.JsonValue | null;
    errorSummary: string | null;
    applyMessage: string | null;
  }) {
    return {
      id: run.id,
      source: run.source,
      originalFilename: run.originalFilename,
      fileSha256: run.fileSha256,
      sheetName: run.sheetName,
      businessDate: run.businessDate,
      warehouseScope: run.warehouseScope,
      status: run.status,
      uploadedById: run.uploadedById,
      uploadedAt: run.uploadedAt,
      validatedAt: run.validatedAt,
      appliedAt: run.appliedAt,
      totalRows: run.totalRows,
      matchedRows: run.matchedRows,
      changedRows: run.changedRows,
      unchangedRows: run.unchangedRows,
      unmappedRows: run.unmappedRows,
      duplicateRows: run.duplicateRows,
      invalidRows: run.invalidRows,
      updatedRows: run.updatedRows,
      failedRows: run.failedRows,
      mappingSnapshot: run.mappingSnapshot,
      sheetsDetected: run.sheetsDetected,
      warehousesDetected: run.warehousesDetected,
      errorSummary: run.errorSummary,
      applyMessage: run.applyMessage
    };
  }

  private toPublicRow(row: {
    id: string;
    rowNumber: number;
    erpItemCode: string | null;
    itemName: string | null;
    erpQuantity: number | null;
    warehouseCode: string | null;
    partNumber: string | null;
    maintainProQuantity: number | null;
    difference: number | null;
    status: InventoryImportRowStatus;
    message: string | null;
  }) {
    return {
      id: row.id,
      rowNumber: row.rowNumber,
      erpItemCode: row.erpItemCode,
      itemName: row.itemName,
      erpQuantity: row.erpQuantity,
      warehouseCode: row.warehouseCode,
      maintainProItem: row.partNumber,
      maintainProQuantity: row.maintainProQuantity,
      difference: row.difference,
      status: row.status,
      message: row.message
    };
  }
}
