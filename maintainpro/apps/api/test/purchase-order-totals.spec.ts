import { calculatePurchaseOrderTotals, clientTotalMismatch, roundMoney } from "../src/modules/inventory/procurement-money.util";

describe("purchase-order-totals", () => {
  it("rounds money to 2 decimals", () => {
    expect(roundMoney(10.005)).toBe(10.01);
    expect(roundMoney(10.004)).toBe(10);
  });

  it("calculates server line and header totals", () => {
    const { lineTotals, headerTotal } = calculatePurchaseOrderTotals([
      { quantity: 2, unitCost: 10.125 },
      { quantity: 1, unitCost: 5.1 }
    ]);
    expect(lineTotals).toEqual([20.25, 5.1]);
    expect(headerTotal).toBe(25.35);
  });

  it("flags client total mismatches beyond 0.009", () => {
    expect(clientTotalMismatch(25.35, 25.35)).toBe(false);
    expect(clientTotalMismatch(25.35, 25.354)).toBe(false);
    expect(clientTotalMismatch(25.35, 25.37)).toBe(true);
  });
});