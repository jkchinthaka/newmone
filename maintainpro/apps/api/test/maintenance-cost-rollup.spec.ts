import { inBusinessDateRange, rollupMaintenanceCost, spreadsheetCell, varianceAgainstEstimate } from "../src/modules/reports/maintenance-cost.rollup";

describe("maintenance cost rollup", () => {
  const start = new Date("2026-09-01T00:00:00.000+05:30");
  const end = new Date("2026-09-30T23:59:59.999+05:30");

  it("matches the single-currency fixture and ignores an open purchase commitment", () => {
    const result = rollupMaintenanceCost({
      parts: [
        { id: "p1", issuedQuantity: 2, returnedQuantity: 1, unitCost: "1000.00", issuedAt: "2026-09-10T00:00:00.000+05:30" }
      ],
      labour: [
        { id: "l1", durationMinutes: 180, labourRateSnapshot: "500.00", endedAt: "2026-09-11T00:00:00.000+05:30" }
      ],
      services: [
        { id: "s1", status: "APPROVED", totalAmount: "2500.00", currency: "LKR", financeApprovedAt: "2026-09-12T00:00:00.000+05:30" }
      ],
      commitments: [{ id: "po1", totalAmount: "7000.00" }]
    });
    expect(result.parts).toBe(1000);
    expect(result.labour).toBe(1500);
    expect(result.services).toBe(2500);
    expect(result.actual).toBe(5000);
    expect(result.commitmentExcluded).toBe(1);
    const variance = varianceAgainstEstimate(result.actualCents, "4000.00", false);
    expect(variance.amount).toBe(1000);
    expect(variance.percent).toBe(25);
  });

  it("does not treat a missing labour rate as zero", () => {
    const result = rollupMaintenanceCost({
      parts: [],
      labour: [{ id: "l2", durationMinutes: 60, labourRateSnapshot: null, endedAt: "2026-09-11T00:00:00.000+05:30" }],
      services: []
    });
    expect(result.labour).toBe(0);
    expect(result.complete).toBe(false);
    expect(result.unvalued).toContain("labour:l2");
  });

  it("keeps an explicit zero rate as zero and flags mixed currency", () => {
    const zero = rollupMaintenanceCost({
      parts: [],
      labour: [{ id: "l3", durationMinutes: 60, labourRateSnapshot: "0.00" }],
      services: []
    });
    expect(zero.complete).toBe(true);
    expect(zero.labour).toBe(0);
    const foreign = rollupMaintenanceCost({
      parts: [],
      labour: [],
      services: [{ id: "s2", status: "APPROVED", totalAmount: "10.00", currency: "USD" }]
    });
    expect(foreign.services).toBe(0);
    expect(foreign.complete).toBe(false);
  });

  it("does not change the total when the same source line is imported again", () => {
    const line = { id: "p1", issuedQuantity: 2, returnedQuantity: 1, unitCost: "1000.00" };
    const once = rollupMaintenanceCost({ parts: [line], labour: [], services: [] });
    const twice = rollupMaintenanceCost({ parts: [line, line], labour: [], services: [] });
    expect(twice.actual).toBe(once.actual);
    expect(twice.actual).toBe(1000);
  });

  it("uses inclusive business-day boundaries", () => {
    expect(inBusinessDateRange("2026-09-30T23:00:00.000+05:30", start, end)).toBe(true);
    expect(inBusinessDateRange("2026-10-01T00:00:00.000+05:30", start, end)).toBe(false);
    expect(varianceAgainstEstimate(100, null, true).percent).toBeNull();
    expect(spreadsheetCell("=1+1")).toBe("'=1+1");
    expect(varianceAgainstEstimate(500000, "0", true).label).toBe("N/A");
  });
});
