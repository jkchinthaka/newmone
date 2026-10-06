import { test } from "node:test";
import assert from "node:assert/strict";

import {
  computeCountVariance,
  computeErpLedgerGap,
  formatStockCountVariance,
  STOCK_COUNT_SOURCE_HELP
} from "../../components/inventory/stock-count-display";

test("computeCountVariance uses ledger qty, not ERP snapshot", () => {
  assert.equal(computeCountVariance({ expectedQuantity: 0, countedQuantity: 145 }), 145);
  assert.equal(computeCountVariance({ expectedQuantity: 10, countedQuantity: 8 }), -2);
  assert.equal(computeCountVariance({ expectedQuantity: 0, countedQuantity: null }), null);
});

test("computeErpLedgerGap is informational only", () => {
  assert.equal(computeErpLedgerGap(145, 0), 145);
  assert.equal(computeErpLedgerGap(null, 0), null);
});

test("formatStockCountVariance signs positive deltas", () => {
  assert.equal(formatStockCountVariance(3), "+3");
  assert.equal(formatStockCountVariance(-2), "-2");
  assert.equal(formatStockCountVariance(0), "0");
});

test("STOCK_COUNT_SOURCE_HELP documents both quantity sources", () => {
  assert.match(STOCK_COUNT_SOURCE_HELP, /MaintainPro Ledger Qty/i);
  assert.match(STOCK_COUNT_SOURCE_HELP, /ERP Snapshot Qty/i);
  assert.match(STOCK_COUNT_SOURCE_HELP, /never copied into Expected/i);
});
