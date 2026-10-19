/** Live invoice/quotation preview. The server recomputes the stored tax and total. */

export function roundMoney(value: number) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

export function previewVendorTax(baseAmount: number, ratePercent: number) {
  const taxAmount = roundMoney((baseAmount * ratePercent) / 100);
  return {
    taxAmount,
    totalAmount: roundMoney(baseAmount + taxAmount)
  };
}

export function taxRateInputIsValid(raw: string) {
  const text = raw.trim();
  if (!/^\d{1,3}(\.\d{1,2})?$/.test(text)) return false;
  const rate = Number(text);
  return rate >= 0 && rate <= 100;
}

export function deriveTaxRatePercent(baseAmount: number, taxAmount: number) {
  if (!Number.isFinite(baseAmount) || !Number.isFinite(taxAmount) || baseAmount === 0) {
    return baseAmount === 0 && taxAmount === 0 ? 0 : null;
  }
  return roundMoney((taxAmount / baseAmount) * 100);
}
