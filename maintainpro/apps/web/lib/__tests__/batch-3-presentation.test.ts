import assert from "node:assert/strict";
import test from "node:test";

import { priorityBadgePresentation, statusBadgePresentation } from "../dashboard-status";
import {
  PART_REQUESTS_TO_ISSUE_AVAILABLE,
  approvalAmountTone,
  columnHasData,
  deriveWorkOrderKpis,
  fleetDocumentBadge,
  fleetGateBadge,
  fleetServiceBadge,
  fleetUsageLabel,
  holdReasonSuffix,
  oldestAgeDays,
  queueNextControl,
  sortOldestFirst,
  visibleTopUsedParts
} from "../batch-3-presentation";

const now = new Date("2026-10-22T00:00:00.000Z");

test("priority and status pills use the batch-3 tones", () => {
  assert.deepEqual(priorityBadgePresentation("HIGH"), { label: "High", tone: "red" });
  assert.deepEqual(priorityBadgePresentation("MEDIUM"), { label: "Medium", tone: "amber" });
  assert.deepEqual(priorityBadgePresentation("LOW"), { label: "Low", tone: "neutral" });
  assert.equal(priorityBadgePresentation(""), null);
  assert.equal(statusBadgePresentation("OPEN").tone, "sky");
  assert.equal(statusBadgePresentation("ASSIGNED").tone, "violet");
  assert.equal(statusBadgePresentation("IN_PROGRESS").tone, "sky");
  assert.equal(statusBadgePresentation("ON_HOLD").tone, "amber");
  assert.equal(statusBadgePresentation("TECHNICIAN_COMPLETED").tone, "fuchsia");
  assert.equal(statusBadgePresentation("CLOSED").tone, "emerald");
  assert.equal(statusBadgePresentation("CANCELLED").tone, "neutral");
});

test("job key numbers hide counts the summary does not provide", () => {
  const cards = deriveWorkOrderKpis({
    queues: [
      { key: "open-requests", count: 44 },
      { key: "unassigned", count: 22 },
      { key: "overdue", count: 1 }
    ],
    openUnassigned: 12
  });
  assert.deepEqual(
    cards.map((card) => card.id),
    ["open", "unassigned", "overdue"]
  );
  assert.equal(cards.find((card) => card.id === "open")?.delta, "12 need assignment");
  assert.equal(cards.find((card) => card.id === "unassigned")?.delta, undefined);
  assert.equal(cards.find((card) => card.id === "overdue")?.tone, "red");
  assert.equal(cards.some((card) => card.label === "Closed this week"), false);
  assert.deepEqual(deriveWorkOrderKpis({ queues: null }), []);
  assert.equal(deriveWorkOrderKpis({ queues: [{ key: "open-requests" }] }).length, 0);
});

test("oldest unassigned age is hidden unless every row has a created time", () => {
  assert.equal(oldestAgeDays([{ createdAt: "2026-10-19T00:00:00.000Z" }, { createdAt: "2026-10-21T00:00:00.000Z" }], now), 3);
  assert.equal(oldestAgeDays([{ createdAt: "2026-10-19T00:00:00.000Z" }, { createdAt: null }], now), null);
  assert.equal(oldestAgeDays([], now), null);
});

test("on hold shows a reason only when the row carries one", () => {
  assert.equal(holdReasonSuffix("ON_HOLD", "Waiting for a bearing", "PARTS"), "Waiting for a bearing");
  assert.equal(holdReasonSuffix("ON_HOLD", "  ", "PARTS"), "parts");
  assert.equal(holdReasonSuffix("ON_HOLD", null, null), null);
  assert.equal(holdReasonSuffix("OPEN", "Waiting", "PARTS"), null);
});

test("next action is a real permitted action, otherwise View", () => {
  assert.deepEqual(queueNextControl({ status: "OPEN", role: "MANAGER", approvalStatus: "APPROVED" }), {
    kind: "action",
    actionId: "assign",
    label: "Assign technician"
  });
  assert.deepEqual(queueNextControl({ status: "OPEN", role: "MANAGER", approvalStatus: "PENDING" }), {
    kind: "action",
    actionId: "approve-assign",
    label: "Approve"
  });
  assert.deepEqual(queueNextControl({ status: "TECHNICIAN_COMPLETED", role: "MANAGER" }), {
    kind: "action",
    actionId: "verify-close",
    label: "Verify & close"
  });
  assert.deepEqual(queueNextControl({ status: "TECHNICIAN_COMPLETED", role: "TECHNICIAN" }), { kind: "view", label: "View" });
  assert.deepEqual(queueNextControl({ status: "CLOSED", role: "ADMIN" }), { kind: "view", label: "View" });
});

test("approval amount tone and oldest-first order", () => {
  assert.equal(approvalAmountTone(118_000), "red");
  assert.equal(approvalAmountTone(100_000), "red");
  assert.equal(approvalAmountTone(42_500), "amber");
  assert.equal(approvalAmountTone(25_000), "amber");
  assert.equal(approvalAmountTone(9_800), "neutral");
  assert.equal(approvalAmountTone(null), null);
  const sorted = sortOldestFirst([
    { id: "new", requestedAt: "2026-10-21T00:00:00.000Z" },
    { id: "old", requestedAt: "2026-10-19T00:00:00.000Z" },
    { id: "missing", requestedAt: null }
  ]);
  assert.deepEqual(sorted.map((item) => item.id), ["old", "new", "missing"]);
});

test("fleet badges hide when the vehicle payload has no date or gate flag", () => {
  assert.deepEqual(fleetServiceBadge("2026-10-19T00:00:00.000Z", now), { label: "Overdue 3 d", tone: "red" });
  assert.deepEqual(fleetServiceBadge("2026-10-28T00:00:00.000Z", now), { label: "In 6 days", tone: "amber" });
  assert.deepEqual(fleetServiceBadge("2026-12-01T00:00:00.000Z", now), { label: "In 40 days", tone: "emerald" });
  assert.equal(fleetServiceBadge(null, now), null);
  assert.deepEqual(fleetDocumentBadge([{ label: "Insurance", at: "2026-11-03T00:00:00.000Z" }], now), {
    label: "Insurance 12 d",
    tone: "amber"
  });
  assert.deepEqual(fleetDocumentBadge([{ label: "Insurance", at: "2027-06-01T00:00:00.000Z" }], now), {
    label: "Valid",
    tone: "emerald"
  });
  assert.equal(fleetDocumentBadge([{ label: "Insurance", at: null }], now), null);
  assert.deepEqual(fleetGateBadge(true), { label: "Blocked", tone: "red" });
  assert.deepEqual(fleetGateBadge(false), { label: "Ready", tone: "emerald" });
  assert.equal(fleetGateBadge(null), null);
  assert.equal(fleetUsageLabel(48210), "48,210 km");
  assert.equal(fleetUsageLabel(null), null);
});

test("spare parts panels stay hidden when the endpoint has no rows", () => {
  assert.equal(PART_REQUESTS_TO_ISSUE_AVAILABLE, false);
  assert.equal(visibleTopUsedParts(null), null);
  assert.equal(visibleTopUsedParts([]), null);
  assert.equal(visibleTopUsedParts([{ partName: " ", quantity: 4 }]), null);
  assert.equal(visibleTopUsedParts([{ partName: "Engine oil", quantity: 64 }])?.length, 1);
});

test("open card never shows more jobs needing assignment than it shows open", () => {
  const queues = [{ key: "open-requests", count: 26 }, { key: "unassigned", count: 26 }];
  const tooMany = deriveWorkOrderKpis({ queues, openUnassigned: 27 });
  assert.equal(tooMany.find((card) => card.id === "open")?.delta, undefined);
  const fine = deriveWorkOrderKpis({ queues, openUnassigned: 12 });
  assert.equal(fine.find((card) => card.id === "open")?.delta, "12 need assignment");
  const negative = deriveWorkOrderKpis({ queues, openUnassigned: -1 });
  assert.equal(negative.find((card) => card.id === "open")?.delta, undefined);
});

test("a table column is hidden only when no row has data for it", () => {
  assert.equal(columnHasData([{ v: null }, { v: "" }, { v: undefined }], (row) => row.v), false);
  assert.equal(columnHasData([{ v: null }, { v: "Ready" }], (row) => row.v), true);
  assert.equal(columnHasData([] as Array<{ v: string }>, (row) => row.v), false);
});
