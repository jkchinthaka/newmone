import assert from "node:assert/strict";
import { test } from "node:test";

import { queueFiltersFromSearch } from "../work-order-queues-api";

test("dashboard overdue smart view selects the overdue queue", () => {
  assert.equal(queueFiltersFromSearch({ smartView: "overdue" }).queue, "overdue");
});

test("dashboard waiting-parts smart view selects that queue", () => {
  assert.equal(queueFiltersFromSearch({ smartView: "waiting-parts" }).queue, "waiting-parts");
});

test("an in-progress status link keeps the status so on-hold jobs stay out", () => {
  const filters = queueFiltersFromSearch({ status: "IN_PROGRESS" });
  assert.equal(filters.queue, "in-progress");
  assert.equal(filters.status, "IN_PROGRESS");
});

test("an explicit queue wins over a smart view", () => {
  assert.equal(
    queueFiltersFromSearch({ queue: "overdue", smartView: "waiting-parts" }).queue,
    "overdue"
  );
});
