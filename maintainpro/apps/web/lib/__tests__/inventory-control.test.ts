import assert from "node:assert/strict";
import test from "node:test";

import { INVENTORY_EMPTY, inventoryControlFromSearch, inventoryControlSearch, inventoryNextAction } from "../inventory-control";

test("inventory filters and the selected part survive a refresh", () => {
  const state = inventoryControlFromSearch(new URLSearchParams("q=bearing&stock=out&mapped=no&part=part-1&page=2&pageSize=50&sortBy=name&sortDir=asc"));
  assert.equal(state.partId, "part-1");
  assert.equal(state.stock, "out");
  assert.equal(state.mapped, "no");
  assert.equal(inventoryControlSearch(state), "q=bearing&stock=out&mapped=no&sortBy=name&sortDir=asc&part=part-1&page=2&pageSize=50");
  assert.equal(INVENTORY_EMPTY, "No inventory items match these filters.");
});

test("next action follows mapping and the ERP snapshot, not a local ledger", () => {
  const now = new Date("2026-10-09T00:00:00.000Z");
  assert.equal(inventoryNextAction({ erpCode: "", quantityInStock: 10, now }), "Mapping required");
  assert.equal(inventoryNextAction({ erpCode: "ERP-1", quantityInStock: 0, now }), "Check ERP stock");
  assert.equal(inventoryNextAction({ erpCode: "ERP-1", quantityInStock: 4, lastMovementAt: null, now }), "No recent movement");
  assert.equal(inventoryNextAction({ erpCode: "ERP-1", quantityInStock: 4, lastMovementAt: "2026-10-01T00:00:00.000Z", now }), "Ready");
});
