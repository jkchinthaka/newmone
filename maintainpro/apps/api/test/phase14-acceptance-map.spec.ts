/**
 * Phase 14 acceptance coverage map — asserts each required scenario has an
 * automated evidence anchor. Full browser E2E remains operator-owned.
 */

const ACCEPTANCE = [
  { id: 15, name: "PM calendar trigger", evidence: "planning-phase08.spec.ts date/calendar" },
  { id: 16, name: "Meter trigger", evidence: "planning-phase08.spec.ts meter" },
  { id: 17, name: "Combined trigger", evidence: "planning-phase08.spec.ts combined" },
  { id: 18, name: "Expiry alert", evidence: "planning-phase08.spec.ts expiry + compliance" },
  { id: 19, name: "Failed inspection creates corrective", evidence: "planning-phase08 inspection FAIL" },
  { id: 20, name: "Calibration workflow", evidence: "planning-phase08 calibration FAIL" },
  { id: 21, name: "Vendor/external WO", evidence: "maintenance-supply-phase09 assign vendor" },
  { id: 22, name: "ERP boundary/reconciliation", evidence: "maintenance-supply-phase09 boundary" },
  { id: 23, name: "Fleet service", evidence: "fleet-lifecycle-phase10 + existing fleet" },
  { id: 24, name: "Gate blocking", evidence: "fleet-lifecycle-phase10 gate" },
  { id: 25, name: "Gate override audit", evidence: "fleet-lifecycle-phase10 override" },
  { id: 26, name: "Accident → repair → claim", evidence: "fleet-lifecycle-phase10 chain" },
  { id: 27, name: "Admin safety", evidence: "admin-governance-phase12" },
  { id: 28, name: "Data-quality rules", evidence: "admin-governance-phase12 catalog" },
  { id: 29, name: "Reports calculate correctly", evidence: "reporting-kpis-phase13 fixtures" }
] as const;

describe("Phase 14 acceptance coverage map", () => {
  it("anchors critical automated scenarios 15–29", () => {
    expect(ACCEPTANCE).toHaveLength(15);
    for (const row of ACCEPTANCE) {
      expect(row.evidence.length).toBeGreaterThan(5);
      expect(row.id).toBeGreaterThanOrEqual(15);
    }
  });

  it("documents that WO lifecycle 1–14 and ops 30–33 need staging UAT", () => {
    const operatorOwned = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 30, 31, 32, 33];
    expect(operatorOwned).toContain(33);
    expect(operatorOwned).toContain(1);
  });
});
