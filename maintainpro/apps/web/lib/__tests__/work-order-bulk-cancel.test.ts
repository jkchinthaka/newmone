import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  bulkCancelSummary,
  bulkCancelToast,
  openWorkOrderIds
} from "../../components/work-orders/bulk-cancel";

const rows = [
  { id: "a", status: "OPEN" },
  { id: "b", status: "IN_PROGRESS" },
  { id: "c", status: "OPEN" },
  { id: "d", status: "CANCELLED" }
];

describe("open work order bulk cancel", () => {
  it("keeps only OPEN ids from the selection", () => {
    assert.deepEqual(openWorkOrderIds(["b", "a", "d", "missing"], rows), ["a"]);
    assert.deepEqual(openWorkOrderIds(["c", "a"], rows), ["c", "a"]);
    assert.deepEqual(openWorkOrderIds(["b", "d"], rows), []);
  });

  it("summarizes how many selected rows can be cancelled", () => {
    assert.equal(bulkCancelSummary(4, 1), "1 of 4 selected can be cancelled");
    assert.equal(bulkCancelSummary(2, 0), "0 of 2 selected can be cancelled");
  });

  it("reports cancelled and skipped counts, then the first error", () => {
    assert.equal(bulkCancelToast(2, 3), "2 cancelled, 3 skipped (not OPEN)");
    assert.equal(
      bulkCancelToast(1, 2, "Only OPEN work orders can be cancelled through this action. Use the governed cancel transition for work already in progress."),
      "1 cancelled, 2 skipped (not OPEN). Only OPEN work orders can be cancelled through this action. Use the governed cancel transition for work already in progress."
    );
  });
});
