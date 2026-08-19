import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { AuditAction, ErpImportBatchStatus, ErpImportType, MovementType, Prisma } from "@prisma/client";

import { PrismaService } from "../../database/prisma.service";
import { requireTenantId } from "../../common/utils/tenant-scope.util";
import type { JwtPayload } from "../auth/auth.types";
import {
  normalizeDocumentStatus,
  parseInventoryWorkbook,
  type ParsedInventoryExcelRow
} from "./inventory-excel-parse.util";
import { InventoryTransactionEngine } from "./inventory-transaction.engine";

type Actor = Pick<JwtPayload, "sub" | "email" | "role" | "tenantId">;

@Injectable()
export class InventoryExcelImportService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly stockEngine: InventoryTransactionEngine
  ) {}

  async preview(buffer: Buffer, filename: string, actor?: Actor) {
    this.assertActor(actor);
    const tenantId = requireTenantId(actor?.tenantId);
    let parsed;
    try {
      parsed = await parseInventoryWorkbook(buffer);
    } catch (error) {
      if (error instanceof Error && error.message === "MALFORMED_WORKBOOK") {
        throw new BadRequestException("Workbook is malformed or missing a recognizable header row");
      }
      throw error;
    }

    const validated = await this.validateRows(tenantId, parsed.rows);
    const counts = this.summarize(validated);

    const batch = await this.prisma.erpImportBatch.create({
      data: {
        tenantId,
        batchNo: await this.nextBatchNo(tenantId),
        importType: ErpImportType.STOCK_BALANCES,
        fileName: filename,
        status: ErpImportBatchStatus.READY_FOR_REVIEW,
        totalRows: parsed.totalRows,
        selectedRows: parsed.selectedRows,
        validRows: counts.validRows,
        invalidRows: counts.failedRows,
        duplicateRows: counts.duplicateRows,
        ignoredRows: counts.ignoredRows,
        failedRows: counts.failedRows,
        appliedRows: 0,
        uploadedByUserId: actor?.sub,
        dryRunSummary: {
          selectedRows: parsed.selectedRows,
          unselectedIgnored: parsed.unselectedIgnored,
          sheetName: parsed.sheetName,
          stockMutated: false
        } as Prisma.InputJsonValue
      }
    });

    if (validated.length > 0) {
      for (const row of validated) {
        await this.prisma.erpImportRow.create({
          data: this.toRowCreate(tenantId, batch.id, row)
        });
      }
    }

    await this.prisma.auditLog.create({
      data: {
        tenantId,
        actorId: actor?.sub,
        module: "inventory",
        entity: "InventoryImportRun",
        entityId: batch.id,
        action: AuditAction.CREATE,
        reason: "Excel inventory preview (no stock mutation)",
        metadata: { filename, ...counts, selectedRows: parsed.selectedRows }
      }
    });

    return {
      importRunId: batch.id,
      batchNo: batch.batchNo,
      filename,
      status: batch.status,
      stockMutated: false,
      ...counts,
      selectedRows: parsed.selectedRows,
      totalRows: parsed.totalRows,
      rows: validated
    };
  }

  async apply(importRunId: string, actor?: Actor) {
    this.assertActor(actor);
    const tenantId = requireTenantId(actor?.tenantId);
    const batch = await this.prisma.erpImportBatch.findFirst({
      where: { id: importRunId, tenantId, importType: ErpImportType.STOCK_BALANCES },
      include: { rows: true }
    });
    if (!batch) {
      throw new NotFoundException("Inventory import run not found");
    }
    if (batch.status === ErpImportBatchStatus.IMPORTED) {
      return this.serializeRun(batch);
    }
    if (batch.status !== ErpImportBatchStatus.READY_FOR_REVIEW && batch.status !== ErpImportBatchStatus.APPROVED) {
      throw new BadRequestException("Import run is not ready to apply");
    }

    let applied = 0;
    let failed = 0;
    let ignored = 0;
    const failedKeys: string[] = [];

    for (const row of batch.rows) {
      if (!row.selected) {
        ignored += 1;
        continue;
      }
      if (row.status === "APPLIED") {
        applied += 1;
        continue;
      }
      if (row.status !== "VALID" && row.status !== "REVERSAL_PENDING") {
        failed += 1;
        continue;
      }

      try {
        await this.applyRow(row, actor, batch.id);
        applied += 1;
      } catch (error) {
        failed += 1;
        failedKeys.push(row.sourceLineKey);
        await this.prisma.erpImportRow.update({
          where: { id: row.id },
          data: {
            status: "FAILED",
            errorCode: "APPLY_FAILED",
            errorMessage: error instanceof Error ? error.message : "Apply failed"
          }
        });
      }
    }

    const updated = await this.prisma.erpImportBatch.update({
      where: { id: batch.id },
      data: {
        status: failed > 0 && applied === 0 ? ErpImportBatchStatus.FAILED : ErpImportBatchStatus.IMPORTED,
        appliedRows: applied,
        failedRows: failed,
        ignoredRows: ignored,
        applySummary: {
          applied,
          failed,
          ignored,
          failedSourceLineKeys: failedKeys
        } as Prisma.InputJsonValue
      },
      include: { rows: true }
    });

    await this.prisma.auditLog.create({
      data: {
        tenantId,
        actorId: actor?.sub,
        module: "inventory",
        entity: "InventoryImportRun",
        entityId: batch.id,
        action: AuditAction.UPDATE,
        reason: "Excel inventory apply",
        metadata: { applied, failed, ignored }
      }
    });

    return this.serializeRun(updated);
  }

  async getRun(importRunId: string, actor?: Actor) {
    const tenantId = requireTenantId(actor?.tenantId);
    const batch = await this.prisma.erpImportBatch.findFirst({
      where: { id: importRunId, tenantId, importType: ErpImportType.STOCK_BALANCES },
      include: { rows: { orderBy: { rowNumber: "asc" } } }
    });
    if (!batch) {
      throw new NotFoundException("Inventory import run not found");
    }
    return this.serializeRun(batch);
  }

  async listRuns(actor?: Actor) {
    const tenantId = requireTenantId(actor?.tenantId);
    return this.prisma.erpImportBatch.findMany({
      where: { tenantId, importType: ErpImportType.STOCK_BALANCES },
      orderBy: { createdAt: "desc" },
      take: 50
    });
  }

  async mapRow(
    importRunId: string,
    rowId: string,
    data: { partId?: string; warehouseId?: string },
    actor?: Actor
  ) {
    this.assertActor(actor);
    const tenantId = requireTenantId(actor?.tenantId);
    const row = await this.prisma.erpImportRow.findFirst({
      where: { id: rowId, importRunId, tenantId }
    });
    if (!row) {
      throw new NotFoundException("Import row not found");
    }
    if (row.status === "APPLIED") {
      throw new BadRequestException("Applied rows cannot be remapped");
    }

    const part = data.partId
      ? await this.prisma.sparePart.findFirst({ where: { id: data.partId, tenantId, isActive: true } })
      : null;
    if (data.partId && !part) {
      throw new BadRequestException("Mapped item is not an approved active part");
    }
    const warehouse = data.warehouseId
      ? await this.prisma.warehouse.findFirst({ where: { id: data.warehouseId, tenantId, isActive: true } })
      : null;
    if (data.warehouseId && !warehouse) {
      throw new BadRequestException("Mapped warehouse not found");
    }

    const status =
      (part || row.mappedPartId) && (warehouse || row.mappedWarehouseId || !row.warehouseCode)
        ? "VALID"
        : row.errorCode === "UNKNOWN_ITEM" || row.errorCode === "UNKNOWN_WAREHOUSE" || row.errorCode === "MAPPING_REQUIRED"
          ? "MAPPING_REQUIRED"
          : row.status;

    return this.prisma.erpImportRow.update({
      where: { id: row.id },
      data: {
        mappedPartId: part?.id ?? row.mappedPartId,
        mappedWarehouseId: warehouse?.id ?? row.mappedWarehouseId,
        status,
        errorCode: status === "VALID" ? null : row.errorCode,
        errorMessage: status === "VALID" ? null : row.errorMessage
      }
    });
  }

  private async applyRow(
    row: {
      id: string;
      tenantId: string;
      sourceLineKey: string;
      mappedPartId: string | null;
      mappedWarehouseId: string | null;
      quantity: number | null;
      documentStatus: string | null;
      productCode: string | null;
      warehouseCode: string | null;
    },
    actor: Actor | undefined,
    importRunId: string
  ) {
    if (!row.mappedPartId || row.quantity == null) {
      throw new BadRequestException("Row is not mapped to an approved item");
    }
    const status = normalizeDocumentStatus(row.documentStatus);
    const idempotencyKey = `import:${row.sourceLineKey}`;

    if (status === "DRAFT" || status === "DELETED") {
      await this.prisma.erpImportRow.update({
        where: { id: row.id },
        data: { status: "IGNORED" }
      });
      return;
    }

    if (status === "REVERSED") {
      const original = await this.prisma.stockMovement.findFirst({
        where: {
          tenantId: row.tenantId,
          sourceLineKey: row.sourceLineKey,
          type: { not: MovementType.REVERSAL }
        },
        orderBy: { createdAt: "desc" }
      });
      if (!original) {
        throw new BadRequestException("No original movement exists to reverse for this source line");
      }
      const result = await this.stockEngine.reverse({
        actor,
        partId: original.partId,
        quantity: original.quantity - (original.quantityReversed ?? 0),
        warehouseId: original.warehouseId ?? row.mappedWarehouseId ?? undefined,
        reason: `ERP reversed status for ${row.sourceLineKey}`,
        reversalOfMovementId: original.id,
        idempotencyKey: `${idempotencyKey}:rev`,
        sourceType: "ERP_IMPORT",
        sourceLineKey: `${row.sourceLineKey}:REV`,
        importRunId
      });
      await this.prisma.erpImportRow.update({
        where: { id: row.id },
        data: { status: "APPLIED", appliedMovementId: result.movement.id }
      });
      return;
    }

    if (status !== "RELEASED") {
      throw new BadRequestException("Unknown ERP document status cannot be applied");
    }

    const result = await this.stockEngine.receive({
      actor,
      partId: row.mappedPartId,
      quantity: row.quantity,
      warehouseId: row.mappedWarehouseId ?? undefined,
      warehouseCode: row.warehouseCode ?? undefined,
      idempotencyKey,
      sourceType: "ERP_IMPORT",
      sourceDocument: row.productCode ?? undefined,
      sourceLineKey: row.sourceLineKey,
      importRunId,
      notes: `ERP Excel import ${row.sourceLineKey}`
    });

    await this.prisma.erpImportRow.update({
      where: { id: row.id },
      data: { status: "APPLIED", appliedMovementId: result.movement.id }
    });
  }

  private async validateRows(tenantId: string, rows: ParsedInventoryExcelRow[]) {
    const selected = rows.filter((row) => row.selected);
    const productCodes = Array.from(new Set(selected.map((row) => row.productCode).filter(Boolean))) as string[];
    const warehouseCodes = Array.from(new Set(selected.map((row) => row.warehouseCode).filter(Boolean))) as string[];

    const [parts, warehouses, existingKeys] = await Promise.all([
      productCodes.length
        ? this.prisma.sparePart.findMany({
            where: { tenantId, isActive: true, partNumber: { in: productCodes } },
            select: { id: true, partNumber: true }
          })
        : Promise.resolve([]),
      warehouseCodes.length
        ? this.prisma.warehouse.findMany({
            where: { tenantId, isActive: true, code: { in: warehouseCodes } },
            select: { id: true, code: true }
          })
        : Promise.resolve([]),
      selected.length
        ? this.prisma.erpImportRow.findMany({
            where: { tenantId, sourceLineKey: { in: selected.map((row) => row.sourceLineKey) }, status: "APPLIED" },
            select: { sourceLineKey: true }
          })
        : Promise.resolve([])
    ]);

    const partByCode = new Map(parts.map((part) => [part.partNumber, part]));
    const warehouseByCode = new Map(warehouses.map((warehouse) => [warehouse.code, warehouse]));
    const appliedKeys = new Set(existingKeys.map((row) => row.sourceLineKey));

    return rows.map((row) => {
      if (!row.selected) {
        return { ...row, status: "IGNORED" as const, mappedPartId: null, mappedWarehouseId: null };
      }
      const errors = [...row.errors];
      let errorCode = row.errorCode;
      const part = row.productCode ? partByCode.get(row.productCode) : undefined;
      const warehouse = row.warehouseCode ? warehouseByCode.get(row.warehouseCode) : undefined;
      if (row.productCode && !part) {
        errors.push("Item is not in approved item master");
        errorCode = "UNKNOWN_ITEM";
      }
      if (row.warehouseCode && !warehouse) {
        errors.push("Warehouse is not in approved warehouse master");
        errorCode = errorCode ?? "UNKNOWN_WAREHOUSE";
      }
      const docStatus = normalizeDocumentStatus(row.documentStatus);
      if (docStatus === "UNKNOWN") {
        errors.push("Unknown ERP document status requires manual review");
        errorCode = "VALIDATION_ERROR";
      }
      if (appliedKeys.has(row.sourceLineKey)) {
        errors.push("Source line already applied");
        errorCode = "DUPLICATE_SOURCE_LINE";
      }
      const status =
        errorCode === "UNKNOWN_ITEM" || errorCode === "UNKNOWN_WAREHOUSE"
          ? "MAPPING_REQUIRED"
          : errors.length > 0
            ? "INVALID"
            : docStatus === "REVERSED"
              ? "REVERSAL_PENDING"
              : "VALID";
      return {
        ...row,
        errors,
        errorCode,
        documentStatus: docStatus,
        status,
        mappedPartId: part?.id ?? null,
        mappedWarehouseId: warehouse?.id ?? null
      };
    });
  }

  private summarize(rows: Array<{ selected: boolean; status: string; errorCode?: string }>) {
    const selected = rows.filter((row) => row.selected);
    return {
      validRows: selected.filter((row) => row.status === "VALID" || row.status === "REVERSAL_PENDING").length,
      failedRows: selected.filter((row) => row.status === "INVALID" || row.status === "MAPPING_REQUIRED").length,
      duplicateRows: selected.filter((row) => row.errorCode === "DUPLICATE_SOURCE_LINE").length,
      ignoredRows: rows.filter((row) => !row.selected || row.status === "IGNORED").length
    };
  }

  private toRowCreate(
    tenantId: string,
    importRunId: string,
    row: ParsedInventoryExcelRow & {
      status: string;
      mappedPartId: string | null;
      mappedWarehouseId: string | null;
    }
  ): Prisma.ErpImportRowCreateManyInput {
    return {
      tenantId,
      importRunId,
      rowNumber: row.rowNumber,
      selected: row.selected,
      sourceLineKey: row.sourceLineKey,
      documentStatus: row.documentStatus,
      warehouseCode: row.warehouseCode,
      warehouseName: row.warehouseName,
      productCode: row.productCode,
      productDescription: row.productDescription,
      uom: row.uom,
      quantity: row.quantity,
      requestedQuantity: row.requestedQuantity,
      requester: row.requester,
      cost: row.cost,
      batch: row.batch,
      lot: row.lot,
      orderNo: row.orderNo,
      orderDate: row.orderDate,
      mappedPartId: row.mappedPartId,
      mappedWarehouseId: row.mappedWarehouseId,
      status: row.status,
      errorCode: row.errorCode,
      errorMessage: row.errors.join("; ") || null,
      sourceFingerprint: row.sourceFingerprint,
      sourceMetadata: {
        selected: row.selected,
        sourceLineId: row.sourceLineId ?? null
      } as Prisma.InputJsonValue
    };
  }

  private serializeRun(batch: {
    id: string;
    batchNo: string;
    fileName: string | null;
    status: ErpImportBatchStatus;
    totalRows: number;
    selectedRows: number;
    validRows: number;
    duplicateRows: number;
    appliedRows: number;
    failedRows: number;
    ignoredRows: number;
    dryRunSummary: Prisma.JsonValue | null;
    applySummary: Prisma.JsonValue | null;
    rows?: unknown;
  }) {
    return {
      importRunId: batch.id,
      batchNo: batch.batchNo,
      filename: batch.fileName,
      status: batch.status,
      totalRows: batch.totalRows,
      selectedRows: batch.selectedRows,
      validRows: batch.validRows,
      duplicateRows: batch.duplicateRows,
      appliedRows: batch.appliedRows,
      failedRows: batch.failedRows,
      ignoredRows: batch.ignoredRows,
      dryRunSummary: batch.dryRunSummary,
      applySummary: batch.applySummary,
      rows: batch.rows ?? []
    };
  }

  private async nextBatchNo(tenantId: string) {
    const count = await this.prisma.erpImportBatch.count({
      where: { tenantId, importType: ErpImportType.STOCK_BALANCES }
    });
    return `INV-IMP-${String(count + 1).padStart(5, "0")}`;
  }

  private assertActor(actor?: Actor) {
    if (!actor?.sub) {
      throw new BadRequestException("Authenticated actor context is required");
    }
  }
}
