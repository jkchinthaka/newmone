import { readFileSync } from "fs";
import { join } from "path";

/**
 * MP-003: document global business-key uniqueness that must become tenant-scoped.
 * Does not mutate Prisma schema or Mongo indexes.
 */
describe("MP-003: tenant uniqueness inventory (no schema mutation)", () => {
  const schema = readFileSync(join(__dirname, "../../../prisma/schema.prisma"), "utf8");

  function modelBlock(modelName: string): string {
    const match = schema.match(new RegExp(`model ${modelName} \\{[\\s\\S]*?\\n\\}`));
    expect(match).toBeTruthy();
    return match![0];
  }

  it("flags Asset.assetTag / Vehicle.registrationNo / Vehicle.vin / SparePart.partNumber as global uniques", () => {
    const asset = modelBlock("Asset");
    expect(asset).toMatch(/assetTag\s+String\s+@unique/);
    expect(asset).not.toMatch(/@@unique\(\[tenantId,\s*assetTag\]\)/);

    const vehicle = modelBlock("Vehicle");
    expect(vehicle).toMatch(/registrationNo\s+String\s+@unique/);
    expect(vehicle).toMatch(/vin\s+String\?\s+@unique/);
    expect(vehicle).not.toMatch(/@@unique\(\[tenantId,\s*registrationNo\]\)/);

    const sparePart = modelBlock("SparePart");
    expect(sparePart).toMatch(/partNumber\s+String\s+@unique/);
    expect(sparePart).not.toMatch(/@@unique\(\[tenantId,\s*partNumber\]\)/);
  });

  it("preserves examples of correct tenant-scoped uniqueness", () => {
    expect(modelBlock("Department")).toMatch(/@@unique\(\[tenantId,\s*code\]\)/);
    expect(modelBlock("PurchaseOrder")).toMatch(/@@unique\(\[tenantId,\s*poNumber\]\)/);
  });

  it("keeps platform-global identities that should remain global", () => {
    expect(modelBlock("Tenant")).toMatch(/slug\s+String\s+@unique/);
    expect(modelBlock("User")).toMatch(/email\s+String\s+@unique/);
  });
});
