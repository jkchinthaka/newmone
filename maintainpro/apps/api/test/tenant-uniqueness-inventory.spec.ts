import { readFileSync } from "fs";
import { join } from "path";

/**
 * MP-003: tenant-scoped business-key uniqueness — schema and migration invariants.
 *
 * This file is intentionally DB-free (this test suite has no live-database dependency by
 * convention). It guards the STATIC design: schema.prisma declares the right compound unique
 * constraints and no lingering global ones, and the forward migration exists and performs the
 * expected DDL. For LIVE behavioral coverage (cross-tenant reuse succeeds, same-tenant reuse is
 * rejected, tenant lookup isolation, work-order number generation, ERP part-number isolation),
 * see scripts/mp003-two-tenant-acceptance.mjs (`npm run test:mp003-two-tenant-acceptance`) —
 * that script exercises a real SQL Server connection with two throwaway tenants and cannot run
 * as a Jest unit test in this suite.
 */
describe("MP-003: tenant-scoped business-key uniqueness (schema invariants)", () => {
  const schema = readFileSync(join(__dirname, "../../../prisma/schema.prisma"), "utf8");

  function modelBlock(modelName: string): string {
    const match = schema.match(new RegExp(`model ${modelName} \\{[\\s\\S]*?\\n\\}`));
    expect(match).toBeTruthy();
    return match![0];
  }

  it("Asset.assetTag is tenant-scoped, not global", () => {
    const asset = modelBlock("Asset");
    expect(asset).toMatch(/@@unique\(\[tenantId,\s*assetTag\]\)/);
    expect(asset).not.toMatch(/assetTag\s+String\s+@unique/);
    expect(asset).toMatch(/tenantId\s+String\s+@db\.NVarChar\(36\)/);
    expect(asset).not.toMatch(/tenantId\s+String\?\s+@db\.NVarChar\(36\)/);
  });

  it("Vehicle.registrationNo is tenant-scoped, not global", () => {
    const vehicle = modelBlock("Vehicle");
    expect(vehicle).toMatch(/@@unique\(\[tenantId,\s*registrationNo\]\)/);
    expect(vehicle).not.toMatch(/registrationNo\s+String\s+@unique/);
  });

  it("Vehicle.vin is tenant-scoped (via migration-only filtered index), not global", () => {
    // vin cannot carry Prisma's @unique (Prisma has no partial/filtered-unique syntax —
    // prisma/prisma#3387), so its tenant-scoped uniqueness is asserted against the migration
    // SQL instead of schema.prisma — see the "MP-003 migration" describe block below.
    const vehicle = modelBlock("Vehicle");
    expect(vehicle).not.toMatch(/vin\s+String\?\s+@unique/);
  });

  it("Driver.licenseNumber is tenant-scoped, not global", () => {
    const driver = modelBlock("Driver");
    expect(driver).toMatch(/@@unique\(\[tenantId,\s*licenseNumber\]\)/);
    expect(driver).not.toMatch(/licenseNumber\s+String\s+@unique/);
  });

  it("WorkOrder.woNumber is tenant-scoped, not global", () => {
    const workOrder = modelBlock("WorkOrder");
    expect(workOrder).toMatch(/@@unique\(\[tenantId,\s*woNumber\]\)/);
    expect(workOrder).not.toMatch(/woNumber\s+String\s+@unique/);
  });

  it("SparePart.partNumber is tenant-scoped, not global", () => {
    const sparePart = modelBlock("SparePart");
    expect(sparePart).toMatch(/@@unique\(\[tenantId,\s*partNumber\]\)/);
    expect(sparePart).not.toMatch(/partNumber\s+String\s+@unique/);
  });

  it("UtilityMeter.meterNumber is tenant-scoped, not global", () => {
    const meter = modelBlock("UtilityMeter");
    expect(meter).toMatch(/@@unique\(\[tenantId,\s*meterNumber\]\)/);
    expect(meter).not.toMatch(/meterNumber\s+String\s+@unique/);
  });

  it("AccidentReport.reportNumber / InsuranceClaim.claimNumber / TrafficFine.fineNumber are tenant-scoped", () => {
    const accident = modelBlock("AccidentReport");
    expect(accident).toMatch(/@@unique\(\[tenantId,\s*reportNumber\]\)/);
    expect(accident).not.toMatch(/reportNumber\s+String\s+@unique/);

    const claim = modelBlock("InsuranceClaim");
    expect(claim).toMatch(/@@unique\(\[tenantId,\s*claimNumber\]\)/);
    expect(claim).not.toMatch(/claimNumber\s+String\s+@unique/);

    const fine = modelBlock("TrafficFine");
    expect(fine).toMatch(/@@unique\(\[tenantId,\s*fineNumber\]\)/);
    expect(fine).not.toMatch(/fineNumber\s+String\s+@unique/);
  });

  it("all nine migrated models require tenantId (not optional)", () => {
    for (const model of [
      "Asset",
      "Vehicle",
      "Driver",
      "WorkOrder",
      "SparePart",
      "UtilityMeter",
      "AccidentReport",
      "InsuranceClaim",
      "TrafficFine"
    ]) {
      const block = modelBlock(model);
      expect(block).not.toMatch(/tenantId\s+String\?/);
      expect(block).toMatch(/tenant\s+Tenant\s+@relation/);
      expect(block).not.toMatch(/tenant\s+Tenant\?\s+@relation/);
    }
  });

  it("CleaningLocation.qrCode is deliberately kept global (product decision, documented)", () => {
    const cleaningLocation = modelBlock("CleaningLocation");
    expect(cleaningLocation).toMatch(/qrCode\s+String\s+@unique/);
    expect(cleaningLocation).not.toMatch(/@@unique\(\[tenantId,\s*qrCode\]\)/);
    expect(cleaningLocation).toMatch(/KEPT GLOBAL/);
  });

  it("preserves examples of correct tenant-scoped uniqueness predating this migration", () => {
    expect(modelBlock("Department")).toMatch(/@@unique\(\[tenantId,\s*code\]\)/);
    expect(modelBlock("PurchaseOrder")).toMatch(/@@unique\(\[tenantId,\s*poNumber\]\)/);
  });

  it("keeps platform-global identities that should remain global", () => {
    expect(modelBlock("Tenant")).toMatch(/slug\s+String\s+@unique/);
    expect(modelBlock("User")).toMatch(/email\s+String\s+@unique/);
  });
});

describe("MP-003: forward migration invariants", () => {
  const migrationPath = join(
    __dirname,
    "../../../prisma/migrations/20260917120000_mp003_tenant_scoped_business_keys/migration.sql"
  );
  const migration = readFileSync(migrationPath, "utf8");

  it("drops every old global unique constraint this migration replaces", () => {
    for (const constraint of [
      "Asset_assetTag_key",
      "Vehicle_registrationNo_key",
      "Vehicle_vin_key",
      "Driver_licenseNumber_key",
      "WorkOrder_woNumber_key",
      "SparePart_partNumber_key",
      "UtilityMeter_meterNumber_key",
      "AccidentReport_reportNumber_key",
      "InsuranceClaim_claimNumber_key",
      "TrafficFine_fineNumber_key"
    ]) {
      expect(migration).toMatch(new RegExp(constraint));
    }
  });

  it("creates the new tenant-scoped compound unique constraints", () => {
    for (const constraint of [
      "Asset_tenantId_assetTag_key",
      "Vehicle_tenantId_registrationNo_key",
      "Vehicle_tenantId_vin_key",
      "Driver_tenantId_licenseNumber_key",
      "WorkOrder_tenantId_woNumber_key",
      "SparePart_tenantId_partNumber_key",
      "UtilityMeter_tenantId_meterNumber_key",
      "AccidentReport_tenantId_reportNumber_key",
      "InsuranceClaim_tenantId_claimNumber_key",
      "TrafficFine_tenantId_fineNumber_key"
    ]) {
      expect(migration).toMatch(new RegExp(constraint));
    }
  });

  it("Vehicle.vin uniqueness is a filtered index scoped to (tenantId, vin) WHERE vin IS NOT NULL", () => {
    expect(migration).toMatch(
      /CREATE UNIQUE NONCLUSTERED INDEX \[Vehicle_tenantId_vin_key\] ON \[dbo\]\.\[Vehicle\]\(\[tenantId\], \[vin\]\) WHERE \[vin\] IS NOT NULL/
    );
  });

  it("makes tenantId NOT NULL on all nine migrated tables", () => {
    for (const table of [
      "Asset",
      "Vehicle",
      "Driver",
      "WorkOrder",
      "SparePart",
      "UtilityMeter",
      "AccidentReport",
      "InsuranceClaim",
      "TrafficFine"
    ]) {
      expect(migration).toMatch(
        new RegExp(`ALTER TABLE \\[dbo\\]\\.\\[${table}\\] ALTER COLUMN \\[tenantId\\] NVARCHAR\\(36\\) NOT NULL`)
      );
    }
  });

  it("guards every DROP CONSTRAINT with an existence check (safe against partial re-runs)", () => {
    const dropConstraintLines = migration.match(/ALTER TABLE .* DROP CONSTRAINT .*/g) ?? [];
    expect(dropConstraintLines.length).toBeGreaterThan(0);
    for (const line of dropConstraintLines) {
      const idx = migration.indexOf(line);
      const precedingLine = migration.slice(0, idx).trimEnd().split("\n").pop() ?? "";
      expect(precedingLine).toMatch(/IF EXISTS/);
    }
  });
});

describe("MP-003: application code no longer performs bare lookups on migrated business keys", () => {
  const root = join(__dirname, "../../..");

  it("seed.ts uses compound selectors for upserts on migrated models", () => {
    const seed = readFileSync(join(root, "apps/api/src/database/seed.ts"), "utf8");
    expect(seed).toMatch(/tenantId_assetTag:/);
    expect(seed).toMatch(/tenantId_registrationNo:/);
    expect(seed).toMatch(/tenantId_partNumber:/);
    expect(seed).toMatch(/tenantId_woNumber:/);
    expect(seed).toMatch(/tenantId_meterNumber:/);
  });

  it("InventoryService.createPart's duplicate check is tenant-scoped (already was — regression guard)", () => {
    const inventoryService = readFileSync(
      join(root, "apps/api/src/modules/inventory/inventory.service.ts"),
      "utf8"
    );
    expect(inventoryService).toMatch(/partNumber:\s*data\.partNumber,\s*\n\s*tenantId/);
  });

  it("WorkOrdersService.nextWoNumber scopes its latest-number lookup by tenantId", () => {
    const src = readFileSync(join(root, "apps/api/src/modules/work-orders/work-orders.service.ts"), "utf8");
    expect(src).toMatch(/nextWoNumber[\s\S]{0,300}where:\s*\{\s*\n\s*tenantId/);
    expect(src).toMatch(/error\.code === "P2002"/);
  });

  it("Accident/InsuranceClaim/TrafficFine/PredictiveAI work order number generators scope their count by tenantId and retry on conflict", () => {
    const files = [
      "apps/api/src/modules/accidents/accidents.service.ts",
      "apps/api/src/modules/insurance-claims/insurance-claims.service.ts",
      "apps/api/src/modules/traffic-fines/traffic-fines.service.ts",
      "apps/api/src/modules/predictive-ai/predictive-ai.service.ts"
    ];
    for (const file of files) {
      const src = readFileSync(join(root, file), "utf8");
      // Every generator's count() call must be scoped by tenantId, and every create() using
      // the generated number must retry on P2002 (concurrency safety within a tenant).
      expect(src).toMatch(/\.count\(\{\s*\n\s*where:\s*\{\s*\n\s*tenantId/);
      expect(src).toMatch(/error\.code === "P2002"/);
    }
  });
});
