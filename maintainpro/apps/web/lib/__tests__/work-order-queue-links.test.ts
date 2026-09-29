import assert from "node:assert/strict";
import test from "node:test";

import { queueFiltersFromSearch } from "../work-order-queues-api";

test("dashboard overdue smart view opens the overdue queue", () => {
  assert.equal(queueFiltersFromSearch({ smartView: "overdue" }).queue, "overdue");
});

test("dashboard status links open the matching queue and keep the status", () => {
  assert.deepEqual(queueFiltersFromSearch({ status: "OPEN" }), {
    queue: "open-requests",
    status: "OPEN"
  });
  assert.deepEqual(queueFiltersFromSearch({ status: "IN_PROGRESS" }), {
    queue: "in-progress",
    status: "IN_PROGRESS"
  });
  assert.deepEqual(queueFiltersFromSearch({ status: "ON_HOLD" }), {
    queue: "in-progress",
    status: "ON_HOLD"
  });
  assert.equal(queueFiltersFromSearch({ status: "REWORK_REQUIRED" }).queue, "rework-required");
});

test("critical priority opens the high-priority queue", () => {
  assert.deepEqual(queueFiltersFromSearch({ priority: "CRITICAL" }), {
    queue: "high-priority",
    priority: "CRITICAL"
  });
});

test("an explicit queue wins over a status guess", () => {
  assert.equal(queueFiltersFromSearch({ queue: "overdue", status: "OPEN" }).queue, "overdue");
});

test("unassigned dashboard link opens the unassigned queue", () => {
  assert.equal(queueFiltersFromSearch({ queue: "unassigned" }).queue, "unassigned");
});
