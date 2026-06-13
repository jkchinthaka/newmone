import {
  buildDryRunResult,
  compareStockBalances,
  parseBileetaStockBalances,
  publicErpStockSyncDryRunHasSensitiveFields
} from "../src/modules/inventory/erp-stock-sync.mapper";

describe("ERP stock sync mapping", () => {
  it("matches MaintainPro partNumber to ERP item code case-insensitively", () => {
    const comparison = compareStockBalances({
      erpBalances: [{ partSku: "brg-001", quantityOnHand: 10, warehouseCode: "MAIN" }],
      maintainProParts: [
        {
          id: "part-1",
          partNumber: "BRG-001",
          name: "Bearing",
          quantityInStock: 8
        }
      ]
    });

    expect(comparison.summary.matchedItems).toBe(1);
    expect(comparison.summary.changedItems).toBe(1);
    expect(comparison.changedRows[0]).toMatchObject({
      partId: "part-1",
      maintainProQuantity: 8,
      erpQuantity: 10,
      delta: 2
    });
  });

  it("reports unmatched ERP and MaintainPro items", () => {
    const comparison = compareStockBalances({
      erpBalances: [{ partSku: "ERP-ONLY", quantityOnHand: 3, warehouseCode: null }],
      maintainProParts: [
        {
          id: "part-2",
          partNumber: "LOCAL-ONLY",
          name: "Local part",
          quantityInStock: 1
        }
      ]
    });

    expect(comparison.summary.unmatchedErpItems).toBe(1);
    expect(comparison.summary.unmatchedMaintainProItems).toBe(1);
    expect(comparison.summary.matchedItems).toBe(0);
  });

  it("caps sample rows without changing summary counts", () => {
    const maintainProParts = Array.from({ length: 8 }, (_, index) => ({
      id: `part-${index}`,
      partNumber: `P-${index}`,
      name: `Part ${index}`,
      quantityInStock: index
    }));
    const erpBalances = maintainProParts.map((part, index) => ({
      partSku: part.partNumber,
      quantityOnHand: index + 1,
      warehouseCode: null
    }));

    const comparison = compareStockBalances({ erpBalances, maintainProParts });
    const dryRun = buildDryRunResult({
      mode: "mock",
      status: "completed",
      comparison,
      applyEnabled: false,
      message: "ok"
    });

    expect(dryRun.summary.changedItems).toBe(8);
    expect(dryRun.sampleRows.length).toBeLessThanOrEqual(5);
    expect(dryRun.changedRows.length).toBeLessThanOrEqual(5);
  });

  it("parses flexible Bileeta stock payloads", () => {
    const balances = parseBileetaStockBalances({
      items: [
        { itemCode: "BRG-001", quantityOnHand: 12, warehouseCode: "MAIN" },
        { partSku: "FLT-220", qty: 4 }
      ]
    });

    expect(balances).toEqual([
      { partSku: "BRG-001", quantityOnHand: 12, warehouseCode: "MAIN" },
      { partSku: "FLT-220", quantityOnHand: 4, warehouseCode: undefined }
    ]);
  });

  it("flags sensitive fields in public dry-run payloads", () => {
    expect(
      publicErpStockSyncDryRunHasSensitiveFields({
        mode: "mock",
        status: "completed",
        checkedAt: new Date().toISOString(),
        summary: {
          matchedItems: 0,
          unmatchedErpItems: 0,
          unmatchedMaintainProItems: 0,
          changedItems: 0,
          unchangedItems: 0
        },
        warnings: [],
        sampleRows: [],
        changedRows: [],
        unmatchedErpSamples: [],
        unmatchedMaintainProSamples: [],
        applyEnabled: false,
        message: "ok",
        erp_api_key: "secret"
      })
    ).toBe(true);
  });
});
