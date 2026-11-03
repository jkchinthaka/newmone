import { BadRequestException } from "@nestjs/common";

import { ErpStockSyncService } from "../src/modules/inventory/erp-stock-sync.service";
import { GoodsInService, normalizeGoodsInLine } from "../src/modules/inventory/goods-in.service";
import { applyOwnedStockIssue } from "../src/modules/inventory/owned-stock";
import { assertVerifiedIssueAllowed } from "../src/modules/inventory/verified-stock-availability";

const tenantId = "t-1";
const actor = { sub: "store-1", tenantId, role: "INVENTORY_KEEPER" };

describe("goods in: line rules", () => {
  it("needs a code and a whole quantity above 0", () => {
    expect(normalizeGoodsInLine({ quantity: 5 }, 0)).toMatchObject({ status: "ERROR", message: "Part code is missing" });
    expect(normalizeGoodsInLine({ partNumber: "b-1", quantity: "2.5" }, 0).status).toBe("ERROR");
    expect(normalizeGoodsInLine({ partNumber: "b-1", quantity: 0 }, 0).status).toBe("ERROR");
    expect(normalizeGoodsInLine({ partNumber: "b-1", quantity: 3, unitCost: -1 }, 0).status).toBe("ERROR");
    expect(normalizeGoodsInLine({ partNumber: " b-1 ", quantity: "1,200", unitCost: "450.555" }, 2)).toMatchObject({
      status: "OK",
      row: 3,
      partNumber: "B-1",
      quantity: 1200,
      unitCost: 450.56,
      unit: "pcs",
      category: "General"
    });
  });
});

function goodsInPrisma(options: { parts?: Array<Record<string, unknown>>; ownedStore?: Record<string, unknown> | null; defaultStore?: Record<string, unknown> | null } = {}) {
  return {
    sparePart: {
      findMany: jest.fn().mockResolvedValue(options.parts ?? []),
      findFirst: jest.fn().mockResolvedValue(null),
      update: jest.fn().mockResolvedValue({})
    },
    warehouse: {
      findFirst: jest
        .fn()
        .mockImplementation(({ where }: { where: Record<string, unknown> }) =>
          Promise.resolve(where.stockSource ? options.ownedStore ?? null : options.defaultStore ?? null)
        ),
      create: jest.fn().mockImplementation(({ data }: { data: Record<string, unknown> }) => Promise.resolve({ id: "wh-new", ...data })),
      update: jest.fn().mockImplementation(({ where, data }: { where: { id: string }; data: Record<string, unknown> }) =>
        Promise.resolve({ id: where.id, code: "DEFAULT", name: "Default Warehouse", ...data })
      )
    },
    auditLog: { create: jest.fn().mockResolvedValue({}) }
  };
}

describe("goods in: preview and save", () => {
  const bearing = { id: "p-1", partNumber: "BRG-6204", erpCode: null, name: "Bearing 6204", category: "Bearings", unit: "pcs", quantityInStock: 4 };

  it("marks known parts OK, unknown codes with a name NEW, and unknown codes without a name as errors", async () => {
    const prisma = goodsInPrisma({ parts: [bearing] });
    const service = new GoodsInService(prisma as never, {} as never, {} as never);
    const result = await service.preview(actor as never, [
      { partNumber: "brg-6204", quantity: 10 },
      { partNumber: "BELT-A42", name: "V belt A42", quantity: 2 },
      { partNumber: "XX-1", quantity: 1 }
    ]);
    expect(result.lines.map((line) => line.status)).toEqual(["OK", "NEW", "ERROR"]);
    expect(result.lines[0]).toMatchObject({ partId: "p-1", name: "Bearing 6204", currentOnHand: 4 });
    expect(result.counts).toEqual({ total: 3, ok: 1, newParts: 1, errors: 1 });
    expect(result.totalQuantity).toBe(12);
  });

  it("refuses to save while any line has an error", async () => {
    const service = new GoodsInService(goodsInPrisma() as never, {} as never, {} as never);
    await expect(
      service.receive(actor as never, { lines: [{ partNumber: "XX-1", quantity: 1 }], idempotencyKey: "k" })
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it("creates the store and new parts, receives each line once and keeps the latest cost", async () => {
    const prisma = goodsInPrisma({ parts: [bearing] });
    const engine = { receive: jest.fn().mockResolvedValue({}) };
    const inventory = { createPart: jest.fn().mockResolvedValue({ id: "p-new" }) };
    const service = new GoodsInService(prisma as never, engine as never, inventory as never);
    const result = await service.receive(actor as never, {
      lines: [
        { partNumber: "BRG-6204", quantity: 10, unitCost: 850 },
        { partNumber: "BELT-A42", name: "V belt A42", quantity: 2 },
        { partNumber: "BELT-A42", name: "V belt A42", quantity: 3 }
      ],
      referenceNo: "GRN-1001",
      supplierName: "ABC Traders",
      idempotencyKey: "batch-1"
    });
    expect(prisma.warehouse.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ code: "MAINT-STORE", stockSource: "MAINTAINPRO", isDefault: true })
    });
    expect(inventory.createPart).toHaveBeenCalledTimes(1);
    expect(engine.receive).toHaveBeenCalledTimes(3);
    expect(engine.receive).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        partId: "p-1",
        quantity: 10,
        warehouseId: "wh-new",
        sourceType: "GOODS_IN",
        sourceDocument: "GRN-1001",
        idempotencyKey: "goods-in:batch-1:1"
      })
    );
    expect(engine.receive).toHaveBeenNthCalledWith(3, expect.objectContaining({ partId: "p-new", quantity: 3 }));
    expect(prisma.sparePart.update).toHaveBeenCalledWith({ where: { id: "p-1" }, data: { unitCost: 850 } });
    expect(result).toMatchObject({ lines: 3, newParts: 1, totalQuantity: 15, totalValue: 8500, referenceNo: "GRN-1001" });
  });

  it("turns an unmapped default store into the MaintainPro store instead of adding a second one", async () => {
    const prisma = goodsInPrisma({ defaultStore: { id: "wh-default", isDefault: true, erpWarehouseCode: null } });
    const service = new GoodsInService(prisma as never, {} as never, {} as never);
    const store = await service.ownedStore(tenantId, actor as never);
    expect(prisma.warehouse.update).toHaveBeenCalledWith({ where: { id: "wh-default" }, data: { stockSource: "MAINTAINPRO" } });
    expect(prisma.warehouse.create).not.toHaveBeenCalled();
    expect(store.id).toBe("wh-default");
  });
});

describe("issuing from a MaintainPro store", () => {
  function issueTx(balance: { onHand: number; reserved: number } | null) {
    return {
      warehouse: {
        findFirst: jest.fn(),
        findMany: jest.fn().mockResolvedValue([{ id: "wh-1", stockSource: "MAINTAINPRO", isDefault: true, erpWarehouseCode: null, lastErpValidatedAt: null }])
      },
      warehouseItemBalance: {
        findFirst: jest.fn().mockResolvedValue(balance ? { id: "b", available: balance.onHand - balance.reserved, ...balance } : null),
        findMany: jest.fn().mockResolvedValue([])
      },
      domainEventOutbox: { findMany: jest.fn() }
    };
  }

  it("uses on hand minus reserved, without ERP provenance", async () => {
    const tx = issueTx({ onHand: 10, reserved: 2 });
    await expect(assertVerifiedIssueAllowed(tx as never, { tenantId, partId: "p-1", quantity: 8 })).resolves.toEqual({
      available: 8,
      warehouseId: "wh-1",
      verifiedAt: null,
      source: "MAINTAINPRO"
    });
    await expect(assertVerifiedIssueAllowed(tx as never, { tenantId, partId: "p-1", quantity: 9 })).rejects.toThrow(
      "Insufficient verified stock. Available: 8, Requested: 9."
    );
    expect(tx.domainEventOutbox.findMany).not.toHaveBeenCalled();
  });

  it("leaves ERP stores alone", async () => {
    const result = await applyOwnedStockIssue({} as never, {} as never, { available: 5, warehouseId: "w", verifiedAt: new Date(), source: "ERP" }, {
      actor,
      partId: "p",
      quantity: 1,
      sourceType: "WORK_ORDER_ISSUE",
      idempotencyKey: "k"
    });
    expect(result).toBeNull();
  });
});

describe("ERP stock apply cannot overwrite MaintainPro stock", () => {
  it("is refused when the default store is a MaintainPro store", async () => {
    const prisma = { warehouse: { findFirst: jest.fn().mockResolvedValue({ id: "wh-1" }) } };
    const service = new ErpStockSyncService(prisma as never, {} as never, {} as never);
    await expect(service.applyStockSnapshot(actor as never)).rejects.toThrow(/kept in MaintainPro/);
    await expect(service.applyAbsoluteStockBalances(actor as never, [], {} as never)).rejects.toThrow(/kept in MaintainPro/);
  });
});
