import {
  STATUTORY_TYPES,
  daysUntil,
  isStatutoryTypeKey,
  statutoryLabel,
  statutoryState,
  summarizeStates
} from "../src/modules/compliance/statutory-catalog";

describe("statutory catalog", () => {
  const now = new Date("2026-10-31T00:00:00.000Z");
  const inDays = (n: number) => new Date(now.getTime() + n * 24 * 60 * 60 * 1000);

  it("has unique keys and sensible defaults", () => {
    const keys = STATUTORY_TYPES.map((t) => t.key);
    expect(new Set(keys).size).toBe(keys.length);
    for (const type of STATUTORY_TYPES) {
      expect(type.defaultIntervalMonths).toBeGreaterThan(0);
      expect(type.defaultReminderDays).toBeGreaterThan(0);
    }
  });

  it("recognises only listed types", () => {
    expect(isStatutoryTypeKey("BOILER_INSPECTION")).toBe(true);
    expect(isStatutoryTypeKey("INSURANCE")).toBe(false);
    expect(statutoryLabel("LIFT_CERTIFICATION")).toBe("Lift certification");
    expect(statutoryLabel("UNKNOWN")).toBe("UNKNOWN");
  });

  it("classifies valid, due soon and expired", () => {
    expect(statutoryState(inDays(90), 30, now)).toBe("VALID");
    expect(statutoryState(inDays(30), 30, now)).toBe("DUE_SOON");
    expect(statutoryState(inDays(0), 30, now)).toBe("DUE_SOON");
    expect(statutoryState(inDays(-1), 30, now)).toBe("EXPIRED");
    expect(daysUntil(inDays(5), now)).toBe(5);
  });

  it("summarises counts", () => {
    expect(summarizeStates(["VALID", "DUE_SOON", "EXPIRED", "EXPIRED"])).toEqual({
      total: 4,
      valid: 1,
      dueSoon: 1,
      expired: 2
    });
  });

  it("counts calendar days in Sri Lanka, so a one-year certificate has 365 days left", () => {
    const today = new Date("2026-10-31T19:20:00.000Z"); // 01 Nov 2026, 00:50 in Colombo
    const endOfExpiryDay = new Date("2027-11-01T18:29:00.000Z"); // 01 Nov 2027, 23:59 in Colombo
    expect(daysUntil(endOfExpiryDay, today)).toBe(365);
    expect(daysUntil(new Date("2026-11-01T18:29:00.000Z"), today)).toBe(0);
    expect(statutoryState(new Date("2026-11-01T18:29:00.000Z"), 30, today)).toBe("DUE_SOON");
  });
});
