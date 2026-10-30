import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

const tabs = readFileSync(new URL("../../components/work-orders/work-order-detail-tabs.tsx", import.meta.url), "utf8");
const panel = readFileSync(new URL("../../components/work-orders/work-order-safety-panel.tsx", import.meta.url), "utf8");

test("machine stopped time tab keeps the safety key and drops the readiness card", () => {
  assert.match(tabs, /\{ id: "safety", label: "Machine stopped time" \}/);
  assert.doesNotMatch(tabs, /label: "Safety"/);
  assert.match(panel, /Machine stopped time/);
  assert.match(panel, /\/work-orders\/\$\{workOrderId\}\/downtime/);
  assert.doesNotMatch(panel, /Safety and start readiness/);
  assert.doesNotMatch(panel, /Manage work permits/);
  assert.doesNotMatch(panel, /\/readiness/);
});
