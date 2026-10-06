/**
 * Stock count quantities come from two intentional sources:
 * - MaintainPro ledger: per-warehouse `WarehouseItemBalance.onHand` (used for count variance / posting)
 * - ERP snapshot: `SparePart.quantityInStock` (read-only mirror from ERP import; not used as Expected)
 */

export type StockCountLineDisplayInput = {
  expectedQuantity: number;
  countedQuantity: number | null;
  variance: number | null;
  erpSnapshotQuantity?: number | null;
};

export function formatStockCountQuantity(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) {
    return "—";
  }
  return String(value);
}

/** Counted minus MaintainPro ledger qty for this warehouse. Drives posting adjustments. */
export function computeCountVariance(line: Pick<StockCountLineDisplayInput, "countedQuantity" | "expectedQuantity">): number | null {
  if (line.countedQuantity == null || !Number.isFinite(line.countedQuantity)) {
    return null;
  }
  return line.countedQuantity - line.expectedQuantity;
}

/** Informational gap between ERP snapshot and ledger — never used as Expected. */
export function computeErpLedgerGap(
  erpSnapshotQuantity: number | null | undefined,
  ledgerQuantity: number
): number | null {
  if (erpSnapshotQuantity == null || !Number.isFinite(erpSnapshotQuantity)) {
    return null;
  }
  return erpSnapshotQuantity - ledgerQuantity;
}

export function formatStockCountVariance(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) {
    return "—";
  }
  if (value === 0) {
    return "0";
  }
  return value > 0 ? `+${value}` : String(value);
}

export function stockCountVarianceTone(value: number | null | undefined): string {
  if (value == null || value === 0) {
    return "text-slate-700";
  }
  return value > 0 ? "text-amber-700 font-medium" : "text-red-700 font-medium";
}

export const STOCK_COUNT_SOURCE_HELP =
  "MaintainPro Ledger Qty is the warehouse balance used for count variance and posting. ERP Snapshot Qty is the last imported ERP mirror and is shown for comparison only — it is never copied into Expected.";
