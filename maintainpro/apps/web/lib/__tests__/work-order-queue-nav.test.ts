import assert from "node:assert/strict";
import test from "node:test";

import {
  activeQueueFilterChips,
  formatQueueDue,
  nextActionLabel,
  queueFiltersAfterChipRemove,
  splitQueueTabs,
  writeQueueFiltersToSearch
} from "../work-order-queue-nav";
import {
  buildQueueListSearchParams,
  DEFAULT_QUEUE_FILTERS,
  queueFiltersFromSearch,
  workOrderQueueRequestKey
} from "../work-order-queues-api";

test("primary queues stay visible and secondary queues move into More", () => {
  const queues = [
    { key: "action-required" as const, label: "Action Required", count: 2 },
    { key: "my-tasks" as const, label: "My Tasks", count: 1 },
    { key: "open-requests" as const, label: "Open Requests", count: 4 },
    { key: "open-load" as const, label: "Open Load", count: 8 },
    { key: "waiting-evidence" as const, label: "Waiting Evidence", count: 3 },
    { key: "all" as const, label: "All", count: 9 },
    { key: "overdue" as const, label: "Overdue", count: 1 }
  ];
  const split = splitQueueTabs(queues);
  assert.deepEqual(
    split.primary.map((queue) => queue.label),
    ["Action Required", "My Tasks", "Open", "Overdue"]
  );
  assert.deepEqual(
    split.more.map((queue) => queue.key),
    ["waiting-evidence", "open-load", "all"]
  );
  assert.equal(split.primary.find((queue) => queue.key === "open-requests")?.count, 4);
  assert.equal(split.more.find((queue) => queue.key === "open-load")?.label, "Open Load");
});

test("queue selection and filters round-trip through the URL", () => {
  const params = new URLSearchParams("wo=abc&filter=in-progress");
  writeQueueFiltersToSearch(params, {
    ...DEFAULT_QUEUE_FILTERS,
    queue: "overdue",
    priority: "HIGH",
    query: "pump",
    overdueOnly: true,
    page: 2
  });
  assert.equal(params.get("wo"), "abc");
  assert.equal(params.get("queue"), "overdue");
  assert.equal(params.get("filter"), null);
  const restored = queueFiltersFromSearch({
    queue: params.get("queue"),
    priority: params.get("priority"),
    q: params.get("q"),
    overdueOnly: params.get("overdueOnly"),
    page: params.get("page")
  });
  assert.equal(restored.queue, "overdue");
  assert.equal(restored.priority, "HIGH");
  assert.equal(restored.query, "pump");
  assert.equal(restored.overdueOnly, true);
  assert.equal(restored.page, 2);
});

test("assignee and domain filters are sent to the queue request", () => {
  const params = buildQueueListSearchParams({
    ...DEFAULT_QUEUE_FILTERS,
    technicianId: "user-1",
    jobDomain: "VEHICLE",
    evidenceStatus: "Missing",
    query: "WO-10"
  });
  assert.equal(params.get("technicianId"), "user-1");
  assert.equal(params.get("jobDomain"), "VEHICLE");
  assert.equal(params.get("evidenceStatus"), "Missing");
  assert.equal(params.get("search"), "WO-10");
  assert.equal(params.get("pageSize"), "25");
});

test("active filter chips can be listed and cleared by key", () => {
  const chips = activeQueueFilterChips({
    ...DEFAULT_QUEUE_FILTERS,
    priority: "HIGH",
    overdueOnly: true,
    unassigned: true
  });
  assert.deepEqual(
    chips.map((chip) => chip.label),
    ["HIGH", "Overdue", "Unassigned"]
  );
  assert.equal(queueFiltersAfterChipRemove("priority").priority, "ALL");
  assert.equal(queueFiltersAfterChipRemove("overdueOnly").overdueOnly, false);
  assert.equal(queueFiltersAfterChipRemove("unassigned").unassigned, false);
  assert.deepEqual(queueFiltersAfterChipRemove("dates"), { dateFrom: "", dateTo: "", page: 1 });
});

test("due dates show overdue and upcoming hints", () => {
  const now = new Date("2026-10-08T00:00:00.000Z");
  assert.equal(formatQueueDue("2026-10-04T00:00:00.000Z", 4, now).hint, "4d overdue");
  assert.equal(formatQueueDue("2026-10-04T00:00:00.000Z", 4, now).overdue, true);
  assert.equal(formatQueueDue("2026-10-10T00:00:00.000Z", 0, now).hint, "Due in 2d");
  assert.equal(formatQueueDue(null, 0, now).date, "No due date");
});

test("queue requests stay on the current page and change when the page or filter changes", () => {
  const first = workOrderQueueRequestKey({ ...DEFAULT_QUEUE_FILTERS, queue: "assigned", query: "a" });
  const second = workOrderQueueRequestKey({ ...DEFAULT_QUEUE_FILTERS, queue: "assigned", page: 2 });
  const filtered = workOrderQueueRequestKey({
    ...DEFAULT_QUEUE_FILTERS,
    queue: "assigned",
    priority: "HIGH",
    query: "belt"
  });
  assert.equal(new URLSearchParams(first).get("page"), "1");
  assert.equal(new URLSearchParams(first).get("search"), null);
  assert.equal(new URLSearchParams(second).get("page"), "2");
  assert.notEqual(first, second);
  assert.equal(new URLSearchParams(filtered).get("priority"), "HIGH");
  assert.equal(new URLSearchParams(filtered).get("search"), "belt");
  assert.equal(new URLSearchParams(filtered).get("page"), "1");
});

test("next action prefers the server action, then parts and evidence", () => {
  assert.equal(nextActionLabel({ actionRequired: [{ label: "Approval pending", severity: "HIGH" }] }).label, "Approval pending");
  assert.equal(nextActionLabel({ partsStatus: "Waiting issue" }).label, "Waiting for parts");
  assert.equal(nextActionLabel({ evidenceStatus: "Missing" }).label, "Evidence missing");
  assert.equal(nextActionLabel({ status: "VERIFIED" }).label, "Ready");
});
