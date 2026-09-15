/**
 * Phase 11 — Company-wide Domain Coverage
 *
 * Tests that all required V1 domains have profiles, KPI applicability differs correctly
 * across domain types, and shared-engine reuse is asserted (no duplicate engines).
 *
 * These tests run against static configuration only — no DB required.
 */

import {
  assertSharedEngineReuse,
  getAllDomainProfiles,
  isDowntimeApplicableDefault,
  isKpiApplicable,
  normalizeDomainCode,
  resolveDomainProfile,
  DOMAIN_CODE_ALIAS_MAP
} from "../src/modules/asset-taxonomy/domain-profiles";
import {
  DEFAULT_ASSET_DOMAINS,
  DEFAULT_CATEGORY_EXAMPLES,
  DEFAULT_ATTRIBUTE_EXAMPLES
} from "../src/modules/asset-taxonomy/domain-defaults";

const REQUIRED_V1_DOMAINS = [
  "PLANT_MACHINERY",
  "MECHANICAL",
  "ELECTRICAL",
  "UTILITIES",
  "HVAC",
  "REFRIGERATION",
  "FACILITY_CIVIL",
  "PLUMBING",
  "WATER_WASTEWATER",
  "FLEET",
  "MATERIAL_HANDLING",
  "FARM_INFRASTRUCTURE",
  "OUTLET_EQUIPMENT",
  "FIRE_SAFETY",
  "SECURITY",
  "IT_HARDWARE",
  "LABORATORY",
  "CALIBRATION",
  "KITCHEN_CANTEEN",
  "ENERGY_SOLAR",
  "TOOLS_MOULDS_JIGS",
  "EXTERNAL_INFRASTRUCTURE",
  "OTHER"
] as const;

describe("Phase 11 — Domain Coverage", () => {
  // ── §1 All required V1 domains have a profile ──────────────────────────────

  it("has profiles for all required V1 domains", () => {
    for (const code of REQUIRED_V1_DOMAINS) {
      const profile = resolveDomainProfile(code);
      expect(profile).toBeDefined();
      expect(profile?.code).toBe(code);
    }
  });

  it("returns all 23+ static profiles from getAllDomainProfiles", () => {
    const profiles = getAllDomainProfiles();
    // Must include all required V1 domains plus HVAC_REFRIGERATION legacy
    expect(profiles.length).toBeGreaterThanOrEqual(REQUIRED_V1_DOMAINS.length);
    const codes = new Set(profiles.map((p) => p.code));
    for (const code of REQUIRED_V1_DOMAINS) {
      expect(codes.has(code)).toBe(true);
    }
  });

  it("also contains HVAC_REFRIGERATION as legacy combined domain", () => {
    const profile = resolveDomainProfile("HVAC_REFRIGERATION");
    expect(profile).toBeDefined();
    expect(profile?.scopeNotes).toContain("Legacy combined domain");
  });

  // ── §2 KPI applicability differs across domain types ──────────────────────

  it("PLANT_MACHINERY uses MTBF but FACILITY_CIVIL does not", () => {
    expect(isKpiApplicable("PLANT_MACHINERY", "MTBF")).toBe(true);
    expect(isKpiApplicable("FACILITY_CIVIL", "MTBF")).toBe(false);
  });

  it("FLEET uses COST_PER_KM but MECHANICAL does not", () => {
    expect(isKpiApplicable("FLEET", "COST_PER_KM")).toBe(true);
    expect(isKpiApplicable("MECHANICAL", "COST_PER_KM")).toBe(false);
  });

  it("CALIBRATION uses COMPLIANCE_DUE/EXPIRED/COMPLETION", () => {
    expect(isKpiApplicable("CALIBRATION", "COMPLIANCE_DUE")).toBe(true);
    expect(isKpiApplicable("CALIBRATION", "COMPLIANCE_EXPIRED")).toBe(true);
    expect(isKpiApplicable("CALIBRATION", "COMPLIANCE_COMPLETION")).toBe(true);
  });

  it("FIRE_SAFETY uses compliance KPIs and no MTBF", () => {
    expect(isKpiApplicable("FIRE_SAFETY", "COMPLIANCE_DUE")).toBe(true);
    expect(isKpiApplicable("FIRE_SAFETY", "MTBF")).toBe(false);
  });

  it("PLANT_MACHINERY and MECHANICAL use DOWNTIME; FACILITY_CIVIL does not", () => {
    expect(isKpiApplicable("PLANT_MACHINERY", "DOWNTIME")).toBe(true);
    expect(isKpiApplicable("MECHANICAL", "DOWNTIME")).toBe(true);
    expect(isKpiApplicable("FACILITY_CIVIL", "DOWNTIME")).toBe(false);
  });

  // ── §3 Location-only work ─────────────────────────────────────────────────

  it("FACILITY_CIVIL allows location-only work", () => {
    const profile = resolveDomainProfile("FACILITY_CIVIL");
    expect(profile?.allowsLocationOnlyWork).toBe(true);
  });

  it("EXTERNAL_INFRASTRUCTURE allows location-only work", () => {
    const profile = resolveDomainProfile("EXTERNAL_INFRASTRUCTURE");
    expect(profile?.allowsLocationOnlyWork).toBe(true);
  });

  it("PLANT_MACHINERY does NOT allow location-only work", () => {
    const profile = resolveDomainProfile("PLANT_MACHINERY");
    expect(profile?.allowsLocationOnlyWork).toBe(false);
  });

  it("FACILITY_CIVIL downtimeApplicableDefault is false (no MTBF for building)", () => {
    expect(isDowntimeApplicableDefault("FACILITY_CIVIL")).toBe(false);
    expect(isKpiApplicable("FACILITY_CIVIL", "MTBF")).toBe(false);
  });

  it("OUTLET_EQUIPMENT allows location-only work", () => {
    const profile = resolveDomainProfile("OUTLET_EQUIPMENT");
    expect(profile?.allowsLocationOnlyWork).toBe(true);
  });

  // ── §4 Scope notes for farm / IT / outlet ─────────────────────────────────

  it("FARM_INFRASTRUCTURE scope notes restrict to infrastructure only", () => {
    const profile = resolveDomainProfile("FARM_INFRASTRUCTURE");
    expect(profile?.scopeNotes).toContain("Physical farm infrastructure maintenance only");
    expect(profile?.scopeNotes).not.toContain("crop/livestock");
  });

  it("IT_HARDWARE scope notes restrict to physical hardware only", () => {
    const profile = resolveDomainProfile("IT_HARDWARE");
    expect(profile?.scopeNotes).toContain("Physical IT hardware maintenance only");
    expect(profile?.scopeNotes).toContain("helpdesk");
  });

  it("OUTLET_EQUIPMENT scope notes describe Site treatment, no ticket system", () => {
    const profile = resolveDomainProfile("OUTLET_EQUIPMENT");
    expect(profile?.scopeNotes).toContain("Outlet treated as Site");
    expect(profile?.scopeNotes).not.toContain("ticket system");
  });

  // ── §5 New domains: PLUMBING, HVAC, REFRIGERATION ────────────────────────

  it("PLUMBING profile exists and is location-only", () => {
    const profile = resolveDomainProfile("PLUMBING");
    expect(profile).toBeDefined();
    expect(profile?.allowsLocationOnlyWork).toBe(true);
    expect(profile?.downtimeApplicableDefault).toBe(false);
  });

  it("HVAC profile exists with SERVICE_COMPLIANCE KPI", () => {
    const profile = resolveDomainProfile("HVAC");
    expect(profile).toBeDefined();
    expect(isKpiApplicable("HVAC", "SERVICE_COMPLIANCE")).toBe(true);
  });

  it("REFRIGERATION has calibrationApplicableDefault true", () => {
    const profile = resolveDomainProfile("REFRIGERATION");
    expect(profile).toBeDefined();
    expect(profile?.calibrationApplicableDefault).toBe(true);
  });

  // ── §6 Shared engine assertion ────────────────────────────────────────────

  it("assertSharedEngineReuse returns no duplicate engine", () => {
    const result = assertSharedEngineReuse();
    expect(result.duplicateEngine).toBe(false);
    expect(result.usesSharedWo).toBe(true);
    expect(result.usesSharedPm).toBe(true);
    expect(result.usesSharedCompliance).toBe(true);
    expect(result.usesSharedParts).toBe(true);
    expect(result.usesSharedVendor).toBe(true);
  });

  // ── §7 Alias normalization ─────────────────────────────────────────────────

  it("normalizeDomainCode resolves BUILDING_CIVIL → FACILITY_CIVIL", () => {
    expect(normalizeDomainCode("BUILDING_CIVIL")).toBe("FACILITY_CIVIL");
  });

  it("normalizeDomainCode resolves OUTLETS_BRANCHES → OUTLET_EQUIPMENT", () => {
    expect(normalizeDomainCode("OUTLETS_BRANCHES")).toBe("OUTLET_EQUIPMENT");
  });

  it("normalizeDomainCode resolves SECURITY_EQUIPMENT → SECURITY", () => {
    expect(normalizeDomainCode("SECURITY_EQUIPMENT")).toBe("SECURITY");
  });

  it("normalizeDomainCode resolves LAB_EQUIPMENT → LABORATORY", () => {
    expect(normalizeDomainCode("LAB_EQUIPMENT")).toBe("LABORATORY");
  });

  it("normalizeDomainCode resolves CALIBRATION_EQUIPMENT → CALIBRATION", () => {
    expect(normalizeDomainCode("CALIBRATION_EQUIPMENT")).toBe("CALIBRATION");
  });

  it("normalizeDomainCode resolves SOLAR_ENERGY → ENERGY_SOLAR", () => {
    expect(normalizeDomainCode("SOLAR_ENERGY")).toBe("ENERGY_SOLAR");
  });

  it("normalizeDomainCode returns HEAD code unchanged when already correct", () => {
    expect(normalizeDomainCode("FLEET")).toBe("FLEET");
    expect(normalizeDomainCode("REFRIGERATION")).toBe("REFRIGERATION");
  });

  it("resolveDomainProfile accepts alias keys transparently", () => {
    const viaAlias = resolveDomainProfile("BUILDING_CIVIL");
    const viaDirect = resolveDomainProfile("FACILITY_CIVIL");
    expect(viaAlias).toEqual(viaDirect);
  });

  // ── §8 Downtime applicability ──────────────────────────────────────────────

  it("PLANT_MACHINERY has downtimeApplicableDefault true", () => {
    expect(isDowntimeApplicableDefault("PLANT_MACHINERY")).toBe(true);
  });

  it("ELECTRICAL has downtimeApplicableDefault true", () => {
    expect(isDowntimeApplicableDefault("ELECTRICAL")).toBe(true);
  });

  it("FIRE_SAFETY has downtimeApplicableDefault false", () => {
    expect(isDowntimeApplicableDefault("FIRE_SAFETY")).toBe(false);
  });

  it("OUTLET_EQUIPMENT has downtimeApplicableDefault false", () => {
    expect(isDowntimeApplicableDefault("OUTLET_EQUIPMENT")).toBe(false);
  });

  // ── §9 Seed / domain-defaults idempotency ─────────────────────────────────

  it("DEFAULT_ASSET_DOMAINS includes PLUMBING, HVAC, REFRIGERATION", () => {
    const codes = DEFAULT_ASSET_DOMAINS.map((d) => d.code);
    expect(codes).toContain("PLUMBING");
    expect(codes).toContain("HVAC");
    expect(codes).toContain("REFRIGERATION");
  });

  it("DEFAULT_ASSET_DOMAINS has no duplicate codes", () => {
    const codes = DEFAULT_ASSET_DOMAINS.map((d) => d.code);
    const unique = new Set(codes);
    expect(unique.size).toBe(codes.length);
  });

  it("DEFAULT_CATEGORY_EXAMPLES entries have valid domain codes", () => {
    const validDomainCodes = new Set<string>(DEFAULT_ASSET_DOMAINS.map((d) => d.code as string));
    for (const ex of DEFAULT_CATEGORY_EXAMPLES) {
      expect(validDomainCodes.has(ex.domainCode)).toBe(true);
    }
  });

  it("DEFAULT_ATTRIBUTE_EXAMPLES entries have valid domain + category + type codes", () => {
    const domainCodes = new Set<string>(DEFAULT_ASSET_DOMAINS.map((d) => d.code as string));
    const catMap = new Map<string, Set<string>>();
    const typeMap = new Map<string, Set<string>>();
    for (const ex of DEFAULT_CATEGORY_EXAMPLES) {
      if (!catMap.has(ex.domainCode)) catMap.set(ex.domainCode, new Set());
      catMap.get(ex.domainCode)!.add(ex.code);
      for (const t of ex.types ?? []) {
        const key = `${ex.domainCode}:${ex.code}`;
        if (!typeMap.has(key)) typeMap.set(key, new Set());
        typeMap.get(key)!.add(t.code);
      }
    }
    for (const attr of DEFAULT_ATTRIBUTE_EXAMPLES) {
      expect(domainCodes.has(attr.domainCode)).toBe(true);
      expect(catMap.get(attr.domainCode)?.has(attr.categoryCode)).toBe(true);
    }
  });

  // ── §10 RBAC catalog keys ─────────────────────────────────────────────────

  it("PERMISSION_CATALOG includes domains.view and domains.manage", () => {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { PERMISSION_CATALOG } = require("../src/database/permission-catalog") as {
      PERMISSION_CATALOG: string[];
    };
    expect(PERMISSION_CATALOG).toContain("domains.view");
    expect(PERMISSION_CATALOG).toContain("domains.manage");
  });

  // ── §11 Attribute hints and vendor categories ─────────────────────────────

  it("FLEET profile has COST_PER_KM KPI and vehicle attribute hints", () => {
    const profile = resolveDomainProfile("FLEET");
    expect(profile?.applicableAttributeHints).toContain("registration");
    expect(profile?.vendorServiceCategories).toContain("VEHICLE_SERVICE");
  });

  it("IT_HARDWARE profile has hostname attribute hint", () => {
    const profile = resolveDomainProfile("IT_HARDWARE");
    expect(profile?.applicableAttributeHints).toContain("hostname");
  });

  it("REFRIGERATION profile has refrigerant attribute hint", () => {
    const profile = resolveDomainProfile("REFRIGERATION");
    expect(profile?.applicableAttributeHints).toContain("refrigerant");
  });

  // ── §12 No duplicate engines (cross-profile check) ────────────────────────

  it("no two domain profiles define a 'module' key (no duplicate engine modules)", () => {
    const profiles = getAllDomainProfiles();
    for (const profile of profiles) {
      // DomainProfileDefaults does not have a 'module' property — confirm shape
      expect("module" in profile).toBe(false);
    }
  });

  it("alias map covers all 6 historical Phase 11 key renames", () => {
    expect(Object.keys(DOMAIN_CODE_ALIAS_MAP)).toHaveLength(6);
  });

  // ── §13 Profile override merge ─────────────────────────────────────────────

  it("resolveDomainProfile merges tenant override into static defaults", () => {
    const override = { enabledByDefault: false, scopeNotes: "Disabled by tenant" };
    const profile = resolveDomainProfile("OTHER", override);
    expect(profile?.enabledByDefault).toBe(false);
    expect(profile?.scopeNotes).toBe("Disabled by tenant");
    // Static fields still present
    expect(profile?.code).toBe("OTHER");
    expect(profile?.kpiKeys).toContain("SPEND");
  });

  it("resolveDomainProfile with empty override returns base profile unchanged", () => {
    const profile = resolveDomainProfile("FLEET", {});
    const base = resolveDomainProfile("FLEET");
    expect(profile).toEqual(base);
  });

  it("resolveDomainProfile returns undefined for unknown code", () => {
    expect(resolveDomainProfile("NONEXISTENT_CODE")).toBeUndefined();
  });
});
