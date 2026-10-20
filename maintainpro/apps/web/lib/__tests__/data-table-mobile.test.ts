import assert from "node:assert/strict";
import test from "node:test";

import { dataTableRowIsKeyboardTarget, getVisibleMobileColumns } from "../data-table-mobile";

test("mobile cards keep columns that are not hidden", () => {
  const columns = [{ id: "a", hideOnMobile: false }, { id: "b", hideOnMobile: true }];
  assert.deepEqual(getVisibleMobileColumns(columns).map((column) => column.id), ["a"]);
});

test("a row click is keyboard accessible only when the row has no separate actions", () => {
  assert.equal(dataTableRowIsKeyboardTarget(true, false), true);
  assert.equal(dataTableRowIsKeyboardTarget(true, true), false);
  assert.equal(dataTableRowIsKeyboardTarget(false, false), false);
});
