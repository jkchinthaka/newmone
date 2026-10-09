import { inventoryPartsWhere } from "../src/modules/inventory/inventory-list-query";

describe("inventory parts query", () => {
  it("keeps the ERP snapshot and mapping filters on the server", () => {
    expect(inventoryPartsWhere("tenant-1", { q: "BRG", mapped: "no", stock: "out" })).toEqual({
      tenantId: "tenant-1",
      isActive: true,
      AND: [
        {
          OR: [
            { name: { contains: "BRG" } },
            { partNumber: { contains: "BRG" } },
            { erpCode: { contains: "BRG" } },
            { supplier: { name: { contains: "BRG" } } }
          ]
        },
        { OR: [{ erpCode: null }, { erpCode: "" }] },
        { quantityInStock: { lte: 0 } }
      ]
    });
  });
});
