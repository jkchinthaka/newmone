import {
  computeAvailability,
  computeMtbf,
  computeMttr,
  computePmCompliance,
  KPI_DEFINITIONS,
  KPI_FORMULA_VERSION,
  getKpiDefinition
} from "../src/modules/reporting-kpis/kpi-definitions";
import { resolveRoleHome, ROLE_HOME_PROFILES } from "../src/modules/reporting-kpis/role-home";

describe("Phase 13 KPI formulas", () => {
  it("keeps a versioned definition catalog", () => {
    expect(KPI_FORMULA_VERSION).toMatch(/^2026-/);
    expect(KPI_DEFINITIONS.length).toBeGreaterThan(8);
    expect(getKpiDefinition("MTTR")?.formula).toContain("repairDurationHours");
  });

  it("computes MTTR/MTBF/availability/PM compliance from fixtures", () => {
    expect(computeMttr([2, 4, 6])).toBe(4);
    expect(computeMtbf(1000, 5)).toBe(200);
    expect(computeAvailability(100, 10)).toBeCloseTo(0.9);
    expect(computePmCompliance(8, 10)).toBeCloseTo(0.8);
    expect(computeMttr([])).toBeNull();
    expect(computeAvailability(0, 1)).toBeNull();
  });

  it("separates domain KPI sets", () => {
    const fleet = KPI_DEFINITIONS.filter((k) => k.domain === "FLEET").map((k) => k.key);
    const machinery = KPI_DEFINITIONS.filter((k) => k.domain === "MACHINERY").map((k) => k.key);
    expect(fleet).toEqual(expect.arrayContaining(["COST_PER_KM", "FUEL_EFFICIENCY"]));
    expect(machinery).toEqual(expect.arrayContaining(["MTTR", "MTBF", "AVAILABILITY"]));
    expect(fleet).not.toContain("MTBF");
  });

  it("maps role home cards", () => {
    expect(resolveRoleHome("TECHNICIAN").cards.map((c) => c.id)).toContain("my-jobs");
    expect(resolveRoleHome("SUPERVISOR").cards.map((c) => c.id)).toContain("pm-due");
    expect(resolveRoleHome("FLEET_MANAGER").cards.map((c) => c.id)).toContain("doc-expiry");
    expect(ROLE_HOME_PROFILES.map((p) => p.roleKey)).toEqual(
      expect.arrayContaining(["REQUESTER", "TECHNICIAN", "SUPERVISOR", "FLEET", "MANAGER"])
    );
  });
});
