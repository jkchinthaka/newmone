export type VendorTaxLine = {
  taxRatePercent: number | null;
  taxAmount: number;
  totalAmount: number;
  displayRatePercent: number | null;
};

export function roundMoney(value: number) {
  if (!Number.isFinite(value)) {
    throw new Error("Amount must be a finite number.");
  }
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

export function parseTaxRatePercent(raw: unknown): { ok: true; rate: number } | { ok: false; message: string } {
  if (typeof raw === "number") {
    if (!Number.isFinite(raw)) {
      return { ok: false, message: "Tax rate must be a number from 0 to 100 with at most 2 decimal places." };
    }
    if (Math.abs(raw * 100 - Math.round(raw * 100)) > 1e-8) {
      return { ok: false, message: "Tax rate must be a number from 0 to 100 with at most 2 decimal places." };
    }
    return validateRate(roundMoney(raw));
  }
  if (typeof raw !== "string") {
    return { ok: false, message: "Tax rate must be a number from 0 to 100 with at most 2 decimal places." };
  }
  const text = raw.trim();
  if (!/^\d{1,3}(\.\d{1,2})?$/.test(text)) {
    return { ok: false, message: "Tax rate must be a number from 0 to 100 with at most 2 decimal places." };
  }
  return validateRate(Number(text));
}

function validateRate(rate: number): { ok: true; rate: number } | { ok: false; message: string } {
  if (rate < 0 || rate > 100) {
    return { ok: false, message: "Tax rate must be a number from 0 to 100 with at most 2 decimal places." };
  }
  return { ok: true, rate };
}

export function taxFromRate(baseAmount: number, ratePercent: number): VendorTaxLine {
  const taxAmount = roundMoney((baseAmount * ratePercent) / 100);
  return {
    taxRatePercent: ratePercent,
    taxAmount,
    totalAmount: roundMoney(baseAmount + taxAmount),
    displayRatePercent: ratePercent
  };
}

/** Display-only. Does not change stored invoice or quotation amounts. */
export function deriveTaxRatePercent(baseAmount: number, taxAmount: number): number | null {
  if (!Number.isFinite(baseAmount) || !Number.isFinite(taxAmount)) return null;
  if (baseAmount === 0) return taxAmount === 0 ? 0 : null;
  return roundMoney((taxAmount / baseAmount) * 100);
}

/**
 * When a rate is present the server ignores any client tax amount.
 * A legacy payload with only taxAmount keeps that stored amount and derives a display rate.
 */
export function resolveVendorTaxLine(
  baseAmount: number,
  input: { taxRatePercent?: unknown; taxAmount?: unknown }
): { ok: true; line: VendorTaxLine } | { ok: false; message: string } {
  const hasRate = input.taxRatePercent !== undefined && input.taxRatePercent !== null && input.taxRatePercent !== "";
  if (hasRate) {
    const parsed = parseTaxRatePercent(input.taxRatePercent);
    if (!parsed.ok) return parsed;
    return { ok: true, line: taxFromRate(baseAmount, parsed.rate) };
  }

  const taxRaw = input.taxAmount ?? 0;
  const taxNumber = typeof taxRaw === "string" && taxRaw.trim() !== "" ? Number(taxRaw) : taxRaw;
  if (typeof taxNumber !== "number" || !Number.isFinite(taxNumber) || taxNumber < 0) {
    return { ok: false, message: "Tax amount must be zero or greater." };
  }
  const taxAmount = roundMoney(taxNumber);
  return {
    ok: true,
    line: {
      taxRatePercent: null,
      taxAmount,
      totalAmount: roundMoney(baseAmount + taxAmount),
      displayRatePercent: deriveTaxRatePercent(baseAmount, taxAmount)
    }
  };
}
