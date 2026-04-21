import { calculateBillTotal, calculateConsumption } from "../src/common/utils/utility-calculations";

describe("utility calculations", () => {
  it("calculates consumption from consecutive readings", () => {
    expect(calculateConsumption(1250, 1000)).toBe(250);
  });

  it("throws when meter reading decreases", () => {
    expect(() => calculateConsumption(900, 1000)).toThrow("Current reading cannot be less than previous reading");
  });

  it("calculates bill total using formula", () => {
    expect(calculateBillTotal(100, 0.5, 10, 2)).toBe(62);
  });
});
