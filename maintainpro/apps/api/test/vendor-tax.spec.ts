import { deriveTaxRatePercent, resolveVendorTaxLine } from "../src/common/utils/vendor-tax";

describe("vendor tax rate", () => {
  it("computes 18 percent of 10000.00 as tax 1800.00 and total 11800.00", () => {
    const result = resolveVendorTaxLine(10_000, { taxRatePercent: 18, taxAmount: 1 });
    expect(result).toEqual({
      ok: true,
      line: {
        taxRatePercent: 18,
        taxAmount: 1800,
        totalAmount: 11800,
        displayRatePercent: 18
      }
    });
  });

  it("rounds half-up to 2 decimal places", () => {
    const result = resolveVendorTaxLine(10.01, { taxRatePercent: 18 });
    expect(result.ok && result.line.taxAmount).toBe(1.8);
    expect(result.ok && result.line.totalAmount).toBe(11.81);
  });

  it("rejects a rate below 0 or above 100", () => {
    expect(resolveVendorTaxLine(100, { taxRatePercent: -1 }).ok).toBe(false);
    expect(resolveVendorTaxLine(100, { taxRatePercent: 100.01 }).ok).toBe(false);
    expect(resolveVendorTaxLine(100, { taxRatePercent: 18.125 }).ok).toBe(false);
  });

  it("keeps a legacy tax amount and derives the display rate without a stored rate", () => {
    const result = resolveVendorTaxLine(10_000, { taxAmount: 1500 });
    expect(result).toEqual({
      ok: true,
      line: {
        taxRatePercent: null,
        taxAmount: 1500,
        totalAmount: 11500,
        displayRatePercent: 15
      }
    });
    expect(deriveTaxRatePercent(10_000, 1500)).toBe(15);
  });
});
