export function roundMoney(n: number): number {
  return Math.round(n * 100) / 100;
}

export type PurchaseOrderLineInput = {
  quantity: number;
  unitCost: number;
};

export function calculateLineTotal(quantity: number, unitCost: number): number {
  return roundMoney(quantity * unitCost);
}

export function calculatePurchaseOrderTotals(lines: PurchaseOrderLineInput[]): {
  lineTotals: number[];
  headerTotal: number;
} {
  const lineTotals = lines.map((line) => calculateLineTotal(line.quantity, line.unitCost));
  const headerTotal = roundMoney(lineTotals.reduce((sum, value) => sum + value, 0));
  return { lineTotals, headerTotal };
}

export function clientTotalMismatch(serverTotal: number, clientTotal?: number | null): boolean {
  if (clientTotal == null || Number.isNaN(Number(clientTotal))) {
    return false;
  }
  return Math.abs(roundMoney(Number(clientTotal)) - serverTotal) > 0.009;
}
