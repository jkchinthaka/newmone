import {
  assertCommonEngineReuse,
  domainsForAssetCategory,
  getDomainProfile,
  MAINTENANCE_DOMAIN_PROFILES
} from "../src/modules/domain-coverage/domain-profiles";

describe("Phase 11 domain coverage", () => {
  it("covers all agreed company domains", () => {
    const keys = MAINTENANCE_DOMAIN_PROFILES.map((d) => d.key);
    for (const required of [
      "PLANT_MACHINERY",
      "MECHANICAL",
      "ELECTRICAL",
      "UTILITIES",
      "HVAC",
      "REFRIGERATION",
      "BUILDING_CIVIL",
      "PLUMBING",
      "WATER_WASTEWATER",
      "FLEET",
      "MATERIAL_HANDLING",
      "FARM_INFRASTRUCTURE",
      "OUTLETS_BRANCHES",
      "FIRE_SAFETY",
      "SECURITY_EQUIPMENT",
      "IT_HARDWARE",
      "LAB_EQUIPMENT",
      "CALIBRATION_EQUIPMENT",
      "KITCHEN_CANTEEN",
      "SOLAR_ENERGY",
      "TOOLS_MOULDS_JIGS",
      "EXTERNAL_INFRASTRUCTURE",
      "OTHER"
    ]) {
      expect(keys).toContain(required);
    }
  });

  it("does not invent global KPIs — fleet vs machinery differ", () => {
    const machinery = getDomainProfile("PLANT_MACHINERY")!;
    const fleet = getDomainProfile("FLEET")!;
    const building = getDomainProfile("BUILDING_CIVIL")!;
    expect(machinery.kpiKeys).toEqual(
      expect.arrayContaining(["MTTR", "MTBF", "AVAILABILITY", "DOWNTIME"])
    );
    expect(fleet.kpiKeys).toEqual(
      expect.arrayContaining(["COST_PER_KM", "FUEL_EFFICIENCY", "SERVICE_COMPLIANCE"])
    );
    expect(building.kpiKeys).toEqual(
      expect.arrayContaining(["BACKLOG_AGE", "CONDITION", "SPEND", "REPEAT_DEFECTS"])
    );
    expect(fleet.kpiKeys).not.toContain("MTBF");
  });

  it("reuses common engine across representative categories", () => {
    for (const category of ["VEHICLE", "MACHINE", "INFRASTRUCTURE", "TOOL", "COLD_ROOM"]) {
      const domains = domainsForAssetCategory(category);
      expect(domains.length).toBeGreaterThan(0);
      for (const d of domains) {
        const engine = assertCommonEngineReuse(d);
        expect(engine.duplicateEngine).toBe(false);
        expect(engine.usesSharedWo).toBe(true);
        expect(engine.usesSharedCompliance).toBe(true);
      }
    }
  });

  it("scopes farm to infrastructure and IT to hardware", () => {
    expect(getDomainProfile("FARM_INFRASTRUCTURE")!.notes).toMatch(/not crop/i);
    expect(getDomainProfile("IT_HARDWARE")!.notes).toMatch(/not password/i);
    expect(getDomainProfile("OUTLETS_BRANCHES")!.notes).toMatch(/Site/i);
    expect(getDomainProfile("REFRIGERATION")!.notes).toMatch(/OWNER REQUIRED/i);
  });
});
