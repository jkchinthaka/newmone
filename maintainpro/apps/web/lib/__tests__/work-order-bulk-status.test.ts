import assert from "node:assert/strict";
import { test } from "node:test";

import { buildBulkStatusItems, remainingBulkSelection, summarizeBulkStatusResults } from "../work-order-bulk-status";

test("each selected row sends its own version", () => {
  const rows = [
    { id: "a", version: 3 },
    { id: "b", version: 9 },
    { id: "c", version: 1 }
  ];
  assert.deepEqual(buildBulkStatusItems(["b", "a"], rows), {
    items: [
      { id: "b", expectedVersion: 9 },
      { id: "a", expectedVersion: 3 }
    ],
    missing: []
  });
});

test("rows without a loaded version are reported, never sent without one", () => {
  const result = buildBulkStatusItems(["a", "gone"], [{ id: "a", version: 2 }, { id: "x" }]);
  assert.deepEqual(result.items, [{ id: "a", expectedVersion: 2 }]);
  assert.deepEqual(result.missing, ["gone"]);
});

test("summary counts each outcome and keeps per-row messages", () => {
  const summary = summarizeBulkStatusResults(
    [
      { id: "a", outcome: "ok" },
      { id: "b", outcome: "conflict", message: "changed" },
      { id: "c", outcome: "error", message: "not allowed" }
    ],
    { a: "WO-1", b: "WO-2", c: "WO-3" }
  );
  assert.equal(summary.ok, 1);
  assert.equal(summary.conflict, 1);
  assert.equal(summary.error, 1);
  assert.deepEqual(summary.lines, [
    "WO-2: changed by someone else — refreshed",
    "WO-3: not allowed"
  ]);
});

test("retry keeps conflict and error rows and drops successes", () => {
  assert.deepEqual(
    remainingBulkSelection(["a", "b", "c"], [
      { id: "a", outcome: "ok" },
      { id: "b", outcome: "conflict" },
      { id: "c", outcome: "error" }
    ]),
    ["b", "c"]
  );
});
