import {
  comparableConsumptions,
  evaluateMeterReading,
  meterFractionDigits,
  parseStrictReadingValue
} from "../src/modules/utilities/meter-reading-rules";

describe("meter reading rules", () => {
  const now = new Date("2026-10-15T10:00:00.000Z");

  it("rejects a future reading", () => {
    const result = evaluateMeterReading({ value: 10, readingAt: new Date("2026-10-15T11:00:00.000Z"), now });
    expect(result.ok).toBe(false);
  });

  it("rejects a lower reading without a reset reason", () => {
    const result = evaluateMeterReading({ value: 4, readingAt: now, now, previousValue: 8 });
    expect(result.ok).toBe(false);
  });

  it("accepts a reset with a reason and does not report negative consumption", () => {
    const result = evaluateMeterReading({ value: 4, readingAt: now, now, previousValue: 8, resetReason: "Meter replaced" });
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.consumption).toBeNull();
  });

  it("warns when consumption exceeds three times the recent average", () => {
    const result = evaluateMeterReading({
      value: 40,
      readingAt: now,
      now,
      previousValue: 10,
      recentConsumptions: [2, 2, 2, 2, 2]
    });
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.warning).toContain("three times");
  });

  it("rejects partial numbers, signs, and scientific notation", () => {
    expect(parseStrictReadingValue("12abc", 3).ok).toBe(false);
    expect(parseStrictReadingValue("1e2", 3).ok).toBe(false);
    expect(parseStrictReadingValue("-1", 3).ok).toBe(false);
    expect(parseStrictReadingValue("Infinity", 0).ok).toBe(false);
    expect(parseStrictReadingValue(Number.NaN, 0).ok).toBe(false);
  });

  it("keeps a valid decimal and rejects extra places", () => {
    const accepted = parseStrictReadingValue("12.50", 3);
    expect(accepted).toEqual({ ok: true, value: 12.5, text: "12.50" });
    expect(parseStrictReadingValue("12.5", 0).ok).toBe(false);
    expect(meterFractionDigits("kWh", "ELECTRICITY")).toBe(3);
    expect(meterFractionDigits("pulse", "ELECTRICITY")).toBe(0);
  });

  it("stops consumption samples at a meter reset", () => {
    expect(
      comparableConsumptions([
        { consumption: 9, notes: "" },
        { consumption: 1, notes: "[reset:replaced]" },
        { consumption: 100, notes: "" }
      ])
    ).toEqual([9]);
  });
});
