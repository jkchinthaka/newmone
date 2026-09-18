/**
 * Structural guard: purchase-order DTOs accept SQL Server cuid/UUID entity ids.
 */
import { readFileSync } from "node:fs";
import path from "node:path";

describe("purchase-order DTO entity id validation", () => {
  const dtoPath = path.join(__dirname, "../src/modules/inventory/dto/purchase-order.dto.ts");
  const src = readFileSync(dtoPath, "utf8");

  it("does not restrict supplier/part ids to Mongo ObjectId only", () => {
    expect(src).not.toMatch(/OBJECT_ID\s*=\s*\/\^\(\[0-9a-fA-F\]\{24\}\)\$\//);
    expect(src).toMatch(/ENTITY_ID/);
    expect(src).toMatch(/a-zA-Z0-9_-\]\{8,64\}/);
  });

  it("applies ENTITY_ID to supplierId, partId, and purchaseOrderLineId", () => {
    expect(src).toMatch(/Matches\(ENTITY_ID\)[\s\S]*supplierId/);
    expect(src).toMatch(/partId\?:/);
    expect(src).toMatch(/purchaseOrderLineId!:/);
  });
});
