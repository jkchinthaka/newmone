import { InventoryImportRowStatus, InventoryImportStatus } from "@prisma/client";

import { ErpExcelImportService } from "../src/modules/inventory/erp-excel-import.service";
import { ErpStockSyncService } from "../src/modules/inventory/erp-stock-sync.service";
import ExcelJS from "exceljs";

async function xlsxBuffer(rows: Array<Record<string, string | number>>) {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("Stock");
  const headers = Object.keys(rows[0]);
  sheet.addRow(headers);
  rows.forEach((row) => sheet.addRow(headers.map((h) => row[h])));
  return Buffer.from(await workbook.xlsx.writeBuffer());
}

describe("ErpExcelImportService", () => {
  const tenantId = "tenant-excel-1";
  const actor = { sub: "user-1", tenantId, email: "keeper@test.local", role: "INVENTORY_KEEPER" };

  function buildService(overrides?: {
    parts?: Array<{ id: string; partNumber: string; name: string; quantityInStock: number }>;
    existingRun?: unknown;
    applyResult?: {
      mode: string;
      status: "completed" | "partial";
      appliedAt: string;
      updatedCount: number;
      skippedCount: number;
      failedCount: number;
      failedPartNumbers: string[];
      warnings: string[];
      message: string;
      snapshotBalanceCount: number;
    };
  }) {
    const runs = new Map<string, any>();
    const rowsByRun = new Map<string, any[]>();

    const prisma: any = {
      inventoryImportRun: {
        findUnique: jest.fn(async ({ where }: any) => {
          if (overrides?.existingRun) return overrides.existingRun;
          for (const run of runs.values()) {
            if (
              run.tenantId === where.tenantId_source_fileSha256.tenantId &&
              run.source === where.tenantId_source_fileSha256.source &&
              run.fileSha256 === where.tenantId_source_fileSha256.fileSha256
            ) {
              return run;
            }
          }
          return null;
        }),
        findFirst: jest.fn(async ({ where, include }: any) => {
          const run = runs.get(where.id);
          if (!run || run.tenantId !== where.tenantId) return null;
          if (include?.rows) {
            return { ...run, rows: rowsByRun.get(run.id) ?? [] };
          }
          return run;
        }),
        findMany: jest.fn(async ({ where }: any) =>
          Array.from(runs.values()).filter((run) => run.tenantId === where.tenantId)
        ),
        create: jest.fn(async ({ data }: any) => {
          const run = {
            id: `run-${runs.size + 1}`,
            ...data,
            uploadedAt: new Date(),
            validatedAt: null,
            appliedAt: null,
            matchedRows: 0,
            changedRows: 0,
            unchangedRows: 0,
            unmappedRows: 0,
            duplicateRows: 0,
            invalidRows: 0,
            updatedRows: 0,
            failedRows: 0,
            errorSummary: null,
            applyMessage: null,
            businessDate: null,
            warehouseScope: null
          };
          runs.set(run.id, run);
          return run;
        }),
        update: jest.fn(async ({ where, data, include }: any) => {
          const current = runs.get(where.id);
          const next = { ...current, ...data };
          runs.set(where.id, next);
          if (include?.rows) {
            return { ...next, rows: rowsByRun.get(where.id) ?? [] };
          }
          return next;
        })
      },
      inventoryImportRow: {
        deleteMany: jest.fn(async ({ where }: any) => {
          rowsByRun.set(where.importRunId, []);
          return { count: 0 };
        }),
        createMany: jest.fn(async ({ data }: any) => {
          const list = data.map((row: any, index: number) => ({
            id: `row-${index}`,
            ...row
          }));
          rowsByRun.set(data[0].importRunId, list);
          return { count: list.length };
        })
      },
      sparePart: {
        findMany: jest.fn(async ({ where }: any) => {
          expect(where.tenantId).toBe(tenantId);
          return (
            overrides?.parts ?? [
              { id: "p1", partNumber: "09CS41", name: "Seal", quantityInStock: 12 }
            ]
          );
        })
      },
      auditLog: {
        create: jest.fn(async () => ({ id: "audit-1" }))
      }
    };

    const erpStockSyncService = {
      applyAbsoluteStockBalances: jest.fn(async (_actor, balances) => {
        expect(Array.isArray(balances)).toBe(true);
        return (
          overrides?.applyResult ?? {
            mode: "absolute-snapshot",
            status: "completed",
            appliedAt: new Date().toISOString(),
            updatedCount: balances.length,
            skippedCount: 0,
            failedCount: 0,
            failedPartNumbers: [],
            warnings: [],
            message: `Applied ${balances.length} local stock adjustment(s) from ERP stock snapshot.`,
            snapshotBalanceCount: balances.length
          }
        );
      })
    } as unknown as ErpStockSyncService;

    const service = new ErpExcelImportService(prisma, erpStockSyncService);
    return { service, prisma, erpStockSyncService, runs, rowsByRun };
  }

  it("matches known parts and leaves unknown as UNMAPPED", async () => {
    const { service } = buildService();
    const buffer = await xlsxBuffer([
      { "Item Code": "09CS41", Qty: 20 },
      { "Item Code": "UNKNOWN", Qty: 3 }
    ]);
    const uploaded = await service.upload(
      { originalname: "stock.xlsx", buffer, size: buffer.length },
      actor
    );
    const validated = await service.validate(
      uploaded.run.id,
      {
        mapping: { itemCode: "Item Code", quantity: "Qty" }
      },
      actor
    );
    expect(validated.summary.changed).toBe(1);
    expect(validated.summary.unmapped).toBe(1);
    expect(validated.preview.some((row) => row.status === InventoryImportRowStatus.UNMAPPED)).toBe(
      true
    );
    expect(validated.applyAllowed).toBe(true);
  });

  it("blocks duplicates in selected scope", async () => {
    const { service } = buildService();
    const buffer = await xlsxBuffer([
      { "Item Code": "09CS41", Qty: 20 },
      { "Item Code": "09CS41", Qty: 21 }
    ]);
    const uploaded = await service.upload(
      { originalname: "dup.xlsx", buffer, size: buffer.length },
      actor
    );
    const validated = await service.validate(
      uploaded.run.id,
      { mapping: { itemCode: "Item Code", quantity: "Qty" } },
      actor
    );
    expect(validated.blocked).toBe(true);
    expect(validated.summary.duplicates).toBe(2);
    expect(validated.applyAllowed).toBe(false);
  });

  it("applies absolute qty through shared engine and is idempotent on retry", async () => {
    const { service, erpStockSyncService, runs, rowsByRun } = buildService();
    const buffer = await xlsxBuffer([{ "Item Code": "09CS41", Qty: 20 }]);
    const uploaded = await service.upload(
      { originalname: "apply.xlsx", buffer, size: buffer.length },
      actor
    );
    await service.validate(
      uploaded.run.id,
      { mapping: { itemCode: "Item Code", quantity: "Qty" } },
      actor
    );

    const first = await service.apply(uploaded.run.id, { confirmed: true }, actor);
    expect(first.run.status).toBe(InventoryImportStatus.COMPLETED);
    expect(erpStockSyncService.applyAbsoluteStockBalances).toHaveBeenCalledWith(
      { sub: actor.sub, tenantId: actor.tenantId },
      [{ partSku: "09CS41", quantityOnHand: 20, warehouseCode: null }],
      expect.objectContaining({ movementReference: `ERP-EXCEL:${uploaded.run.id}` })
    );

    // Simulate durable applied state for retry
    const run = runs.get(uploaded.run.id);
    run.status = InventoryImportStatus.COMPLETED;
    rowsByRun.set(uploaded.run.id, [
      {
        id: "row-1",
        status: InventoryImportRowStatus.CHANGE,
        erpItemCode: "09CS41",
        erpQuantity: 20,
        partId: "p1",
        warehouseCode: null
      }
    ]);

    const second = await service.apply(uploaded.run.id, { confirmed: true }, actor);
    expect(second.reused).toBe(true);
    expect(erpStockSyncService.applyAbsoluteStockBalances).toHaveBeenCalledTimes(1);
  });

  it("rejects missing tenant context", async () => {
    const { service } = buildService();
    const buffer = await xlsxBuffer([{ "Item Code": "09CS41", Qty: 1 }]);
    await expect(
      service.upload({ originalname: "stock.xlsx", buffer, size: buffer.length }, {
        sub: "u",
        tenantId: null as unknown as string
      })
    ).rejects.toThrow(/Tenant context/i);
  });

  it("requires warehouse scope when multiple warehouses are present", async () => {
    const { service } = buildService({
      parts: [
        { id: "p1", partNumber: "A", name: "A", quantityInStock: 1 },
        { id: "p2", partNumber: "B", name: "B", quantityInStock: 1 }
      ]
    });
    const buffer = await xlsxBuffer([
      { "Item Code": "A", Qty: 2, Warehouse: "WH1" },
      { "Item Code": "B", Qty: 3, Warehouse: "WH2" }
    ]);
    const uploaded = await service.upload(
      { originalname: "multi.xlsx", buffer, size: buffer.length },
      actor
    );
    await expect(
      service.validate(
        uploaded.run.id,
        { mapping: { itemCode: "Item Code", quantity: "Qty", warehouse: "Warehouse" } },
        actor
      )
    ).rejects.toThrow(/Multiple warehouses|warehouse/i);
  });

  it("does not claim COMPLETED when shared apply returns partial failures", async () => {
    const { service } = buildService({
      applyResult: {
        mode: "absolute-snapshot",
        status: "partial",
        appliedAt: new Date().toISOString(),
        updatedCount: 0,
        skippedCount: 0,
        failedCount: 1,
        failedPartNumbers: ["09CS41"],
        warnings: [],
        message: "Partial ERP stock apply",
        snapshotBalanceCount: 1
      }
    });
    const buffer = await xlsxBuffer([{ "Item Code": "09CS41", Qty: 99 }]);
    const uploaded = await service.upload(
      { originalname: "partial.xlsx", buffer, size: buffer.length },
      actor
    );
    await service.validate(
      uploaded.run.id,
      { mapping: { itemCode: "Item Code", quantity: "Qty" } },
      actor
    );
    const applied = await service.apply(uploaded.run.id, { confirmed: true }, actor);
    expect(applied.run.status).toBe(InventoryImportStatus.PARTIAL);
  });

  it("recovers existing non-applied run for same file hash", async () => {
    const { service } = buildService();
    const buffer = await xlsxBuffer([{ "Item Code": "09CS41", Qty: 8 }]);
    const first = await service.upload(
      { originalname: "same.xlsx", buffer, size: buffer.length },
      actor
    );
    const second = await service.upload(
      { originalname: "same.xlsx", buffer, size: buffer.length },
      actor
    );
    expect(second.reused).toBe(true);
    expect(second.run.id).toBe(first.run.id);
  });
});
